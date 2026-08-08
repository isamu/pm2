/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
import { format } from 'node:util';
import rawSchema from '../API/schema.json';

interface SchemaEntry {
  type: string | string[];
  alias?: string | string[];
  require?: boolean;
  regex?: string;
  desc?: string;
  default?: unknown;
  max?: number;
  min?: number;
  ext_type?: string;
}

type Schema = Record<string, SchemaEntry>;

const ERROR_MESSAGES: Record<string, string> = {
  require: '"%s" is required',
  type: 'Expect "%s" to be a typeof %s, but now is %s',
  regex: 'Verify "%s" with regex failed, %s',
  max: 'The maximum of "%s" is %s, but now is %s',
  min: 'The minimum of "%s" is %s, but now is %s',
};

// [suffix, multiplier] rather than an object, so the single-letter suffixes stay data.
const SIZE_SUFFIXES: Record<string, [string, number][]> = {
  sbyte: [
    ['G', 1024 * 1024 * 1024],
    ['M', 1024 * 1024],
    ['K', 1024],
  ],
  stime: [
    ['h', 60 * 60 * 1000],
    ['m', 60 * 1000],
    ['s', 1000],
  ],
};

const NUMBER_TAG = '[object Number]';
const STRING_TAG = '[object String]';
const BOOLEAN_TAG = '[object Boolean]';
const ARRAY_TAG = '[object Array]';

// A key holding a backslash is a regular expression matched against whatever the user wrote,
// rather than a name to look up.
const isPatternKey = (key: string): boolean => key.includes('\\');

const own = <T>(obj: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

const aliasesOf = (entry: SchemaEntry): string[] => (Array.isArray(entry.alias) ? entry.alias : []);

const declaredAliases = (entry: SchemaEntry): string[] => {
  if (Array.isArray(entry.alias)) return entry.alias;
  return entry.alias ? [entry.alias] : [];
};

const typeTag = (name: string): string => `[object ${name[0].toUpperCase()}${name.slice(1)}]`;

const camelCase = (key: string): string =>
  key
    .split('_')
    .map((part, index) =>
      index !== 0 && part.length > 1 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join('');

// Every option answers to its camelCase spelling as well as any alias the schema names, so
// `maxMemoryRestart` and `max_memory_restart` are the same option.
const withAliases = (schema: Schema): Schema => {
  Object.keys(schema).forEach((key) => {
    if (isPatternKey(key)) return;
    const entry = schema[key];
    entry.alias = [...declaredAliases(entry), camelCase(key)];
  });
  return schema;
};

const wantsNumber = (value: unknown, expected: string[]): number | null => {
  const tag = Object.prototype.toString.call(value);
  if (tag === BOOLEAN_TAG || !expected.includes(NUMBER_TAG) || isNaN(Number(value))) return null;
  return parseFloat(String(value));
};

// Quoted runs stay together and lose their quotes; everything else splits on whitespace. Flat
// alternation on purpose — the nested version was CVE-2025-5891.
const splitArguments = (value: string): string[] =>
  (value.match(/[^\s"'=]+="[^"]*"|[^\s"'=]+='[^']*'|"([^"]*)"|'([^']*)'|\S+/g) ?? [])
    .map((each) => {
      if (each[0] === '"' && each[each.length - 1] === '"') return each.slice(1, -1);
      if (each[0] === "'" && each[each.length - 1] === "'") return each.slice(1, -1);
      return each;
    })
    .filter((each) => each && each.trim());

// Declared as an array first but given as a string: split it the way a shell would. A size or
// duration written with a suffix becomes the number of bytes or milliseconds it stands for.
const coerce = (entry: SchemaEntry, expected: string[], tag: string, value: unknown): unknown => {
  if (tag !== STRING_TAG) return value;

  if (expected.length > 1 && expected[0] !== tag && expected[0] === ARRAY_TAG) {
    return splitArguments(String(value));
  }

  const suffixes = entry.ext_type ? own(SIZE_SUFFIXES, entry.ext_type) : undefined;
  const text = String(value);
  if (!suffixes || text.length < 2) return value;

  const match = suffixes.find(([suffix]) => suffix === text.slice(-1));
  return parseFloat(text.slice(0, -1)) * (match ? match[1] : NaN);
};

let cachedSchema: Schema | null = null;

const Config = {
  _errMsgs: ERROR_MESSAGES,
  _errors: [] as string[],

  get schema(): Schema {
    cachedSchema ??= withAliases(rawSchema as Schema);
    return cachedSchema;
  },

  /**
   * Reads the options the caller actually supplied — under any of their names — into their
   * canonical schema keys.
   */
  filterOptions(cmd: Record<string, unknown>): Record<string, unknown> {
    const conf: Record<string, unknown> = {};
    const schema = this.schema;

    Object.keys(schema).forEach((key) => {
      aliasesOf(schema[key]).forEach((alias) => {
        if (!Object.prototype.hasOwnProperty.call(cmd, alias)) return;
        conf[key] ??= cmd[alias];
      });
    });

    return conf;
  },

  validateJSON(json: Record<string, unknown>): {
    errors: string[];
    config: Record<string, unknown>;
  } {
    const conf: Record<string, unknown> = Object.assign({}, json);
    const res: Record<string, unknown> = {};
    const schema = this.schema;
    this._errors = [];

    Object.keys(schema)
      .filter((key) => !isPatternKey(key))
      .forEach((key) => {
        const entry = schema[key];
        aliasesOf(entry).forEach((alias) => {
          conf[key] ||= own(json, alias);
        });

        const given = conf[key];
        delete conf[key];

        // Undefined short-circuits before _valid runs, so the schema's `require` is never
        // evaluated here. Left as it is: turning it on would start rejecting configs that pm2
        // accepts today.
        const value = given === undefined || given === null ? null : this._valid(key, given);
        if (value === null) {
          if (entry.default !== undefined) res[key] = entry.default;
          return;
        }
        res[key] = value;
      });

    // Anything left over is matched against the pattern keys.
    Object.keys(schema)
      .filter(isPatternKey)
      .forEach((patternKey) => {
        const pattern = new RegExp(patternKey);
        Object.keys(conf).forEach((key) => {
          if (!pattern.test(key)) return;
          if (this._valid(key, conf[key], schema[patternKey])) {
            res[key] = conf[key];
            delete conf[key];
          }
        });
      });

    return { errors: this._errors, config: res };
  },

  _valid(key: string, value: unknown, sch?: SchemaEntry): unknown {
    const entry = sch ?? own(this.schema, key);
    if (!entry) return null;

    if (this._error(Boolean(entry.require) && value === undefined, 'require', key)) return null;
    if (value === undefined) return null;

    const expected = (typeof entry.type === 'string' ? [entry.type] : entry.type).map(typeTag);
    // A number written as a string is still a number, unless it is a boolean.
    const asNumber = wantsNumber(value, expected);
    const parsed = asNumber ?? value;
    const tag = asNumber === null ? Object.prototype.toString.call(value) : NUMBER_TAG;

    if (this._error(!expected.includes(tag), 'type', key, expected.join(' / '), tag)) return null;
    if (this._rejectedByRegex(key, entry, tag, parsed)) return null;
    if (this._outOfRange(key, entry, tag, parsed)) return null;

    return coerce(entry, expected, tag, parsed);
  },

  _rejectedByRegex(key: string, entry: SchemaEntry, tag: string, value: unknown): boolean {
    const failed =
      tag === STRING_TAG &&
      Boolean(entry.regex) &&
      !new RegExp(entry.regex ?? '').test(String(value));
    return this._error(failed, 'regex', key, entry.desc ?? `should match ${entry.regex}`);
  },

  _outOfRange(key: string, entry: SchemaEntry, tag: string, value: unknown): boolean {
    if (tag !== NUMBER_TAG) return false;
    const amount = Number(value);
    if (this._error(entry.max !== undefined && amount > entry.max, 'max', key, entry.max, amount)) {
      return true;
    }
    return this._error(
      entry.min !== undefined && amount < entry.min,
      'min',
      key,
      entry.min,
      amount,
    );
  },

  _error(possible: boolean, type: string, ...args: unknown[]): boolean {
    if (possible) {
      this._errors?.push(format(own(ERROR_MESSAGES, type) ?? type, ...args));
    }
    return possible;
  },
};

export = Config;
