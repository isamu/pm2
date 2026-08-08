var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pth = require('path');
var completion = require('../../lib/completion.js');

describe('completion', function () {
  describe('.missingRcError', function () {
    it('should name the completer in the instructions', function () {
      var err = completion.missingRcError('.bashrc', 'pm2');
      assert(err instanceof Error);
      assert(err.message.indexOf('pm2 completion >> ~/.bashrc') !== -1);
      assert(err.message.indexOf('No .bashrc file') === 0);
    });

    it('should use the shell the caller is actually running', function () {
      var err = completion.missingRcError('.zshrc', 'pm2');
      assert(err.message.indexOf('.zshrc') !== -1);
      assert(err.message.indexOf('.bashrc') === -1);
    });
  });

  describe('with no rc file in HOME', function () {
    var home, shell, argv, emptyHome;

    beforeEach(function () {
      home = process.env.HOME;
      shell = process.env.SHELL;
      argv = process.argv;
      emptyHome = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-completion-'));
      process.env.HOME = emptyHome;
      process.env.SHELL = '/bin/bash';
      process.argv = ['node', 'pm2', 'completion', 'install'];
    });

    afterEach(function () {
      process.env.HOME = home;
      process.env.SHELL = shell;
      process.argv = argv;
      fs.rmSync(emptyHome, { recursive: true, force: true });
    });

    it('should report how to install completion by hand', function (done) {
      completion.complete('pm2', 'pm2', function (err) {
        assert(err instanceof Error);
        assert(err.message.indexOf('pm2 completion >> ~/.bashrc') !== -1);
        done();
      });
    });
  });

  // The write path reads the rc file, edits it, then writes it back, and each half stats the
  // file separately. Removing it in between is the only way to reach the write half's failure
  // branch — which reported the same instructions as the read half but had no completer in
  // scope to name, so it threw a ReferenceError instead of returning the error.
  describe('when the rc file disappears mid-uninstall', function () {
    var home, shell, argv, readFile, tmpHome, rcPath;

    var RC_CONTENTS =
      'export EDITOR=vi\n' +
      '\n\n###-begin-pm2-completion-###\n' +
      'complete -o default -F _pm2_completion pm2\n' +
      '###-end-pm2-completion-###\n';

    beforeEach(function () {
      home = process.env.HOME;
      shell = process.env.SHELL;
      argv = process.argv;
      readFile = fs.readFile;

      tmpHome = fs.mkdtempSync(pth.join(os.tmpdir(), 'pm2-completion-'));
      rcPath = pth.join(tmpHome, '.bashrc');
      fs.writeFileSync(rcPath, RC_CONTENTS);

      process.env.HOME = tmpHome;
      process.env.SHELL = '/bin/bash';
      process.argv = ['node', 'pm2', 'completion', 'uninstall'];

      fs.readFile = function (path, encoding, callback) {
        fs.rmSync(rcPath, { force: true });
        callback(null, RC_CONTENTS);
      };
    });

    afterEach(function () {
      process.env.HOME = home;
      process.env.SHELL = shell;
      process.argv = argv;
      fs.readFile = readFile;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('should return the instructions instead of throwing', function (done) {
      completion.complete('pm2', 'pm2', function (err) {
        assert(err instanceof Error);
        assert.strictEqual(err.constructor, Error);
        assert(err.message.indexOf('pm2 completion >> ~/.bashrc') !== -1);
        done();
      });
    });
  });
});
