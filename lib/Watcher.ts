/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { createRequire } from 'node:module';

const requireFrom = createRequire(__filename);
const chokidar: { watch(paths: unknown, options: WatchOptions): Watcher } = requireFrom('chokidar');
const log: (...args: unknown[]) => void = requireFrom('debug')('pm2:watch');

interface Watcher {
  on(event: string, handler: (...args: never[]) => void): void;
  close(): void;
}

interface WatchOptions {
  ignored: unknown;
  persistent: boolean;
  ignoreInitial: boolean;
  cwd: string;
}

// Only the fields this file reads. An app's environment carries far more; the schema is what
// Common.verifyConfs enforces.
interface WatchedEnv {
  pm_id: number;
  name: string;
  pm_cwd: string;
  watch?: boolean | string | string[];
  ignore_watch?: unknown;
  watch_options?: Partial<WatchOptions>;
  watch_delay?: number;
}

// What this module needs of God, rather than the whole namespace: a mixin states its own
// requirements and structural typing does the rest.
interface WatchHost {
  watch?: {
    _watchers: Record<string, Watcher | undefined>;
    enable(pm2_env: WatchedEnv): void;
    disable(pm2_env: WatchedEnv): boolean;
    disableAll(): void;
  };
  restartProcessName(name: string, cb: (err: unknown) => void): void;
}

const DEFAULT_IGNORED = /[\/\\]\.|node_modules/;

const attachWatcher = (God: WatchHost) => {
  const watchers: Record<string, Watcher | undefined> = {};

  const enable = (pm2_env: WatchedEnv): void => {
    disable(pm2_env);

    log('Initial watch ', pm2_env.watch);

    const asked = pm2_env.watch;
    const target =
      typeof asked === 'boolean' || (Array.isArray(asked) && asked.length === 0)
        ? pm2_env.pm_cwd
        : asked;

    log('Watching %s', target);

    const options: WatchOptions = Object.assign(
      {
        ignored: pm2_env.ignore_watch || DEFAULT_IGNORED,
        persistent: true,
        ignoreInitial: true,
        cwd: pm2_env.pm_cwd,
      },
      pm2_env.watch_options ?? {},
    );

    log('Watch opts', options);

    const watcher = chokidar.watch(target, options);
    console.log('[Watch] Start watching', pm2_env.name);

    // One restart at a time per app: a save that touches several files arrives as several
    // events, and without this each of them would ask for its own restart.
    let restarting = false;

    watcher.on('all', ((event: string, changed: string) => {
      if (restarting) {
        log('Already restarting, skipping');
        return;
      }
      restarting = true;

      console.log('Change detected on path %s for app %s - restarting', changed, pm2_env.name);

      setTimeout(() => {
        God.restartProcessName(pm2_env.name, (err) => {
          restarting = false;
          if (err) {
            log('Error while restarting', err);
            return;
          }
          log('Process restarted');
        });
      }, pm2_env.watch_delay || 0);
    }) as (...args: never[]) => void);

    watcher.on('error', ((e: Error) => {
      console.error(e.stack || e);
    }) as (...args: never[]) => void);

    watchers[pm2_env.pm_id] = watcher;
  };

  const disable = (pm2_env: WatchedEnv): boolean => {
    const watcher = watchers[pm2_env.pm_id];
    if (!watcher) return false;

    console.log('[Watch] Stop watching', pm2_env.name);
    watcher.close();
    delete watchers[pm2_env.pm_id];
    return true;
  };

  // `_watchers` is keyed by pm_id, so this walked it with splice — an Array method — and threw
  // TypeError on the first entry. Nothing calls this today, which is why that has stood.
  const disableAll = (): void => {
    console.log('[Watch] PM2 is being killed. Watch is disabled to avoid conflicts');
    Object.keys(watchers).forEach((id) => {
      watchers[id]?.close();
      delete watchers[id];
    });
  };

  God.watch = { _watchers: watchers, enable, disable, disableAll };
};

export = attachWatcher;
