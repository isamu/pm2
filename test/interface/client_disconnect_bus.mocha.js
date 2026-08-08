var assert = require('assert');

var Client = require('../../dist/lib/Client.js');

// disconnectBus asks the SUB socket to close and gives it 200ms. The timeout branch is the one
// nothing exercises in normal use — a socket that closes promptly never reaches it — so it is
// tested here against a stub socket that simply never reports closing.
describe('Client.prototype.disconnectBus', function () {
  var disconnectBus = Client.prototype.disconnectBus;

  var stubSocket = function (overrides) {
    var socket = {
      connected: true,
      closing: false,
      destroyed: false,
      closed: false,
      handlers: {},
      once: function (event, handler) {
        socket.handlers[event] = handler;
      },
      close: function () {
        socket.closed = true;
      },
      destroy: function () {
        socket.destroyed = true;
      },
    };
    Object.keys(overrides || {}).forEach(function (key) {
      socket[key] = overrides[key];
    });
    return socket;
  };

  it('should report that the bus was never connected', function (done) {
    disconnectBus.call({}, function (err, state) {
      assert.strictEqual(err, null);
      assert.deepStrictEqual(state, { msg: 'bus was not connected' });
      done();
    });
  });

  it('should report a socket that is already closing', function (done) {
    var context = { sub_sock: stubSocket({ closing: true }) };

    disconnectBus.call(context, function (err) {
      assert(err instanceof Error);
      assert.strictEqual(context.sub, null);
      done();
    });
  });

  it('should call back once the socket reports it closed', function (done) {
    var socket = stubSocket();
    var context = { sub_sock: socket };

    disconnectBus.call(context, function (err) {
      assert.strictEqual(err, undefined);
      assert.strictEqual(context.sub, null);
      done();
    });

    assert.strictEqual(socket.closed, true);
    socket.handlers.close();
  });

  // The 200ms timer reached for `Client.sub_sock` — the constructor — rather than the instance,
  // so it read `.destroy` off undefined and threw out of a timer, where the surrounding
  // try/catch could not see it.
  it('should destroy a socket that never reports closing', function (done) {
    var socket = stubSocket();
    var context = { sub_sock: socket };

    disconnectBus.call(context, function () {
      assert.strictEqual(socket.destroyed, true);
      done();
    });
  });
});
