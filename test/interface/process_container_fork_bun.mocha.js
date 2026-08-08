var assert = require('assert');
var fs = require('fs');
var pth = require('path');
var fork = require('child_process').fork;
var FIXTURES = pth.join(__dirname, '..', 'fixtures', 'process-container');
var BUN_CONTAINER = pth.join(__dirname, '..', '..', 'dist', 'lib', 'ProcessContainerForkBun.js');

// Looked up by walking PATH rather than by running `which`, so finding out whether Bun is here
// does not itself mean spawning a command resolved through PATH.
var bunPath = (function () {
  var names = process.platform === 'win32' ? ['bun.exe', 'bun'] : ['bun'];
  var dirs = (process.env.PATH || '').split(pth.delimiter).filter(Boolean);

  for (var dir = 0; dir < dirs.length; dir++) {
    for (var name = 0; name < names.length; name++) {
      var candidate = pth.join(dirs[dir], names[name]);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
})();

/**
 * The Bun fork container is only ever run BY Bun, and the two runtimes disagree about it: the
 * `main` property of a createRequire() result is writable under node and read-only under Bun.
 * Assigning to it was silent while this file was sloppy-mode JavaScript and throws now that it
 * is compiled TypeScript, which is emitted with "use strict" — so every application started
 * under Bun in fork mode died after loading, and the sibling suite never saw it because that one
 * forks this container with node.
 */
describe('ProcessContainerForkBun under Bun', function () {
  this.timeout(30000);

  before(function () {
    if (!bunPath) this.skip();
    if (!fs.existsSync(BUN_CONTAINER)) this.skip();
  });

  var runUnderBun = function (script, done) {
    var messages = [];
    var stderr = '';

    var child = fork(BUN_CONTAINER, [], {
      execPath: bunPath,
      env: Object.assign({}, process.env, { pmx: 'false', pm_exec_path: script }),
      silent: true,
    });

    child.stderr.on('data', function (chunk) {
      stderr += chunk.toString();
    });
    child.on('message', function (message) {
      messages.push(message);
    });
    child.on('error', done);
    child.on('exit', function (code) {
      done(null, { code: code, messages: messages, stderr: stderr });
    });
  };

  it('should load the application and exit cleanly', function (done) {
    runUnderBun(pth.join(FIXTURES, 'reports-back.js'), function (err, result) {
      assert.ifError(err);
      assert.strictEqual(
        result.stderr,
        '',
        'the container wrote to stderr:\n' + result.stderr.slice(0, 800),
      );
      assert.strictEqual(result.code, 0, 'the container exited with ' + result.code);
      assert.ok(
        result.messages.some(function (message) {
          return message && message.ran === true;
        }),
        'the application never ran: ' + JSON.stringify(result.messages),
      );
      done();
    });
  });

  it('should leave process.mainModule as something the application can read', function (done) {
    runUnderBun(pth.join(FIXTURES, 'reports-back.js'), function (err, result) {
      assert.ifError(err);
      var report = result.messages.filter(function (message) {
        return message && message.ran === true;
      })[0];
      assert.ok(report, 'the application never ran');
      assert.notStrictEqual(report.isMainLoaded, undefined);
      done();
    });
  });
});
