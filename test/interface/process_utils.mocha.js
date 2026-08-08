var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var ProcessUtils = require('../../dist/lib/ProcessUtils.js');

var makeProject = function (packageJson) {
  var root = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-esm-'));
  if (packageJson !== null) {
    fs.writeFileSync(pth.join(root, 'package.json'), packageJson);
  }
  fs.writeFileSync(pth.join(root, 'app.js'), '');
  return root;
};

describe('ProcessUtils.isESModule', function () {
  var leftovers = [];

  afterEach(function () {
    leftovers.forEach(function (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    leftovers = [];
  });

  it('should call a .mjs script an ES module without reading anything', function () {
    assert.strictEqual(ProcessUtils.isESModule('/nowhere/at/all/app.mjs'), true);
  });

  it('should follow "type": "module" in the nearest package.json', function () {
    var root = makeProject('{"type":"module"}');
    leftovers.push(root);
    assert.strictEqual(ProcessUtils.isESModule(pth.join(root, 'app.js')), true);
  });

  it('should say no when package.json does not set the type', function () {
    var root = makeProject('{"name":"plain"}');
    leftovers.push(root);
    assert.strictEqual(ProcessUtils.isESModule(pth.join(root, 'app.js')), false);
  });

  it('should say no for an explicit commonjs type', function () {
    var root = makeProject('{"type":"commonjs"}');
    leftovers.push(root);
    assert.strictEqual(ProcessUtils.isESModule(pth.join(root, 'app.js')), false);
  });

  it('should walk up to a package.json in a parent directory', function () {
    var root = makeProject('{"type":"module"}');
    leftovers.push(root);
    var nested = pth.join(root, 'src', 'deep');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(pth.join(nested, 'app.js'), '');
    assert.strictEqual(ProcessUtils.isESModule(pth.join(nested, 'app.js')), true);
  });

  // Callers compare with === true, so an unreadable or malformed manifest has always meant
  // "not an ES module" by falling out of the catch with no value at all.
  it('should return undefined when the package.json cannot be parsed', function () {
    var root = makeProject('{ this is not json');
    leftovers.push(root);
    assert.strictEqual(ProcessUtils.isESModule(pth.join(root, 'app.js')), undefined);
  });

  it('should return undefined when there is no package.json to find', function () {
    var root = makeProject(null);
    leftovers.push(root);
    assert.strictEqual(ProcessUtils.isESModule(pth.join(root, 'app.js')), undefined);
  });
});
