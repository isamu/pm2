import { accessSync, constants, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRECTORY = 'node_modules';

const isReadable = (target: string): boolean => {
  try {
    accessSync(target, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

// Follows symlinks, as this has always done, but a broken one is now skipped rather than
// throwing out of the whole walk. A dangling link is ordinary — emacs leaves .#file pointing at
// user@host.pid for as long as a buffer is open — and it used to kill the entire scan.
const describe = (target: string) => {
  try {
    return statSync(target);
  } catch {
    return null;
  }
};

const findExtensions = (folder: string, extensions: RegExp[], found: string[]): void => {
  if (!isReadable(folder)) return;

  const stats = describe(folder);
  if (!stats?.isDirectory() || folder.includes(SKIPPED_DIRECTORY)) return;

  readdirSync(folder).forEach((entry) => {
    const target = join(folder, entry);
    const entryStats = describe(target);
    if (!entryStats) return;

    if (entryStats.isDirectory()) {
      findExtensions(target, extensions, found);
      return;
    }

    if (!extensions.some((extension) => extension.test(entry))) found.push(target);
  });
};

/**
 * Collects, into `found`, every file below the current directory that does NOT carry one of the
 * comma-separated extensions in `opts.ext` — the set pm2 will refuse to treat as a script.
 */
const makeAvailableExtension = (opts: unknown, found: unknown): void => {
  if (typeof opts !== 'object' || opts === null || !Array.isArray(found)) return;
  if (!('ext' in opts) || typeof opts.ext !== 'string') return;

  const extensions = opts.ext.split(',').map((extension) => new RegExp(`\\.${extension}$`));
  findExtensions(process.cwd(), extensions, found);
};

export = { make_available_extension: makeAvailableExtension };
