const fs = require('fs');
const os = require('os');
const spawn = require('child_process').spawn;
const chalk = require('ansis');
const parallel = require('async/parallel');

const Configuration = require('../../Configuration.js');
const cst = require('../../../constants.js');
const Common = require('../../Common');
const Utility = require('../../Utility.js');
const packageRootFrom = require('../../tools/packageRoot.js');
const readline = require('readline');

const INTERNAL_MODULES = {
  'deep-monitoring': {
    dependencies: [
      { name: 'v8-profiler-node8' },
      { name: 'gc-stats' },
      { name: 'event-loop-inspector' },
    ],
  },
  'gc-stats': { name: 'gc-stats' },
  'event-loop-inspector': { name: 'event-loop-inspector' },
  'v8-profiler': { name: 'v8-profiler-node8' },
  profiler: { name: 'v8-profiler-node8' },
  typescript: { dependencies: [{ name: 'typescript' }, { name: 'ts-node@latest' }] },
  livescript: { name: 'livescript' },
  'coffee-script': { name: 'coffee-script', message: 'Coffeescript v1 support' },
  coffeescript: { name: 'coffeescript', message: 'Coffeescript v2 support' },
};

module.exports = {
  install,
  INTERNAL_MODULES,
  installMultipleModules,
};

function install(module, cb, verbose) {
  if (!module || !module.name || module.name.length === 0) {
    return cb(new Error('No module name !'));
  }

  if (typeof verbose === 'undefined') {
    verbose = true;
  }

  installLangModule(module.name, function (err) {
    const display = module.message || module.name;
    if (err) {
      if (verbose) {
        Common.printError(
          cst.PREFIX_MSG_MOD_ERR +
            chalk.bold.green(display + ' installation has FAILED (checkout previous logs)'),
        );
      }
      return cb(err);
    }

    if (verbose) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green(display + ' ENABLED'));
    }
    return cb();
  });
}

function installMultipleModules(modules, cb, post_install) {
  const functionList = [];
  for (let i = 0; i < modules.length; i++) {
    functionList.push(
      (function (index) {
        return function (callback) {
          let module = modules[index];
          if (typeof modules[index] === 'string') {
            module = { name: modules[index] };
          }
          install(
            module,
            function ($post_install, err, $index, $modules) {
              try {
                const install_instance = spawn(post_install[modules[index]], {
                  stdio: 'inherit',
                  windowsHide: true,
                  env: process.env,
                  shell: true,
                  cwd: process.cwd(),
                });
                Common.printOut(cst.PREFIX_MSG_MOD + 'Running configuraton script.');
              } catch (e) {
                Common.printOut(cst.PREFIX_MSG_MOD + 'No configuraton script found.');
              }
              callback(null, { module: module, err: err });
            },
            false,
          );
        };
      })(i),
    );
  }

  parallel(functionList, function (err, results) {
    for (let i = 0; i < results.length; i++) {
      const display = results[i].module.message || results[i].module.name;
      if (results[i].err) {
        err = results[i].err;
        Common.printError(
          cst.PREFIX_MSG_MOD_ERR +
            chalk.bold.green(display + ' installation has FAILED (checkout previous logs)'),
        );
      } else {
        Common.printOut(cst.PREFIX_MSG + chalk.bold.green(display + ' ENABLED'));
      }
    }

    if (cb) cb(err);
  });
}

function installLangModule(module_name, cb) {
  const node_module_path = packageRootFrom(__dirname, 3);
  Common.printOut(
    cst.PREFIX_MSG_MOD +
      'Calling ' +
      chalk.bold.red('[NPM]') +
      ' to install ' +
      module_name +
      ' ...',
  );

  const install_instance = spawn(
    cst.IS_WINDOWS ? 'npm.cmd' : 'npm',
    ['install', module_name, '--loglevel=error'],
    {
      stdio: 'inherit',
      env: process.env,
      cwd: node_module_path,
      shell: cst.IS_WINDOWS,
    },
  );

  install_instance.on('close', function (code) {
    if (code > 0) return cb(new Error('Module install failed'));
    return cb(null);
  });

  install_instance.on('error', function (err) {
    console.error(err.stack || err);
  });
}
