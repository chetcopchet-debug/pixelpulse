// The Payments row in /admin: what is read from Lemon Squeezy's answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPayInfo } from '../lib/payInfo.js';

const me = (testMode) => ({ data: { attributes: { name: 'Owner', email: 'owner@example.com' } }, meta: { test_mode: testMode } });
const stores = { data: [{ id: '11', attributes: { name: 'Yelvo', url: 'https://yelvo.lemonsqueezy.com', country: 'IL', currency: 'USD' } }] };
const products = { data: [
  { id: '5', attributes: { name: 'Creator Pack', status: 'published', price: 990, price_formatted: '$9.90', test_mode: false, store_id: 11 } },
  { id: '6', attributes: { name: 'Pulse Pro', status: 'draft', price: 1490, price_formatted: '$14.90/month', test_mode: false, store_id: 11 } },
] };

test('the account, the store and the mode are read; the key decides the mode', () => {
  const live = readPayInfo({ me: me(false), stores, products }, { storeId: '11' });
  assert.equal(live.email, 'owner@example.com');
  assert.equal(live.testMode, false);
  assert.deepEqual(live.stores.map((s) => [s.name, s.ours, s.verified]), [['Yelvo', true, null]]); // no verification field: not guessed
  assert.equal(readPayInfo({ me: me(true), stores, products }).testMode, true);
  assert.equal(readPayInfo({ me: { data: { attributes: {} } }, stores, products }).testMode, null); // not said: unknown
});

test('products keep their names, prices and state', () => {
  const p = readPayInfo({ me: me(false), stores, products }).products;
  assert.deepEqual(p.map((x) => [x.name, x.status, x.price, x.testMode]), [['Creator Pack', 'published', '$9.90', false], ['Pulse Pro', 'draft', '$14.90/month', false]]);
});

test('what the site sells is matched to its product, and a missing variant is said plainly', () => {
  const variants = [
    { plan: 'Yelvo Pack', data: { data: { attributes: { name: 'Default', price: 990, status: 'published', product_id: 5, test_mode: false } } } },
    { plan: 'Yelvo Pro', error: 'Lemon Squeezy answered 404' },
  ];
  const sold = readPayInfo({ me: me(false), stores, products, variants }).sold;
  assert.deepEqual([sold[0].found, sold[0].product, sold[0].price], [true, 'Creator Pack', '9.90 USD']);
  assert.deepEqual([sold[1].found, sold[1].error], [false, 'Lemon Squeezy answered 404']);
});

test('answers that are missing or empty do not break the row', () => {
  const x = readPayInfo({ me: null, stores: null, products: null });
  assert.deepEqual([x.email, x.stores.length, x.products.length, x.sold.length], ['', 0, 0, 0]);
});
