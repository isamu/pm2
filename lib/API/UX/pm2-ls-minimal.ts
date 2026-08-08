import { basename } from 'node:path';
import UxHelpers from './helpers.js';

interface ProcessEnv {
  name?: string;
  namespace?: string;
  version?: string;
  pm_id?: number;
  status?: string;
  exec_mode?: string;
  restart_time?: number;
  pm_uptime?: number;
  pm_exec_path?: string;
  pm_err_log_path?: string;
  pm_pid_path?: string;
  watch?: unknown;
}

interface ProcessEntry {
  pid?: number;
  monit?: { memory?: number };
  pm2_env: ProcessEnv;
}

const MEMORY_PRECISION = 1;

// A daemon that has just started, or one mid-restart, hands back entries with fields still
// missing. Losing the whole listing over one of them is not a useful trade, and these are all
// labels on a display.
const nameOf = (env: ProcessEnv): string => {
  if (env.name) return env.name;
  return env.pm_exec_path ? basename(env.pm_exec_path) : '';
};

const modeOf = (env: ProcessEnv): string => (env.exec_mode ?? '').split('_mode')[0];

const uptimeOf = (env: ProcessEnv): string | number =>
  env.pm_uptime && env.status === 'online' ? UxHelpers.timeSince(env.pm_uptime) : 0;

/**
 * The one-block-per-process display behind `pm2 ls -m`.
 */
const miniDisplay = (list: ProcessEntry[]): void => {
  list.forEach((proc) => {
    const env = proc.pm2_env;

    console.log('+--- %s', nameOf(env));
    console.log('namespace : %s', env.namespace);
    console.log('version : %s', env.version);
    console.log('pid : %s', proc.pid);
    console.log('pm2 id : %s', env.pm_id);
    console.log('status : %s', env.status);
    console.log('mode : %s', modeOf(env));
    console.log('restarted : %d', env.restart_time ?? 0);
    console.log('uptime : %s', uptimeOf(env));
    console.log(
      'memory usage : %s',
      proc.monit ? UxHelpers.bytesToSize(proc.monit.memory ?? 0, MEMORY_PRECISION) : '',
    );
    console.log('error log : %s', env.pm_err_log_path);
    console.log('watching : %s', env.watch ? 'yes' : 'no');
    console.log('PID file : %s\n', env.pm_pid_path);
  });
};

export = miniDisplay;
