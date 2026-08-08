var assert = require('assert');
var httpInterface = require('../../dist/lib/HttpInterface.js');

// end() is what tells the test the handler is finished, so nothing test-only has to be added to
// the handler's own signature.
var fakeResponse = function (onEnd) {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader: function (name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    write: function (chunk) {
      this.body += chunk;
    },
    end: function () {
      onEnd(this);
    },
  };
};

var fakePm2 = function (err, list) {
  return {
    list: function (onList) {
      onList(err, list);
    },
  };
};

var ONE_PROCESS = [{ name: 'api', pm2_env: { status: 'online', env: { SECRET: 'shhh' } } }];

describe('HttpInterface.handleRequest', function () {
  it('should answer / with the process list and system info', function (done) {
    var res = fakeResponse(function (finished) {
      assert.strictEqual(finished.statusCode, 200);
      var payload = JSON.parse(finished.body);
      assert.strictEqual(payload.processes.length, 1);
      assert.ok(payload.system_info.hostname);
      assert.ok(payload.monit.total_mem > 0);
      done();
    });
    httpInterface.handleRequest(fakePm2(null, ONE_PROCESS), { url: '/' }, res);
  });

  it('should send JSON and permissive CORS headers', function (done) {
    var res = fakeResponse(function (finished) {
      assert.strictEqual(finished.headers['content-type'], 'application/json');
      assert.strictEqual(finished.headers['access-control-allow-origin'], '*');
      done();
    });
    httpInterface.handleRequest(fakePm2(null, []), { url: '/' }, res);
  });

  it('should answer 404 for any other path', function (done) {
    var res = fakeResponse(function (finished) {
      assert.strictEqual(finished.statusCode, 404);
      assert.deepStrictEqual(JSON.parse(finished.body), { err: '404' });
      done();
    });
    httpInterface.handleRequest(fakePm2(null, []), { url: '/elsewhere' }, res);
  });

  it('should ignore the query string when matching the path', function (done) {
    var res = fakeResponse(function (finished) {
      assert.strictEqual(finished.statusCode, 200);
      done();
    });
    httpInterface.handleRequest(fakePm2(null, []), { url: '/?full=true' }, res);
  });

  // The failure branch called res.send, an Express method that a plain http.ServerResponse does
  // not have — so a daemon that could not answer took the web interface down with a TypeError
  // instead of returning anything at all.
  it('should answer with an error rather than throwing when pm2 cannot list', function (done) {
    var res = fakeResponse(function (finished) {
      assert.strictEqual(finished.statusCode, 500);
      assert.strictEqual(JSON.parse(finished.body).err, 'daemon is down');
      done();
    });
    httpInterface.handleRequest(fakePm2(new Error('daemon is down'), null), { url: '/' }, res);
  });

  it('should strip env when asked to', function (done) {
    var list = [{ name: 'api', pm2_env: { env: { SECRET: 'shhh' } } }, { name: 'no-env' }];
    var res = fakeResponse(function (finished) {
      var payload = JSON.parse(finished.body);
      assert.strictEqual(payload.processes[0].pm2_env.env, undefined);
      assert.strictEqual(payload.processes[1].name, 'no-env');
      done();
    });
    httpInterface.handleRequest(fakePm2(null, list), { url: '/' }, res, { stripEnvVars: true });
  });
});
