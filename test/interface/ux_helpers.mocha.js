var assert = require('assert');
var helpers = require('../../dist/lib/API/UX/helpers.js');

var captureLog = function (body) {
  var lines = [];
  var original = console.log;
  console.log = function () {
    lines.push(Array.prototype.join.call(arguments, ' '));
  };
  try {
    body();
  } finally {
    console.log = original;
  }
  return lines;
};

// Colour codes make the assertions unreadable and depend on whether the runner has a TTY.
var ESCAPE = String.fromCharCode(27);

var withoutColour = function (line) {
  line = line.split(ESCAPE).join('');
  return line.replace(/\[[0-9;]*m/g, '');
};

describe('UX.helpers.dispKeys', function () {
  var conf = {
    'pm2-logrotate': { max_size: '10M', retain: 30 },
    'pm2-server-monit': { drive: '/' },
  };

  it('should print every module when no target is given', function () {
    var lines = captureLog(function () {
      helpers.dispKeys(conf);
    }).map(withoutColour);

    assert.deepStrictEqual(lines, [
      'Module: pm2-logrotate',
      '$ pm2 set pm2-logrotate:max_size 10M',
      '$ pm2 set pm2-logrotate:retain 30',
      'Module: pm2-server-monit',
      '$ pm2 set pm2-server-monit:drive /',
    ]);
  });

  // displayConf() reaches this with undefined rather than null when no app was named, so the
  // two have to stay interchangeable.
  it('should treat undefined the same as null and print everything', function () {
    var withNull = captureLog(function () {
      helpers.dispKeys(conf, null);
    });
    var withUndefined = captureLog(function () {
      helpers.dispKeys(conf, undefined);
    });
    assert.deepStrictEqual(withUndefined, withNull);
  });

  it('should print only the module asked for', function () {
    var lines = captureLog(function () {
      helpers.dispKeys(conf, 'pm2-server-monit');
    }).map(withoutColour);

    assert.deepStrictEqual(lines, [
      'Module: pm2-server-monit',
      '$ pm2 set pm2-server-monit:drive /',
    ]);
  });

  it('should print nothing for a module that is not configured', function () {
    var lines = captureLog(function () {
      helpers.dispKeys(conf, 'not-installed');
    });
    assert.deepStrictEqual(lines, []);
  });

  it('should skip entries that are not settings objects', function () {
    var lines = captureLog(function () {
      helpers.dispKeys({ scalar: 'value', nothing: null, mod: { key: 1 } });
    }).map(withoutColour);

    assert.deepStrictEqual(lines, ['Module: mod', '$ pm2 set mod:key 1']);
  });
});
