// Paid credit balance (persistent, Supabase migration 005). Free daily credits are always used first.
// What is sold (PLANS) and the balance are here. The payment company itself is behind lib/pay/index.js.
import crypto from 'crypto';
import { getSupabase } from './supabase.js';

export const PLANS = {
  pack: { id: 'pack', name: 'Yelvo Pack', credits: 500, price: '$9.90', period: 'one-time' },
  pro: { id: 'pro', name: 'Yelvo Pro', credits: 1200, price: '$14.90', period: 'month' },
};
// Buying is closed until the new payment company is connected (launch checklist, row 18). While this is false no
// checkout can be opened from anywhere: the buttons say "Coming soon" and /api/checkout refuses.
// Whether a plan can be bought right now is asked of lib/pay/index.js (paymentsEnabled, planEnabled): it also needs
// the payment company's keys.
export const PAYMENTS_OPEN = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
export function signUidFor(purpose, uid) { return crypto.createHmac('sha256', SECRET()).update(`${purpose}.${uid}`).digest('base64url'); }
export function verifyUidFor(purpose, uid, sig) {
  if (!SECRET() || !UUID_RE.test(String(uid || '')) || typeof sig !== 'string') return false;
  const a = Buffer.from(sig), b = Buffer.from(signUidFor(purpose, uid));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// True if this uid ever bought credits (pack or Pro). Referral bonuses don't count.
export async function hasPurchased(uid) {
  const sb = getSupabase(); if (!sb || !UUID_RE.test(String(uid || ''))) return false;
  const { data, error } = await sb.from('payment_events').select('event_id').eq('uid', uid).in('kind', ['pack', 'pro']).limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

// True while this uid's Yelvo Pro subscription is running: a Pro payment in the last 35 days (it renews monthly).
export async function hasPro(uid) {
  const sb = getSupabase(); if (!sb || !UUID_RE.test(String(uid || ''))) return false;
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const { data, error } = await sb.from('payment_events').select('event_id').eq('uid', uid).eq('kind', 'pro').gte('created_at', since).limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

export async function paidBalance(uid) {
  const sb = getSupabase(); if (!sb || !UUID_RE.test(String(uid || ''))) return 0;
  const { data, error } = await sb.rpc('paid_balance', { p_uid: uid });
  return error ? 0 : Number(data) || 0;
}
// Returns true if charged.
export async function spendPaid(uid, amount) {
  const sb = getSupabase(); if (!sb || !UUID_RE.test(String(uid || ''))) return false;
  const { data, error } = await sb.rpc('paid_spend', { p_uid: uid, p_amount: amount });
  return !error && data !== null && data !== undefined;
}
// Returns new balance, null if the event was already processed, or throws on DB error.
export async function grantPaid(uid, amount, { event = null, kind = 'refund_internal', order = null, emailHash = null } = {}) {
  const sb = getSupabase(); if (!sb) throw new Error('no db');
  const { data, error } = await sb.rpc('paid_grant', { p_uid: uid, p_amount: amount, p_event: event, p_kind: kind, p_order: order, p_email_hash: emailHash });
  if (error) throw new Error(error.message);
  return data;
}
