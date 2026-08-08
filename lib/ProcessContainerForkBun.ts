/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { createRequire } from 'node:module';
import ProcessUtils from './ProcessUtils.js';

const requireFrom = createRequire(__filename);

if (
  process.env.disable_source_map_support !== 'true' &&
  typeof process.setSourceMapsEnabled === 'function'
) {
  process.setSourceMapsEnabled(true);
}

ProcessUtils.injectModules();

const script = process.env.pm_exec_path;

process.title = process.env.PROCESS_TITLE || `bun ${script}`;

if (process.connected && process.send && process.versions?.node) {
  process.send({ node_version: process.versions.node });
}

// Bun's loader handles both module kinds through require, so unlike the node container there is
// no ES-module branch here.
requireFrom(String(script));

// Make the application see what it would have seen had it been started directly. Bun does not
// always give this file a main module, so the fallback is an empty object rather than whatever
// createRequire happens to hold — an application reading process.mainModule.loaded should find
// `false`, not throw.
//
// The matching `requireFrom.main = ...` the node container ends with is deliberately absent:
// under Bun that property is read-only and assigning to it throws, and since `requireFrom` is
// local to this file the assignment was never something the application could observe. What it
// can observe is process.mainModule, which is set above.
process.mainModule = process.mainModule || Object.create(null);
if (process.mainModule) process.mainModule.loaded = false;
