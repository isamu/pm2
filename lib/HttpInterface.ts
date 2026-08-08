/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { cpus, freemem, hostname, loadavg, networkInterfaces, totalmem, uptime } from 'node:os';
import { createRequire } from 'node:module';
import cst from '../constants.js';

const STATUS_OK = 200;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

interface ProcessEntry {
  pm2_env?: { env?: unknown };
}

interface Pm2Api {
  list: (cb: (err: Error | null, list: ProcessEntry[]) => void) => void;
  connect?: (cb: () => void) => void;
}

interface HandlerOptions {
  stripEnvVars?: boolean;
}

const setHeaders = (res: ServerResponse): void => {
  // Wide open on purpose so a browser can fetch the listing directly. Anyone who can reach the
  // port can read every process's environment unless WEB_STRIP_ENV_VARS is set.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
};

const respond = (res: ServerResponse, status: number, payload: unknown): void => {
  res.statusCode = status;
  res.write(JSON.stringify(payload));
  res.end();
};

const systemSnapshot = (processes: ProcessEntry[]) => ({
  system_info: { hostname: hostname(), uptime: uptime() },
  monit: {
    loadavg: loadavg(),
    total_mem: totalmem(),
    free_mem: freemem(),
    cpu: cpus(),
    interfaces: networkInterfaces(),
  },
  processes,
});

const withoutEnv = (processes: ProcessEntry[]): ProcessEntry[] =>
  processes.map((proc) => {
    if (!proc.pm2_env || proc.pm2_env.env === undefined) return proc;
    const pm2_env = Object.fromEntries(
      Object.entries(proc.pm2_env).filter(([key]) => key !== 'env'),
    );
    return { ...proc, pm2_env };
  });

const handleRequest = (
  pm2: Pm2Api,
  req: Pick<IncomingMessage, 'url'>,
  res: ServerResponse,
  options: HandlerOptions = {},
): void => {
  setHeaders(res);

  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path !== '/') return respond(res, NOT_FOUND, { err: '404' });

  pm2.list((err, list) => {
    // This branch called res.send, which is Express and not on http.ServerResponse, so a daemon
    // that could not answer took the whole web interface down with a TypeError.
    if (err) return respond(res, SERVER_ERROR, { err: err.message });

    const processes = options.stripEnvVars ? withoutEnv(list) : list;
    respond(res, STATUS_OK, systemSnapshot(processes));
  });
};

const startWebServer = (pm2: Pm2Api): void => {
  const port = Number(process.env.PM2_WEB_PORT) || cst.WEB_PORT;
  const options: HandlerOptions = { stripEnvVars: Boolean(cst.WEB_STRIP_ENV_VARS) };

  createServer((req, res) => handleRequest(pm2, req, res, options)).listen(
    port,
    cst.WEB_IPADDR,
    () => {
      console.log('Web interface listening on  %s:%s', cst.WEB_IPADDR, port);
    },
  );
};

// Started only when pm2 forks this file as a process. Requiring it — which the tests do, to
// exercise the handler without a daemon or a port — must not open a socket.
if (require.main === module) {
  const pm2: Pm2Api = createRequire(__filename)('../index.js');
  pm2.connect?.(() => startWebServer(pm2));
}

export = { handleRequest, startWebServer };
