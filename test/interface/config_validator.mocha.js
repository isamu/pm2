var assert = require('assert');
var Config = require('../../dist/lib/tools/Config.js');

var validate = function (json) {
  return Config.validateJSON(json);
};

describe('Config.filterOptions', function () {
  it('should take a value given under its own name', function () {
    assert.strictEqual(Config.filterOptions({ name: 'api' }).name, 'api');
  });

  // schema.json gives script the alias "exec", and every key also gets its camelCase spelling.
  it('should take a value given under an alias', function () {
    assert.strictEqual(Config.filterOptions({ exec: './app.js' }).script, './app.js');
  });

  it('should take a value given in camelCase', function () {
    assert.strictEqual(
      Config.filterOptions({ maxMemoryRestart: '100M' }).max_memory_restart,
      '100M',
    );
  });

  it('should ignore anything the schema does not name', function () {
    assert.deepStrictEqual(Object.keys(Config.filterOptions({ nonsense: 1 })), []);
  });

  it('should keep a falsy value that was actually given', function () {
    assert.strictEqual(Config.filterOptions({ instances: 0 }).instances, 0);
  });
});

describe('Config.validateJSON', function () {
  describe('types', function () {
    it('should accept a value of the declared type', function () {
      var result = validate({ script: './app.js', name: 'api' });
      assert.deepStrictEqual(result.errors, []);
      assert.strictEqual(result.config.name, 'api');
    });

    it('should reject a value of the wrong type and say so', function () {
      var result = validate({ script: './app.js', name: 42 });
      assert.strictEqual(result.errors.length, 1);
      assert(result.errors[0].indexOf('name') !== -1);
      assert.strictEqual(result.config.name, undefined);
    });

    it('should parse a numeric string into a number', function () {
      assert.strictEqual(validate({ script: './app.js', instances: '4' }).config.instances, 4);
    });

    it('should not read a boolean as a number', function () {
      var result = validate({ script: './app.js', instances: true });
      assert.strictEqual(result.errors.length, 1);
    });
  });

  describe('required values and defaults', function () {
    // Documented, not endorsed. validateJSON short-circuits on an undefined value before it
    // calls _valid, so the schema's `require: true` — which only script carries — is never
    // evaluated. _valid produces the error correctly when called directly. Turning it on would
    // make Common.js reject a config with no script, which is a decision for whoever owns that
    // path, so this pins what happens today.
    it('should not complain about a missing required value, though _valid would', function () {
      assert.deepStrictEqual(validate({ name: 'api' }).errors, []);

      Config._errors = [];
      Config._valid('script', undefined);
      assert.strictEqual(Config._errors.length, 1);
      assert(Config._errors[0].indexOf('script') !== -1);
    });

    it('should fill in a default the caller did not give', function () {
      assert.strictEqual(validate({ script: './app.js' }).config.autorestart, true);
    });

    it('should leave a given value alone rather than defaulting it', function () {
      assert.strictEqual(
        validate({ script: './app.js', autorestart: false }).config.autorestart,
        false,
      );
    });
  });

  describe('regex-constrained values', function () {
    it('should accept a spelling the pattern allows', function () {
      var result = validate({ script: './app.js', exec_mode: 'cluster_mode' });
      assert.deepStrictEqual(result.errors, []);
      assert.strictEqual(result.config.exec_mode, 'cluster_mode');
    });

    it('should reject one it does not, with the schema description', function () {
      var result = validate({ script: './app.js', exec_mode: 'sideways' });
      assert.strictEqual(result.errors.length, 1);
      assert(result.errors[0].indexOf('cluster') !== -1);
    });
  });

  describe('sizes written with a suffix', function () {
    it('should read the suffix as a multiplier', function () {
      var config = validate({ script: './app.js', max_memory_restart: '100M' }).config;
      assert.strictEqual(config.max_memory_restart, 100 * 1024 * 1024);
    });

    it('should read K and G as well', function () {
      assert.strictEqual(
        validate({ script: './app.js', max_memory_restart: '2K' }).config.max_memory_restart,
        2048,
      );
      assert.strictEqual(
        validate({ script: './app.js', max_memory_restart: '1G' }).config.max_memory_restart,
        1024 * 1024 * 1024,
      );
    });

    it('should take a plain number as bytes', function () {
      assert.strictEqual(
        validate({ script: './app.js', max_memory_restart: 1048576 }).config.max_memory_restart,
        1048576,
      );
    });

    // The regex on max_memory_restart only allows K, M and G, so an unknown suffix is rejected
    // before the multiplier lookup ever sees it.
    it('should reject a suffix the pattern does not allow', function () {
      var result = validate({ script: './app.js', max_memory_restart: '100X' });
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.config.max_memory_restart, undefined);
    });
  });

  describe('args given as a string', function () {
    it('should split on whitespace', function () {
      assert.deepStrictEqual(validate({ script: './app.js', args: 'one two' }).config.args, [
        'one',
        'two',
      ]);
    });

    it('should keep a quoted run together and drop the quotes', function () {
      assert.deepStrictEqual(
        validate({ script: './app.js', args: 'key="a b" other' }).config.args,
        ['key="a b"', 'other'],
      );
    });

    it('should leave an array alone', function () {
      assert.deepStrictEqual(validate({ script: './app.js', args: ['a', 'b'] }).config.args, [
        'a',
        'b',
      ]);
    });
  });

  describe('keys the schema does not know', function () {
    it('should drop them rather than passing them through', function () {
      var config = validate({ script: './app.js', not_a_pm2_option: 'x' }).config;
      assert.strictEqual(config.not_a_pm2_option, undefined);
    });

    // The keys come out of the user's own ecosystem file, so a name that happens to exist on
    // Object.prototype must not be mistaken for a schema entry and carried through.
    it('should not carry through a name off the prototype chain', function () {
      var config = validate({ script: './app.js', constructor: 'x', toString: 'y' }).config;
      assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'constructor'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'toString'), false);
    });
  });

  describe('errors from one call not leaking into the next', function () {
    it('should report only what the current config got wrong', function () {
      validate({ name: 42 });
      var second = validate({ script: './app.js', name: 'api' });
      assert.deepStrictEqual(second.errors, []);
    });
  });
});
