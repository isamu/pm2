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

// Make the application see what it would have seen had it been started directly.
process.mainModule ??= requireFrom.main;
if (process.mainModule) process.mainModule.loaded = false;
requireFrom.main = process.mainModule;
