import { accessSync, existsSync, statSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import cst from '../../constants.js';

// Windows XP's default, in case PATHEXT is missing entirely — child_process.spawn with an empty
// environment is one way that happens.
const XP_DEFAULT_PATHEXT = '.com;.exe;.bat;.cmd;.vbs;.vbe;.js;.jse;.wsf;.wsh';
const EXECUTABLE_MODE = 1;
const HAS_EXTENSION = /\.[^<>:"/|?*.]+$/;

const splitPath = (value: string | undefined): string[] => (value ? value.split(delimiter) : []);

const isExecutable = (pathName: string): boolean => {
  try {
    accessSync(pathName, EXECUTABLE_MODE);
  } catch {
    return false;
  }
  return true;
};

// Windows has no executable bit; there, being named with a PATHEXT extension is what counts.
const isRunnableFile = (pathName: string): boolean =>
  existsSync(pathName) &&
  !statSync(pathName).isDirectory() &&
  (cst.IS_WINDOWS || isExecutable(pathName));

const extensionsToTry = (): string[] => {
  if (!cst.IS_WINDOWS) return [''];
  return splitPath((process.env.PATHEXT || XP_DEFAULT_PATHEXT).toUpperCase());
};

const findInDirectory = (directory: string, command: string, extensions: string[]) => {
  const attempt = cst.IS_WINDOWS
    ? resolve(directory, command).toUpperCase()
    : resolve(directory, command);

  // The caller already typed the extension, as in which('node.exe').
  const typedExtension = attempt.match(HAS_EXTENSION);
  if (typedExtension && extensions.includes(typedExtension[0])) {
    return isRunnableFile(attempt) ? attempt : null;
  }

  return extensions.map((extension) => attempt + extension).find(isRunnableFile) ?? null;
};

/**
 * The absolute path of `command`, searched for on PATH, or null. A command containing a slash is
 * taken as a path in its own right and only checked, not searched for.
 */
const which = (command: string): string | null => {
  if (!command) {
    console.error('must specify command');
    return null;
  }

  if (command.includes('/')) {
    return isRunnableFile(command) ? resolve(command) : null;
  }

  const extensions = extensionsToTry();
  return (
    splitPath(process.env.PATH)
      .map((directory) => findInDirectory(directory, command, extensions))
      .find((match) => match !== null) ?? null
  );
};

export = which;
