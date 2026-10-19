import db from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sanitizeAvatar } from '../services/avatarImage.js';
import AppError from '../utils/AppError.js';

// The additive avatar migration is applied separately from application deploys.
// Never turn unavailable storage into a successful read, save or deletion.
async function avatarQuery(sql, values) {
  try {
    return await db.execute(sql, values);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      throw new AppError('Profile photo storage is temporarily unavailable.', 503);
    }
    throw error;
  }
}

export const getAvatar = asyncHandler(async (req, res) => {
  const [rows] = await avatarQuery('SELECT jpeg FROM user_avatars WHERE user_id = ?', [req.user.id]);
  res.json({ success: true, data: { avatar: rows[0]?.jpeg.toString('base64') ?? null } });
});
export const saveAvatar = asyncHandler(async (req, res) => {
  const jpeg = await sanitizeAvatar(req.body?.image);
  await avatarQuery('INSERT INTO user_avatars (user_id, jpeg) VALUES (?, ?) ON DUPLICATE KEY UPDATE jpeg = VALUES(jpeg)', [req.user.id, jpeg]);
  res.json({ success: true, data: { avatar: jpeg.toString('base64') } });
});
export const removeAvatar = asyncHandler(async (req, res) => {
  await avatarQuery('DELETE FROM user_avatars WHERE user_id = ?', [req.user.id]);
  res.json({ success: true, data: { avatar: null } });
});
