/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * Common Utilities ONLY USED IN ->DAEMON<-
 */

import fs from 'node:fs';
import util from 'node:util';
import { createRequire } from 'node:module';
import dayjs from 'dayjs';
import cst from '../constants.js';

// Three JavaScript modules with no types of their own. Each is asked for one thing, said here.
const requireFrom = createRequire(__filename);
const fclone: (obj: unknown) => Record<string, unknown> = requireFrom('../modules/fclone');
const waterfall: (tasks: unknown[], done: (err?: Error) => void) => void =
  requireFrom('async/waterfall');
const findPackageJson: (path: string) => { next(): { value?: { version?: string } } } = requireFrom(
  './tools/find-package-json',
);

// The daemon passes plain JSON around: process descriptors, environments, log maps. Naming a
// shape here would name it in one place out of many, so these say only what this file needs —
// that the value is an object it may read and write by key.
type Mutable = Record<string, unknown>;

// startLogging is handed a map of paths and replaces each with an open stream, in place —
// except the ones that mean "discard", which stay the string they arrived as.
type LogTarget = string | (NodeJS.WritableStream & { fd?: number });
type LogTargets = Record<string, LogTarget>;
interface ProcHolder {
  pm2_env?: Mutable;
  [key: string]: unknown;
}
interface OptsHolder {
  env?: { current_conf?: Mutable };
  [key: string]: unknown;
}

const Utility = {
  findPackageVersion: function (fullpath: string): string {
    let version: string;

    try {
      version = findPackageJson(fullpath).next().value?.version ?? 'N/A';
    } catch (e) {
      version = 'N/A';
    }
    return version;
  },
  getDate: function () {
    return Date.now();
  },
  extendExtraConfig: function (proc: ProcHolder, opts: OptsHolder): void {
    if (opts.env && opts.env.current_conf) {
      if (
        opts.env.current_conf.env &&
        typeof opts.env.current_conf.env === 'object' &&
        Object.keys(opts.env.current_conf.env).length === 0
      )
        delete opts.env.current_conf.env;

      Utility.extendMix(proc.pm2_env ?? {}, opts.env.current_conf);
      delete opts.env.current_conf;
    }
  },
  formatCLU: function (process: ProcHolder): Mutable {
    if (!process.pm2_env) {
      return process;
    }

    const obj = Utility.clone(process.pm2_env ?? {});
    delete obj.env;

    return obj;
  },
  extend: function (destination: Mutable, source?: Mutable | null): Mutable {
    if (!source || typeof source != 'object') return destination;

    Object.keys(source).forEach(function (new_key) {
      if (source[new_key] != '[object Object]') destination[new_key] = source[new_key];
    });

    return destination;
  },
  // Same as extend but drop value with 'null'
  extendMix: function (destination: Mutable, source?: Mutable | null): Mutable {
    if (!source || typeof source != 'object') return destination;

    Object.keys(source).forEach(function (new_key) {
      if (source[new_key] == 'null') delete destination[new_key];
      else destination[new_key] = source[new_key];
    });

    return destination;
  },

  whichFileExists: function (file_arr: string[]): string | null {
    let f: string | null = null;

    file_arr.some(function (file) {
      try {
        fs.statSync(file);
      } catch (e) {
        return false;
      }
      f = file;
      return true;
    });
    return f;
  },
  clone: function (obj: unknown): Mutable {
    if (obj === null || obj === undefined) return {};
    return fclone(obj);
  },
  overrideConsole: function (bus?: { emit(event: string, packet: unknown): void }): void {
    if (cst.PM2_LOG_DATE_FORMAT && typeof cst.PM2_LOG_DATE_FORMAT == 'string') {
      // Generate timestamp prefix
      function timestamp() {
        return `${dayjs(Date.now()).format(cst.PM2_LOG_DATE_FORMAT)}:`;
      }

      const hacks = ['info', 'log', 'error', 'warn'];
      const consoled: Record<string, (...args: unknown[]) => void> = {};

      // store console functions.
      hacks.forEach(function (method) {
        const original = Reflect.get(console, method);
        if (typeof original === 'function') consoled[method] = original.bind(console);
      });

      hacks.forEach(function (k) {
        Reflect.set(console, k, function (this: unknown, ...args: unknown[]) {
          if (bus) {
            bus.emit('log:PM2', {
              process: {
                pm_id: 'PM2',
                name: 'PM2',
                rev: null,
              },
              at: Utility.getDate(),
              data: util.format.apply(this, args) + '\n',
            });
          }
          // do not destroy variable insertion
          args[0] && (args[0] = timestamp() + ' PM2 ' + k + ': ' + args[0]);
          consoled[k].apply(console, args);
        });
      });
    }
  },
  startLogging: function (stds: LogTargets, callback: (err?: Error) => void): void {
    /**
     * Start log outgoing messages
     * @method startLogging
     * @param {} callback
     * @return
     */
    // Make sure directories of `logs` and `pids` exist.
    // try {
    //   ['logs', 'pids'].forEach(function(n){
    //     console.log(n);
    //     (function(_path){
    //       !fs.existsSync(_path) && fs.mkdirSync(_path, '0755');
    //     })(path.resolve(cst.PM2_ROOT_PATH, n));
    //   });
    // } catch(err) {
    //   return callback(new Error('can not create directories (logs/pids):' + err.message));
    // }

    // waterfall.
    const flows: ((next: (err?: Error) => void) => void)[] = [];
    // types of stdio, should be sorted as `std(entire log)`, `out`, `err`.
    const types = Object.keys(stds).sort(function (x, y) {
      return -x.charCodeAt(0) + y.charCodeAt(0);
    });

    // Create write streams.
    // Each turn is handed a one-element splice of `types`, so the list shrinks as it recurses
    // and an empty splice is what ends it.
    (function createWS(next_type: string[]) {
      if (next_type.length != 1) {
        return false;
      }
      const io = next_type[0];

      // If `std` is a Stream type, try next `std`.
      // compatible with `pm2 reloadLogs`
      // Already an open stream — `pm2 reloadLogs` hands those back — so leave it and move on.
      const existing = stds[io];
      if (typeof existing === 'object' && existing !== null && !isNaN(Number(existing.fd))) {
        return createWS(types.splice(0, 1));
      }

      flows.push(function (next: (err?: Error) => void) {
        const file = stds[io];

        // if file contains ERR or /dev/null, dont try to create stream since he dont want logs
        if (typeof file !== 'string' || file.indexOf('NULL') > -1 || file.indexOf('/dev/null') > -1)
          return next();

        const stream = fs
          .createWriteStream(file, { flags: 'a' })
          .once('error', next)
          .on('open', function () {
            stream.removeListener('error', next);

            stream.on('error', function (err: Error) {
              console.error(err);
            });

            next();
          });
        // Read back by reloadLogs to reopen the same path.
        Reflect.set(stream, '_file', file);
        stds[io] = stream;
      });
      return createWS(types.splice(0, 1));
    })(types.splice(0, 1));

    waterfall(flows, callback);
  },

  /**
   * Function parse the module name and returns it as canonic:
   * - Makes the name based on installation filename.
   * - Removes the Github author, module version and git branch from original name.
   *
   * @param {string} module_name
   * @returns {string} Canonic module name (without trimed parts).
   * @example Always returns 'pm2-slack' for inputs 'ma-zal/pm2-slack', 'ma-zal/pm2-slack#own-branch',
   *          'pm2-slack-1.0.0.tgz' or 'pm2-slack@1.0.0'.
   */
  getCanonicModuleName: function (module_name: unknown): string | null {
    if (typeof module_name !== 'string') return null;
    let canonic_module_name = module_name;

    // Returns the module name from a .tgz package name (or the original name if it is not a valid pkg).
    // Input: The package name (e.g. "foo.tgz", "foo-1.0.0.tgz", "folder/foo.tgz")
    // Output: The module name
    if (canonic_module_name.match(/\.tgz($|\?)/)) {
      // Matched once and the result kept, rather than matched to test and matched again to
      // read — same expressions, same order.
      const packaged = canonic_module_name.match(/^(.+\/)?([^\/]+)\.tgz($|\?)/);
      if (packaged) {
        canonic_module_name = packaged[2];
        const versioned = canonic_module_name.match(
          /^(.+)-[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9_]+\.[0-9]+)?$/,
        );
        if (versioned) canonic_module_name = versioned[1];
      }
    }

    //pm2 install git+https://github.com/user/module
    if (canonic_module_name.indexOf('git+') !== -1) {
      canonic_module_name = canonic_module_name.split('/').pop() ?? canonic_module_name;
    }

    //pm2 install https://github.com/user/module
    if (
      canonic_module_name.indexOf('http://') !== -1 ||
      canonic_module_name.indexOf('https://') !== -1
    ) {
      const uri = new URL(canonic_module_name);
      canonic_module_name = uri.pathname.split('/').pop() ?? canonic_module_name;
    }

    //pm2 install file:///home/user/module
    else if (canonic_module_name.indexOf('file://') === 0) {
      canonic_module_name =
        canonic_module_name.replace(/\/$/, '').split('/').pop() ?? canonic_module_name;
    }

    //pm2 install username/module
    else if (canonic_module_name.indexOf('/') !== -1) {
      if (canonic_module_name.charAt(0) !== '@') {
        canonic_module_name = canonic_module_name.split('/')[1] ?? canonic_module_name;
      }
    }

    //pm2 install @somescope/module@2.1.0-beta
    if (canonic_module_name.lastIndexOf('@') > 0) {
      canonic_module_name = canonic_module_name.substr(0, canonic_module_name.lastIndexOf('@'));
    }

    //pm2 install module#some-branch
    if (canonic_module_name.indexOf('#') !== -1) {
      canonic_module_name = canonic_module_name.split('#')[0];
    }

    if (canonic_module_name.indexOf('.git') !== -1) {
      canonic_module_name = canonic_module_name.replace('.git', '');
    }

    return canonic_module_name;
  },

  checkPathIsNull: function (path: unknown): boolean {
    return path === 'NULL' || path === '/dev/null' || path === '\\\\.\\NUL';
  },

  generateUUID: function () {
    const s = [];
    const hexDigits = '0123456789abcdef';
    for (let i = 0; i < 36; i++) {
      s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = '4';
    // s[19] is a hex character, and `& 0x3` on it converts through Number — so 'a'..'f' give
    // NaN, which masks to 0. Spelled out rather than left to the operator, and answering the
    // same 8..b variant nibble it always has.
    s[19] = hexDigits.substr((Number(s[19]) & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = '-';
    return s.join('');
  },
};

export = Utility;
