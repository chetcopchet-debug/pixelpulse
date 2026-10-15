// One-time free Cutout pass for auto-cutout formats (Sticker, Emoji): the generation was already charged.
// Signed by the server at generation time and bound to that image + creator; consumed once.
import crypto from 'crypto';
import { bump } from './usage';

const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
const TTL_MS = 15 * 60_000;
const sign = (p) => crypto.createHmac('sha256', SECRET()).update(`cutpass.${p}`).digest('base64url');

export function issueCutoutPass(imageId, creatorId) {
  if (!SECRET()) return null;
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(`${imageId}.${creatorId}.${exp}`)}`;
}

// True if the pass is valid for this image + creator and was not used before (consumes it).
export async function consumeCutoutPass(pass, imageId, creatorId) {
  if (typeof pass !== 'string' || !SECRET()) return false;
  const [exp, sig] = pass.split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(`${imageId}.${creatorId}.${exp}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const used = await bump(`cutpass:${imageId}`, 1, 1).catch(() => null);
  return used !== null;
}
