var assert = require('assert');
var pth = require('path');
var withEnv = require('../helpers/env.js').withEnv;

var CONSTANTS_PATH = require.resolve('../../dist/constants.js');
var PATHS_PATH = require.resolve('../../dist/paths.js');

// Every value is computed once, at require time, from the environment as it stood then. Reading
// a different environment means loading the module again from scratch.
var loadConstants = function () {
  delete require.cache[CONSTANTS_PATH];
  delete require.cache[PATHS_PATH];
  return require('../../dist/constants.js');
};

describe('constants', function () {
  after(function () {
    loadConstants();
  });

  describe('defaults', function () {
    it('should use the built-in numbers when nothing is set', function () {
      withEnv(
        {
          PM2_CONCURRENT_ACTIONS: undefined,
          PM2_API_PORT: undefined,
          KEYMETRICS_PUSH_PORT: undefined,
          PM2_GRACEFUL_TIMEOUT: undefined,
        },
        function () {
          var cst = loadConstants();
          assert.strictEqual(cst.CONCURRENT_ACTIONS, 2);
          assert.strictEqual(cst.WEB_PORT, 9615);
          assert.strictEqual(cst.REMOTE_PORT_TCP, 80);
          assert.strictEqual(cst.GRACEFUL_TIMEOUT, 8000);
        },
      );
    });

    it('should expose the exit codes and statuses pm2 branches on', function () {
      var cst = loadConstants();
      assert.strictEqual(cst.SUCCESS_EXIT, 0);
      assert.strictEqual(cst.ERROR_EXIT, 1);
      assert.strictEqual(cst.ONLINE_STATUS, 'online');
      assert.strictEqual(cst.STOPPED_STATUS, 'stopped');
      assert.strictEqual(cst.CLUSTER_MODE_ID, 'cluster_mode');
      assert.strictEqual(cst.FORK_MODE_ID, 'fork_mode');
    });

    it('should report platform flags as booleans', function () {
      var cst = loadConstants();
      assert.strictEqual(typeof cst.IS_WINDOWS, 'boolean');
      assert.strictEqual(typeof cst.IS_BUN, 'boolean');
      assert.strictEqual(cst.IS_WINDOWS, process.platform === 'win32');
    });
  });

  describe('numbers taken from the environment', function () {
    it('should parse a value that is a number', function () {
      withEnv({ PM2_API_PORT: '1234', PM2_CONCURRENT_ACTIONS: '8' }, function () {
        var cst = loadConstants();
        assert.strictEqual(cst.WEB_PORT, 1234);
        assert.strictEqual(cst.CONCURRENT_ACTIONS, 8);
      });
    });

    // parseInt('nonsense') is NaN, which is falsy, so the default takes over. Losing that would
    // put NaN into a port number and fail somewhere far away from the cause.
    it('should fall back to the default when the value is not a number', function () {
      withEnv({ PM2_API_PORT: 'nonsense', KEYMETRICS_PUSH_PORT: '' }, function () {
        var cst = loadConstants();
        assert.strictEqual(cst.WEB_PORT, 9615);
        assert.strictEqual(cst.REMOTE_PORT_TCP, 80);
      });
    });

    it('should fall back when the value is zero, as it always has', function () {
      withEnv({ PM2_API_PORT: '0' }, function () {
        assert.strictEqual(loadConstants().WEB_PORT, 9615);
      });
    });
  });

  describe('strings taken from the environment', function () {
    it('should prefer INSTANCE_NAME over the other machine-name variables', function () {
      withEnv(
        { INSTANCE_NAME: 'first', MACHINE_NAME: 'second', PM2_MACHINE_NAME: 'third' },
        function () {
          assert.strictEqual(loadConstants().MACHINE_NAME, 'first');
        },
      );
    });

    it('should fall through the machine-name variables in order', function () {
      withEnv({ INSTANCE_NAME: undefined, MACHINE_NAME: 'second' }, function () {
        assert.strictEqual(loadConstants().MACHINE_NAME, 'second');
      });
    });

    it('should keep an explicitly empty log date format', function () {
      withEnv({ PM2_LOG_DATE_FORMAT: '' }, function () {
        assert.strictEqual(loadConstants().PM2_LOG_DATE_FORMAT, '');
      });
    });

    it('should use the default log date format when unset', function () {
      withEnv({ PM2_LOG_DATE_FORMAT: undefined }, function () {
        assert.strictEqual(loadConstants().PM2_LOG_DATE_FORMAT, 'YYYY-MM-DDTHH:mm:ss');
      });
    });
  });

  describe('merged path structure', function () {
    it('should carry every path from paths.js', function () {
      withEnv({ OVER_HOME: '/over/home' }, function () {
        var cst = loadConstants();
        assert.strictEqual(cst.PM2_HOME, '/over/home');
        assert.strictEqual(cst.PM2_LOG_FILE_PATH, pth.resolve('/over/home', 'pm2.log'));
        assert.strictEqual(cst.DUMP_FILE_PATH, pth.resolve('/over/home', 'dump.pm2'));
      });
    });

    it('should point the template folder at the code that ships beside it', function () {
      var cst = loadConstants();
      assert.strictEqual(
        cst.TEMPLATE_FOLDER,
        pth.join(pth.dirname(CONSTANTS_PATH), 'lib/templates'),
      );
    });
  });
});
