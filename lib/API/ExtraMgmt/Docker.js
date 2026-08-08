const spawn = require('child_process').spawn;
const DockerMgmt = {};

module.exports = DockerMgmt;

function execDocker(cmd, cb) {
  var i = spawn('docker', cmd, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  i.on('close', cb);
}

var DOCKER_COMMAND_FOR = {
  stopProcessId: 'stop',
  deleteProcessId: 'rm',
  restartProcessId: 'restart',
};

DockerMgmt.processCommand = function (PM2, start_id, select_id, action, cb) {
  PM2.Client.executeRemote('getSystemData', {}, (err, sys_infos) => {
    // The error was ignored, so a daemon that could not answer left sys_infos undefined and the
    // next line read .containers off it.
    if (err) return cb(err);

    var containers = (sys_infos && sys_infos.containers) || [];
    var container = containers[select_id - start_id - 1];
    if (!container) return cb(new Error(`Process ${select_id} not found`));

    var docker_command = Object.prototype.hasOwnProperty.call(DOCKER_COMMAND_FOR, action)
      ? DOCKER_COMMAND_FOR[action]
      : null;
    if (!docker_command) return cb(new Error(`Unknown action ${action}`));

    execDocker([docker_command, container.id], cb);
  });
};
