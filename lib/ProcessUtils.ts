import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';

interface AgentModule {
  init: (conf: object) => void;
}

// Loaded on demand, not at import time: every forked application runs this file, and pulling the
// agent in when nothing asked for it would cost each of them the whole module graph.
const requireAgent = (): AgentModule => createRequire(__filename)('../modules/pm2-io-bpm');

const findPackageJson = (directory: string): string | null => {
  const candidate = join(directory, 'package.json');
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  const parent = resolve(directory, '..');
  return parent === directory ? null : findPackageJson(parent);
};

const injectModules = (): void => {
  if (process.env.pmx === 'false') return;

  // Set by pm2 itself when it has already initialised the agent in this process.
  const hasSpecificConfig = typeof process.env.io === 'string' || process.env.trace === 'true';
  if (!hasSpecificConfig) return;

  const ioSettings: unknown = process.env.io ? JSON.parse(process.env.io) : null;
  const conf = isObject(ioSettings) && isObject(ioSettings.conf) ? ioSettings.conf : {};

  requireAgent().init(Object.assign({ tracing: process.env.trace === 'true' || false }, conf));
};

/**
 * Undefined rather than false when the manifest is missing or unreadable: callers compare with
 * === true, so it has always meant "not an ES module", and narrowing it to false would be a
 * behaviour change disguised as tidying.
 */
const isESModule = (execPath: string): boolean | undefined => {
  if (extname(execPath) === '.mjs') return true;

  const manifest = findPackageJson(dirname(execPath));
  if (manifest === null) return undefined;

  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    return isObject(parsed) && parsed.type === 'module';
  } catch {
    return undefined;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export = { injectModules, isESModule };
