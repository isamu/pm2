var assert = require('assert');
var DockerMgmt = require('../../dist/lib/API/ExtraMgmt/Docker.js');

var fakePM2 = function (err, sysInfos) {
  return {
    Client: {
      executeRemote: function (command, options, onData) {
        onData(err, sysInfos);
      },
    },
  };
};

describe('DockerMgmt.processCommand', function () {
  // executeRemote's error was dropped on the floor, so a failed getSystemData left sys_infos
  // undefined and the next line read .containers off it.
  it('should hand back the error when getSystemData fails', function (done) {
    var pm2 = fakePM2(new Error('daemon is down'), undefined);
    DockerMgmt.processCommand(pm2, 0, 1, 'stopProcessId', function (err) {
      assert(err instanceof Error);
      assert.strictEqual(err.message, 'daemon is down');
      done();
    });
  });

  it('should not throw when the reply has no containers at all', function (done) {
    DockerMgmt.processCommand(fakePM2(null, {}), 0, 1, 'stopProcessId', function (err) {
      assert(err instanceof Error);
      done();
    });
  });

  it('should report a process that is not there', function (done) {
    var pm2 = fakePM2(null, { containers: [] });
    DockerMgmt.processCommand(pm2, 0, 3, 'stopProcessId', function (err) {
      assert(err instanceof Error);
      assert(err.message.indexOf('3') !== -1);
      done();
    });
  });

  // start_id and select_id index into the container list; asking for one past the end used to
  // read undefined.id and throw rather than saying it could not find it.
  it('should report an index past the end of the list', function (done) {
    var pm2 = fakePM2(null, { containers: [{ id: 'abc' }] });
    DockerMgmt.processCommand(pm2, 0, 9, 'stopProcessId', function (err) {
      assert(err instanceof Error);
      done();
    });
  });

  it('should reject an action it does not know', function (done) {
    var pm2 = fakePM2(null, { containers: [{ id: 'abc' }] });
    DockerMgmt.processCommand(pm2, 0, 1, 'somethingElse', function (err) {
      assert(err instanceof Error);
      done();
    });
  });
});
