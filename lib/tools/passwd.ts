import { readFileSync } from 'node:fs';

export interface PasswdEntry {
  username: string;
  password: string;
  userId: string;
  groupId: string;
  name: string;
  homedir: string;
  shell: string;
}

export interface GroupEntry {
  name: string;
  password: string;
  id: string;
  members: string[];
}

const PASSWD_FIELDS = 7;
const GROUP_FIELDS = 4;

const contentLines = (contents: string): string[] =>
  contents.split('\n').filter((line) => line.length > 0 && line[0] !== '#');

// A prototype-less map, because the key comes from the user's own ecosystem file. On a plain
// object, `user: "constructor"` answers with something inherited and the caller reads that as a
// user it found, then parses undefined into the uid.
const emptyMap = <T>(): Record<string, T> => Object.create(null);

const indexBy = <T>(entries: [string, string, T][]): Record<string, T> => {
  const map = emptyMap<T>();
  entries.forEach(([name, id, entry]) => {
    map[name] = entry;
    map[id] = entry;
  });
  return map;
};

export const parsePasswd = (contents: string): Record<string, PasswdEntry> =>
  indexBy(
    contentLines(contents)
      // A truncated line used to reach fields[4].split(',') and throw, taking the whole lookup
      // down rather than skipping the one bad line.
      .map((line) => line.split(':'))
      .filter((fields) => fields.length >= PASSWD_FIELDS)
      .map((fields) => [
        fields[0],
        fields[2],
        {
          username: fields[0],
          password: fields[1],
          userId: fields[2],
          groupId: fields[3],
          name: fields[4].split(',')[0],
          homedir: fields[5],
          shell: fields[6],
        },
      ]),
  );

export const parseGroups = (contents: string): Record<string, GroupEntry> =>
  indexBy(
    contentLines(contents)
      .map((line) => line.split(':'))
      .filter((fields) => fields.length >= GROUP_FIELDS)
      .map((fields) => [
        fields[0],
        fields[2],
        {
          name: fields[0],
          password: fields[1],
          id: fields[2],
          members: fields[3].split(','),
        },
      ]),
  );

export const getUsers = (): Record<string, PasswdEntry> =>
  parsePasswd(readFileSync('/etc/passwd', 'utf8'));

// Returns the error rather than throwing it, which is what it has always done. Common.js wraps
// the call in a try/catch that therefore never fires and falls through to "Group cannot be
// found" instead — wrong shape, right outcome, and not this migration's call to change.
export const getGroups = (): Record<string, GroupEntry> | Error => {
  try {
    return parseGroups(readFileSync('/etc/group', 'utf8'));
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};
