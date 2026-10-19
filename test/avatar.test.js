import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import db from '../config/db.js';
import { sanitizeAvatar } from '../services/avatarImage.js';
import authRoutes from '../routes/authRoutes.js';
import errorHandler from '../middleware/errorHandler.js';
import generateToken from '../utils/generateToken.js';

test('avatar re-encodes bounded JPEG without EXIF; rejects invalid, oversized and SVG content', async () => {
  const input = await sharp({ create: { width: 80, height: 120, channels: 3, background: '#cc3300' } }).withMetadata({ exif: { IFD0: { Artist: 'private' } } }).png().toBuffer();
  const result = await sanitizeAvatar(input.toString('base64'));
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 384); assert.equal(meta.height, 384);
  assert.equal(meta.exif, undefined); assert.ok(result.length <= 262144);
  for (const bad of ['garbage', Buffer.from('<svg/>').toString('base64'), 'A'.repeat(350001)]) {
    await assert.rejects(() => sanitizeAvatar(bad), { statusCode: 422 });
  }
});
test('avatar API authenticates, persists, replaces and deletes only the signed-in owner', async () => {
  const original = db.execute;
  const avatars = new Map();
  const mutations = [];
  db.execute = async (sql, args) => {
    if (sql.startsWith('SELECT id,name')) return [[{ id: args[0], name: 'Synthetic', email: 'test@example.test', password: 'hash' }]];
    if (sql.startsWith('SELECT jpeg')) return [avatars.has(args[0]) ? [{ jpeg: avatars.get(args[0]) }] : []];
    if (sql.startsWith('INSERT INTO user_avatars')) { mutations.push(args[0]); avatars.set(args[0], args[1]); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('DELETE FROM user_avatars')) { mutations.push(args[0]); avatars.delete(args[0]); return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const app = express(); app.use(express.json({ limit: '350kb' })); app.use('/auth', authRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/auth/avatar`;
  const headers = { authorization: `Bearer ${generateToken(7, 'hash')}`, 'content-type': 'application/json' };
  try {
    assert.equal((await fetch(url)).status, 401);
    const image = (await sharp({ create: { width: 50, height: 50, channels: 3, background: '#123456' } }).png().toBuffer()).toString('base64');
    const save = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ image, userId: 99 }) });
    assert.equal(save.status, 200);
    const photo = (await save.json()).data.avatar;
    assert.equal((await (await fetch(url, { headers })).json()).data.avatar, photo);
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ image }) })).status, 200);
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 200);
    assert.equal((await (await fetch(url, { headers })).json()).data.avatar, null);
    assert.deepEqual(mutations, [7, 7, 7]);
  } finally { db.execute = original; await new Promise(resolve => server.close(resolve)); }
});

test('unapplied avatar migration fails honestly for every operation and recovers after provisioning', async () => {
  const original = db.execute;
  let provisioned = false;
  db.execute = async (sql) => {
    if (sql.startsWith('SELECT id,name')) return [[{ id: 7, password: 'hash' }]];
    if (!provisioned) throw Object.assign(new Error('private database.user_avatars missing'), { code: 'ER_NO_SUCH_TABLE' });
    return sql.startsWith('SELECT') ? [[]] : [{ affectedRows: 1 }];
  };
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/auth/avatar`;
  const image = (await sharp({ create: { width: 1, height: 1, channels: 3, background: '#123456' } }).png().toBuffer()).toString('base64');
  const headers = { authorization: `Bearer ${generateToken(7, 'hash')}`, 'content-type': 'application/json' };
  try {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await fetch(url, { method })).status, 401);
      const response = await fetch(url, { method, headers, ...(method === 'PUT' ? { body: JSON.stringify({ image }) } : {}) });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.data, undefined);
      assert.ok(!JSON.stringify(body).includes('user_avatars'));
    }
    provisioned = true;
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.avatar, null);
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 200);
  } finally {
    db.execute = original;
    await new Promise(resolve => server.close(resolve));
  }
});
