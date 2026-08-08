var assert = require('assert');
var pth = require('path');
var execFileSync = require('child_process').execFileSync;

var DIST = pth.join(__dirname, '..', '..', 'dist');

/**
 * Six of API's methods are assigned onto its prototype by the modules required at the bottom of
 * API.js, not written in the class body. Declaring one of them as a class field is enough to
 * break it: a field with no initialiser is still defined on the instance, as undefined, and an
 * own property shadows the prototype. Nothing fails at build time and no unit test that avoids
 * constructing pm2 will notice — it surfaces as `pm2.getVersion is not a function` the first
 * time a command reaches for it.
 *
 * Constructing pm2 starts a client and leaves the event loop alive, so this runs in a child.
 */
var FROM_PROTOTYPE = [
  'dump',
  'getVersion',
  'killAgent',
  'launchAll',
  'resurrect',
  'streamLogs',
  'connect',
  'disconnect',
  'start',
  'stop',
  'restart',
  'reload',
  'delete',
  'list',
];

var apiShape = function () {
  var script = [
    'var API = require(' + JSON.stringify(pth.join(DIST, 'lib', 'API.js')) + ');',
    'var pm2 = new API({ daemon_mode: false });',
    'var shape = {};',
    JSON.stringify(FROM_PROTOTYPE) +
      '.forEach(function (name) { shape[name] = typeof pm2[name]; });',
    'shape._own = Object.keys(pm2).sort();',
    'require("fs").writeSync(1, JSON.stringify(shape));',
    'process.exit(0);',
  ].join('\n');

  return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
};

describe('API surface', function () {
  var shape;

  before(function () {
    this.timeout(30000);
    shape = apiShape();
  });

  FROM_PROTOTYPE.forEach(function (name) {
    it('should reach ' + name + ' on a constructed pm2', function () {
      assert.strictEqual(shape[name], 'function', name + ' is ' + shape[name] + ', not a function');
    });
  });

  // The positive assertions above only catch a shadowed method if the name is listed. This
  // catches the shape of the mistake instead: an own property holding undefined is what a
  // declared-but-unassigned class field leaves behind.
  it('should carry no own property that is undefined', function () {
    assert.deepStrictEqual(
      shape._own.filter(function (key) {
        return shape[key] === 'undefined';
      }),
      [],
    );
  });
});
