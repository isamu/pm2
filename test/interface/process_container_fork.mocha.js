var assert = require('assert');
var fork = require('child_process').fork;
var pth = require('path');

var FIXTURES = pth.join(__dirname, '..', 'fixtures', 'process-container');
var CONTAINER = pth.join(__dirname, '..', '..', 'dist', 'lib', 'ProcessContainerFork.js');
var BUN_CONTAINER = pth.join(__dirname, '..', '..', 'dist', 'lib', 'ProcessContainerForkBun.js');

/**
 * These run as the entry point of every forked application, so the only honest way to test them
 * is to fork them and see what the application on the other side got.
 */
var runContainer = function (container, env, done) {
  var messages = [];
  var child = fork(container, [], {
    env: Object.assign({}, process.env, { pmx: 'false' }, env),
    silent: true,
  });

  child.on('message', function (message) {
    messages.push(message);
  });

  var finished = false;
  var finish = function (err) {
    if (finished) return;
    finished = true;
    child.kill();
    done(err, messages);
  };

  // The fixture reports and then the container leaves the process alive, so stop on the first
  // message rather than on exit.
  var deadline = setTimeout(function () {
    finish(null);
  }, 4000);

  child.on('message', function () {
    if (messages.length >= 2) {
      clearTimeout(deadline);
      finish(null);
    }
  });

  child.on('error', function (err) {
    clearTimeout(deadline);
    finish(err);
  });
};

var reportFrom = function (messages) {
  return messages.find(function (message) {
    return message && message.ran;
  });
};

describe('ProcessContainerFork', function () {
  this.timeout(20000);

  it('should load the application it was pointed at', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      assert.ok(reportFrom(messages), 'the application never ran');
      done();
    });
  });

  it('should announce the node version it is running under', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      var announced = messages.find(function (message) {
        return message && message.node_version;
      });
      assert.strictEqual(announced.node_version, process.versions.node);
      done();
    });
  });

  it('should name the process after the script', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      assert.strictEqual(reportFrom(messages).title, 'node ' + script);
      done();
    });
  });

  it('should use PROCESS_TITLE when one is given', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    var env = { pm_exec_path: script, PROCESS_TITLE: 'chosen-name' };
    runContainer(CONTAINER, env, function (err, messages) {
      assert.ifError(err);
      assert.strictEqual(reportFrom(messages).title, 'chosen-name');
      done();
    });
  });

  // node treats a script it was handed directly as not-yet-loaded, and pm2 copies that so the
  // application sees what it would have seen under `node app.js`.
  it('should leave mainModule marked unloaded', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      assert.strictEqual(reportFrom(messages).isMainLoaded, false);
      done();
    });
  });

  it('should import an ES module rather than requiring it', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.mjs');
    runContainer(CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      var report = reportFrom(messages);
      assert.ok(report, 'the ES module never ran');
      assert.strictEqual(report.esm, true);
      done();
    });
  });

  it('should refuse to start with no script to run', function (done) {
    var child = fork(CONTAINER, [], {
      env: Object.assign({}, process.env, { pmx: 'false', pm_exec_path: '' }),
      silent: true,
    });
    var stderr = '';
    child.stderr.on('data', function (chunk) {
      stderr += chunk;
    });
    child.on('exit', function (code) {
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.indexOf('Could not') !== -1, stderr);
      done();
    });
  });
});

describe('ProcessContainerForkBun', function () {
  this.timeout(20000);

  it('should load the application it was pointed at', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(BUN_CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      assert.ok(reportFrom(messages), 'the application never ran');
      done();
    });
  });

  it('should name the process after the script', function (done) {
    var script = pth.join(FIXTURES, 'reports-back.js');
    runContainer(BUN_CONTAINER, { pm_exec_path: script }, function (err, messages) {
      assert.ifError(err);
      assert.strictEqual(reportFrom(messages).title, 'bun ' + script);
      done();
    });
  });
});
