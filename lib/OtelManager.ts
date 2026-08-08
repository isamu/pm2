'use strict';

const execSync = require('child_process').execSync;
const Common = require('./Common');
const cst = require('../constants');
const which = require('./tools/which');
const packageRootFrom = require('./tools/packageRoot.js');

const PM2_ROOT = packageRootFrom(__dirname, 1);

const OTEL_PACKAGES = [
  '@opentelemetry/api',
  '@opentelemetry/sdk-node',
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/core',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/semantic-conventions',
];

module.exports = {
  OTEL_PACKAGES: OTEL_PACKAGES,

  isInstalled: function () {
    try {
      require.resolve('@opentelemetry/sdk-node');
      return true;
    } catch (e) {
      return false;
    }
  },

  install: function () {
    const pm = which('npm') ? 'npm' : which('bun') ? 'bun' : null;
    if (!pm) {
      throw new Error('npm or bun is required to install OpenTelemetry packages');
    }
    Common.printOut(cst.PREFIX_MSG + 'Installing OpenTelemetry tracing packages...');
    execSync(pm + ' install --no-save ' + OTEL_PACKAGES.join(' '), {
      cwd: PM2_ROOT,
      stdio: 'inherit',
    });
    Common.printOut(cst.PREFIX_MSG + 'OpenTelemetry tracing packages installed successfully');
  },

  uninstall: function () {
    const pm = which('npm') ? 'npm' : which('bun') ? 'bun' : null;
    if (!pm) {
      throw new Error('npm or bun is required to uninstall OpenTelemetry packages');
    }
    Common.printOut(cst.PREFIX_MSG + 'Removing OpenTelemetry tracing packages...');
    execSync(pm + ' remove --no-save ' + OTEL_PACKAGES.join(' '), {
      cwd: PM2_ROOT,
      stdio: 'inherit',
    });
    Common.printOut(cst.PREFIX_MSG + 'OpenTelemetry tracing packages removed');
  },

  ensureInstalled: function () {
    if (this.isInstalled()) return true;
    try {
      this.install();
      return true;
    } catch (e) {
      Common.printError(
        cst.PREFIX_MSG_ERR + 'Failed to install OpenTelemetry packages: ' + e.message,
      );
      Common.printError(cst.PREFIX_MSG_ERR + 'Install manually with: pm2 install-otel');
      return false;
    }
  },
};
