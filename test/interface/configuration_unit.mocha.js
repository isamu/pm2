var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');

// Configuration reads cst.PM2_MODULE_CONF_FILE, which paths.js derives from PM2_HOME at the
// moment constants.js is first required. Pointing HOME somewhere disposable therefore means
// re-requiring the whole chain, not just setting the variable.
var DIST = pth.join(__dirname, '..', '..', 'dist');

var loadConfiguration = function (home) {
  process.env.PM2_HOME = home;
  [
    pth.join(DIST, 'paths.js'),
    pth.join(DIST, 'constants.js'),
    pth.join(DIST, 'lib', 'Configuration.js'),
  ].forEach(function (mod) {
    delete require.cache[require.resolve(mod)];
  });
  return require(pth.join(DIST, 'lib', 'Configuration.js'));
};

describe('Configuration', function () {
  var home, previousHome, confPath, Configuration;

  beforeEach(function () {
    previousHome = process.env.PM2_HOME;
    home = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-conf-'));
    confPath = pth.join(home, 'module_conf.json');
    fs.writeFileSync(confPath, '{}');
    Configuration = loadConfiguration(home);
  });

  afterEach(function () {
    if (previousHome === undefined) delete process.env.PM2_HOME;
    else process.env.PM2_HOME = previousHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  var readConf = function () {
    return JSON.parse(fs.readFileSync(confPath, 'utf8'));
  };

  describe('.getAllSync', function () {
    it('should return the whole configuration', function () {
      fs.writeFileSync(confPath, JSON.stringify({ alpha: 'one' }));
      assert.deepStrictEqual(Configuration.getAllSync(), { alpha: 'one' });
    });

    // Every sync reader funnels through here, so a missing file has to answer something a
    // caller can index into rather than throwing out of an unrelated call.
    it('should return an empty object when the file is missing', function () {
      fs.rmSync(confPath);
      assert.deepStrictEqual(Configuration.getAllSync(), {});
    });
  });

  describe('.setSync / .getSync', function () {
    it('should round-trip a flat key', function () {
      Configuration.setSync('alpha', 'one');
      assert.strictEqual(Configuration.getSync('alpha'), 'one');
      assert.deepStrictEqual(readConf(), { alpha: 'one' });
    });

    it('should treat a dotted key as a path', function () {
      Configuration.setSync('module.option', 'value');
      assert.deepStrictEqual(readConf(), { module: { option: 'value' } });
      assert.strictEqual(Configuration.getSync('module.option'), 'value');
    });

    it('should treat a colon key as a path', function () {
      Configuration.setSync('module:option', 'value');
      assert.deepStrictEqual(readConf(), { module: { option: 'value' } });
    });

    it('should keep quoted segments whole', function () {
      Configuration.setSync('"one.two"', 'value');
      assert.deepStrictEqual(readConf(), { 'one.two': 'value' });
    });

    it('should answer null for a key that is not set', function () {
      assert.strictEqual(Configuration.getSync('absent'), null);
    });

    it('should answer null for a path through a key that is not set', function () {
      assert.strictEqual(Configuration.getSync('absent.deeper'), null);
    });

    it('should replace a scalar standing where a path needs an object', function () {
      Configuration.setSync('alpha', 'one');
      Configuration.setSync('alpha.beta', 'two');
      assert.deepStrictEqual(readConf(), { alpha: { beta: 'two' } });
    });
  });

  describe('.unsetSync', function () {
    it('should remove a flat key', function () {
      Configuration.setSync('alpha', 'one');
      Configuration.unsetSync('alpha');
      assert.deepStrictEqual(readConf(), {});
    });

    it('should remove a nested key and keep its parent', function () {
      Configuration.setSync('module.first', 'one');
      Configuration.setSync('module.second', 'two');
      Configuration.unsetSync('module.first');
      assert.deepStrictEqual(readConf(), { module: { second: 'two' } });
    });

    it('should return null when there is no file to edit', function () {
      fs.rmSync(confPath);
      assert.strictEqual(Configuration.unsetSync('alpha'), null);
    });
  });

  describe('.setSyncIfNotExist', function () {
    it('should write the value when the key is absent', function () {
      Configuration.setSyncIfNotExist('module.option', 'value');
      assert.strictEqual(Configuration.getSync('module.option'), 'value');
    });

    it('should leave an existing value alone', function () {
      Configuration.setSync('module.option', 'original');
      assert.strictEqual(Configuration.setSyncIfNotExist('module.option', 'replacement'), null);
      assert.strictEqual(Configuration.getSync('module.option'), 'original');
    });

    it('should return null when there is no file to read', function () {
      fs.rmSync(confPath);
      assert.strictEqual(Configuration.setSyncIfNotExist('alpha', 'one'), null);
    });
  });

  describe('.set / .get / .getAll / .unset', function () {
    it('should round-trip a key', function (done) {
      Configuration.set('alpha', 'one', function (err) {
        assert.strictEqual(err, null);
        Configuration.get('alpha', function (getErr, value) {
          assert.strictEqual(getErr, null);
          assert.strictEqual(value, 'one');
          done();
        });
      });
    });

    it('should report an unknown key rather than answering with it', function (done) {
      Configuration.get('absent', function (err, value) {
        assert.deepStrictEqual(err, { err: 'Unknown key' });
        assert.strictEqual(value, null);
        done();
      });
    });

    it('should hand back everything it holds', function (done) {
      Configuration.set('alpha', 'one', function () {
        Configuration.getAll(function (err, conf) {
          assert.strictEqual(err, null);
          assert.deepStrictEqual(conf, { alpha: 'one' });
          done();
        });
      });
    });

    it('should surface the read error when the file is missing', function (done) {
      fs.rmSync(confPath);
      Configuration.getAll(function (err) {
        assert(err instanceof Error);
        done();
      });
    });

    it('should remove a key', function (done) {
      Configuration.set('alpha', 'one', function () {
        Configuration.unset('alpha', function (err) {
          assert.strictEqual(err, null);
          assert.deepStrictEqual(readConf(), {});
          done();
        });
      });
    });

    // 'all' is the documented way to wipe the file, and it is spelled as a key rather than a
    // separate call, so it has to survive being routed through the same path-splitting.
    it('should empty the file for the key "all"', function (done) {
      Configuration.set('alpha', 'one', function () {
        Configuration.unset('all', function (err) {
          assert.strictEqual(err, null);
          assert.deepStrictEqual(readConf(), {});
          done();
        });
      });
    });
  });

  describe('.multiset', function () {
    it('should set every key/value pair in the string', function (done) {
      Configuration.multiset('alpha one beta two', function (err) {
        assert(!err);
        assert.deepStrictEqual(readConf(), { alpha: 'one', beta: 'two' });
        done();
      });
    });

    it('should keep a quoted value whole', function (done) {
      Configuration.multiset('alpha "one two"', function (err) {
        assert(!err);
        assert.strictEqual(readConf().alpha, '"one two"');
        done();
      });
    });
  });

  // CVE territory: splitKey answers [] for __proto__/constructor/prototype so no path walk can
  // reach Object.prototype. The pollution itself is what matters — see the note in docs/logs.md
  // about the empty list falling through to a raw assignment, which is why these assert on the
  // prototype rather than on the file.
  describe('prototype pollution', function () {
    it('should not reach Object.prototype through __proto__', function (done) {
      Configuration.set('__proto__.polluted', 'yes', function () {
        assert.strictEqual({}.polluted, undefined);
        done();
      });
    });

    it('should not reach Object.prototype through constructor.prototype', function (done) {
      Configuration.set('constructor.prototype.polluted', 'yes', function () {
        assert.strictEqual({}.polluted, undefined);
        done();
      });
    });

    it('should not reach Object.prototype through setSync', function () {
      Configuration.setSync('__proto__.polluted', 'yes');
      assert.strictEqual({}.polluted, undefined);
    });
  });
});
