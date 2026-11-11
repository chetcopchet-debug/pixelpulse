import crypto from 'crypto';
import { bump } from './usage';
import { freePlan, freeLeft } from './freePlan';
export { DAILY_CREDITS, GUEST_TRIAL } from './freePlan';

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

export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Free credits left for this visitor. Guests get a one-time trial; signed-in accounts get a daily allowance.
// Returns the request "state": { remaining, limit, guest, date }.
export async function freeState({ creator, ip, signedIn }) {
  const plan = freePlan(signedIn);
  const used = creator?.isNew ? 0 : await bump(plan.ownKey(creator.id), 0, 1e9, plan.day).catch(() => 0);
  const net = await bump(plan.netKey(ip), 0, 1e9).catch(() => 0);
  return { remaining: freeLeft(plan, used, net), limit: plan.limit, guest: plan.guest, date: today() };
}

// Unified charge: free credits first (trial or daily allowance), then the persistent paid balance.
// Returns { ok, source, refund } or { ok: false, block: 'minute' | 'credits' }.
import { spendPaid, grantPaid, paidBalance } from './paid';
export async function chargeCredits({ admin, state, ip, creator, cost, signedIn = false }) {
  if (admin || cost <= 0) return { ok: true, source: 'none', refund: async () => {} };
  const plan = freePlan(signedIn);
  if (state.remaining >= cost) {
    // Shared per-minute burst limit (all instances)
    const minute = await bump(`rl:gen:${ip}:${Math.floor(Date.now() / 60_000)}`, 1, PER_MINUTE_LIMIT).catch(() => 0);
    if (minute === null) return { ok: false, block: 'minute' };
    const ownKey = plan.ownKey(creator.id), netKey = plan.netKey(ip);
    const own = await bump(ownKey, cost, plan.limit, plan.day).catch(() => null);
    if (own !== null) {
      const net = await bump(netKey, cost, plan.netLimit).catch(() => null);
      if (net !== null) {
        state.remaining = freeLeft(plan, own, net);
        return { ok: true, source: 'free', refund: async () => {
          await bump(ownKey, -cost, 1e9, plan.day).catch(() => {}); await bump(netKey, -cost, 1e9).catch(() => {});
          state.remaining = Math.min(plan.limit, state.remaining + cost);
        } };
      }
      await bump(ownKey, -cost, 1e9, plan.day).catch(() => {}); // the network ceiling was hit: give the own credits back
    }
    state.remaining = 0; // the counters say there is nothing free left (another device or the network used it)
  }
  return chargePaidOnly(creator, cost);
}
async function chargePaidOnly(creator, cost) {
  if (creator && !creator.isNew && await spendPaid(creator.id, cost)) {
    return { ok: true, source: 'paid', refund: async () => { await grantPaid(creator.id, cost).catch((e) => console.error('paid refund', e)); } };
  }
  return { ok: false, block: 'credits' };
}
// Premium tools: paid balance only (never the free daily credits). Admin bypasses.
export async function chargePaidCredits({ admin, creator, cost }) {
  if (admin || cost <= 0) return { ok: true, source: 'none', refund: async () => {} };
  if (!creator || creator.isNew) return { ok: false, block: 'credits' };
  return chargePaidOnly(creator, cost);
}
export async function paidFor(creator) { return creator && !creator.isNew ? paidBalance(creator.id) : 0; }
