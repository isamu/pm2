var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var fork = require('child_process').fork;

var FIXTURES = pth.join(__dirname, '..', 'fixtures', 'process-container');
var CONTAINER = pth.join(__dirname, '..', '..', 'dist', 'lib', 'ProcessContainer.js');

/**
 * ProcessContainer wraps every application pm2 runs in cluster mode: it replaces process.send,
 * process.stdout.write and process.stderr.write before loading the app, so that what the app
 * prints reaches both the log file and the daemon's bus. Forking it with a real pm2_env and
 * watching both channels is the only way to see that the replacements still do their job.
 */
var runContainer = function (pm2_env, done) {
  var messages = [];
  var child = fork(CONTAINER, [], {
    env: Object.assign({}, process.env, { pmx: 'false', pm2_env: JSON.stringify(pm2_env) }),
    silent: true,
  });

  var finished = false;
  var finish = function (err) {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    child.kill();
    done(err, messages);
  };

  var deadline = setTimeout(function () {
    finish(null);
  }, 5000);

  child.on('message', function (message) {
    messages.push(message);
    if (message && message.type === 'test:report') setTimeout(finish, 150);
  });

  child.on('error', finish);
};

describe('ProcessContainer', function () {
  this.timeout(15000);

  // The cluster-mode container for node; Bun gets ProcessContainerBun. fork() launches whatever
  // runs this suite, so under Bun this would be running the wrong one.
  before(function () {
    if (typeof process.versions.bun === 'string') this.skip();
  });

  var dir, pm2_env, messages;

  before(function (done) {
    dir = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-container-'));
    pm2_env = {
      name: 'container-under-test',
      pm_id: 0,
      pm_exec_path: pth.join(FIXTURES, 'writes-to-stdout.js'),
      pm_cwd: FIXTURES,
      pm_out_log_path: pth.join(dir, 'out.log'),
      pm_err_log_path: pth.join(dir, 'err.log'),
      pm_pid_path: pth.join(dir, 'app.pid'),
    };

    runContainer(pm2_env, function (err, collected) {
      messages = collected;
      done(err);
    });
  });

  after(function () {
    // `before` skips the whole suite under Bun, so there may be nothing to clean up.
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  var messageOfType = function (type) {
    return messages.filter(function (message) {
      return message && message.type === type;
    })[0];
  };

  // The replacement only forwards while process.connected, so a message arriving at all is what
  // shows it forwards rather than swallowing.
  it('should still forward messages through the replaced process.send', function () {
    var announced = messages.filter(function (message) {
      return message && message.node_version;
    })[0];
    assert(announced, 'no node_version was announced: ' + JSON.stringify(messages));
    assert.strictEqual(announced.node_version, process.versions.node);
  });

  it('should route what the app prints to the daemon bus', function () {
    var logged = messageOfType('log:out');
    assert(logged, 'nothing was sent as log:out: ' + JSON.stringify(messages));
    assert.strictEqual(logged.data, 'hello from the app\n');
  });

  it('should write what the app prints to the out log', function () {
    assert.strictEqual(fs.readFileSync(pm2_env.pm_out_log_path, 'utf8'), 'hello from the app\n');
  });

  it('should write the pid file', function () {
    assert(fs.existsSync(pm2_env.pm_pid_path));
  });

  // write() owes its caller a boolean. The replacement has always answered with something falsy
  // — nothing here ever emits 'drain' — and it now says so in the type the contract asks for.
  it('should answer write() with a boolean', function () {
    var report = messageOfType('test:report');
    assert(report, 'the app never reported: ' + JSON.stringify(messages));
    assert.strictEqual(report.returned_type, 'boolean');
    assert.strictEqual(report.returned, false);
  });
});
