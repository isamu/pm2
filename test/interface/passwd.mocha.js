var assert = require('assert');
var passwd = require('../../dist/lib/tools/passwd.js');

var PASSWD_SAMPLE = [
  '# a comment line',
  'root:*:0:0:System Administrator:/var/root:/bin/sh',
  'deploy:x:1001:1001:Deploy User,,,:/home/deploy:/bin/bash',
  'nobody:*:-2:-2:Unprivileged User:/var/empty:/usr/bin/false',
  '',
].join('\n');

var GROUP_SAMPLE = ['# a comment line', 'wheel:*:0:root,admin', 'staff:*:20:', ''].join('\n');

describe('passwd', function () {
  describe('.parsePasswd', function () {
    it('should key each entry by both name and id', function () {
      var users = passwd.parsePasswd(PASSWD_SAMPLE);
      assert.strictEqual(users.deploy.username, 'deploy');
      assert.strictEqual(users['1001'].username, 'deploy');
    });

    it('should split the fields of a line', function () {
      var deploy = passwd.parsePasswd(PASSWD_SAMPLE).deploy;
      assert.deepStrictEqual(deploy, {
        username: 'deploy',
        password: 'x',
        userId: '1001',
        groupId: '1001',
        name: 'Deploy User',
        homedir: '/home/deploy',
        shell: '/bin/bash',
      });
    });

    it('should skip comments and blank lines', function () {
      var users = passwd.parsePasswd(PASSWD_SAMPLE);
      assert.deepStrictEqual(Object.keys(users).sort(), [
        '-2',
        '0',
        '1001',
        'deploy',
        'nobody',
        'root',
      ]);
    });

    // app.user comes out of the user's own ecosystem file and is handed straight to this map.
    // On a plain object, "constructor" and "__proto__" answer with something inherited, and the
    // caller reads that as a user it found.
    it('should not answer for a name it never saw', function () {
      var users = passwd.parsePasswd(PASSWD_SAMPLE);
      assert.strictEqual(users.constructor, undefined);
      assert.strictEqual(users.toString, undefined);
      assert.strictEqual(users['__proto__'], undefined);
      assert.strictEqual(users.hasOwnProperty, undefined);
    });

    // A line that has been truncated used to reach fields[4].split(',') and throw, taking the
    // whole user lookup with it rather than skipping the one bad line.
    it('should skip a line that does not have all its fields', function () {
      var users = passwd.parsePasswd('short:x:1:1\ngood:x:2:2:Name:/home/good:/bin/sh\n');
      assert.strictEqual(users.short, undefined);
      assert.strictEqual(users.good.homedir, '/home/good');
    });

    it('should return an empty map for empty input', function () {
      assert.deepStrictEqual(Object.keys(passwd.parsePasswd('')), []);
    });
  });

  describe('.parseGroups', function () {
    it('should key each group by both name and id', function () {
      var groups = passwd.parseGroups(GROUP_SAMPLE);
      assert.strictEqual(groups.wheel.name, 'wheel');
      assert.strictEqual(groups['0'].name, 'wheel');
    });

    it('should split the member list', function () {
      assert.deepStrictEqual(passwd.parseGroups(GROUP_SAMPLE).wheel.members, ['root', 'admin']);
    });

    it('should not answer for a group it never saw', function () {
      var groups = passwd.parseGroups(GROUP_SAMPLE);
      assert.strictEqual(groups.constructor, undefined);
      assert.strictEqual(groups['__proto__'], undefined);
    });

    it('should skip a line that does not have all its fields', function () {
      var groups = passwd.parseGroups('short:x:5\ngood:x:6:a,b\n');
      assert.strictEqual(groups.short, undefined);
      assert.deepStrictEqual(groups.good.members, ['a', 'b']);
    });
  });

  describe('reading the system files', function () {
    it('should read the real passwd database', function () {
      var users = passwd.getUsers();
      assert.strictEqual(typeof users, 'object');
      assert.ok(Object.keys(users).length > 0);
    });
  });
});
