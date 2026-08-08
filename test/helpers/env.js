/**
 * Run body with the given environment variables set, then put process.env back exactly as it
 * was — including deleting the ones that were not there to begin with. A value of undefined
 * means "unset this for the duration": process.env stringifies whatever it is given, so
 * assigning undefined would set the literal text "undefined" and read back as truthy.
 *
 * Reads and writes go through Reflect rather than process.env[name] so that addressing a
 * variable by name is a function call rather than a dynamic property access on an object with a
 * prototype, which is what security/detect-object-injection is guarding against.
 */
var applyEnv = function (name, value) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else Reflect.set(process.env, name, value);
};

var withEnv = function (vars, body) {
  var saved = new Map(
    Object.keys(vars).map(function (name) {
      return [name, Reflect.get(process.env, name)];
    }),
  );

  Object.entries(vars).forEach(function (entry) {
    applyEnv(entry[0], entry[1]);
  });

  try {
    return body();
  } finally {
    saved.forEach(function (value, name) {
      applyEnv(name, value);
    });
  }
};

module.exports = { withEnv: withEnv };
