import { exec, type ExecException, type ExecOptions } from 'node:child_process';
import { resolve } from 'node:path';

const DEFAULT_MAXBUFFER_SIZE = 20 * 1024 * 1024;

// Usually a numeric exit status, but exec reports a failure to spawn at all as an errno string
// such as 'ENOENT'. Callers here only ask whether it is 0, and both kinds answer that, so it is
// passed through as it always has been rather than flattened into a number.
type ExitCode = number | string;
type SexecCallback = (code: ExitCode, stdout: string, stderr: string) => void;
type SexecOptions = ExecOptions & { silent?: boolean };

const defaults = (): SexecOptions => ({
  silent: false,
  cwd: resolve(process.cwd()).toString(),
  env: process.env,
  maxBuffer: DEFAULT_MAXBUFFER_SIZE,
  encoding: 'utf8',
});

// A failure has to arrive as a code rather than an Error, because that is what callers branch
// on. See issue #536 for the case where exec reports no code at all.
const exitCodeOf = (error: ExecException | null): ExitCode => {
  if (error === null) return 0;
  return error.code === undefined ? 1 : error.code;
};

function sexec(command: string, callback?: SexecCallback): void;
function sexec(command: string, options: SexecOptions, callback?: SexecCallback): void;
function sexec(
  command: string,
  optionsOrCallback?: SexecOptions | SexecCallback,
  maybeCallback?: SexecCallback,
): void {
  const callback =
    typeof optionsOrCallback === 'function' ? optionsOrCallback : (maybeCallback ?? undefined);
  const given = typeof optionsOrCallback === 'object' ? optionsOrCallback : {};

  // This used to print and carry on, and exec then threw synchronously on the empty string —
  // so the one thing the check was there to prevent is what happened, and it arrived as an
  // exception rather than through the callback every other outcome uses.
  if (!command) {
    const reason = '[sexec] must specify command';
    if (callback) process.nextTick(() => callback(1, '', reason));
    else console.error(reason);
    return;
  }

  // Copied rather than merged in place: callers reuse the object they hand in, and writing to it
  // made a second call behave differently from the first for no reason they could see.
  const options: SexecOptions = Object.assign(defaults(), given);

  const child = exec(command, options, (error, stdout, stderr) => {
    if (callback) callback(exitCodeOf(error), String(stdout), String(stderr));
  });

  if (!options.silent) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }
}

export = sexec;
