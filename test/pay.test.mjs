// The payment layer (lib/pay): the same four operations whichever company is behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { readFileSync, readdirSync } from 'node:fs';
process.env.CREDITS_SECRET = 'test-secret';
const LS = { LEMONSQUEEZY_API_KEY: 'k', LEMONSQUEEZY_STORE_ID: '77', LEMONSQUEEZY_WEBHOOK_SECRET: 'whsec-test', LEMONSQUEEZY_VARIANT_PACK: '111', LEMONSQUEEZY_VARIANT_PRO: '222' };
Object.assign(process.env, LS);
const pay = await import('../lib/pay/index.js');
const { PLANS, signUidFor, PAYMENTS_OPEN } = await import('../lib/paid.js');
const uid = '11111111-2222-4333-8444-555555555555';
const sign = (b) => crypto.createHmac('sha256', LS.LEMONSQUEEZY_WEBHOOK_SECRET).update(b).digest('hex');
const hook = (name, attrs) => JSON.stringify({ meta: { event_name: name, custom_data: { uid, sig: signUidFor('pay', uid) } }, data: { id: '9001', attributes: attrs } });
const withFetch = async (answer, run) => { const real = globalThis.fetch, calls = []; globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return answer(String(url), init); }; try { return { out: await run(), calls }; } finally { globalThis.fetch = real; } };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('which company: Lemon Squeezy unless PAYMENT_PROVIDER names another one that exists', () => {
  assert.equal(pay.providerId(), 'lemonsqueezy');
  process.env.PAYMENT_PROVIDER = 'no-such-company'; assert.equal(pay.providerId(), 'lemonsqueezy'); delete process.env.PAYMENT_PROVIDER;
  assert.equal(pay.provider('constructor'), null); assert.equal(pay.provider('no-such-company'), null);
  for (const fn of ['ready', 'planRef', 'checkout', 'readWebhook', 'manageUrl']) assert.equal(typeof pay.provider()[fn], 'function', fn);
  assert.ok(Array.isArray(pay.provider().needs) && pay.provider().needs.length);
});

test('buying stays closed while the switch is off, whatever keys are set', () => {
  assert.equal(pay.provider().ready(), true);
  assert.equal(pay.paymentsEnabled(), PAYMENTS_OPEN);
  assert.equal(pay.planEnabled('pack'), PAYMENTS_OPEN); assert.equal(pay.planEnabled('nothing'), false);
});

test('checkout: asks the company for a page, with the signed buyer id and the plan', async () => {
  const { out, calls } = await withFetch(() => json(201, { data: { attributes: { url: 'https://pay.example/c/1' } } }), () => pay.startCheckout({ plan: PLANS.pro, uid }));
  assert.deepEqual(out, { url: 'https://pay.example/c/1' });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.lemonsqueezy.com/v1/checkouts');
  const sent = JSON.parse(calls[0].init.body).data;
  assert.deepEqual(sent.attributes.checkout_data.custom, { uid, sig: signUidFor('pay', uid), plan: 'pro' });
  assert.equal(sent.relationships.variant.data.id, '222'); assert.equal(sent.relationships.store.data.id, '77');
  assert.match(sent.attributes.product_options.redirect_url, /\/\?paid=1$/);
});
test('checkout: a refusal or a broken connection is an error, never a thrown one', async () => {
  assert.deepEqual((await withFetch(() => json(422, { errors: [{ detail: 'no' }] }), () => pay.startCheckout({ plan: PLANS.pack, uid }))).out, { error: 'failed' });
  assert.deepEqual((await withFetch(() => { throw new Error('network'); }, () => pay.startCheckout({ plan: PLANS.pack, uid }))).out, { error: 'failed' });
});

test('webhook: a paid pack adds its credits once, under the payment\'s own key', async () => {
  const body = hook('order_created', { status: 'paid', user_email: 'A@b.com', first_order_item: { variant_id: 111 } });
  const grants = [];
  const grant = async (...a) => { grants.push(a); return 500; };
  const out = await pay.handleWebhook('lemonsqueezy', body, (h) => (h === 'x-signature' ? sign(body) : null), grant);
  assert.deepEqual(out, { status: 200, body: { ok: true, duplicate: false } });
  assert.equal(grants.length, 1); assert.equal(grants[0][0], uid); assert.equal(grants[0][1], 500);
  assert.equal(grants[0][2].event, 'order:9001'); assert.equal(grants[0][2].kind, 'pack'); assert.ok(grants[0][2].emailHash);
  // The same webhook again: the balance function says "already done" (null), and the answer says so.
  assert.deepEqual((await pay.handleWebhook('lemonsqueezy', body, () => sign(body), async () => null)).body, { ok: true, duplicate: true });
});
test('webhook: a Pro payment keeps the subscription id, which "Manage subscription" needs later', async () => {
  const body = hook('subscription_payment_success', { status: 'paid', subscription_id: 4242 });
  const grants = [];
  await pay.handleWebhook('lemonsqueezy', body, () => sign(body), async (...a) => { grants.push(a); return 1200; });
  assert.equal(grants[0][1], 1200); assert.equal(grants[0][2].kind, 'pro'); assert.equal(grants[0][2].order, '4242');
});
test('webhook: a wrong signature, an unknown company and an event that changes nothing', async () => {
  const body = hook('order_created', { status: 'paid', first_order_item: { variant_id: 111 } });
  const never = async () => { throw new Error('must not be called'); };
  assert.equal((await pay.handleWebhook('lemonsqueezy', body, () => sign(body + ' '), never)).status, 401);
  assert.equal((await pay.handleWebhook('lemonsqueezy', body, () => null, never)).status, 401);
  assert.equal((await pay.handleWebhook('no-such-company', body, () => sign(body), never)).status, 404);
  const quiet = hook('subscription_updated', {});
  const out = await pay.handleWebhook('lemonsqueezy', quiet, () => sign(quiet), never);
  assert.equal(out.status, 200); assert.match(out.body.ignored, /subscription_updated/);
});
test('webhook: when the balance cannot be changed the company is asked to send it again', async () => {
  const body = hook('order_created', { status: 'paid', first_order_item: { variant_id: 111 } });
  assert.equal((await pay.handleWebhook('lemonsqueezy', body, () => sign(body), async () => { throw new Error('db down'); })).status, 500);
});

test('manage subscription: the company\'s own page for that subscription', async () => {
  const { out, calls } = await withFetch(() => json(200, { data: { attributes: { urls: { customer_portal: 'https://store.example/billing?x=1' } } } }), () => pay.subscriptionUrl({ subscription: '4242' }));
  assert.deepEqual(out, { url: 'https://store.example/billing?x=1' });
  assert.equal(calls[0].url, 'https://api.lemonsqueezy.com/v1/subscriptions/4242');
  // No page, an id that is not one, an address that is not https: an error, and nothing is opened.
  assert.deepEqual((await withFetch(() => json(404, {}), () => pay.subscriptionUrl({ subscription: '4242' }))).out, { error: 'failed' });
  const bad = await withFetch(() => json(200, {}), () => pay.subscriptionUrl({ subscription: '../users/me' }));
  assert.deepEqual(bad.out, { error: 'failed' }); assert.equal(bad.calls.length, 0);
  assert.deepEqual((await withFetch(() => json(200, { data: { attributes: { urls: { customer_portal: 'javascript:alert(1)' } } } }), () => pay.subscriptionUrl({ subscription: '1' }))).out, { error: 'failed' });
});

test('only lib/pay (and the admin reader) knows the payment company', () => {
  const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.js$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const allowed = (f) => f.startsWith('lib/pay/') || f === 'lib/payInfo.js' || f.startsWith('app/admin/') || f.startsWith('app/api/webhooks/lemonsqueezy/') || /^app\/i18n\/[a-z]{2}\.js$/.test(f) || f === 'lib/galleryPrompts.js';
  const leaks = [...walk('app'), ...walk('lib')].filter((f) => !allowed(f) && /lemon ?squeezy|LEMONSQUEEZY/i.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')));
  assert.deepEqual(leaks, []);
});
