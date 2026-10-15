import crypto from 'crypto';

export const DAILY_CREDITS = 5;
export const PER_MINUTE_LIMIT = 3;
export const COOKIE_NAME = 'pp_credits';

const SECRET = process.env.CREDITS_SECRET || '';

function today() {
  return new Date().toISOString().slice(0, 10); // UTC date
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

// Cookie value: "<remaining>.<YYYY-MM-DD>.<hmac>"
export function readCreditsCookie(value) {
  const fresh = { remaining: DAILY_CREDITS, date: today() };
  if (!SECRET || !value) return fresh;
  const parts = value.split('.');
  if (parts.length !== 3) return fresh;
  const [rem, date, sig] = parts;
  const expected = sign(`${rem}.${date}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fresh;
  if (date !== today()) return fresh; // daily reset
  const n = parseInt(rem, 10);
  if (!Number.isInteger(n) || n < 0 || n > DAILY_CREDITS) return fresh;
  return { remaining: n, date };
}

export function setCreditsCookie(response, state) {
  if (!SECRET) return;
  const payload = `${state.remaining}.${state.date}`;
  response.cookies.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 48,
  });
}

// In-memory per-IP limits (defense in depth). NOTE: resets on serverless cold starts.
const ipStore = new Map(); // ip -> { date, used, minute: [timestamps] }

export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function ipEntry(ip) {
  let e = ipStore.get(ip);
  if (!e || e.date !== today()) {
    e = { date: today(), used: 0, minute: [] };
    ipStore.set(ip, e);
  }
  if (ipStore.size > 10000) {
    for (const [k, v] of ipStore) if (v.date !== today()) ipStore.delete(k);
  }
  return e;
}

export function ipRemaining(ip) {
  return Math.max(0, DAILY_CREDITS - ipEntry(ip).used);
}

// Returns null if allowed (and charges), or 'daily' / 'minute'
export function chargeIp(ip, amount = 1) {
  const e = ipEntry(ip);
  const now = Date.now();
  e.minute = e.minute.filter((t) => now - t < 60_000);
  if (e.used + amount > DAILY_CREDITS) return 'daily';
  if (e.minute.length >= PER_MINUTE_LIMIT) return 'minute';
  e.used += amount;
  e.minute.push(now);
  return null;
}

export function refundIp(ip, amount = 1) {
  const e = ipEntry(ip);
  e.used = Math.max(0, e.used - amount);
  e.minute.pop();
}
