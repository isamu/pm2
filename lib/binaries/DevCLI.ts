'use strict';

process.env.PM2_NO_INTERACTION = 'true';
// Do not print banner
process.env.PM2_DISCRETE_MODE = 'true';

import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import chalk from 'ansis';
import { messageOf } from '../tools/errors.js';
import cst from '../../constants.js';
import pkg from '../../package.json';
import type {
  Pm2Client,
  Pm2Module,
  LogStreamer,
  Pm2Process,
  CommanderCli,
  DevOptions,
} from '../types/pm2-api.js';

interface DevBus {
  on(event: string, handler: (packet: { event?: string }) => void): void;
}
interface DevClient {
  launchBus(cb: (err: unknown, bus: DevBus) => void): void;
}

const requireFrom = createRequire(__filename);
const commander: CommanderCli = requireFrom('commander');

const PM2: Pm2Module = requireFrom('../..');
const Log: LogStreamer = requireFrom('../API/Log');
const fmt: {
  title(text: string): void;
  field(name: string, value: unknown): void;
  sep(): void;
} = requireFrom('../tools/fmt.js');

commander
  .version(pkg.version)
  .description('pm2-dev monitor for any file changes and automatically restart it')
  .option('--raw', 'raw log output')
  .option('--timestamp', 'print timestamp')
  .option(
    '--node-args <node_args>',
    'space delimited arguments to pass to node in cluster mode - e.g. --node-args="--debug=7001 --trace-deprecation"',
  )
  .option('--ignore [files]', 'files to ignore while watching')
  .option('--post-exec [cmd]', 'execute extra command after change detected')
  .option('--silent-exec', 'do not output result of post command', false)
  .option('--test-mode', 'debug mode for test suit')
  .option(
    '--interpreter <interpreter>',
    'the interpreter pm2 should use for executing app (bash, python...)',
  )
  .option('--env [name]', 'select env_[name] env variables in process config file')
  .option('--auto-exit', 'exit if all processes are errored/stopped or 0 apps launched')
  .usage('pm2-dev app.js');

const pm2 = new PM2.custom({
  pm2_home: path.join(os.homedir(), '.pm2-dev'),
});

pm2.connect(function () {
  commander.parse(process.argv);
});

function postExecCmd(command: string, cb?: (err: null) => void) {
  const exec_cmd = exec(command);

  if (commander.silentExec !== true) {
    exec_cmd.stdout?.on('data', function (data: Buffer) {
      process.stdout.write(data);
    });

    exec_cmd.stderr?.on('data', function (data: Buffer) {
      process.stderr.write(data);
    });
  }

  exec_cmd.on('close', function done() {
    if (cb) cb(null);
  });

  exec_cmd.on('error', function (err) {
    console.error(err.stack || err);
  });
}

function run(cmd: string, opts: DevOptions) {
  let timestamp = opts.timestamp;

  opts.watch = true;
  opts.autostart = true;
  opts.autorestart = true;
  opts.restart_delay = 1000;
  if (opts.autoExit) autoExit();

  if (opts.ignore) {
    opts.ignore_watch = opts.ignore.split(',');
    opts.ignore_watch.push('node_modules');
  }

  if (timestamp === true) timestamp = 'YYYY-MM-DD-HH:mm:ss';

  pm2.start(cmd, opts, function (err, procs) {
    if (err) {
      console.error(err);
      pm2.destroy(function () {
        process.exit(0);
      });
      return false;
    }

    if (opts.testMode) {
      return pm2.disconnect(function () {
        console.log('disconnected succesfully from pm2-dev');
      });
    }

    fmt.title('PM2 development mode');
    fmt.field(
      'Apps started',
      (procs ?? []).map(function (proc: Pm2Process) {
        return proc.pm2_env.name;
      }),
    );
    fmt.field('Processes started', chalk.bold(String(procs?.length ?? 0)));
    fmt.field('Watch and Restart', chalk.green('Enabled'));
    fmt.field('Ignored folder', opts.ignore_watch || 'node_modules');
    if (opts.postExec) fmt.field('Post restart cmd', opts.postExec);
    fmt.sep();

    setTimeout(function () {
      (pm2.Client as DevClient).launchBus(function (err: unknown, bus: DevBus) {
        bus.on('process:event', function (packet: { event?: string }) {
          if (packet.event == 'online') {
            if (opts.postExec) postExecCmd(opts.postExec);
          }
        });
      });
    }, 1000);

    Log.devStream(pm2.Client, 'all', opts.raw, timestamp, false);

    process.on('SIGINT', function () {
      console.log('>>>>> [PM2 DEV] Stopping current development session');
      pm2.delete('all', function () {
        pm2.destroy(function () {
          process.exit(0);
        });
      });
    });
  });
}

commander.command('*').action(function (cmd: string, opts: DevOptions) {
  run(cmd, commander);
});

commander
  .command('start <file|json_file>')
  .description('start target config file/script in development mode')
  .action(function (cmd: string, opts: DevOptions) {
    run(cmd, commander);
  });

function exitPM2() {
  if (pm2 && pm2.connected == true) {
    console.log(chalk.green.bold('>>> Exiting PM2'));
    pm2.kill(function () {
      process.exit(0);
    });
  } else process.exit(0);
}

function autoExit(final?: boolean) {
  setTimeout(function () {
    pm2.list(function (err, apps) {
      if (err) console.error(messageOf(err));

      let online_count = 0;

      (apps ?? []).forEach(function (app: Pm2Process) {
        if (app.pm2_env.status == cst.ONLINE_STATUS || app.pm2_env.status == cst.LAUNCHING_STATUS)
          online_count++;
      });

      if (online_count == 0) {
        console.log('0 application online, exiting');
        if (final == true) process.exit(1);
        else autoExit(true);
        return false;
      }
      autoExit(false);
    });
  }, 3000);
}

if (process.argv.length == 2) {
  commander.outputHelp();
  exitPM2();
}
