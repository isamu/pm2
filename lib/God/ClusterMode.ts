/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

/**
 * @file Cluster execution functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */
import cluster from 'node:cluster';
import Utility from '../Utility.js';
import pkg from '../../package.json';

// Only what this file touches. A pm2 environment carries far more; the schema is what
// Common.verifyConfs enforces.
interface ClusterEnv {
  name: string;
  pm_id: number;
  node_args?: unknown;
  namespace?: string;
  versioning?: { revision?: string } | null;
  node_version?: string;
  _pm2_version?: string;
  [key: string]: unknown;
}

// What this module needs of God, rather than the whole namespace.
interface ClusterHost {
  bus: { emit(event: string, packet: unknown): void };
  logAndGenerateError(err: unknown): void;
  nodeApp?(env_copy: ClusterEnv, cb: (err: unknown, clu?: unknown) => void): unknown;
}

type ClusterWorker = ReturnType<typeof cluster.fork> & { pm2_env: ClusterEnv };

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
const attachClusterMode = (God: ClusterHost): void => {
  /**
   * For Node apps - Cluster mode
   * It will wrap the code and enable load-balancing mode
   * @method nodeApp
   * @param {} env_copy
   * @param {} cb
   * @return Literal
   */
  God.nodeApp = function nodeApp(env_copy, cb) {
    let clu: ClusterWorker;

    console.log(`App [${env_copy.name}:${env_copy.pm_id}] starting in -cluster mode-`);
    if (env_copy.node_args && Array.isArray(env_copy.node_args)) {
      cluster.settings.execArgv = env_copy.node_args;
    }

    env_copy._pm2_version = pkg.version;

    try {
      // node.js cluster clients can not receive deep-level objects or arrays in the forked process, e.g.:
      // { "args": ["foo", "bar"], "env": { "foo1": "bar1" }} will be parsed to
      // { "args": "foo, bar", "env": "[object Object]"}
      // So we passing a stringified JSON here.
      clu = Object.assign(cluster.fork({ pm2_env: JSON.stringify(env_copy) }), {
        pm2_env: env_copy,
      });
    } catch (e) {
      God.logAndGenerateError(e);
      return cb(e);
    }

    /**
     * Broadcast message to God
     */
    clu.on('message', function cluMessage(msg: Record<string, unknown>) {
      /*********************************
       * If you edit this function
       * Do the same in ForkMode.js !
       *********************************/
      if (msg.data && typeof msg.type === 'string') {
        return God.bus.emit(msg.type, {
          at: Utility.getDate(),
          data: msg.data,
          process: {
            pm_id: clu.pm2_env.pm_id,
            name: clu.pm2_env.name,
            rev:
              clu.pm2_env.versioning && clu.pm2_env.versioning.revision
                ? clu.pm2_env.versioning.revision
                : null,
            namespace: clu.pm2_env.namespace,
          },
        });
      } else {
        if (typeof msg == 'object' && 'node_version' in msg) {
          clu.pm2_env.node_version = String(msg.node_version);
          return false;
        }

        return God.bus.emit('process:msg', {
          at: Utility.getDate(),
          raw: msg,
          process: {
            pm_id: clu.pm2_env.pm_id,
            name: clu.pm2_env.name,
            namespace: clu.pm2_env.namespace,
          },
        });
      }
    });

    return cb(null, clu);
  };
};

export = attachClusterMode;
