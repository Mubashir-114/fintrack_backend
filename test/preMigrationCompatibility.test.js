import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('server starts and existing routes work without avatar storage or a native image processor', () => {
  const result = spawnSync(process.execPath, [
    '--import', './config/testEnv.js', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { Server } from 'node:http';
    import db from './config/db.js';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'sharp') throw new Error('Simulated missing native processor');
      return next(specifier, context);
    }});
    let user;
    let avatarQueries = 0;
    db.query = async sql => { assert.equal(sql, 'SELECT 1'); return [[{ healthy: 1 }]]; };
    db.execute = async (sql, args) => {
      if (sql.includes('user_avatars')) { avatarQueries++; throw Object.assign(new Error('missing table'), { code: 'ER_NO_SUCH_TABLE' }); }
      if (sql.startsWith('SELECT * FROM users WHERE email')) return [user ? [user] : []];
      if (sql.startsWith('Insert into users')) { user = { id: 7, name: args[0], email: args[1], password: args[2] }; return [{ insertId: 7 }]; }
      if (sql.startsWith('SELECT id,name')) return [[user]];
      if (sql.includes('COUNT')) return [[{ total: 0 }]];
      if (sql.includes('FROM transactions')) return [[]];
      throw new Error('Unexpected pre-migration query: ' + sql);
    };
    let server;
    const listen = Server.prototype.listen;
    Server.prototype.listen = function (...args) { server = this; return listen.apply(this, args); };
    await import('./server.js');
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    Server.prototype.listen = listen;
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      assert.equal(avatarQueries, 0, 'Startup must not require the avatar table');
      assert.equal((await fetch(base + '/health')).status, 200);
      const payload = { name: 'Synthetic', email: 'compatibility@example.test', password: 'SyntheticPassword123!' };
      const post = path => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal((await post('/api/auth/register')).status, 201);
      const login = await post('/api/auth/login');
      assert.equal(login.status, 200);
      const headers = { authorization: 'Bearer ' + (await login.json()).data.token, 'content-type': 'application/json' };
      for (const path of ['/api/auth/me', '/api/transactions', '/api/analytics/capabilities']) {
        const response = await fetch(base + path, { headers });
        assert.equal(response.status, 200, path);
        assert.equal((await response.json()).success, true);
      }
      assert.equal(avatarQueries, 0, 'Existing routes must not query avatar storage');
      assert.equal((await fetch(base + '/api/auth/avatar', { headers })).status, 503);
      const save = await fetch(base + '/api/auth/avatar', { method: 'PUT', headers, body: JSON.stringify({ image: 'YWJj' }) });
      assert.equal(save.status, 503, 'Missing native processor must not fake a save');
      assert.equal((await fetch(base + '/health')).status, 200);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await db.end();
    }
  `], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, PORT: '0' },
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
