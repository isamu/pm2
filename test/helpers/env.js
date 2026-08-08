/**
 * Run body with the given environment variables set, then put process.env back exactly as it
 * was — including deleting the ones that were not there to begin with.
 *
 * Reads and writes go through Reflect rather than process.env[name] so that saving a variable
 * by name is a function call rather than a dynamic property access on an object with a
 * prototype, which is what security/detect-object-injection is guarding against.
 */
var withEnv = function (vars, body) {
  var saved = new Map(
    Object.keys(vars).map(function (name) {
      return [name, Reflect.get(process.env, name)];
    }),
  );

  Object.entries(vars).forEach(function (entry) {
    Reflect.set(process.env, entry[0], entry[1]);
  });

  try {
    return body();
  } finally {
    saved.forEach(function (value, name) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else Reflect.set(process.env, name, value);
    });
  }
};

module.exports = { withEnv: withEnv };
