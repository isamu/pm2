/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ProcessUtils from './ProcessUtils.js';

// Node's own loader, reached for below to start the application the way `node app.js` would.
interface ModuleLoader {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
}

const requireFrom = createRequire(__filename);

if (
  process.env.disable_source_map_support !== 'true' &&
  typeof process.setSourceMapsEnabled === 'function'
) {
  process.setSourceMapsEnabled(true);
}

ProcessUtils.injectModules();

const script = process.env.pm_exec_path;

process.title = process.env.PROCESS_TITLE || `node ${script}`;

if (process.connected && process.send && process.versions?.node) {
  process.send({ node_version: process.versions.node });
}

if (!script) throw new Error('Could not _load() the script');

if (ProcessUtils.isESModule(script) === true) {
  // Deliberately not awaited: the application takes over from here, and awaiting would make
  // this file a module, which changes how node treats everything below it.
  import(pathToFileURL(script).href).catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // _load rather than require, because the application has to come up as the main module.
  const loader: ModuleLoader = requireFrom('module');
  loader._load(script, null, true);
}

// Make the application see what it would have seen had node started it directly.
process.mainModule ??= requireFrom.main;
if (process.mainModule) process.mainModule.loaded = false;
requireFrom.main = process.mainModule;
