/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import createDebug from 'debug';

const debug = createDebug('pm2:paths');

interface Pm2Paths {
  PM2_HOME: string;
  PM2_ROOT_PATH: string;
  PM2_CONF_FILE: string;
  PM2_MODULE_CONF_FILE: string;
  PM2_LOG_FILE_PATH: string;
  PM2_PID_FILE_PATH: string;
  PM2_RELOAD_LOCKFILE: string;
  DEFAULT_PID_PATH: string;
  DEFAULT_LOG_PATH: string;
  DEFAULT_MODULE_PATH: string;
  PM2_IO_ACCESS_TOKEN: string;
  DUMP_FILE_PATH: string;
  DUMP_BACKUP_FILE_PATH: string;
  DAEMON_RPC_PORT: string;
  DAEMON_PUB_PORT: string;
  INTERACTOR_RPC_PORT: string;
  INTERACTOR_LOG_FILE_PATH: string;
  INTERACTOR_PID_PATH: string;
  INTERACTION_CONF: string;
  HAS_NODE_EMBEDDED: boolean;
  BUILTIN_NODE_PATH: string | null;
  BUILTIN_NPM_PATH: string | null;
}

// Never overridden from the environment: PM2_HOME is the root every other path is derived
// from, so letting it move after the fact would leave the rest pointing somewhere else.
const FIXED_PATHS = ['PM2_HOME', 'PM2_ROOT_PATH'];

const WINDOWS_PIPES = {
  DAEMON_RPC_PORT: '\\\\.\\pipe\\rpc.sock',
  DAEMON_PUB_PORT: '\\\\.\\pipe\\pub.sock',
  INTERACTOR_RPC_PORT: '\\\\.\\pipe\\interactor.sock',
};

const getDefaultPM2Home = (): string => {
  if (process.env.PM2_HOME) return process.env.PM2_HOME;

  const home = homedir();
  if (home) {
    const resolved = resolve(home, '.pm2');
    debug('pm2 home resolved to %s', resolved);
    return resolved;
  }

  console.error('[PM2][Initialization] Could not determine home directory!');
  console.error('[PM2][Initialization] Defaulting to /etc/.pm2');
  return resolve('/etc', '.pm2');
};

const isWindows = (): boolean => process.platform === 'win32';

// A path may be overridden by an environment variable of the same name, prefixed with PM2_ when
// it does not already carry one. Read through a Map: looking the name up on process.env itself
// would be a dynamic property access on an object with a prototype.
const envOverride = (environment: Map<string, string | undefined>, key: string) => {
  if (FIXED_PATHS.includes(key)) return undefined;
  const envKey = key.includes('PM2_') ? key : `PM2_${key}`;
  return environment.get(envKey) || undefined;
};

const applyOverrides = (paths: Pm2Paths): Pm2Paths => {
  const environment = new Map(Object.entries(process.env));
  const entries = Object.entries(paths).map(([key, value]) => [
    key,
    envOverride(environment, key) ?? value,
  ]);
  return Object.assign(paths, Object.fromEntries(entries));
};

const pm2Paths = (requestedHome?: string): Pm2Paths => {
  const hasNodeEmbedded = existsSync(resolve(__dirname, './node'));
  const pm2Home = requestedHome || getDefaultPM2Home();

  const paths: Pm2Paths = {
    PM2_HOME: pm2Home,
    PM2_ROOT_PATH: pm2Home,

    PM2_CONF_FILE: resolve(pm2Home, 'conf.js'),
    PM2_MODULE_CONF_FILE: resolve(pm2Home, 'module_conf.json'),

    PM2_LOG_FILE_PATH: resolve(pm2Home, 'pm2.log'),
    PM2_PID_FILE_PATH: resolve(pm2Home, 'pm2.pid'),

    PM2_RELOAD_LOCKFILE: resolve(pm2Home, 'reload.lock'),

    DEFAULT_PID_PATH: resolve(pm2Home, 'pids'),
    DEFAULT_LOG_PATH: resolve(pm2Home, 'logs'),
    DEFAULT_MODULE_PATH: resolve(pm2Home, 'modules'),
    PM2_IO_ACCESS_TOKEN: resolve(pm2Home, 'pm2-io-token'),
    DUMP_FILE_PATH: resolve(pm2Home, 'dump.pm2'),
    DUMP_BACKUP_FILE_PATH: resolve(pm2Home, 'dump.pm2.bak'),

    DAEMON_RPC_PORT: resolve(pm2Home, 'rpc.sock'),
    DAEMON_PUB_PORT: resolve(pm2Home, 'pub.sock'),
    INTERACTOR_RPC_PORT: resolve(pm2Home, 'interactor.sock'),

    INTERACTOR_LOG_FILE_PATH: resolve(pm2Home, 'agent.log'),
    INTERACTOR_PID_PATH: resolve(pm2Home, 'agent.pid'),
    INTERACTION_CONF: resolve(pm2Home, 'agent.json5'),

    HAS_NODE_EMBEDDED: hasNodeEmbedded,
    BUILTIN_NODE_PATH: hasNodeEmbedded ? join(__dirname, 'node', 'bin', 'node') : null,
    BUILTIN_NPM_PATH: hasNodeEmbedded ? join(__dirname, 'node', 'bin', 'npm') : null,
  };

  const resolved = applyOverrides(paths);

  // A named pipe is not a filesystem path, so it cannot be derived from PM2_HOME.
  return isWindows() ? Object.assign(resolved, WINDOWS_PIPES) : resolved;
};

export = pm2Paths;
