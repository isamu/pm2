import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';

interface AgentModule {
  init: (conf: object) => void;
}

// Required from inside injectModules rather than at the top of the file, because whether it is
// loaded at all depends on the environment. Requiring it is not a lookup — loading the agent is
// what installs the process:exception hooks — so the call below happens before any decision
// about init, exactly where it always has.
const requireAgent = (): AgentModule => createRequire(__filename)('../modules/pm2-io-bpm');

const findPackageJson = (directory: string): string | null => {
  const candidate = join(directory, 'package.json');
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  const parent = resolve(directory, '..');
  return parent === directory ? null : findPackageJson(parent);
};

const injectModules = (): void => {
  if (process.env.pmx === 'false') return;

  const agent = requireAgent();

  // Without either of these pm2 has already initialised the agent in this process, and calling
  // init a second time is what this guard is avoiding — not the require above it.
  const hasSpecificConfig = typeof process.env.io === 'string' || process.env.trace === 'true';
  if (!hasSpecificConfig) return;

  const ioSettings: unknown = process.env.io ? JSON.parse(process.env.io) : null;
  const conf = isObject(ioSettings) && isObject(ioSettings.conf) ? ioSettings.conf : {};

  agent.init(Object.assign({ tracing: process.env.trace === 'true' || false }, conf));
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
