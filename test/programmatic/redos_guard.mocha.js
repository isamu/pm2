var assert = require('assert');
var Utility = require('../../dist/lib/Utility.js');
var isAbsolute = require('../../dist/lib/tools/IsAbsolute.js');

/**
 * eslint-plugin-security flags these regexes by star height, which is a heuristic and not an
 * analysis: measured against pumped input they are all linear today. That is a property worth
 * pinning rather than a warning worth dismissing — CVE-2025-5891 was a ReDoS in this codebase,
 * and the way the next one arrives is somebody widening one of these patterns.
 */
var BUDGET_MS = 2000;
var SMALL_INPUT = 4000;
var LARGE_INPUT = 16000;

var timeToRun = function (body) {
  var started = process.hrtime.bigint();
  body();
  return Number(process.hrtime.bigint() - started) / 1e6;
};

// What the larger of two pumped inputs costs. A linear matcher takes single-digit multiples of
// the smaller run; anything backtracking catastrophically is orders of magnitude worse.
var costOfPumping = function (run, buildInput) {
  timeToRun(function () {
    run(buildInput(SMALL_INPUT));
  });
  return timeToRun(function () {
    run(buildInput(LARGE_INPUT));
  });
};

var overBudget = function (label, milliseconds) {
  return label + ': ' + milliseconds.toFixed(1) + 'ms exceeds the ' + BUDGET_MS + 'ms budget';
};

var canonicName = function (input) {
  Utility.getCanonicModuleName(input);
};

describe('ReDoS guards', function () {
  this.timeout(30000);

  describe('Utility.getCanonicModuleName', function () {
    it('should stay linear on a deep .tgz path', function () {
      var cost = costOfPumping(canonicName, function (size) {
        return 'a/'.repeat(size / 2) + '.tgz';
      });
      assert(cost < BUDGET_MS, overBudget('tgz path', cost));
    });

    it('should stay linear on a name that nearly looks versioned', function () {
      var cost = costOfPumping(canonicName, function (size) {
        return 'a-'.repeat(size / 2) + '1.0.0-x.tgz';
      });
      assert(cost < BUDGET_MS, overBudget('tgz version', cost));
    });

    it('should stay linear on a git+ specifier', function () {
      var cost = costOfPumping(canonicName, function (size) {
        return 'git+https://host/' + 'a-'.repeat(size / 2);
      });
      assert(cost < BUDGET_MS, overBudget('git specifier', cost));
    });

    it('should still resolve the names it is there to resolve', function () {
      assert.strictEqual(Utility.getCanonicModuleName('pm2-slack'), 'pm2-slack');
      assert.strictEqual(Utility.getCanonicModuleName('pm2-slack-1.0.0.tgz'), 'pm2-slack');
      assert.strictEqual(Utility.getCanonicModuleName('folder/pm2-slack.tgz'), 'pm2-slack');
      assert.strictEqual(Utility.getCanonicModuleName('ma-zal/pm2-slack'), 'pm2-slack');
    });
  });

  describe('IsAbsolute.win32', function () {
    it('should stay linear on a long UNC-looking path', function () {
      var cost = costOfPumping(isAbsolute.win32, function (size) {
        return '\\\\' + 'a'.repeat(size);
      });
      assert(cost < BUDGET_MS, overBudget('unc path', cost));
    });

    it('should stay linear on a run of separators', function () {
      var cost = costOfPumping(isAbsolute.win32, function (size) {
        return '\\'.repeat(size) + 'a';
      });
      assert(cost < BUDGET_MS, overBudget('separator run', cost));
    });

    it('should still classify the paths it is there to classify', function () {
      assert.strictEqual(isAbsolute.win32('C:\\Users\\app'), true);
      assert.strictEqual(isAbsolute.win32('\\\\server\\share'), true);
      assert.strictEqual(isAbsolute.win32('relative\\path'), false);
      assert.strictEqual(isAbsolute.posix('/var/log'), true);
      assert.strictEqual(isAbsolute.posix('var/log'), false);
    });
  });
});
