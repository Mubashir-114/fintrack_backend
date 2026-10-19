import AppError from '../utils/AppError.js';

export async function sanitizeAvatar(base64) {
  if (typeof base64 !== 'string' || base64.length > 350000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new AppError('Choose a JPEG, PNG or WebP image smaller than 256 KB.', 422);
  }
  const input = Buffer.from(base64, 'base64');
  if (!input.length || input.length > 262144) throw new AppError('Image exceeds 256 KB.', 422);
  // A missing native image binary must not prevent unrelated API routes starting.
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    throw new AppError('Profile photo processing is temporarily unavailable.', 503);
  }
  try {
    const image = sharp(input, { limitInputPixels: 16000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
    // Re-encoding strips EXIF/GPS and other metadata; never retain original uploads.
    return await image.rotate().resize(384, 384, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    throw new AppError('Image cannot be read. Choose a JPEG, PNG or WebP photo.', 422);
  }
}
