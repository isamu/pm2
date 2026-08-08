var assert = require('assert');
var pth = require('path');

// These modules used to export an empty object and hang their methods off it one assignment at
// a time. They now name those methods in the literal instead, so TypeScript can see the shape —
// which means a method dropped from the literal is no longer a syntax error anywhere, just a
// missing export nobody notices until a user hits that command. This pins the exported surface.
var DIST = pth.join(__dirname, '..', '..', 'dist');

var MODULES = [
  {
    path: 'lib/Configuration.js',
    methods: [
      'set',
      'unset',
      'setSyncIfNotExist',
      'setSync',
      'unsetSync',
      'multiset',
      'get',
      'getSync',
      'getAll',
      'getAllSync',
    ],
  },
  {
    path: 'lib/API/Modules/Modularizer.js',
    methods: [
      'install',
      'launchModules',
      'package',
      'uninstall',
      'listModules',
      'getAdditionalConf',
      'publish',
      'generateSample',
    ],
  },
];

describe('module surface', function () {
  MODULES.forEach(function (mod) {
    describe(mod.path, function () {
      var loaded = require(pth.join(DIST, mod.path));

      mod.methods.forEach(function (name) {
        it('should export ' + name + ' as a function', function () {
          assert.strictEqual(typeof loaded[name], 'function', name + ' is not exported');
        });
      });

      it('should export nothing beyond what is listed here', function () {
        assert.deepStrictEqual(Object.keys(loaded).sort(), mod.methods.slice().sort());
      });
    });
  });
});
