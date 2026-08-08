var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');

var Utility = require('../../dist/lib/Utility.js');

// startLogging replaces each path in `stds` with an open write stream, in place. The walk that
// does it recurses over a list it splices as it goes, so the interesting cases are the entries
// it must skip rather than open: a stream that is already there, and the paths that mean
// "discard this".
describe('Utility.startLogging', function () {
  var dir;

  beforeEach(function () {
    dir = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-logging-'));
  });

  afterEach(function () {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  var pathIn = function (name) {
    return pth.join(dir, name);
  };

  it('should open a stream for every path it is given', function (done) {
    var stds = { out: pathIn('out.log'), err: pathIn('err.log') };

    Utility.startLogging(stds, function (err) {
      assert(!err);
      assert.strictEqual(typeof stds.out.write, 'function');
      assert.strictEqual(typeof stds.err.write, 'function');
      done();
    });
  });

  // The opened stream carries the path it came from, which is how reloadLogs knows what to
  // reopen. Losing it would only show up the next time logs were rotated.
  it('should record the file each stream was opened from', function (done) {
    var stds = { out: pathIn('out.log') };

    Utility.startLogging(stds, function () {
      assert.strictEqual(stds.out._file, pathIn('out.log'));
      done();
    });
  });

  it('should create the file on disk', function (done) {
    var stds = { out: pathIn('out.log') };

    Utility.startLogging(stds, function () {
      assert(fs.existsSync(pathIn('out.log')));
      done();
    });
  });

  it('should leave a /dev/null path alone rather than opening it', function (done) {
    var stds = { out: '/dev/null' };

    Utility.startLogging(stds, function (err) {
      assert(!err);
      assert.strictEqual(stds.out, '/dev/null');
      done();
    });
  });

  it('should leave a NULL path alone rather than opening it', function (done) {
    var stds = { out: 'NULL' };

    Utility.startLogging(stds, function (err) {
      assert(!err);
      assert.strictEqual(stds.out, 'NULL');
      done();
    });
  });

  // `pm2 reloadLogs` hands back entries that are already open streams. Reopening one would leak
  // the old descriptor, so the walk skips anything that looks like a stream.
  it('should skip an entry that is already an open stream', function (done) {
    var existing = fs.createWriteStream(pathIn('already.log'), { flags: 'a' });

    existing.on('open', function () {
      var stds = { out: existing, err: pathIn('err.log') };

      Utility.startLogging(stds, function (err) {
        assert(!err);
        assert.strictEqual(stds.out, existing);
        assert.strictEqual(typeof stds.err.write, 'function');
        existing.end();
        done();
      });
    });
  });

  it('should call back when there is nothing to open', function (done) {
    Utility.startLogging({}, function (err) {
      assert(!err);
      done();
    });
  });
});
