var assert = require('assert');
var miniDisplay = require('../../dist/lib/API/UX/pm2-ls-minimal.js');

var captureLog = function (body) {
  var lines = [];
  var original = console.log;
  console.log = function () {
    lines.push(Array.prototype.slice.call(arguments).join(' '));
  };
  try {
    body();
  } finally {
    console.log = original;
  }
  return lines;
};

var show = function (list) {
  return captureLog(function () {
    miniDisplay(list);
  });
};

var lineFor = function (lines, label) {
  return lines.find(function (line) {
    return line.indexOf(label + ' :') === 0;
  });
};

var ONLINE = {
  pid: 4242,
  monit: { memory: 2 * 1024 * 1024 },
  pm2_env: {
    name: 'api',
    namespace: 'default',
    version: '1.0.0',
    pm_id: 0,
    status: 'online',
    exec_mode: 'cluster_mode',
    restart_time: 3,
    pm_uptime: Date.now() - 5000,
    pm_err_log_path: '/logs/api-error.log',
    pm_pid_path: '/pids/api.pid',
    watch: true,
  },
};

describe('pm2 ls -m', function () {
  it('should print a heading and the fields for each process', function () {
    var lines = show([ONLINE]);
    assert.ok(
      lines.some((line) => line.indexOf('+--- %s api') === 0 || line.indexOf('api') !== -1),
    );
    assert.strictEqual(lineFor(lines, 'pid'), 'pid : %s 4242');
    assert.strictEqual(lineFor(lines, 'status'), 'status : %s online');
    assert.strictEqual(lineFor(lines, 'restarted'), 'restarted : %d 3');
  });

  it('should drop the _mode suffix from the execution mode', function () {
    assert.strictEqual(lineFor(show([ONLINE]), 'mode'), 'mode : %s cluster');
  });

  it('should render memory in human units', function () {
    assert.strictEqual(lineFor(show([ONLINE]), 'memory usage'), 'memory usage : %s 2.0mb ');
  });

  it('should say watching yes or no rather than the raw value', function () {
    assert.strictEqual(lineFor(show([ONLINE]), 'watching'), 'watching : %s yes');
  });

  it('should print nothing at all for an empty list', function () {
    assert.deepStrictEqual(show([]), []);
  });

  describe('processes that have not reported everything', function () {
    var without = function (field) {
      var copy = JSON.parse(JSON.stringify(ONLINE));
      delete copy.pm2_env[field];
      return copy;
    };

    // A daemon that has just started, or one restarting, hands back entries with fields still
    // missing. Losing the whole listing over one of them is not a useful trade.
    it('should survive a process with no exec_mode', function () {
      var lines = show([without('exec_mode')]);
      assert.ok(lineFor(lines, 'mode'));
    });

    it('should fall back to the script name when there is no name', function () {
      var entry = without('name');
      entry.pm2_env.pm_exec_path = '/apps/worker.js';
      var lines = show([entry]);
      assert.ok(lines.some((line) => line.indexOf('worker.js') !== -1));
    });

    it('should survive a process with neither a name nor a script path', function () {
      var lines = show([without('name')]);
      assert.ok(lines.length > 0);
    });

    it('should leave memory blank when there is no monit data', function () {
      var entry = JSON.parse(JSON.stringify(ONLINE));
      delete entry.monit;
      assert.strictEqual(lineFor(show([entry]), 'memory usage'), 'memory usage : %s ');
    });

    it('should show no uptime for a process that is not online', function () {
      var entry = JSON.parse(JSON.stringify(ONLINE));
      entry.pm2_env.status = 'stopped';
      assert.strictEqual(lineFor(show([entry]), 'uptime'), 'uptime : %s 0');
    });
  });
});
