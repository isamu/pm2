/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import fs from 'node:fs';
import util from 'node:util';
import chalk from 'ansis';
import dayjs from 'dayjs';
import { createRequire } from 'node:module';

const requireFrom = createRequire(__filename);

// ansis has bgBlackBright at runtime but leaves it out of its type declarations.
const bgBlackBright: (text: string) => string = Reflect.get(chalk, 'bgBlackBright');
const forEachLimit: (
  items: TailTarget[],
  limit: number,
  each: (item: TailTarget, next: () => void) => void,
  done: () => void,
) => void = requireFrom('async/forEachLimit');

interface TailTarget {
  path?: string;
  type?: string;
  app_name?: string;
}

interface LogPacket {
  data?: unknown;
  at?: number;
  process: {
    pm_id?: number | string;
    name?: string;
    namespace?: string;
  };
  event?: string;
}

interface Bus {
  on(event: 'log:*', handler: (type: string, packet: LogPacket) => void): void;
  on(event: 'process:event', handler: (packet: LogPacket) => void): void;
}

interface BusClient {
  launchBus(
    cb: (err: unknown, bus: Bus, socket?: { on(e: string, h: () => void): void }) => void,
  ): void;
}

const Log = (module.exports = {
  tail,
  stream,
  devStream,
  jsonStream,
  formatStream,
});

const DEFAULT_PADDING = '          ';

/**
 * Tail logs from file stream.
 * @param {Object} apps_list
 * @param {Number} lines
 * @param {Boolean} raw
 * @param {Function} callback
 * @return
 */

function tail(apps_list: TailTarget[], lines: number, raw: boolean, callback?: () => void) {
  if (lines === 0 || apps_list.length === 0) return callback && callback();

  const count = 0;

  const getLastLines = function (
    filename: string,
    lines: number,
    callback: (out: string[]) => void,
  ) {
    let chunk = '';
    const size = Math.max(0, fs.statSync(filename).size - lines * 200);

    const fd = fs.createReadStream(filename, { start: size });
    fd.on('data', function (data) {
      chunk += data.toString();
    });
    fd.on('end', function () {
      // The read starts mid-file, so the first line is almost always a partial one; taking
      // lines+1 from the end and dropping the last empty split is what leaves `lines` whole ones.
      const lastLines = chunk.split('\n').slice(-(lines + 1));
      lastLines.pop();
      callback(lastLines);
    });
  };

  const modifiedAt = (target: TailTarget): number =>
    target.path && fs.existsSync(target.path) ? fs.statSync(target.path).mtime.valueOf() : 0;

  apps_list.sort((a, b) => modifiedAt(a) - modifiedAt(b));

  forEachLimit(
    apps_list,
    1,
    function (app, next) {
      if (!app.path || !fs.existsSync(app.path)) return next();

      getLastLines(app.path, lines, function (output) {
        console.log(chalk.gray('%s last %d lines:'), app.path, lines);
        output.forEach(function (out) {
          if (raw) return app.type === 'err' ? console.error(out) : console.log(out);
          if (app.type === 'out')
            process.stdout.write(chalk.green(pad(DEFAULT_PADDING, app.app_name) + ' | '));
          else if (app.type === 'err')
            process.stdout.write(chalk.red(pad(DEFAULT_PADDING, app.app_name) + ' | '));
          else process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | '));
          console.log(out);
        });
        if (output.length) process.stdout.write('\n');
        next();
      });
    },
    function () {
      callback && callback();
    },
  );
}

/**
 * Stream logs in realtime from the bus eventemitter.
 * @param {String} id
 * @param {Boolean} raw
 * @return
 */

function stream(
  Client: BusClient,
  id: string,
  raw: boolean,
  timestamp: string | false,
  exclusive: string | false,
  highlight?: string | false,
) {
  Client.launchBus(function (err, bus, socket) {
    socket?.on('reconnect attempt', function () {
      // Set by pm2-runtime when it wants the log stream to end with the daemon it is tailing.
      if (Reflect.get(globalThis, '_auto_exit') === true) {
        if (timestamp) process.stdout.write(chalk.dim(chalk.gray(dayjs().format(timestamp) + ' ')));
        process.stdout.write(
          chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | ') + '[[[ Target PM2 killed. ]]]',
        );
        process.exit(0);
      }
    });

    let min_padding = 3;

    bus.on('log:*', function (type, packet) {
      const isMatchingProcess =
        id === 'all' ||
        packet.process.name == id ||
        packet.process.pm_id == id ||
        packet.process.namespace == id;

      if (!isMatchingProcess) return;

      if (
        (type === 'out' && exclusive === 'err') ||
        (type === 'err' && exclusive === 'out') ||
        (type === 'PM2' && exclusive !== false)
      )
        return;

      let lines;

      if (typeof packet.data === 'string') lines = (packet.data || '').split('\n');
      else return;

      lines.forEach(function (line) {
        if (!line || line.length === 0) return;

        if (raw)
          return type === 'err'
            ? process.stderr.write(util.format(line) + '\n')
            : process.stdout.write(util.format(line) + '\n');

        if (timestamp) process.stdout.write(chalk.dim(chalk.gray(dayjs().format(timestamp) + ' ')));

        const name = packet.process.pm_id + '|' + packet.process.name;

        if (name.length > min_padding) min_padding = name.length + 1;

        if (type === 'out')
          process.stdout.write(chalk.green(pad(' '.repeat(min_padding), name) + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(' '.repeat(min_padding), name) + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(' '.repeat(min_padding), 'PM2') + ' | '));
        if (highlight)
          process.stdout.write(
            util.format(line).replace(highlight, bgBlackBright(highlight)) + '\n',
          );
        else process.stdout.write(util.format(line) + '\n');
      });
    });
  });
}

function devStream(
  Client: BusClient,
  id: string,
  raw: boolean,
  timestamp: string | false | null,
  exclusive: string | false,
) {
  Client.launchBus(function (err, bus) {
    setTimeout(function () {
      bus.on('process:event', function (packet) {
        if (packet.event == 'online')
          console.log(chalk.green('[rundev] App %s restarted'), packet.process.name);
      });
    }, 1000);

    let min_padding = 3;

    bus.on('log:*', function (type, packet) {
      if (id !== 'all' && packet.process.name != id && packet.process.pm_id != id) return;

      if (
        (type === 'out' && exclusive === 'err') ||
        (type === 'err' && exclusive === 'out') ||
        (type === 'PM2' && exclusive !== false)
      )
        return;

      if (type === 'PM2') return;

      const name = packet.process.pm_id + '|' + packet.process.name;

      let lines;

      if (typeof packet.data === 'string') lines = (packet.data || '').split('\n');
      else return;

      lines.forEach(function (line) {
        if (!line || line.length === 0) return;

        if (raw) return process.stdout.write(util.format(line) + '\n');

        if (timestamp) process.stdout.write(chalk.dim(chalk.gray(dayjs().format(timestamp) + ' ')));

        const name = packet.process.name + '-' + packet.process.pm_id;

        if (name.length > min_padding) min_padding = name.length + 1;

        if (type === 'out')
          process.stdout.write(chalk.green(pad(' '.repeat(min_padding), name) + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(' '.repeat(min_padding), name) + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(' '.repeat(min_padding), 'PM2') + ' | '));
        process.stdout.write(util.format(line) + '\n');
      });
    });
  });
}

function jsonStream(Client: BusClient, id: string) {
  Client.launchBus(function (err, bus) {
    if (err) console.error(err);

    bus.on('process:event', function (packet) {
      process.stdout.write(
        JSON.stringify({
          timestamp: dayjs(packet.at),
          type: 'process_event',
          status: packet.event,
          app_name: packet.process.name,
        }),
      );
      process.stdout.write('\n');
    });

    bus.on('log:*', function (type, packet) {
      if (id !== 'all' && packet.process.name != id && packet.process.pm_id != id) return;

      if (type === 'PM2') return;

      if (typeof packet.data == 'string') packet.data = packet.data.replace(/(\r\n|\n|\r)/gm, '');

      process.stdout.write(
        JSON.stringify({
          message: packet.data,
          timestamp: dayjs(packet.at),
          type: type,
          process_id: packet.process.pm_id,
          app_name: packet.process.name,
        }),
      );
      process.stdout.write('\n');
    });
  });
}

function formatStream(
  Client: BusClient,
  id: string,
  raw: boolean,
  timestamp: string | false,
  exclusive: string | false,
  highlight?: string | false,
) {
  Client.launchBus(function (err, bus) {
    bus.on('log:*', function (type, packet) {
      if (id !== 'all' && packet.process.name != id && packet.process.pm_id != id) return;

      if (
        (type === 'out' && exclusive === 'err') ||
        (type === 'err' && exclusive === 'out') ||
        (type === 'PM2' && exclusive !== false)
      )
        return;

      if (type === 'PM2' && raw) return;

      const name = packet.process.name + '-' + packet.process.pm_id;

      let lines;

      if (typeof packet.data === 'string') lines = (packet.data || '').split('\n');
      else return;

      lines.forEach(function (line) {
        if (!line || line.length === 0) return;

        if (!raw) {
          if (timestamp) process.stdout.write('timestamp=' + dayjs().format(timestamp) + ' ');
          if (packet.process.name === 'PM2') process.stdout.write('app=pm2 ');
          if (packet.process.name !== 'PM2')
            process.stdout.write(
              'app=' + packet.process.name + ' id=' + packet.process.pm_id + ' ',
            );
          if (type === 'out') process.stdout.write('type=out ');
          else if (type === 'err') process.stdout.write('type=error ');
        }

        process.stdout.write('message=');
        if (highlight)
          process.stdout.write(
            util.format(line).replace(highlight, bgBlackBright(highlight)) + '\n',
          );
        else process.stdout.write(util.format(line) + '\n');
      });
    });
  });
}

function pad(pad: string, str?: string, padLeft?: boolean) {
  if (typeof str === 'undefined') return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}
