import { basename, dirname, resolve } from 'node:path';

const BUILD_DIRECTORY = 'dist';

/**
 * The package root, reached by stepping `levels` directories up from a module's own directory.
 *
 * A build puts the same file one level deeper, under dist/, so counting '..' segments alone
 * lands on the build output — which is where `pm2 install-otel` started putting its packages.
 * Only a dist that the count actually arrived at is stepped over; one further up the path
 * belongs to whoever owns that directory.
 */
const packageRootFrom = (moduleDirectory: string, levels: number): string => {
  const segments = new Array<string>(levels).fill('..');
  const counted = resolve(moduleDirectory, ...segments);

  return basename(counted) === BUILD_DIRECTORY ? dirname(counted) : counted;
};

export = packageRootFrom;
