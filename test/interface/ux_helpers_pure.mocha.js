var assert = require('assert');
var helpers = require('../../dist/lib/API/UX/helpers.js');

var ESCAPE = String.fromCharCode(27);

var plain = function (text) {
  return String(text)
    .split(ESCAPE)
    .join('')
    .replace(/\[[0-9;]*m/g, '');
};

describe('UX.helpers.bytesToSize', function () {
  it('should keep bytes under a kilobyte as bytes', function () {
    assert.strictEqual(helpers.bytesToSize(0, 1), '0b ');
    assert.strictEqual(helpers.bytesToSize(512, 1), '512b ');
  });

  it('should step up through each unit', function () {
    assert.strictEqual(helpers.bytesToSize(1024, 1), '1.0kb ');
    assert.strictEqual(helpers.bytesToSize(1024 * 1024, 2), '1.00mb ');
    assert.strictEqual(helpers.bytesToSize(1024 * 1024 * 1024, 0), '1gb ');
    assert.strictEqual(helpers.bytesToSize(Math.pow(1024, 4), 1), '1.0tb ');
  });

  it('should honour the requested precision', function () {
    assert.strictEqual(helpers.bytesToSize(1536, 3), '1.500kb ');
  });

  it('should fall back to bytes for a negative figure', function () {
    assert.strictEqual(helpers.bytesToSize(-1, 1), '-1b ');
  });
});

describe('UX.helpers.colorStatus', function () {
  it('should read running as online, the way pm2 reports it', function () {
    assert.strictEqual(plain(helpers.colorStatus('running')), 'online');
    assert.strictEqual(plain(helpers.colorStatus('online')), 'online');
  });

  it('should name the other states it knows', function () {
    assert.strictEqual(plain(helpers.colorStatus('restarting')), 'restart');
    assert.strictEqual(plain(helpers.colorStatus('created')), 'created');
    assert.strictEqual(plain(helpers.colorStatus('launching')), 'launching');
  });

  it('should pass an unknown state through rather than hiding it', function () {
    assert.strictEqual(plain(helpers.colorStatus('errored')), 'errored');
    assert.strictEqual(plain(helpers.colorStatus('whatever')), 'whatever');
  });
});

describe('UX.helpers.getNestedProperty', function () {
  var proc = { name: 'api', pm2_env: { status: 'online', axm_options: { isModule: true } } };

  it('should follow a dotted path', function () {
    assert.strictEqual(helpers.getNestedProperty('name', proc), 'api');
    assert.strictEqual(helpers.getNestedProperty('pm2_env.status', proc), 'online');
    assert.strictEqual(helpers.getNestedProperty('pm2_env.axm_options.isModule', proc), true);
  });

  it('should answer undefined for a path that is not there', function () {
    assert.strictEqual(helpers.getNestedProperty('pm2_env.nothing', proc), undefined);
  });

  // The path comes from a whitelist keyed by whatever the user typed after --sort, and a plain
  // object answers for "constructor" and friends. Reaching Object.prototype through a process
  // listing is not a lookup anybody meant to allow.
  it('should not walk into the prototype chain', function () {
    assert.strictEqual(helpers.getNestedProperty('constructor', proc), undefined);
    assert.strictEqual(helpers.getNestedProperty('toString', proc), undefined);
    assert.strictEqual(helpers.getNestedProperty('constructor.prototype', proc), undefined);
  });

  it('should survive a path that runs past a leaf', function () {
    assert.strictEqual(helpers.getNestedProperty('name.length.nope', proc), undefined);
  });

  it('should treat a missing object as empty', function () {
    assert.strictEqual(helpers.getNestedProperty('anything', null), undefined);
  });
});

describe('UX.helpers.colorizedMetric', function () {
  it('should render zero without a colour', function () {
    assert.strictEqual(helpers.colorizedMetric(0, 50, 80, '%'), '0%');
  });

  it('should say N/A for something that is not a number', function () {
    assert.strictEqual(helpers.colorizedMetric('nonsense', 50, 80), 'N/A');
  });

  it('should carry the prefix through', function () {
    assert.strictEqual(plain(helpers.colorizedMetric(10, 50, 80, '%')), '10%');
    assert.strictEqual(plain(helpers.colorizedMetric(90, 50, 80, 'mb')), '90mb');
  });

  // Thresholds the other way round mean lower is worse — free memory rather than load.
  it('should read a reversed pair of thresholds as lower being worse', function () {
    assert.strictEqual(plain(helpers.colorizedMetric(100, 80, 50)), '100');
    assert.strictEqual(plain(helpers.colorizedMetric(10, 80, 50)), '10');
  });
});

describe('UX.helpers.safe_push', function () {
  it('should replace a missing value with N/A', function () {
    var table = [];
    helpers.safe_push(table, { name: undefined }, { pid: null });
    assert.deepStrictEqual(table, [{ name: 'N/A' }, { pid: 'N/A' }]);
  });

  it('should replace the missing entries inside an array value', function () {
    var table = [];
    helpers.safe_push(table, { pids: [1, null, 3] });
    assert.deepStrictEqual(table, [{ pids: [1, 'N/A', 3] }]);
  });

  it('should leave a value that is there alone', function () {
    var table = [];
    helpers.safe_push(table, { name: 'api' }, { pid: 0 });
    assert.deepStrictEqual(table, [{ name: 'api' }, { pid: 0 }]);
  });
});
