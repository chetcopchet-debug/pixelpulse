import crypto from 'crypto';

export const UID_COOKIE = 'pp_uid';
const UID_RE = /^[0-9a-f-]{36}$/;

// Anonymous creator id from cookie. Returns { id, isNew }.
export function getCreatorId(request) {
  const v = request.cookies.get(UID_COOKIE)?.value;
  if (v && UID_RE.test(v)) return { id: v, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}

export function setCreatorCookie(response, creator) {
  if (!creator?.isNew) return;
  response.cookies.set(UID_COOKIE, creator.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
