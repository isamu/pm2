import { cpSync } from 'node:fs';
import { join } from 'node:path';

// tsc emits code and the JSON it sees imported, and nothing else. pm2 reads a lot more from
// beside its code at runtime — the ecosystem and init-script templates, completion.sh, the motd
// files, the xdg-open helper, and JSON it opens with fs rather than require. Without this they
// are absent from a dist build and every feature that reads one fails at the point of use.
const ROOTS = ['lib', 'modules'];

// `pm2 boilerplate` and `pm2 ecosystem` copy these out to the user's own directory. They are
// not pm2's code to compile — running them through tsc rewrites what the user ends up with —
// so tsconfig.build.json leaves them alone and they are copied whole, .js files included.
const VERBATIM_ROOTS = ['lib/templates'];

const NOT_SHIPPED = /(^|[/\\])(test|node_modules)([/\\]|$)/;
const EMITTED_BY_TSC = /\.(js|map)$/;

// Decided from the path alone rather than by stat: no directory under either root is named
// like an emitted file, so anything not ending in .js or .map is either an asset or a
// directory to descend into.
const shouldCopy = (src) => !NOT_SHIPPED.test(src) && !EMITTED_BY_TSC.test(src);

const copyInto = (root, filter) => cpSync(root, join('dist', root), { recursive: true, filter });

ROOTS.forEach((root) => copyInto(root, shouldCopy));
VERBATIM_ROOTS.forEach((root) => copyInto(root, (src) => !NOT_SHIPPED.test(src)));
