import { spawn } from 'node:child_process';
import chalk from 'ansis';

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;
const GIGABYTE = MEGABYTE * 1024;
const TERABYTE = GIGABYTE * 1024;

// Largest first: the first unit the elapsed time covers more than once is the one shown.
const UNITS: [string, number][] = [
  ['Y', 31536000],
  ['M', 2592000],
  ['D', 86400],
  ['h', 3600],
  ['m', 60],
];

const MISSING = 'N/A';

const STATUS_LABEL: Record<string, string> = {
  online: chalk.green.bold('online'),
  running: chalk.green.bold('online'),
  restarting: chalk.yellow.bold('restart'),
  created: chalk.yellow.bold('created'),
  launching: chalk.blue.bold('launching'),
};

const bytesToSize = (bytes: number, precision: number): string => {
  if (bytes >= TERABYTE) return (bytes / TERABYTE).toFixed(precision) + 'tb ';
  if (bytes >= GIGABYTE) return (bytes / GIGABYTE).toFixed(precision) + 'gb ';
  if (bytes >= MEGABYTE) return (bytes / MEGABYTE).toFixed(precision) + 'mb ';
  if (bytes >= KILOBYTE) return (bytes / KILOBYTE).toFixed(precision) + 'kb ';
  return bytes + 'b ';
};

const colorStatus = (status: string): string =>
  Object.prototype.hasOwnProperty.call(STATUS_LABEL, status)
    ? STATUS_LABEL[status]
    : chalk.red.bold(status);

const fillMissing = (value: unknown): unknown => {
  if (value === undefined || value === null) return MISSING;
  if (Array.isArray(value)) {
    return value.map((each) => (each === undefined || each === null ? MISSING : each));
  }
  return value;
};

// Each row is a one-key object; the key is the column and pm2 would rather print N/A than an
// empty cell where a process has not reported a figure yet.
const safe_push = (table: unknown[], ...rows: Record<string, unknown>[]): void => {
  rows.forEach((row) => {
    const column = Object.keys(row)[0];
    if (column !== undefined) row[column] = fillMissing(row[column]);
    table.push(row);
  });
};

const timeSince = (date: number | Date): string => {
  const seconds = Math.floor((Date.now() - Number(date)) / 1000);

  const unit = UNITS.find(([, span]) => Math.floor(seconds / span) > 1);
  if (!unit) return Math.floor(seconds) + 's';

  return Math.floor(seconds / unit[1]) + unit[0];
};

const colorizedMetric = (value: number, warn: number, alert: number, prefix = ''): string => {
  if (isNaN(value)) return MISSING;
  if (value == 0) return 0 + prefix;

  // Thresholds the other way round mean lower is worse — free memory rather than load.
  const inverted = alert < warn;
  const good = inverted ? value > warn : value < warn;
  const middling = inverted ? value <= warn && value >= alert : value >= warn && value <= alert;

  if (good) return chalk.green(value + prefix);
  if (middling) return chalk.bold.yellow(value + prefix);
  return chalk.bold.red(value + prefix);
};

/**
 * Reads a dotted path off an object. Own properties only: the path is chosen by a lookup keyed
 * on whatever the user typed after --sort, so a plain object would otherwise answer for
 * "constructor" and hand back something off Object.prototype.
 */
const getNestedProperty = (propertyName: string, obj: unknown): unknown =>
  String(propertyName)
    .split('.')
    .reduce<unknown>((current, part) => {
      if (typeof current !== 'object' || current === null) return undefined;
      return Object.prototype.hasOwnProperty.call(current, part)
        ? (current as Record<string, unknown>)[part]
        : undefined;
    }, obj ?? {});

interface EditorOptions {
  editor?: string;
}

type EditorCallback = (code: number | null, signal: NodeJS.Signals | null) => void;

const openEditor = (
  file: string,
  optsOrCallback?: EditorOptions | EditorCallback,
  maybeCallback?: EditorCallback,
): void => {
  const callback = typeof optsOrCallback === 'function' ? optsOrCallback : maybeCallback;
  const opts = typeof optsOrCallback === 'object' && optsOrCallback ? optsOrCallback : {};

  const fallback = process.platform === 'win32' ? 'notepad' : 'vim';
  const editor = opts.editor || process.env.VISUAL || process.env.EDITOR || fallback;

  const args = editor.split(/\s+/);
  const bin = args.shift() ?? fallback;

  const editing = spawn(bin, args.concat([file]), { windowsHide: true, stdio: 'inherit' });
  editing.on('exit', (code, signal) => {
    if (callback) callback(code, signal);
  });
};

const dispKeys = (modules: Record<string, unknown>, target_module?: string | null): void => {
  new Map(Object.entries(modules)).forEach((settings, moduleName) => {
    if (target_module != null && target_module != moduleName) return;
    if (typeof settings != 'object' || settings === null) return;

    console.log(chalk.bold('Module: ') + chalk.bold.blue(moduleName));
    new Map(Object.entries(settings)).forEach((value, settingName) => {
      console.log(`$ pm2 set ${moduleName}:${settingName} ${value}`);
    });
  });
};

export = {
  bytesToSize,
  colorStatus,
  safe_push,
  timeSince,
  colorizedMetric,
  getNestedProperty,
  openEditor,
  dispKeys,
};
