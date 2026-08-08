var assert = require('assert');

var appsIn = require('../../dist/lib/tools/processFile.js').appsIn;

// This is the lookup that decides what `pm2 start <file>` actually starts. It used to be four
// statements reassigning one binding through three shapes, inside _startJson and again inside
// actionFromJson; the two copies had drifted — one looked under `pm2`, the other did not.
describe('processFile.appsIn', function () {
  it('should take the list under apps', function () {
    var one = { name: 'one' };
    var two = { name: 'two' };
    assert.deepStrictEqual(appsIn({ apps: [one, two] }), [one, two]);
  });

  it('should wrap a single entry under apps in a list', function () {
    var only = { name: 'only' };
    assert.deepStrictEqual(appsIn({ apps: only }), [only]);
  });

  // `pm2` is the old spelling of `apps` and is still accepted.
  it('should fall back to the list under pm2', function () {
    var one = { name: 'one' };
    assert.deepStrictEqual(appsIn({ pm2: [one] }), [one]);
  });

  it('should wrap a single entry under pm2 in a list', function () {
    var only = { name: 'only' };
    assert.deepStrictEqual(appsIn({ pm2: only }), [only]);
  });

  it('should prefer apps when the file carries both', function () {
    var chosen = { name: 'chosen' };
    var ignored = { name: 'ignored' };
    assert.deepStrictEqual(appsIn({ apps: [chosen], pm2: [ignored] }), [chosen]);
  });

  // A file naming neither is itself the one app — this is what makes
  // `pm2 start '{"script":"app.js"}'` work.
  it('should treat a file naming neither as a single app', function () {
    var file = { script: 'app.js', name: 'bare' };
    assert.deepStrictEqual(appsIn(file), [file]);
  });

  // An empty list is truthy, so a file declaring `apps: []` starts nothing — it does not fall
  // through to being treated as one app. The original `if (config.apps)` behaved the same way.
  it('should answer with an empty apps list rather than falling through it', function () {
    assert.deepStrictEqual(appsIn({ apps: [], script: 'app.js' }), []);
  });

  it('should fall through apps set to null', function () {
    var file = { apps: null, script: 'app.js' };
    assert.deepStrictEqual(appsIn(file), [file]);
  });

  it('should answer with a list even for an empty file', function () {
    var file = {};
    assert.deepStrictEqual(appsIn(file), [file]);
  });
});
