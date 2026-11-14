// The site's payments, whichever company handles them.
//
// The rest of the site talks to the four operations here and never to a payment company directly:
//   paymentsEnabled() / planEnabled(id)   is buying open, and is this plan on sale
//   startCheckout({ plan, uid })          -> { url }: the page where the person pays
//   handleWebhook(provider, raw, header)  -> the company tells us about a payment or a refund; credits are added or taken back
//   subscriptionUrl({ subscription })     -> { url }: the company's page where a subscription is cancelled
//
// A payment company is one file in this folder (an "adapter") that exports:
//   id, name, needs (the environment variables it requires), ready(), planRef(planId),
//   checkout({ plan, custom, returnUrl }), readWebhook(rawBody, getHeader), manageUrl({ subscription })
// To add a company: write its file, add it to ADAPTERS, and point its webhook at /api/webhooks/pay/<id>.
// To switch to it: set PAYMENT_PROVIDER to its id. Nothing else on the site changes.
//
// readWebhook returns the same thing for every company: { ok: false, status, error } for a call that must not be
// trusted, or { ok: true, action: 'grant' | 'ignore', uid, credits, event, kind, order, emailHash, reason }.
// `event` is unique per payment, so a webhook that arrives twice adds credits once.
import { PLANS, PAYMENTS_OPEN, signUidFor, grantPaid } from '../paid.js';
import { SITE_URL } from '../site.js';
import * as lemonsqueezy from './lemonsqueezy.js';

const ADAPTERS = { lemonsqueezy };
export const DEFAULT_PROVIDER = 'lemonsqueezy';
export const providerId = () => (Object.prototype.hasOwnProperty.call(ADAPTERS, process.env.PAYMENT_PROVIDER || '') ? process.env.PAYMENT_PROVIDER : DEFAULT_PROVIDER);
export const provider = (id) => (Object.prototype.hasOwnProperty.call(ADAPTERS, id || providerId()) ? ADAPTERS[id || providerId()] : null);

// Buying is open only when the switch in lib/paid.js is on and the company's keys are set.
export const paymentsEnabled = () => PAYMENTS_OPEN && Boolean(provider()?.ready());
export const planEnabled = (id) => paymentsEnabled() && Boolean(PLANS[id]) && Boolean(provider().planRef(id));

// The page where the person pays for `plan`. The payment carries the buyer's id, signed, so the webhook knows
// whose credits these are. Returns { url } or { error }.
export async function startCheckout({ plan, uid }) {
  const p = provider();
  try {
    const out = await p.checkout({ plan, custom: { uid, sig: signUidFor('pay', uid), plan: plan.id }, returnUrl: `${SITE_URL}/?paid=1` });
    if (!out.url) console.error('checkout failed', p.id, out.error || '');
    return out.url ? { url: out.url } : { error: 'failed' };
  } catch (e) { console.error('checkout error', p.id, e?.message || e); return { error: 'failed' }; }
}

// A webhook from the company `id`. Returns { status, body } to answer with. `grant` is the function that changes
// the balance (lib/paid.js); it is a parameter so this can be tested without a database.
export async function handleWebhook(id, rawBody, getHeader, grant = grantPaid) {
  const p = provider(id);
  if (!p) return { status: 404, body: { error: 'unknown provider' } };
  const evt = p.readWebhook(rawBody, getHeader);
  if (!evt.ok) return { status: evt.status, body: { error: evt.error } };
  if (evt.action !== 'grant') return { status: 200, body: { ok: true, ignored: evt.reason } };
  try {
    const bal = await grant(evt.uid, evt.credits, { event: evt.event, kind: evt.kind, order: evt.order, emailHash: evt.emailHash });
    return { status: 200, body: { ok: true, duplicate: bal === null } };
  } catch (e) {
    console.error('payment webhook: grant failed', p.id, e?.message || e);
    return { status: 500, body: { error: 'retry' } }; // the company sends it again after an answer that is not 2xx
  }
}

// The company's page for one subscription (cancel, change the card). Returns { url } or { error }.
export async function subscriptionUrl({ subscription }) {
  const p = provider();
  try {
    const out = await p.manageUrl({ subscription });
    if (!out.url) console.error('subscription page failed', p.id, out.error || '');
    return out.url ? { url: out.url } : { error: 'failed' };
  } catch (e) { console.error('subscription page error', p.id, e?.message || e); return { error: 'failed' }; }
}
