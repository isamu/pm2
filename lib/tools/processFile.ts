/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

interface AppsHolder {
  apps?: unknown;
  pm2?: unknown;
}

/**
 * A process file names its apps under `apps`, or under `pm2`, or is itself the one app. Either
 * key may hold a single entry rather than a list.
 */
const appsIn = (file: AppsHolder): unknown[] => {
  const named = file.apps || file.pm2 || file;
  return Array.isArray(named) ? named : [named];
};

export = { appsIn };
