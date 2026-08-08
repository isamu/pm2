import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// lstat rather than stat: a symlinked directory has to be unlinked, not followed and emptied,
// or removing a module would take whatever it points at with it.
const deleteFolderRecursive = (target: string): void => {
  if (!existsSync(target)) return;

  readdirSync(target).forEach((entry) => {
    const child = join(target, entry);
    if (lstatSync(child).isDirectory()) deleteFolderRecursive(child);
    else unlinkSync(child);
  });

  rmdirSync(target);
};

export = deleteFolderRecursive;
