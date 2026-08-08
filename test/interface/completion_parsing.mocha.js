var assert = require('assert');
var completion = require('../../dist/lib/completion.js');
var withEnv = require('../helpers/env.js').withEnv;

var HELP_TEXT = [
  '  Usage: pm2 [options]',
  '  -v --version   print version',
  '  -s --silent    hide output',
  '  --no-daemon    run in foreground',
].join('\n');

describe('completion.parseOut', function () {
  it('should pull out the short flags without their dashes', function () {
    assert.deepStrictEqual(completion.parseOut(HELP_TEXT).shorts, ['v', 's']);
  });

  it('should pull out the long flags without their dashes', function () {
    assert.deepStrictEqual(completion.parseOut(HELP_TEXT).longs, ['version', 'silent', 'no']);
  });

  // str.match returns null when nothing matches, and the result was mapped over unguarded — so
  // help output with no flags in it took the completion script down.
  it('should answer with empty lists when there are no flags at all', function () {
    assert.deepStrictEqual(completion.parseOut('just some prose'), { shorts: [], longs: [] });
  });

  it('should answer with empty lists for an empty string', function () {
    assert.deepStrictEqual(completion.parseOut(''), { shorts: [], longs: [] });
  });

  it('should find the long flags when only those are present', function () {
    var parsed = completion.parseOut('  --only-long here');
    assert.deepStrictEqual(parsed.shorts, []);
    assert.deepStrictEqual(parsed.longs, ['only']);
  });
});

describe('completion.parseTasks', function () {
  var CAKE = ['cake build    # compile', 'cake test     # run tests', 'other line'].join('\n');

  it('should list the tasks under a prefix', function () {
    assert.deepStrictEqual(completion.parseTasks(CAKE, 'cake'), ['build', 'test']);
  });

  it('should answer with nothing when the prefix appears nowhere', function () {
    assert.deepStrictEqual(completion.parseTasks(CAKE, 'nothing'), []);
  });

  it('should take a caller-supplied pattern instead', function () {
    assert.deepStrictEqual(completion.parseTasks('one\ntwo', null, /^\w+/gm), ['one', 'two']);
  });
});

describe('completion.log', function () {
  var captureLog = function (body) {
    var lines = [];
    var original = console.log;
    console.log = function (line) {
      lines.push(line);
    };
    try {
      body();
    } finally {
      console.log = original;
    }
    return lines;
  };

  it('should print only what the last word starts', function () {
    var lines = captureLog(function () {
      completion.log(['start', 'stop', 'restart'], { last: 'st' });
    });
    assert.deepStrictEqual(lines, ['start', 'stop']);
  });

  it('should ignore leading dashes on the last word', function () {
    var lines = captureLog(function () {
      completion.log(['silent', 'version'], { last: '--si' });
    });
    assert.deepStrictEqual(lines, ['silent']);
  });

  it('should take a single value as well as a list', function () {
    var lines = captureLog(function () {
      completion.log('start', { last: 's' });
    });
    assert.deepStrictEqual(lines, ['start']);
  });

  it('should put the prefix in front of each line', function () {
    var lines = captureLog(function () {
      completion.log(['start'], { last: '' }, '> ');
    });
    assert.deepStrictEqual(lines, ['> start']);
  });
});

describe('completion.isComplete', function () {
  var savedArgv;

  beforeEach(function () {
    savedArgv = process.argv;
  });

  afterEach(function () {
    process.argv = savedArgv;
  });

  it('should say yes when invoked as the completion command', function () {
    process.argv = ['node', 'pm2', 'completion'];
    withEnv({ COMP_CWORD: undefined, COMP_POINT: undefined, COMP_LINE: undefined }, function () {
      assert.ok(completion.isComplete());
    });
  });

  it('should say yes when the shell passed the COMP_ variables', function () {
    process.argv = ['node', 'pm2'];
    withEnv({ COMP_CWORD: '1', COMP_POINT: '4', COMP_LINE: 'pm2 ' }, function () {
      assert.ok(completion.isComplete());
    });
  });

  it('should say no when neither is the case', function () {
    process.argv = ['node', 'pm2', 'list'];
    withEnv({ COMP_CWORD: undefined, COMP_POINT: undefined, COMP_LINE: undefined }, function () {
      assert.ok(!completion.isComplete());
    });
  });
});
