/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { readFile, lstat, writeFile } from 'node:fs';
import { join } from 'node:path';

//  hacked from node-tabtab 0.0.4 https://github.com/mklabs/node-tabtab.git
//  Itself based on npm completion by @isaac

type Callback = (err: Error | null, env?: unknown, content?: string) => void;
type ContentCallback = (err: Error | null, content?: string) => void;

interface CompletionEnv {
  args: string[];
  complete: boolean;
  install: boolean;
  uninstall: boolean;
  words: number;
  point: number;
  line?: string;
}

const SHELL_NAME = /\/bin\/(\w+)/;

const parseEnv = (): CompletionEnv => {
  const args = process.argv.slice(2);
  const complete = args[0] === 'completion';

  return {
    args,
    complete,
    install: complete && args[1] === 'install',
    uninstall: complete && args[1] === 'uninstall',
    words: Number(process.env.COMP_CWORD),
    point: Number(process.env.COMP_POINT),
    line: process.env.COMP_LINE,
  };
};

/**
 * The rc file for the shell the user is running, or null when SHELL says nothing useful — which
 * is routine in containers, cron, and anything not started from a login shell.
 */
const rcFileName = (): string | null => {
  const shell = SHELL_NAME.exec(process.env.SHELL ?? '');
  return shell ? `.${shell[1]}rc` : null;
};

const missingRcError = (file: string, completer: string): Error =>
  new Error(`No ${file} file. You'll have to run instead: ${completer} completion >> ~/${file}`);

const unknownShellError = (): Error =>
  new Error(`Cannot tell which shell to set up completion for; SHELL is ${process.env.SHELL}`);

const withRc = (
  completer: string,
  action: (err: Error | null, filepath?: string) => void,
): void => {
  const file = rcFileName();
  if (!file) return action(unknownShellError());

  const filepath = join(process.env.HOME ?? '', file);
  lstat(filepath, (err) => {
    if (err) return action(missingRcError(file, completer));
    action(null, filepath);
  });
};

const readRc = (completer: string, done: ContentCallback): void => {
  withRc(completer, (err, filepath) => {
    if (err || !filepath) return done(err);
    readFile(filepath, 'utf8', done);
  });
};

const writeRc = (completer: string, content: string, done: ContentCallback): void => {
  withRc(completer, (err, filepath) => {
    if (err || !filepath) return done(err);
    writeFile(filepath, content, done);
  });
};

// The completion script itself, a template naming the command it completes.
const script = (name: string, completer: string, done: ContentCallback): void => {
  readFile(join(__dirname, 'completion.sh'), 'utf8', (err, content) => {
    if (err) return done(err);
    done(null, content);
  });
};

const install = (name: string, completer: string, done: ContentCallback): void => {
  const markerIn = `###-begin-${name}-completion-###`;
  let rcContents: string | undefined;
  let scriptOutput: string | undefined;

  const next = (): void => {
    if (!rcContents || !scriptOutput) return;
    writeRc(completer, rcContents + scriptOutput, (err) => {
      if (err) return done(err);
      done(null, ` ✓ ${completer} tab-completion installed.`);
    });
  };

  readRc(completer, (err, file) => {
    if (err || file === undefined) return done(err);

    if (file.split(markerIn)[1]) {
      return done(null, ` ✗ ${completer} tab-completion has been already installed. Do nothing.`);
    }

    rcContents = file;
    next();
  });

  script(name, completer, (err, file) => {
    scriptOutput = file;
    next();
  });
};

const uninstall = (name: string, completer: string, done: ContentCallback): void => {
  const markerIn = `\n\n###-begin-${name}-completion-###`;
  const markerOut = `###-end-${name}-completion-###\n`;

  readRc(completer, (err, file) => {
    if (err || file === undefined) return done(err);

    const part = file.split(markerIn)[1];
    if (!part) {
      return done(null, ` ✗ ${completer} tab-completion has been already uninstalled. Do nothing.`);
    }

    const block = markerIn + part.split(markerOut)[0] + markerOut;
    writeRc(completer, file.replace(block, ''), (writeErr) => {
      if (writeErr) return done(writeErr);
      done(null, ` ✓ ${completer} tab-completion uninstalled.`);
    });
  });
};

const reportThen = (done: Callback) => (err: Error | null, state?: string) => {
  console.log(state || err?.message);
  if (err) return done(err);
  done(null, null, state);
};

// Dumps the install script to stdout, which is how `. <(pm2 completion)` works.
const dumpScript = (name: string, completer: string, done: Callback): void => {
  script(name, completer, (err, content) => {
    if (err) return done(err);
    process.stdout.write(content ?? '', () => done(null, null, content));
    process.stdout.on('error', (writeErr: NodeJS.ErrnoException) => {
      // bash on macOS closes its file argument before reading from it, so `source <(...)` always
      // raises EPIPE after exactly one successful write. See npm's own completion for the story.
      done(writeErr.code === 'EPIPE' ? null : writeErr, null, content);
    });
  });
};

const complete = (name: string, completer: string | Callback, maybeCallback?: Callback): void => {
  // Called with two arguments: the completer is the executable itself.
  const done = typeof completer === 'function' ? completer : (maybeCallback as Callback);
  const command = typeof completer === 'function' ? name : completer;

  const env = parseEnv();
  if (!env.complete) return done(null);
  if (env.install) return install(name, command, reportThen(done));
  if (env.uninstall) return uninstall(name, command, reportThen(done));
  if (!env.words || !env.point || !env.line) return dumpScript(name, command, done);

  const partial = env.line.substr(0, env.point);
  const lastWord = (line: string) => line.split(' ').slice(-1).join('');

  done(null, {
    line: env.line,
    words: env.words,
    point: env.point,
    partial,
    last: lastWord(env.line),
    prev: env.line.split(' ').slice(0, -1).slice(-1)[0],
    lastPartial: lastWord(partial),
  });
};

const isComplete = (): boolean => {
  const env = parseEnv();
  return env.complete || Boolean(env.words && env.point && env.line);
};

const trim = (value: string): string => value.trim();
const cleanPrefix = (value: string): string => value.replace(/-/g, '');

// match answers null rather than an empty list, so help text carrying no flags of one kind used
// to take the completion script down here.
const parseOut = (str: string): { shorts: string[]; longs: string[] } => ({
  shorts: (str.match(/\s-\w+/g) ?? []).map(trim).map(cleanPrefix),
  longs: (str.match(/\s--\w+/g) ?? []).map(trim).map(cleanPrefix),
});

// specific to cake case
const parseTasks = (str: string, prefix: string | null, reg?: RegExp): string[] => {
  const tasks = str.match(reg ?? new RegExp(`^${prefix}\\s[^#]+`, 'gm')) ?? [];
  return tasks.map(trim).map((each) => each.replace(`${prefix} `, ''));
};

const log = (arr: string | string[], opts: { last: string }, prefix = ''): void => {
  const starts = new RegExp(`^${opts.last.replace(/^--?/g, '')}`);
  (Array.isArray(arr) ? arr : [arr])
    .filter((each) => starts.test(each))
    .forEach((each) => console.log(prefix + each));
};

export = { complete, isComplete, parseOut, parseTasks, log, missingRcError };
