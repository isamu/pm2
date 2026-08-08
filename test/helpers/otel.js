/**
 * OtelManager installs the OpenTelemetry packages at runtime with `npm install --no-save` and no
 * versions, so whatever is current on npm is what these tests run against — and OpenTelemetry
 * renamed the HTTP attributes when the HTTP semantic conventions stabilised:
 *
 *   http.target       -> url.path
 *   http.method       -> http.request.method
 *   http.status_code  -> http.response.status_code
 *
 * What these tests are about is that a server span for the request reaches PM2's bus with the
 * right method, path and status. Which spelling the instrumentation used to say that is its
 * business, not PM2's, so the value is read through whichever name is present.
 */
var readFirst = function (tags, names) {
  for (var i = 0; i < names.length; i++) {
    if (tags && tags[names[i]] !== undefined) return tags[names[i]];
  }
  return undefined;
};

module.exports = {
  path: function (tags) {
    return readFirst(tags, ['url.path', 'http.target']);
  },
  method: function (tags) {
    return readFirst(tags, ['http.request.method', 'http.method']);
  },
  status: function (tags) {
    return readFirst(tags, ['http.response.status_code', 'http.status_code']);
  },
};
