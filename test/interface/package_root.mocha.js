var assert = require('assert');
var pth = require('path');
var packageRootFrom = require('../../dist/lib/tools/packageRoot.js');

/**
 * Everything that installs packages or resolves siblings addresses the package root by counting
 * '..' segments from __dirname. A build puts the same file one level deeper, under dist/, so the
 * count lands on the build output instead — which is how `pm2 install-otel` started installing
 * into dist/node_modules.
 */
describe('packageRootFrom', function () {
  it('should count up from a checkout layout', function () {
    assert.strictEqual(packageRootFrom('/app/lib', 1), '/app');
    assert.strictEqual(packageRootFrom('/app/lib/API/Modules', 3), '/app');
  });

  it('should step back out of dist when the same file runs from a build', function () {
    assert.strictEqual(packageRootFrom('/app/dist/lib', 1), '/app');
    assert.strictEqual(packageRootFrom('/app/dist/lib/API/Modules', 3), '/app');
  });

  it('should land on the same place from either layout', function () {
    assert.strictEqual(
      packageRootFrom('/app/dist/lib/API/Modules', 3),
      packageRootFrom('/app/lib/API/Modules', 3),
    );
  });

  // Only a dist directory that the count actually landed on is stepped over. One further up the
  // path is somebody's project directory and none of this code's business.
  it('should leave a dist further up the path alone', function () {
    assert.strictEqual(packageRootFrom('/dist/app/lib', 1), '/dist/app');
  });

  it('should not step past a root it did not reach', function () {
    assert.strictEqual(packageRootFrom('/app/dist/lib/API', 1), pth.resolve('/app/dist/lib'));
  });
});
