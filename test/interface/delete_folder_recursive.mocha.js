var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var deleteFolderRecursive = require('../../dist/lib/tools/deleteFolderRecursive.js');

var makeTree = function (spec) {
  var root = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-rmtree-'));
  Object.keys(spec).forEach(function (relative) {
    var target = pth.join(root, relative);
    fs.mkdirSync(pth.dirname(target), { recursive: true });
    fs.writeFileSync(target, spec[relative]);
  });
  return root;
};

describe('deleteFolderRecursive', function () {
  var leftovers = [];

  afterEach(function () {
    leftovers.forEach(function (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    leftovers = [];
  });

  it('should remove a directory and everything under it', function () {
    var root = makeTree({
      'top.txt': 'a',
      'nested/one.txt': 'b',
      'nested/deeper/two.txt': 'c',
    });
    leftovers.push(root);

    deleteFolderRecursive(root);

    assert.strictEqual(fs.existsSync(root), false);
  });

  it('should remove an empty directory', function () {
    var root = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-rmtree-'));
    leftovers.push(root);

    deleteFolderRecursive(root);

    assert.strictEqual(fs.existsSync(root), false);
  });

  // Callers hand it paths built from module names that may never have been created, and every
  // one of them treats a missing directory as nothing to do.
  it('should do nothing when the path does not exist', function () {
    var missing = pth.join(os.tmpdir(), 'pm2-rmtree-not-here-' + process.pid);
    assert.strictEqual(fs.existsSync(missing), false);
    deleteFolderRecursive(missing);
    assert.strictEqual(fs.existsSync(missing), false);
  });

  it('should leave a sibling directory alone', function () {
    var root = makeTree({ 'target/file.txt': 'x', 'keep/file.txt': 'y' });
    leftovers.push(root);

    deleteFolderRecursive(pth.join(root, 'target'));

    assert.strictEqual(fs.existsSync(pth.join(root, 'target')), false);
    assert.strictEqual(fs.readFileSync(pth.join(root, 'keep', 'file.txt'), 'utf8'), 'y');
  });

  // lstat rather than stat: a symlink to a directory must be unlinked, not followed and
  // emptied, or removing a module would take its link target's contents with it.
  it('should unlink a symlinked directory without emptying its target', function () {
    var root = makeTree({ 'outside/precious.txt': 'keep me', 'target/own.txt': 'x' });
    leftovers.push(root);
    fs.symlinkSync(pth.join(root, 'outside'), pth.join(root, 'target', 'link'), 'dir');

    deleteFolderRecursive(pth.join(root, 'target'));

    assert.strictEqual(fs.existsSync(pth.join(root, 'target')), false);
    assert.strictEqual(
      fs.readFileSync(pth.join(root, 'outside', 'precious.txt'), 'utf8'),
      'keep me',
    );
  });
});
