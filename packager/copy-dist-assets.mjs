import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fills dist/ with everything tsc did not emit.
 *
 * tsc compiles the .ts files and nothing else. Running pm2's existing JavaScript through it as
 * well is not behaviour-preserving: tsc marks every emitted module "use strict", and 50 of
 * these files were written for sloppy mode. Under Bun that difference is enough to fail the
 * process-file suite outright, and TypeScript 7 removes alwaysStrict, so there is no way to ask
 * it to stop. The .js files are copied byte for byte instead.
 *
 * That leaves no overlap to resolve: a module is either .ts, and tsc emits its .js, or it is .js
 * and arrives here untouched.
 */
const ROOTS = ['lib', 'modules'];

// pm2 reads these from beside its code at runtime and require()s package.json for its version.
const ROOT_FILES = ['index.js', 'package.json'];

const NOT_SHIPPED = /(^|[/\\])(test|node_modules)([/\\]|$)/;

// tsc's own output. A .ts source next to its compiled .js is worse than useless: Bun resolves a
// require of ./x.js to ./x.ts when both exist and would run the TypeScript.
const EMITTED_BY_TSC = /\.(map)$/;
const IS_SOURCE = /\.(ts|tsx)$/;

const shouldCopy = (src) =>
  !NOT_SHIPPED.test(src) && !EMITTED_BY_TSC.test(src) && !IS_SOURCE.test(src);

ROOTS.forEach((root) => {
  cpSync(root, join('dist', root), { recursive: true, filter: shouldCopy });
});

ROOT_FILES.forEach((file) => {
  cpSync(file, join('dist', file));
});

// package.json is copied so pm2 can read its own version from beside its code, but `main` in it
// is a path from the package root — inside dist it points at dist/dist/index.js, and node warns
// about the invalid field every time a runtime binary starts. Rewritten to where the entry
// actually is relative to this copy.
{
  const manifestPath = join('dist', 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.main = 'index.js';
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
