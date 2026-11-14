// Lemon Squeezy, as one payment company behind lib/pay/index.js. Everything that knows Lemon Squeezy's API, its
// webhook format or its environment variables is in this file (and in lib/payInfo.js, which only reads the
// account for /admin).
import crypto from 'crypto';
import { PLANS, verifyUidFor } from '../paid.js';

export const id = 'lemonsqueezy';
export const name = 'Lemon Squeezy';
const API = 'https://api.lemonsqueezy.com/v1';
// The product ("variant") behind each plan, by environment variable.
const VARIANT_ENV = { pack: 'LEMONSQUEEZY_VARIANT_PACK', pro: 'LEMONSQUEEZY_VARIANT_PRO' };
// What this deployment must have set before anything can be sold.
export const needs = ['LEMONSQUEEZY_API_KEY', 'LEMONSQUEEZY_STORE_ID', 'LEMONSQUEEZY_WEBHOOK_SECRET', 'LEMONSQUEEZY_VARIANT_PACK'];
export const ready = () => needs.every((k) => Boolean(process.env[k]));
// The company's own id for a plan, or '' when that plan is not set up here.
export const planRef = (planId) => String(process.env[VARIANT_ENV[planId]] || '');
const planByVariant = (variantId) => Object.values(PLANS).find((p) => planRef(p.id) && planRef(p.id) === String(variantId)) || null;
const headers = () => ({ Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` });

// 1. The page where the person pays. `custom` travels with the payment and comes back in the webhook: it says
// whose credits these are ({ uid, sig, plan }). Returns { url } or { error } (for the log).
export async function checkout({ plan, custom, returnUrl }) {
  const payload = {
    data: {
      type: 'checkouts',
      attributes: { checkout_data: { custom }, product_options: { redirect_url: returnUrl } },
      relationships: {
        store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
        variant: { data: { type: 'variants', id: planRef(plan.id) } },
      },
    },
  };
  const r = await fetch(`${API}/checkouts`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  const url = d?.data?.attributes?.url;
  return r.ok && url ? { url } : { error: `${r.status} ${JSON.stringify(d?.errors || '').slice(0, 300)}` };
}

// 2. A webhook. Returns { ok: false, status, error } when it is not to be trusted or read, otherwise
// { ok: true, ...what planEvent says }.
export function readWebhook(rawBody, getHeader) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'not configured' };
  if (!verifySignature(rawBody, getHeader('x-signature'), secret)) return { ok: false, status: 401, error: 'bad signature' };
  let evt; try { evt = JSON.parse(rawBody); } catch { return { ok: false, status: 400, error: 'bad json' }; }
  return { ok: true, ...planEvent(evt) };
}

// 3. The company's page where the customer cancels a subscription or changes the card. `subscription` is the id
// kept with each Pro payment. Returns { url } or { error }.
export async function manageUrl({ subscription }) {
  if (!/^\d+$/.test(String(subscription || ''))) return { error: 'no subscription id' };
  const r = await fetch(`${API}/subscriptions/${subscription}`, { headers: headers(), cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  const urls = d?.data?.attributes?.urls || {};
  const url = urls.customer_portal || urls.update_payment_method;
  return r.ok && typeof url === 'string' && url.startsWith('https://') ? { url } : { error: `${r.status} no portal address` };
}

// ---- the webhook's core (pure, testable): signature check + event -> credit action ----
export function verifySignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex'), b = Buffer.from(signature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Returns { action: 'grant'|'ignore', uid, credits, event, kind, order, emailHash, reason }
export function planEvent(evt) {
  const eventName = evt?.meta?.event_name;
  const custom = evt?.meta?.custom_data || {};
  const a = evt?.data?.attributes || {};
  const eid = String(evt?.data?.id || '');
  if (!eid) return { action: 'ignore', reason: 'no id' };
  if (!verifyUidFor('pay', custom.uid, custom.sig)) return { action: 'ignore', reason: 'bad or missing custom uid' };
  const emailHash = a.user_email ? crypto.createHash('sha256').update(String(a.user_email).trim().toLowerCase()).digest('hex') : null;
  const base = { uid: custom.uid, emailHash };
  switch (eventName) {
    case 'order_created': {
      const plan = planByVariant(a.first_order_item?.variant_id);
      if (a.status !== 'paid') return { action: 'ignore', reason: `order status ${a.status}` };
      if (!plan || plan.id !== 'pack') return { action: 'ignore', reason: 'not a pack (subscriptions credit on payment_success)' };
      return { ...base, action: 'grant', credits: plan.credits, event: `order:${eid}`, kind: 'pack', order: eid };
    }
    case 'order_refunded': {
      const plan = planByVariant(a.first_order_item?.variant_id);
      if (!plan || plan.id !== 'pack') return { action: 'ignore', reason: 'not a pack' };
      return { ...base, action: 'grant', credits: -plan.credits, event: `refund:${eid}`, kind: 'pack_refund', order: eid };
    }
    case 'subscription_payment_success':
      if (a.status && a.status !== 'paid') return { action: 'ignore', reason: `invoice status ${a.status}` };
      return { ...base, action: 'grant', credits: PLANS.pro.credits, event: `subinv:${eid}`, kind: 'pro', order: String(a.subscription_id || eid) };
    case 'subscription_payment_refunded':
      return { ...base, action: 'grant', credits: -PLANS.pro.credits, event: `subref:${eid}`, kind: 'pro_refund', order: String(a.subscription_id || eid) };
    default:
      // subscription_created / updated / cancelled / expired: no credit change (credits already granted stay until used).
      return { action: 'ignore', reason: `event ${eventName}` };
  }
}
