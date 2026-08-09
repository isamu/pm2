var assert = require('assert');
var sexec = require('../../dist/lib/tools/sexec.js');

describe('sexec', function () {
  this.timeout(20000);

  it('should report exit code 0 and the output of a command that works', function (done) {
    sexec('echo hello', { silent: true }, function (code, stdout, stderr) {
      assert.strictEqual(code, 0);
      assert.strictEqual(stdout, 'hello\n');
      assert.strictEqual(stderr, '');
      done();
    });
  });

  it('should report the exit code of a command that fails', function (done) {
    sexec('exit 3', { silent: true }, function (code) {
      assert.strictEqual(code, 3);
      done();
    });
  });

  it('should hand back what the command wrote to stderr', function (done) {
    sexec('echo oops 1>&2', { silent: true }, function (code, stdout, stderr) {
      assert.strictEqual(code, 0);
      assert.strictEqual(stderr, 'oops\n');
      done();
    });
  });

  it('should accept the callback in place of the options', function (done) {
    sexec('echo second-form', function (code, stdout) {
      assert.strictEqual(code, 0);
      assert.strictEqual(stdout, 'second-form\n');
      done();
    });
  });

  it('should run in the directory it is told to', function (done) {
    sexec('pwd', { silent: true, cwd: '/' }, function (code, stdout) {
      assert.strictEqual(code, 0);
      assert.strictEqual(stdout.trim(), '/');
      done();
    });
  });

  it('should pass the environment through', function (done) {
    var env = Object.assign({}, process.env, { PM2_SEXEC_PROBE: 'set-by-test' });
    sexec('echo $PM2_SEXEC_PROBE', { silent: true, env: env }, function (code, stdout) {
      assert.strictEqual(stdout.trim(), 'set-by-test');
      done();
    });
  });

  // Callers reuse the object they pass in; writing to it made the second call behave
  // differently from the first for no reason the caller could see.
  it('should not modify the options object it was given', function (done) {
    var options = { silent: true };
    sexec('echo x', options, function () {
      assert.deepStrictEqual(options, { silent: true });
      done();
    });
  });

  // Documented, not endorsed. The empty-command guard only returns if console.error itself
  // throws, so the empty string reaches exec and it rejects it synchronously — the callback
  // never runs. Reachable: Startup.js builds its command with commands.join('&& ').
  it('should report an empty command through the callback rather than throwing', function (done) {
    assert.doesNotThrow(function () {
      sexec('', { silent: true }, function (code, stdout, stderr) {
        assert.notStrictEqual(code, 0, 'an empty command is not a success');
        assert.strictEqual(stdout, '');
        assert(stderr.length > 0, 'the reason should reach the caller');
        done();
      });
    });
  });

  it('should not spawn anything for an empty command', function (done) {
    var started = Date.now();
    sexec('', { silent: true }, function () {
      // A spawn would cost milliseconds and a process; answering directly costs neither.
      assert(Date.now() - started < 100);
      done();
    });
  });
});
