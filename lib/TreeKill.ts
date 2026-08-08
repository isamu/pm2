import { exec, spawn } from 'node:child_process';
import which from './tools/which.js';

type Callback = (err?: Error | null, pids?: number[]) => void;

const PS_ARGS = ['-e', '-o', 'pid=,ppid='];

// A Map rather than an object: the keys come from ps output, and a parent pid is not something
// to look up on a prototype.
const parseProcessTree = (psOutput: string): Map<number, number[]> => {
  const childrenOf = new Map<number, number[]>();

  psOutput
    .trim()
    .split('\n')
    .forEach((line) => {
      const [pid, parentPid] = line.trim().split(/\s+/).map(Number);
      if (!Number.isInteger(pid) || !Number.isInteger(parentPid)) return;

      const siblings = childrenOf.get(parentPid) ?? [];
      siblings.push(pid);
      childrenOf.set(parentPid, siblings);
    });

  return childrenOf;
};

/**
 * Every pid descending from `pid` in the output of `ps -e -o pid=,ppid=`, deepest first, which
 * is the order they have to be signalled in.
 *
 * ps output from a loaded machine can name a parent that has already exited and been reused, so
 * a pid already seen is never followed twice — otherwise a cycle hangs the kill.
 */
const descendantsOf = (psOutput: string, pid: number): number[] => {
  const childrenOf = parseProcessTree(psOutput);
  const found: number[] = [];
  const seen = new Set<number>([pid]);

  const collect = (parentPid: number): void => {
    (childrenOf.get(parentPid) ?? []).forEach((child) => {
      if (seen.has(child)) return;
      seen.add(child);
      collect(child);
      found.push(child);
    });
  };

  collect(pid);
  return found;
};

const killPid = (pid: number, signal?: string | number): void => {
  try {
    process.kill(pid, signal);
  } catch (err) {
    // The process finished between reading ps and signalling it, which is not a failure.
    if (err instanceof Error && 'code' in err && err.code !== 'ESRCH') console.error(err);
  }
};

const treeKill = (pid: number | string, signal?: string | number, callback?: Callback): void => {
  const rootPid = parseInt(String(pid), 10);
  if (isNaN(rootPid)) {
    if (callback) callback(new Error('pid must be a number'));
    return;
  }

  if (process.platform === 'win32') {
    exec(`taskkill /pid ${rootPid} /T /F`, { windowsHide: true }, (err) => {
      if (callback) callback(err, [rootPid]);
    });
    return;
  }

  // Absolute path rather than PATH: this decides which processes get signalled, so it should not
  // depend on whichever ps happens to come first for the user pm2 is running as.
  const psPath = which('ps') ?? '/bin/ps';
  const lister = spawn(psPath, PS_ARGS);
  let psOutput = '';

  lister.on('error', (err) => {
    if (callback) callback(err);
  });

  lister.stdout?.on('data', (data: Buffer) => {
    psOutput += data.toString('ascii');
  });

  lister.on('close', (code) => {
    // No listing to work from: signal what was asked for and nothing else.
    if (code !== 0 && psOutput.length === 0) {
      killPid(rootPid, signal);
      if (callback) callback();
      return;
    }

    const allPids = descendantsOf(psOutput, rootPid).concat(rootPid);
    allPids.forEach((each) => killPid(each, signal));

    if (callback) callback(null, allPids);
  });
};

export = Object.assign(treeKill, { descendantsOf });
