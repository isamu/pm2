var assert = require('assert');
var pth = require('path');
var execFileSync = require('child_process').execFileSync;

// God is built by mutation: this file creates the object, then seven modules are handed it in
// turn and hang their own methods off it. The seven that live in God.js itself are now named in
// the literal rather than assigned one at a time, which is the change this guards — a name
// dropped from that literal breaks nothing at build time, it just stops being part of God.
//
// Requiring God has to happen in a child process: it replaces the global console (so anything
// printed afterwards is routed through its bus) and leaves the event loop alive.
var DIST = pth.join(__dirname, '..', '..', 'dist');

var CONTRIBUTED = {
  'God.js': [
    'init',
    'prepare',
    'executeApp',
    'handleExit',
    'finalizeProcedure',
    'injectVariables',
    'writeExitSeparator',
  ],
  'Event.js': ['notify'],
  'God/Methods.js': ['getNewId'],
  'God/ForkMode.js': ['forkMode'],
  'God/ClusterMode.js': ['nodeApp'],
  'Worker.js': ['registerCron', 'Worker'],
  'Watcher.js': ['watch'],
};

var STATE = ['next_id', 'clusters_db', 'configuration', 'started_at', 'system_infos', 'bus'];

var godShape = function () {
  var script = [
    'var God = require(' + JSON.stringify(pth.join(DIST, 'lib', 'God.js')) + ');',
    'var shape = {};',
    'Object.keys(God).forEach(function (key) { shape[key] = typeof God[key]; });',
    'require("fs").writeSync(1, JSON.stringify(shape));',
    'process.exit(0);',
  ].join('\n');

  return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
};

describe('God namespace', function () {
  var shape;

  before(function () {
    this.timeout(30000);
    shape = godShape();
  });

  Object.keys(CONTRIBUTED).forEach(function (source) {
    CONTRIBUTED[source].forEach(function (name) {
      it('should carry ' + name + ', contributed by ' + source, function () {
        assert(name in shape, name + ' is missing from God');
      });
    });
  });

  it('should expose the seven from God.js as functions', function () {
    CONTRIBUTED['God.js'].forEach(function (name) {
      assert.strictEqual(shape[name], 'function', name + ' is not a function');
    });
  });

  it('should keep Worker and watch as the objects their modules fill in', function () {
    assert.strictEqual(shape.Worker, 'object');
    assert.strictEqual(shape.watch, 'object');
  });

  it('should still carry its own state', function () {
    STATE.forEach(function (name) {
      assert(name in shape, name + ' is missing from God');
    });
  });
});
