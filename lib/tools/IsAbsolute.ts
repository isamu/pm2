// Node's own splitDeviceRe answers this with one pattern, but only two of its groups decide the
// result and anchoring its lazy tail is what made it backtrack. Split into the three things
// actually being asked, each of which matches a fixed prefix and cannot backtrack at all.
// https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
const DRIVE_LETTER = /^[a-zA-Z]:/;
const UNC_PREFIX = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/;
const SEPARATOR = /^[\\/]/;

const posix = (target: string): boolean => target.charAt(0) === '/';

const win32 = (target: string): boolean => {
  // \\server\share names a remote root, so it is absolute whatever follows it.
  if (UNC_PREFIX.test(target)) return true;

  const drive = DRIVE_LETTER.exec(target);
  const afterDrive = drive ? target.slice(drive[0].length) : target;

  // C:file is relative to the current directory *on* C:; only C:\file is absolute.
  return SEPARATOR.test(afterDrive);
};

interface IsAbsolute {
  (target: string): boolean;
  posix: (target: string) => boolean;
  win32: (target: string) => boolean;
}

const forThisPlatform: IsAbsolute = Object.assign(process.platform === 'win32' ? win32 : posix, {
  posix,
  win32,
});

export = forThisPlatform;
