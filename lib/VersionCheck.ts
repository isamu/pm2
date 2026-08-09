import { statSync, readFileSync } from 'node:fs';
import { type } from 'node:os';
import { createRequire } from 'node:module';

// Neither of these ships types, and adding @types packages for them is a dependency decision
// rather than a typing one. What this file asks of each is small enough to say here.
const requireFrom = createRequire(__filename);
const vCheck: { runCheck(params: VersionCheckParams, cb: VersionCheckCallback): void } =
  requireFrom('@pm2/pm2-version-check');
const semver: { lt(a: string, b: string): boolean } = requireFrom('semver');

interface VersionCheckOptions {
  state: string;
  version: string;
}

// The four optional ones are filled in under a try: os.type() and the docker probes read the
// filesystem, and a failure there should still leave state and version to report.
interface VersionCheckParams extends VersionCheckOptions {
  os?: string;
  uptime?: number;
  nodev?: string;
  docker?: boolean;
}

type VersionCheckCallback = (err: Error | null, pkg?: { current_version?: string }) => void;

const hasDockerEnv = (): boolean => {
  try {
    statSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
};

const hasDockerCGroup = (): boolean => {
  try {
    return readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
};

const checkVersion = (opts: VersionCheckOptions): void => {
  const params: VersionCheckParams = {
    state: opts.state,
    version: opts.version,
  };

  try {
    params.os = type();
    params.uptime = Math.floor(process.uptime());
    params.nodev = process.versions.node;
    params.docker = hasDockerEnv() || hasDockerCGroup();
  } catch {
    // Reported without them rather than not at all.
  }

  vCheck.runCheck(params, (err, pkg) => {
    if (err || !pkg?.current_version) return;
    if (opts.version && semver.lt(opts.version, pkg.current_version)) {
      console.log('[PM2] This PM2 is not UP TO DATE');
      console.log('[PM2] Upgrade to version %s', pkg.current_version);
    }
  });
};

export = checkVersion;
