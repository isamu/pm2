/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Reload functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

import cst from '../../constants.js';
import Utility from '../Utility.js';

type Callback = (err: unknown, result?: unknown) => void;

interface ReloadOpts {
  id: string;
  env?: { current_conf?: Record<string, unknown> };
  [key: string]: unknown;
}

// A live worker: cluster gives it the emitter and channel methods, so they are always there.
interface ClusterEntry {
  pm2_env: Record<string, unknown> & {
    pm_id?: unknown;
    status?: string;
    restart_time?: number;
    env?: Record<string, unknown>;
  };
  process: { pid: number };
  once(event: string, handler: (...args: never[]) => void): void;
  removeListener(event: string, handler: (...args: never[]) => void): void;
  disconnect(): void;
  send(message: string): void;
  [key: string]: unknown;
}

// What these functions need of God, rather than the whole namespace.
interface ReloadHost {
  bus: {
    on(event: string, handler: (packet: never) => void): void;
    removeListener(event: string, handler: (packet: never) => void): void;
  };
  clusters_db: Record<string, ClusterEntry>;
  executeApp(env: unknown, cb: (err: unknown, new_worker: ClusterEntry) => void): void;
  killProcess(pid: number, pm2_env: unknown, cb: Callback): void;
  deleteProcessId(id: string, cb: Callback): void;
  notify(action_name: string, data: unknown, manually?: boolean): void;
  resetState(pm2_env: unknown): void;
  restartProcessId(opts: ReloadOpts, cb: Callback): unknown;
  softReloadProcessId?(opts: ReloadOpts, cb: Callback): unknown;
  reloadProcessId?(opts: ReloadOpts, cb: Callback): unknown;
}

/**
 * softReload will wait permission from process to exit
 * @method softReload
 * @param {} God
 * @param {} id
 * @param {} cb
 * @return Literal
 */
function softReload(God: ReloadHost, id: string, cb: Callback) {
  const t_key = '_old_' + id;

  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];

  delete God.clusters_db[id];

  const old_worker = God.clusters_db[t_key];

  // Deep copy
  const new_env = Utility.clone(old_worker.pm2_env);

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  new_env.restart_time = Number(new_env.restart_time ?? 0) + 1;

  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;

  God.executeApp(new_env, function (err: unknown, new_worker: ClusterEntry) {
    if (err) return cb(err);

    let timer: NodeJS.Timeout | undefined;

    const onListen = function () {
      clearTimeout(timer);
      softCleanDeleteProcess();
      console.log('-softReload- New worker listening');
    };

    // Bind to know when the new process is up
    new_worker.once('listening', onListen);

    timer = setTimeout(
      function () {
        new_worker.removeListener('listening', onListen);
        softCleanDeleteProcess();
      },
      Number(new_env.listen_timeout || cst.GRACEFUL_LISTEN_TIMEOUT),
    );

    // Remove old worker properly
    const softCleanDeleteProcess = function () {
      const cleanUp = function () {
        clearTimeout(timer);
        console.log('-softReload- Old worker disconnected');
        return God.deleteProcessId(t_key, cb);
      };

      old_worker.once('disconnect', cleanUp);

      try {
        if (old_worker.state != 'dead' && old_worker.state != 'disconnected')
          old_worker.send && old_worker.send('shutdown');
        else {
          clearTimeout(timer);
          console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
          return God.deleteProcessId(t_key, cb);
        }
      } catch (e) {
        clearTimeout(timer);
        console.error('Worker %d is already disconnected', old_worker.pm2_env.pm_id);
        return God.deleteProcessId(t_key, cb);
      }

      timer = setTimeout(function () {
        old_worker.removeListener('disconnect', cleanUp);
        return God.deleteProcessId(t_key, cb);
      }, cst.GRACEFUL_TIMEOUT);
      return false;
    };
    return false;
  });
  return false;
}

/**
 * hardReload will reload without waiting permission from process
 * @method hardReload
 * @param {} God
 * @param {} id
 * @param {} cb
 * @return Literal
 */
function hardReload(God: ReloadHost, id: string, wait_msg: string, cb: Callback) {
  const t_key = '_old_' + id;

  // Move old worker to tmp id
  God.clusters_db[t_key] = God.clusters_db[id];
  delete God.clusters_db[id];

  const old_worker = God.clusters_db[t_key];
  // Deep copy
  const new_env = Utility.clone(old_worker.pm2_env);
  new_env.restart_time = Number(new_env.restart_time ?? 0) + 1;

  // Reset created_at and unstable_restarts
  God.resetState(new_env);

  old_worker.pm2_env.pm_id = t_key;
  old_worker.pm_id = t_key;
  let timer: NodeJS.Timeout | undefined;
  let readySignalSent = false;

  const onListen = function () {
    clearTimeout(timer);
    readySignalSent = true;
    console.log('-reload- New worker listening');
    return God.deleteProcessId(t_key, cb);
  };

  const listener = function (packet: {
    raw?: unknown;
    process: { pm_id?: unknown; name?: string };
  }) {
    if (
      packet.raw === 'ready' &&
      packet.process.name === old_worker.pm2_env.name &&
      packet.process.pm_id === id
    ) {
      God.bus.removeListener('process:msg', listener);
      return onListen();
    }
  };

  if (wait_msg !== 'listening') {
    God.bus.on('process:msg', listener);
  }

  God.executeApp(new_env, function (err: unknown, new_worker: ClusterEntry) {
    if (err) return cb(err);

    // Bind to know when the new process is up
    if (wait_msg === 'listening') {
      new_worker.once('listening', onListen);
    }

    timer = setTimeout(
      function () {
        if (readySignalSent) {
          return;
        }

        if (wait_msg === 'listening') new_worker.removeListener(wait_msg, onListen);
        else God.bus.removeListener('process:msg', listener);

        return God.deleteProcessId(t_key, cb);
      },
      Number(new_env.listen_timeout || cst.GRACEFUL_LISTEN_TIMEOUT),
    );

    return false;
  });
  return false;
}

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
const attachReload = (God: ReloadHost): void => {
  /**
   * Reload
   * @method softReloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.softReloadProcessId = function (opts, cb) {
    const id = opts.id;
    const env = opts.env || {};

    if (!(id in God.clusters_db)) return cb(new Error(`pm_id ${id} not available in ${id}`));

    if (
      God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS &&
      God.clusters_db[id].pm2_env.exec_mode == 'cluster_mode' &&
      !God.clusters_db[id].pm2_env.wait_ready
    ) {
      Utility.extend(God.clusters_db[id].pm2_env.env ?? {}, opts.env);
      Utility.extendExtraConfig(God.clusters_db[id], opts);

      return softReload(God, id, cb);
    } else {
      console.log('Process %s in a stopped status, starting it', id);
      return God.restartProcessId(opts, cb);
    }
  };

  /**
   * Reload
   * @method reloadProcessId
   * @param {} id
   * @param {} cb
   * @return CallExpression
   */
  God.reloadProcessId = function (opts, cb) {
    const id = opts.id;
    const env = opts.env || {};

    if (!(id in God.clusters_db)) return cb(new Error('PM2 ID unknown'));

    if (
      God.clusters_db[id].pm2_env.status == cst.ONLINE_STATUS &&
      God.clusters_db[id].pm2_env.exec_mode == 'cluster_mode'
    ) {
      Utility.extend(God.clusters_db[id].pm2_env.env ?? {}, opts.env);
      Utility.extendExtraConfig(God.clusters_db[id], opts);

      const wait_msg = God.clusters_db[id].pm2_env.wait_ready ? 'ready' : 'listening';
      return hardReload(God, id, wait_msg, cb);
    } else {
      console.log('Process %s in a stopped status, starting it', id);
      return God.restartProcessId(opts, cb);
    }
  };
};

export = attachReload;
