'use strict';

import http from 'node:http';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import cst from '../../../../constants.js';
import { codeOf } from '../../../tools/errors.js';

// Neither ships types. Each is asked for one thing, written out here.
const requireFrom = createRequire(__filename);
const AuthStrategy: new () => object = requireFrom('@pm2/js-api/src/auth_strategies/strategy');
const tryEach: (
  tasks: ((next: TryNext) => void)[],
  done: (err: unknown, result?: Tokens) => void,
) => void = requireFrom('async/tryEach');

type TryNext = (err: unknown, result?: Tokens) => void;

interface Tokens {
  access_token?: string;
  refresh_token?: string;
  expire_at?: string | number;
}

interface KmClient {
  auth: {
    retrieveToken(opts: { client_id: unknown; refresh_token: unknown }): Promise<{ data: Tokens }>;
    revoke(): Promise<unknown>;
  };
}

type TokenCallback = (err: unknown, tokens?: Tokens) => void;
type OpenCallback = (err: Error | null) => void;

class WebStrategy extends AuthStrategy {
  declare authenticated: boolean;
  declare callback: TokenCallback;
  declare km: KmClient;
  declare client_id: unknown;
  declare oauth_endpoint: string;
  declare oauth_query: string;

  // the client will try to call this but we handle this part ourselves
  retrieveTokens(km: KmClient, cb: TokenCallback) {
    this.authenticated = false;
    this.callback = cb;
    this.km = km;
  }

  // so the cli know if we need to tell user to login/register
  isAuthenticated(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (this.authenticated) return resolve(true);

      const tokensPath = cst.PM2_IO_ACCESS_TOKEN;
      fs.readFile(tokensPath, 'utf8', (err, contents) => {
        if (err && codeOf(err) === 'ENOENT') return resolve(false);
        if (err) return reject(err);

        // verify that the token is valid
        let tokens: Tokens;
        try {
          tokens = JSON.parse(contents || '{}');
        } catch {
          fs.unlinkSync(tokensPath);
          return resolve(false);
        }

        // if the refresh tokens is here, the user could be automatically authenticated
        return resolve(typeof tokens.refresh_token === 'string');
      });
    });
  }

  // called when we are sure the user asked to be logged in
  _retrieveTokens(optionalCallback?: TokenCallback) {
    const km = this.km;
    const cb = this.callback;

    const verifyToken = (refresh: unknown) => {
      return km.auth.retrieveToken({
        client_id: this.client_id,
        refresh_token: refresh,
      });
    };
    tryEach(
      [
        // try to find the token via the environment
        (next: TryNext) => {
          if (!process.env.PM2_IO_TOKEN) {
            return next(new Error('No token in env'));
          }
          verifyToken(process.env.PM2_IO_TOKEN)
            .then((res) => {
              return next(null, res.data);
            })
            .catch(next);
        },
        // try to find it in the file system
        (next: TryNext) => {
          fs.readFile(cst.PM2_IO_ACCESS_TOKEN, 'utf8', (err, contents) => {
            if (err) return next(err);
            // verify that the token is valid
            const tokens: Tokens = JSON.parse(contents || '{}');
            if (new Date(tokens.expire_at ?? 0) > new Date(new Date().toISOString())) {
              return next(null, tokens);
            }

            verifyToken(tokens.refresh_token)
              .then((res) => {
                return next(null, res.data);
              })
              .catch(next);
          });
        },
        // otherwise make the whole flow
        (next: TryNext) => {
          return this.loginViaWeb((data: Tokens) => {
            // verify that the token is valid
            verifyToken(data.access_token)
              .then((res) => {
                return next(null, res.data);
              })
              .catch((err) => next(err));
          });
        },
      ],
      (err, result) => {
        // if present run the optional callback
        if (typeof optionalCallback === 'function') {
          optionalCallback(err, result);
        }

        if (result?.refresh_token) {
          this.authenticated = true;
          const file = cst.PM2_IO_ACCESS_TOKEN;
          fs.writeFile(file, JSON.stringify(result), () => {
            return cb(err, result);
          });
        } else {
          return cb(err, result);
        }
      },
    );
  }

  loginViaWeb(cb: (query: Tokens) => void) {
    const redirectURL = `${this.oauth_endpoint}${this.oauth_query}`;

    console.log(
      `${cst.PM2_IO_MSG} Please follow the popup or go to this URL :`,
      '\n',
      '    ',
      redirectURL,
    );

    let shutdown = false;
    const server = http.createServer((req, res) => {
      // only handle one request
      if (shutdown === true) return res.end();
      shutdown = true;

      const query: Tokens = Object.fromEntries(
        new URL(req.url ?? '/', 'http://localhost').searchParams,
      );

      res.write(`
        <head>
          <script>
          </script>
        </head>
        <body>
          <h2 style="text-align: center">
            You can go back to your terminal now :)
          </h2>
        </body>`);
      res.end();
      server.close();
      return cb(query);
    });
    server.listen(43532, () => {
      this.open(redirectURL);
    });
  }

  deleteTokens(km: KmClient) {
    return new Promise((resolve, reject) => {
      // revoke the refreshToken
      km.auth
        .revoke()
        .then((res) => {
          // remove the token from the filesystem
          const file = cst.PM2_IO_ACCESS_TOKEN;
          fs.unlinkSync(file);
          return resolve(res);
        })
        .catch(reject);
    });
  }

  open(target: string, appNameOrCallback?: string | OpenCallback, maybeCallback?: OpenCallback) {
    // Called either as open(target, cb) or open(target, appName, cb).
    const callback = typeof appNameOrCallback === 'function' ? appNameOrCallback : maybeCallback;
    const appName = typeof appNameOrCallback === 'string' ? appNameOrCallback : undefined;

    let cmd: string;
    let args: string[] = [];

    switch (process.platform) {
      case 'darwin': {
        cmd = 'open';
        if (appName) args.push('-a', appName);
        args.push(target);
        break;
      }
      case 'win32': {
        cmd = 'cmd';
        args = ['/c', 'start', '""'];
        if (appName) args.push(appName);
        args.push(target);
        break;
      }
      default: {
        cmd = appName || 'xdg-open';
        args.push(target);
        break;
      }
    }

    if (process.env.SUDO_USER) {
      if (!/^[a-zA-Z0-9._-]+$/.test(process.env.SUDO_USER)) {
        return callback && callback(new Error('Invalid SUDO_USER'));
      }
      args = ['-u', process.env.SUDO_USER, cmd].concat(args);
      cmd = 'sudo';
    }

    return execFile(cmd, args, callback);
  }
}

export = WebStrategy;
