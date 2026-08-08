const vCheck = require('@pm2/pm2-version-check');
const semver = require('semver');
const fs = require('fs');
const os = require('os');

function hasDockerEnv() {
  try {
    fs.statSync('/.dockerenv');
    return true;
  } catch (_) {
    return false;
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch (_) {
    return false;
  }
}

module.exports = function (opts) {
  // The four below are filled in under a try: os.type() and the docker probes read the
  // filesystem, and a failure there should still leave state and version to report.
  const params: {
    state: string;
    version: string;
    os?: string;
    uptime?: number;
    nodev?: string;
    docker?: boolean;
  } = {
    state: opts.state,
    version: opts.version,
  };

  try {
    params.os = os.type();
    params.uptime = Math.floor(process.uptime());
    params.nodev = process.versions.node;
    params.docker = hasDockerEnv() || hasDockerCGroup();
  } catch (e) {}

  vCheck.runCheck(params, (err, pkg) => {
    if (err) return false;
    if (!pkg.current_version) return false;
    if (opts.version && semver.lt(opts.version, pkg.current_version)) {
      console.log('[PM2] This PM2 is not UP TO DATE');
      console.log('[PM2] Upgrade to version %s', pkg.current_version);
    }
  });
};
