/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * A caught value is `unknown`: anything at all can be thrown, and pm2 catches around syscalls
 * and third-party code where a plain string or an errno object is as likely as an Error. These
 * read what is there and answer undefined when it is not, so a log line about a failure cannot
 * itself fail.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return String(error);
};

export const stackOf = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.stack;
  if (isRecord(error) && typeof error.stack === 'string') return error.stack;
  return undefined;
};

export const codeOf = (error: unknown): string | undefined => {
  if (isRecord(error) && typeof error.code === 'string') return error.code;
  return undefined;
};
