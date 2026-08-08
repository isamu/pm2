var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var which = require('../../dist/lib/tools/which.js');
var withEnv = require('../helpers/env.js').withEnv;

var IS_WINDOWS = process.platform === 'win32';

var makeBinDir = function (files) {
  var dir = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-which-'));
  Object.keys(files).forEach(function (name) {
    var target = pth.join(dir, name);
    fs.writeFileSync(target, '#!/bin/sh\n');
    fs.chmodSync(target, files[name]);
  });
  return dir;
};

describe('which', function () {
  var leftovers = [];

  afterEach(function () {
    leftovers.forEach(function (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    leftovers = [];
  });

  it('should find an executable on PATH and answer with its absolute path', function () {
    var dir = makeBinDir({ 'pm2-which-probe': 0o755 });
    leftovers.push(dir);

    withEnv({ PATH: dir }, function () {
      assert.strictEqual(which('pm2-which-probe'), pth.join(dir, 'pm2-which-probe'));
    });
  });

  it('should answer null for a command that is not there', function () {
    var dir = makeBinDir({});
    leftovers.push(dir);

    withEnv({ PATH: dir }, function () {
      assert.strictEqual(which('pm2-which-absent'), null);
    });
  });

  it('should take the first match when several directories have one', function () {
    var first = makeBinDir({ 'pm2-which-dup': 0o755 });
    var second = makeBinDir({ 'pm2-which-dup': 0o755 });
    leftovers.push(first, second);

    withEnv({ PATH: first + pth.delimiter + second }, function () {
      assert.strictEqual(which('pm2-which-dup'), pth.join(first, 'pm2-which-dup'));
    });
  });

  it('should resolve a path that was given directly', function () {
    var dir = makeBinDir({ 'pm2-which-direct': 0o755 });
    leftovers.push(dir);
    var full = pth.join(dir, 'pm2-which-direct');

    withEnv({ PATH: '' }, function () {
      assert.strictEqual(which(full), full);
    });
  });

  it('should answer null for a path that was given directly and does not exist', function () {
    assert.strictEqual(which(pth.join(os.tmpdir(), 'pm2-which-nowhere', 'nope')), null);
  });

  it('should not pick a directory that happens to share the name', function () {
    var dir = makeBinDir({});
    leftovers.push(dir);
    fs.mkdirSync(pth.join(dir, 'pm2-which-dir'));

    withEnv({ PATH: dir }, function () {
      assert.strictEqual(which('pm2-which-dir'), null);
    });
  });

  it('should answer null when asked for nothing', function () {
    assert.strictEqual(which(''), null);
  });

  // Windows decides executability by extension, not by mode, so this only means anything here.
  var maybe = IS_WINDOWS ? it.skip : it;
  maybe('should skip a file on PATH that is not executable', function () {
    var dir = makeBinDir({ 'pm2-which-noexec': 0o644 });
    leftovers.push(dir);

    withEnv({ PATH: dir }, function () {
      assert.strictEqual(which('pm2-which-noexec'), null);
    });
  });
});
