var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var flagExt = require('../../dist/lib/API/Modules/flagExt.js');

var inDirectory = function (dir, body) {
  var previous = process.cwd();
  process.chdir(dir);
  try {
    return body();
  } finally {
    process.chdir(previous);
  }
};

var makeTree = function (files) {
  var root = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-flagext-'));
  Object.keys(files).forEach(function (relative) {
    var target = pth.join(root, relative);
    fs.mkdirSync(pth.dirname(target), { recursive: true });
    fs.writeFileSync(target, '');
  });
  return root;
};

describe('flagExt.make_available_extension', function () {
  var leftovers = [];

  afterEach(function () {
    leftovers.forEach(function (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    leftovers = [];
  });

  var collect = function (root, ext) {
    var found = [];
    inDirectory(root, function () {
      flagExt.make_available_extension({ ext: ext }, found);
    });
    return found.map(function (file) {
      return pth.basename(file);
    });
  };

  it('should list the files that do not carry the extension', function () {
    var root = makeTree({ 'keep.js': '', 'drop.txt': '', 'also.md': '' });
    leftovers.push(root);

    var found = collect(root, 'js');
    assert.deepStrictEqual(found.sort(), ['also.md', 'drop.txt']);
  });

  it('should accept several extensions at once', function () {
    var root = makeTree({ 'a.js': '', 'b.ts': '', 'c.txt': '' });
    leftovers.push(root);

    assert.deepStrictEqual(collect(root, 'js,ts'), ['c.txt']);
  });

  it('should descend into subdirectories', function () {
    var root = makeTree({ 'top.txt': '', 'nested/deep.txt': '', 'nested/keep.js': '' });
    leftovers.push(root);

    assert.deepStrictEqual(collect(root, 'js').sort(), ['deep.txt', 'top.txt']);
  });

  it('should stay out of node_modules', function () {
    var root = makeTree({ 'app.txt': '', 'node_modules/dep/index.txt': '' });
    leftovers.push(root);

    assert.deepStrictEqual(collect(root, 'js'), ['app.txt']);
  });

  // A dangling symlink is ordinary: emacs leaves .#file pointing at user@host.pid while a
  // buffer is open. statSync follows it, throws ENOENT, and the exception used to escape the
  // whole recursion — so `pm2 start --ext` died on any directory somebody had a file open in.
  it('should walk past a symlink whose target is gone', function () {
    var root = makeTree({ 'real.txt': '' });
    leftovers.push(root);
    fs.symlinkSync(pth.join(root, 'does-not-exist'), pth.join(root, '.#real.txt'));

    assert.deepStrictEqual(collect(root, 'js'), ['real.txt']);
  });

  // The check was `statSync(folder).mode & 4`, the world-readable bit — nothing to do with
  // whether pm2 can read the directory, which accessSync above already answers. A project
  // directory at 0700, which is ordinary, silently produced no matches at all.
  it('should scan a directory that only its owner can read', function () {
    var root = makeTree({ 'private.txt': '' });
    leftovers.push(root);
    fs.chmodSync(root, 0o700);

    assert.deepStrictEqual(collect(root, 'js'), ['private.txt']);
  });

  it('should ignore anything but an options object and an array', function () {
    var found = [];
    flagExt.make_available_extension('not an object', found);
    flagExt.make_available_extension({ ext: 'js' }, 'not an array');
    assert.deepStrictEqual(found, []);
  });
});
