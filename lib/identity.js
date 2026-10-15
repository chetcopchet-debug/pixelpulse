import crypto from 'crypto';

// Anonymous creator identity, stored as a SIGNED cookie: "<uuid>.<hmac>".
// The raw creator id is never put in public URLs or API responses.
// Legacy unsigned cookies (plain uuid) are NOT trusted by normal routes; /api/session upgrades them
// exactly once by moving that uid's rows to a brand-new random uid (so a copied old uid becomes useless).
export const UID_COOKIE = 'pp_uid';
const SECRET = process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sign(id) {
  return crypto.createHmac('sha256', SECRET).update(`uid.${id}`).digest('base64url');
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function readUidCookie(request) {
  const v = request.cookies.get(UID_COOKIE)?.value || '';
  const [id, sig, extra] = v.split('.');
  if (SECRET && extra === undefined && sig && UUID_RE.test(id) && safeEq(sig, sign(id))) return { id, signed: true };
  if (!sig && UUID_RE.test(id)) return { id, legacy: true };
  return null;
}

// Returns { id, isNew, legacyId? }. Only a valid signed cookie yields an existing identity.
export function getCreatorId(request) {
  const c = readUidCookie(request);
  if (c?.signed) return { id: c.id, isNew: false };
  return { id: crypto.randomUUID(), isNew: true, ...(c?.legacy ? { legacyId: c.id } : {}) };
}

export function setCreatorCookie(response, creator, force = false) {
  if (!creator?.isNew && !force) return;
  response.cookies.set(UID_COOKIE, `${creator.id}.${sign(creator.id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

// Short non-reversible tag for binding temp paths / idempotency keys to a creator.
export function creatorTag(id, salt = '') {
  return crypto.createHmac('sha256', SECRET).update(`tag.${salt}.${id}`).digest('hex').slice(0, 24);
}

export function randomName() {
  return crypto.randomBytes(16).toString('hex');
}

export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
