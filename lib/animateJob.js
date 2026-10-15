// Signed, stateless Animate job tokens: the client polls with it; the server re-checks everything.
import crypto from 'crypto';
const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
const sign = (p) => crypto.createHmac('sha256', SECRET()).update(`anim.${p}`).digest('base64url');
// fields: p (prediction id), u (creator uid), s (source image id), c (credits charged), x (expiry ms)
export function makeJob(fields) {
  const p = Buffer.from(JSON.stringify(fields)).toString('base64url');
  return `${p}.${sign(p)}`;
}
export function readJob(token) {
  if (typeof token !== 'string' || !SECRET() || token.length > 6000) return null;
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const j = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); return j && j.x > Date.now() ? j : null; } catch { return null; }
}
