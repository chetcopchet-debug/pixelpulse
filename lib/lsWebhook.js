// Lemon Squeezy webhook core (pure, testable): signature check + event -> credit action.
import crypto from 'crypto';
import { PLANS, planByVariant, verifyUidFor } from './paid.js';

export function verifySignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex'), b = Buffer.from(signature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Returns { action: 'grant'|'ignore', uid, credits, event, kind, order, emailHash, reason }
export function planEvent(evt) {
  const name = evt?.meta?.event_name;
  const custom = evt?.meta?.custom_data || {};
  const a = evt?.data?.attributes || {};
  const id = String(evt?.data?.id || '');
  if (!id) return { action: 'ignore', reason: 'no id' };
  if (!verifyUidFor('pay', custom.uid, custom.sig)) return { action: 'ignore', reason: 'bad or missing custom uid' };
  const emailHash = a.user_email ? crypto.createHash('sha256').update(String(a.user_email).trim().toLowerCase()).digest('hex') : null;
  const base = { uid: custom.uid, emailHash };
  switch (name) {
    case 'order_created': {
      const plan = planByVariant(a.first_order_item?.variant_id);
      if (a.status !== 'paid') return { action: 'ignore', reason: `order status ${a.status}` };
      if (!plan || plan.id !== 'pack') return { action: 'ignore', reason: 'not a pack (subscriptions credit on payment_success)' };
      return { ...base, action: 'grant', credits: plan.credits, event: `order:${id}`, kind: 'pack', order: id };
    }
    case 'order_refunded': {
      const plan = planByVariant(a.first_order_item?.variant_id);
      if (!plan || plan.id !== 'pack') return { action: 'ignore', reason: 'not a pack' };
      return { ...base, action: 'grant', credits: -plan.credits, event: `refund:${id}`, kind: 'pack_refund', order: id };
    }
    case 'subscription_payment_success':
      if (a.status && a.status !== 'paid') return { action: 'ignore', reason: `invoice status ${a.status}` };
      return { ...base, action: 'grant', credits: PLANS.pro.credits, event: `subinv:${id}`, kind: 'pro', order: String(a.subscription_id || id) };
    case 'subscription_payment_refunded':
      return { ...base, action: 'grant', credits: -PLANS.pro.credits, event: `subref:${id}`, kind: 'pro_refund', order: String(a.subscription_id || id) };
    default:
      // subscription_created / updated / cancelled / expired: no credit change (credits already granted stay until used).
      return { action: 'ignore', reason: `event ${name}` };
  }
}
