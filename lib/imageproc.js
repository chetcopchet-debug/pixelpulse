// Server-side image normalisation with sharp: EXIF rotate, max 1536px, JPEG (PNG if alpha).
import sharp from 'sharp';

export function sniffType(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12).toLowerCase();
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

export class ImageProcError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

export async function normalizeImage(buf, maxSide = 1536) {
  const type = sniffType(buf);
  if (!type) throw new ImageProcError('That file is not a supported image (use JPG, PNG or WebP).', 415);
  let meta;
  try {
    meta = await sharp(buf, { failOn: 'none', limitInputPixels: 120e6 }).metadata();
  } catch (e) {
    if (type === 'image/heic') throw new ImageProcError('HEIC not supported, choose JPG (or set the camera to "Most compatible").', 415);
    throw new ImageProcError('Could not read that image file. It may be corrupted.', 415);
  }
  try {
    const alpha = meta.hasAlpha && type !== 'image/jpeg';
    let img = sharp(buf, { failOn: 'none', limitInputPixels: 120e6, animated: false }).rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
    img = alpha ? img.png({ compressionLevel: 9 }) : img.flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true });
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: alpha ? 'image/png' : 'image/jpeg', width: info.width, height: info.height, sourceType: type };
  } catch (e) {
    console.error('normalizeImage failed:', type, e?.message);
    if (type === 'image/heic') throw new ImageProcError('HEIC not supported, choose JPG.', 415);
    throw new ImageProcError('Could not process that image.', 415);
  }
}

export const ratioFor = (w, h) => { const r = w / h; return r >= 1.5 ? '16:9' : r <= 0.667 ? '9:16' : '1:1'; };
