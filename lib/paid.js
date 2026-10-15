// Paid credit balance (persistent, Supabase migration 005). Free daily credits are always used first.
import crypto from 'crypto';
import { getSupabase } from './supabase.js';

export const PLANS = {
  pack: { id: 'pack', name: 'Creator Pack', credits: 500, price: '$9.90', period: 'one-time', env: 'LEMONSQUEEZY_VARIANT_PACK' },
  pro: { id: 'pro', name: 'Pulse Pro', credits: 1200, price: '$14.90', period: 'month', env: 'LEMONSQUEEZY_VARIANT_PRO' },
};
export const paymentsEnabled = () => Boolean(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID && process.env.LEMONSQUEEZY_WEBHOOK_SECRET && process.env.LEMONSQUEEZY_VARIANT_PACK);
export const planEnabled = (id) => paymentsEnabled() && Boolean(process.env[PLANS[id]?.env]);
export const planByVariant = (variantId) => Object.values(PLANS).find((p) => process.env[p.env] && String(process.env[p.env]) === String(variantId)) || null;

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
