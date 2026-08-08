var assert = require('assert');
var fs = require('fs');
var pth = require('path');

var SOURCE_DIR = pth.join(__dirname, '..', '..', 'lib', 'templates');
var BUILT_DIR = pth.join(__dirname, '..', '..', 'dist', 'lib', 'templates');

var filesUnder = function (root) {
  var found = [];
  var walk = function (dir, prefix) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
      var relative = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(pth.join(dir, entry.name), relative);
      else found.push(relative);
    });
  };
  walk(root, '');
  return found.sort();
};

/**
 * `pm2 boilerplate` and `pm2 ecosystem` copy these out to the user's own directory verbatim.
 * They are not pm2's code to compile: transpiling one rewrites what the user ends up with,
 * down to the indentation and a sourceMappingURL comment pointing at a map that is not there.
 */
describe('lib/templates in the build', function () {
  it('should ship every template the sources have', function () {
    var sources = filesUnder(SOURCE_DIR);
    var built = filesUnder(BUILT_DIR).filter(function (name) {
      return !name.endsWith('.map');
    });
    assert.deepStrictEqual(built, sources);
  });

  it('should copy each one byte for byte', function () {
    var differing = filesUnder(SOURCE_DIR).filter(function (name) {
      var source = fs.readFileSync(pth.join(SOURCE_DIR, name));
      var built = fs.readFileSync(pth.join(BUILT_DIR, name));
      return !source.equals(built);
    });
    assert.deepStrictEqual(differing, [], 'rewritten by the build: ' + differing.join(', '));
  });

  it('should not leave a source map beside a template', function () {
    var maps = filesUnder(BUILT_DIR).filter(function (name) {
      return name.endsWith('.map');
    });
    assert.deepStrictEqual(maps, []);
  });
});
