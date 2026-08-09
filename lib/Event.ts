/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import Utility from './Utility.js';

// A process as the daemon holds it. Structural, so it lines up with what Utility expects
// without either file having to own the definition.
interface ProcessDescriptor {
  pm2_env?: Record<string, unknown>;
  [key: string]: unknown;
}

// What this module needs of God, rather than the whole namespace.
interface EventHost {
  bus: { emit(event: string, packet: unknown): void };
  clusters_db: Record<string, ProcessDescriptor>;
  notify?(action_name: string, data: ProcessDescriptor, manually?: boolean): void;
  notifyByProcessId?(opts: NotifyByIdOptions, cb: (err: Error | null) => void): void;
}

interface NotifyByIdOptions {
  id?: string | number;
  action_name?: string;
  manually?: boolean;
}

const attachEvents = (God: EventHost): void => {
  God.notify = (action_name, data, manually) => {
    God.bus.emit('process:event', {
      event: action_name,
      // Any value at all means "a person asked for this"; only absence means otherwise.
      manually: typeof manually !== 'undefined',
      process: Utility.formatCLU(data),
      at: Utility.getDate(),
    });
  };

  God.notifyByProcessId = (opts, cb) => {
    if (typeof opts.id === 'undefined') {
      return cb(new Error('process id missing'));
    }

    const proc = God.clusters_db[opts.id];
    if (!proc) {
      return cb(new Error('process id doesnt exists'));
    }

    God.bus.emit('process:event', {
      event: opts.action_name,
      manually: typeof opts.manually !== 'undefined',
      process: Utility.formatCLU(proc),
      at: Utility.getDate(),
    });

    process.nextTick(() => cb(null));
  };
};

export = attachEvents;
