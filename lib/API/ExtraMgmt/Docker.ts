import { spawn } from 'node:child_process';
import which from '../../tools/which.js';

interface Container {
  id: string;
}

interface SystemData {
  containers?: Container[];
}

type Callback = (err: Error | null, code?: number | null) => void;

interface Pm2Client {
  Client: {
    executeRemote: (
      command: string,
      options: object,
      onData: (err: Error | null, data: SystemData) => void,
    ) => void;
  };
}

const DOCKER_COMMAND_FOR: Record<string, string> = {
  stopProcessId: 'stop',
  deleteProcessId: 'rm',
  restartProcessId: 'restart',
};

// Resolved to an absolute path before spawning: on PATH alone a missing docker only shows up as
// an exit code from the shell, which reads the same as the command having failed.
const execDocker = (args: string[], callback: Callback): void => {
  const dockerPath = which('docker');
  if (!dockerPath) return callback(new Error('docker was not found on PATH'));

  const docker = spawn(dockerPath, args, { stdio: 'inherit', env: process.env });
  docker.on('close', (code) => callback(null, code));
};

const processCommand = (
  pm2: Pm2Client,
  startId: number,
  selectId: number,
  action: string,
  callback: Callback,
): void => {
  pm2.Client.executeRemote('getSystemData', {}, (err, sysInfos) => {
    // The error used to be ignored, so a daemon that could not answer left sysInfos undefined
    // and the next line read .containers off it.
    if (err) return callback(err);

    const containers = sysInfos?.containers ?? [];
    const container = containers[selectId - startId - 1];
    if (!container) return callback(new Error(`Process ${selectId} not found`));

    const dockerCommand = Object.prototype.hasOwnProperty.call(DOCKER_COMMAND_FOR, action)
      ? DOCKER_COMMAND_FOR[action]
      : undefined;
    if (!dockerCommand) return callback(new Error(`Unknown action ${action}`));

    execDocker([dockerCommand, container.id], callback);
  });
};

export = { processCommand };
