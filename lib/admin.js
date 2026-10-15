import crypto from 'crypto';

export const ADMIN_COOKIE = 'pp_admin';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SIGN_SECRET = process.env.CREDITS_SECRET || ADMIN_KEY;

export function adminEnabled() {
  return Boolean(ADMIN_KEY);
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb) && String(a).length === String(b).length;
}

export function checkAdminKey(key) {
  if (!adminEnabled() || typeof key !== 'string' || !key) return false;
  return safeEqual(key, ADMIN_KEY);
}

// Signature is bound to the current ADMIN_KEY, so rotating ADMIN_KEY revokes old cookies.
function sign(payload) {
  const keyTag = crypto.createHash('sha256').update(ADMIN_KEY).digest('hex').slice(0, 16);
  return crypto.createHmac('sha256', SIGN_SECRET).update(`${payload}.${keyTag}`).digest('base64url');
}

export function isAdmin(request) {
  if (!adminEnabled()) return false;
  const v = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!v) return false;
  const parts = v.split('.');
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  if (!/^\d+$/.test(ts)) return false;
  return safeEqual(sig, sign(`admin.${ts}`));
}

export function setAdminCookie(response) {
  const ts = String(Date.now());
  response.cookies.set(ADMIN_COOKIE, `${ts}.${sign(`admin.${ts}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
