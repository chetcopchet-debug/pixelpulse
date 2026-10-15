// Run: node --test test/  (uses node:test, no deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
process.env.CREDITS_SECRET = 'test-secret';
process.env.LEMONSQUEEZY_VARIANT_PACK = '111';
process.env.LEMONSQUEEZY_VARIANT_PRO = '222';
const { verifySignature, planEvent } = await import('../lib/lsWebhook.js');
const { signUidFor } = await import('../lib/paid.js');
const uid = '11111111-2222-4333-8444-555555555555';
const WH = 'whsec-test';
const sig = (b) => crypto.createHmac('sha256', WH).update(b).digest('hex');
const evt = (name, attrs, custom = { uid, sig: signUidFor('pay', uid) }) => ({ meta: { event_name: name, custom_data: custom }, data: { id: '9001', attributes: attrs } });

test('signature: valid passes, tampered/missing fail', () => {
  const body = JSON.stringify(evt('order_created', {}));
  assert.equal(verifySignature(body, sig(body), WH), true);
  assert.equal(verifySignature(body + ' ', sig(body), WH), false);
  assert.equal(verifySignature(body, 'nothex', WH), false);
  assert.equal(verifySignature(body, null, WH), false);
  assert.equal(verifySignature(body, sig(body), ''), false);
});
test('paid pack order grants 500, idempotency key per order', () => {
  const p = planEvent(evt('order_created', { status: 'paid', user_email: 'A@b.com', first_order_item: { variant_id: 111 } }));
  assert.equal(p.action, 'grant'); assert.equal(p.credits, 500); assert.equal(p.event, 'order:9001'); assert.equal(p.uid, uid); assert.ok(p.emailHash);
});
test('pending order / pro order_created ignored', () => {
  assert.equal(planEvent(evt('order_created', { status: 'pending', first_order_item: { variant_id: 111 } })).action, 'ignore');
  assert.equal(planEvent(evt('order_created', { status: 'paid', first_order_item: { variant_id: 222 } })).action, 'ignore');
});
test('subscription payment grants monthly credits; refunds deduct', () => {
  assert.equal(planEvent(evt('subscription_payment_success', { status: 'paid', subscription_id: 5 })).credits, 1200);
  assert.equal(planEvent(evt('subscription_payment_refunded', { subscription_id: 5 })).credits, -1200);
  assert.equal(planEvent(evt('order_refunded', { first_order_item: { variant_id: 111 } })).credits, -500);
});
test('forged / missing uid signature is ignored', () => {
  assert.equal(planEvent(evt('order_created', { status: 'paid', first_order_item: { variant_id: 111 } }, { uid, sig: 'forged' })).action, 'ignore');
  assert.equal(planEvent(evt('order_created', { status: 'paid', first_order_item: { variant_id: 111 } }, {})).action, 'ignore');
});
