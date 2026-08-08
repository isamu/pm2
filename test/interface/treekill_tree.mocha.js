var assert = require('assert');
var treekill = require('../../dist/lib/TreeKill.js');

/**
 * The part of TreeKill that reads `ps -e -o pid=,ppid=` and works out what descends from what.
 * It used to be inline in the close handler, where the only way to exercise it was to spawn
 * real processes and kill them.
 */
describe('TreeKill.descendantsOf', function () {
  //  1
  //  └── 10
  //      ├── 100
  //      └── 101
  //          └── 1000
  var SAMPLE = ['  1     0', ' 10     1', '100    10', '101    10', '1000   101'].join('\n');

  it('should find every descendant, deepest first', function () {
    assert.deepStrictEqual(treekill.descendantsOf(SAMPLE, 10), [100, 1000, 101]);
  });

  it('should find nothing under a leaf', function () {
    assert.deepStrictEqual(treekill.descendantsOf(SAMPLE, 100), []);
  });

  it('should find nothing under a pid that is not running', function () {
    assert.deepStrictEqual(treekill.descendantsOf(SAMPLE, 9999), []);
  });

  it('should read a header line and other noise as nothing', function () {
    var withHeader = '  PID  PPID\n' + SAMPLE;
    assert.deepStrictEqual(treekill.descendantsOf(withHeader, 10), [100, 1000, 101]);
  });

  it('should skip lines that do not have both columns', function () {
    assert.deepStrictEqual(treekill.descendantsOf('10 1\nbroken\n\n100 10', 10), [100]);
  });

  it('should return nothing for empty output', function () {
    assert.deepStrictEqual(treekill.descendantsOf('', 1), []);
  });

  // ps output from a machine under load can name a parent that has already exited; following it
  // forever is the difference between a slow kill and a hung one.
  it('should not loop forever on a cycle', function () {
    assert.deepStrictEqual(treekill.descendantsOf('2 3\n3 2', 2), [3]);
  });
});
