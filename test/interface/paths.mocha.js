var assert = require('assert');
var pth = require('path');
var paths = require('../../dist/paths.js');
var withEnv = require('../helpers/env.js').withEnv;

describe('paths', function () {
  describe('derived from PM2_HOME', function () {
    it('should hang every path off the home it was given', function () {
      var resolved = paths('/base');
      assert.strictEqual(resolved.PM2_HOME, '/base');
      assert.strictEqual(resolved.PM2_ROOT_PATH, '/base');
      assert.strictEqual(resolved.PM2_LOG_FILE_PATH, pth.resolve('/base', 'pm2.log'));
      assert.strictEqual(resolved.DEFAULT_LOG_PATH, pth.resolve('/base', 'logs'));
      assert.strictEqual(resolved.DUMP_FILE_PATH, pth.resolve('/base', 'dump.pm2'));
    });

    it('should resolve a relative home to an absolute path', function () {
      assert.strictEqual(paths('./rel').PM2_LOG_FILE_PATH, pth.resolve('./rel', 'pm2.log'));
    });

    it('should report no embedded node when none is bundled', function () {
      var resolved = paths('/base');
      assert.strictEqual(resolved.HAS_NODE_EMBEDDED, false);
      assert.strictEqual(resolved.BUILTIN_NODE_PATH, null);
      assert.strictEqual(resolved.BUILTIN_NPM_PATH, null);
    });
  });

  describe('environment overrides', function () {
    it('should take a path from the variable of the same name', function () {
      withEnv({ PM2_LOG_FILE_PATH: '/custom/pm2.log' }, function () {
        assert.strictEqual(paths('/base').PM2_LOG_FILE_PATH, '/custom/pm2.log');
      });
    });

    // DEFAULT_LOG_PATH has no PM2_ of its own, so the variable that overrides it gains one.
    it('should prefix a key that does not already carry PM2_', function () {
      withEnv({ PM2_DEFAULT_LOG_PATH: '/custom/logs' }, function () {
        assert.strictEqual(paths('/base').DEFAULT_LOG_PATH, '/custom/logs');
      });
    });

    // Every other path is derived from these two, so honouring an override here would leave the
    // rest pointing at the old home.
    it('should refuse to move PM2_HOME or PM2_ROOT_PATH', function () {
      withEnv({ PM2_HOME: '/ignored', PM2_ROOT_PATH: '/ignored-too' }, function () {
        var resolved = paths('/base');
        assert.strictEqual(resolved.PM2_HOME, '/base');
        assert.strictEqual(resolved.PM2_ROOT_PATH, '/base');
      });
    });

    it('should treat an empty variable as absent', function () {
      withEnv({ PM2_LOG_FILE_PATH: '' }, function () {
        assert.strictEqual(paths('/base').PM2_LOG_FILE_PATH, pth.resolve('/base', 'pm2.log'));
      });
    });

    it('should apply several overrides at once', function () {
      withEnv(
        { PM2_PID_FILE_PATH: '/custom/pm2.pid', PM2_DEFAULT_PID_PATH: '/custom/pids' },
        function () {
          var resolved = paths('/base');
          assert.strictEqual(resolved.PM2_PID_FILE_PATH, '/custom/pm2.pid');
          assert.strictEqual(resolved.DEFAULT_PID_PATH, '/custom/pids');
          assert.strictEqual(resolved.DUMP_FILE_PATH, pth.resolve('/base', 'dump.pm2'));
        },
      );
    });
  });

  describe('with no home given', function () {
    it('should fall back to PM2_HOME from the environment', function () {
      withEnv({ PM2_HOME: '/from/env' }, function () {
        assert.strictEqual(paths().PM2_HOME, '/from/env');
      });
    });
  });
});
