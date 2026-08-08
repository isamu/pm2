import { rmSync } from 'node:fs';

// tsc overwrites what it emits, but the asset copier cannot tell a file it wrote last time from
// one it is about to write again, and a source that has since been renamed or converted to
// TypeScript leaves its old output behind either way. Starting empty is the only way the build
// output can be trusted to be this build's.
rmSync('dist', { recursive: true, force: true });
