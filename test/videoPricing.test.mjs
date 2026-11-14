import test from 'node:test';
import assert from 'node:assert/strict';
const { VIDEO_PRICING, videoQuote, CREDIT_USD } = await import('../lib/videoPricing.js');
const { VIDEO_TIERS } = await import('../lib/models.js');
test('every allowed combo has >=50% margin basis (credits >= usd/0.0057)', () => {
  for (const [m, p] of Object.entries(VIDEO_PRICING)) for (const d of p.durations) for (const r of p.resolutions) {
    const q = videoQuote(m, d, r); if (!q) continue;
    assert.ok(q.cost * CREDIT_USD >= q.usd - 1e-9, `${m} ${d} ${r}`);
  }
});
test('the default option of each model is the price the server holds for it', () => {
  for (const [m, t] of Object.entries(VIDEO_TIERS)) { const d = VIDEO_PRICING[m].def; assert.equal(videoQuote(m, d.d, d.r).cost, t.cost, m); }
});
test('prices agreed with the owner (5 s unless noted)', () => {
  const c = (m, d, r) => videoQuote(m, d, r).cost;
  assert.equal(c('seedance-25', 5, '720p'), 205);
  assert.equal(c('seedance-25', 5, '480p'), 95);
  assert.equal(c('kling-4', 5, '720p'), 140);
  assert.equal(c('veo', 4, '720p'), 110);
  assert.equal(c('kling-4-flash', 5, '720p'), 85);
  assert.equal(c('grok-video', 5, '720p'), 65); // $0.07 a second at 720p
  assert.equal(c('grok-video', 5, '480p'), 45); // $0.05 a second at 480p, as before
  assert.equal(videoQuote('h3-lite', 5, '768p', '16:9', false, Date.UTC(2027, 0, 1)).cost, 36); // the list price
  assert.equal(c('wan', 5, '480p'), 10);
});
test('Omni is charged at the prices on its Replicate page, with a 360p draft', () => {
  const q = videoQuote('omni', 5, '720p');
  assert.equal(q.usd, 0.525); // $0.105 a second
  assert.equal(q.cost, 95);
  assert.equal(videoQuote('omni', 10, '720p').cost, 185);
  assert.equal(videoQuote('omni', 15, '720p').cost, 280);
  assert.equal(videoQuote('omni', 5, '1080p').cost, 140); // $0.155 a second
  assert.equal(videoQuote('omni', 5, '360p').cost, 31); // the draft: $0.035 a second
  assert.equal(videoQuote('omni', 10, '360p').cost, 65);
  assert.equal(Object.values(VIDEO_PRICING).filter((p) => p.approx).length, 0);
  // A video that starts from a picture costs what a text one does (no separate price on the model pages).
  assert.equal(videoQuote('omni', 5, '720p', '16:9', true).usd, 0.525);
});
test('every price keeps at least half of what the cheapest credit is sold for', () => {
  const SOLD = 14.9 / 1200; // the lowest price a credit is sold at (Yelvo Pro)
  for (const [id, p] of Object.entries(VIDEO_PRICING)) for (const d of p.durations) for (const r of p.resolutions) {
    const q = videoQuote(id, d, r); if (!q) continue;
    assert.ok(q.usd <= q.cost * SOLD * 0.5 + 1e-9, `${id} ${d}s ${r}: costs $${q.usd}, sold for ${q.cost} credits`);
  }
});
test('server rejects combos the model does not support', () => {
  assert.equal(videoQuote('veo-lite', 4, '720p'), null); // switched off by Google, no longer offered
  assert.equal(videoQuote('h3-lite', 5, '1080p'), null);
  assert.equal(videoQuote('veo', 5, '720p'), null);
  assert.equal(videoQuote('wan', 5, '1080p'), null);
  assert.equal(videoQuote('nope', 5, '720p'), null);
  assert.equal(videoQuote('constructor', 5, '720p'), null);
});

test('a video that starts from an image: only on models that can, at the text-to-video price', async () => {
  const { videoQuote, videoTakesImage, VIDEO_PRICING } = await import('../lib/videoPricing.js');
  assert.equal(videoTakesImage('wan'), false);
  assert.equal(videoQuote('wan', 5, '480p', '16:9', true), null); // Wan's picker model is text only
  for (const id of ['seedance-25', 'kling-4', 'veo', 'kling-4-flash', 'omni', 'grok-video', 'h3-lite']) {
    const p = VIDEO_PRICING[id], text = videoQuote(id, p.def.d, p.def.r, '16:9'), img = videoQuote(id, p.def.d, p.def.r, '16:9', true);
    assert.ok(img && img.cost === text.cost && img.usd === text.usd, `${id}: the same price as text-to-video`);
  }
});

test('MiniMax H3 Lite: half price through 31 Dec 2026, the list price again from 1 Jan 2027, by the date alone', async () => {
  const { videoQuote, h3Promo, H3_PROMO_END, setServerNow } = await import('../lib/videoPricing.js');
  const during = Date.UTC(2026, 11, 31, 23, 59, 59), after = Date.UTC(2027, 0, 1, 0, 0, 0);
  assert.equal(H3_PROMO_END, after);
  assert.equal(h3Promo(during), true); assert.equal(h3Promo(after), false);
  const q = (d, r, at) => videoQuote('h3-lite', d, r, '16:9', false, at);
  assert.deepEqual([q(5, '768p', during).usd, q(5, '768p', during).cost], [0.1, 20]);
  assert.deepEqual([q(10, '768p', during).cost, q(5, '480p', during).cost, q(10, '480p', during).cost], [36, 15, 22]);
  assert.deepEqual([q(5, '768p', after).usd, q(5, '768p', after).cost], [0.2, 36]);
  assert.deepEqual([q(10, '768p', after).cost, q(5, '480p', after).cost, q(10, '480p', after).cost], [75, 22, 45]);
  // The page follows the server's clock: a server already in 2027 shows the list price whatever the phone says.
  setServerNow(after + 1000); assert.equal(videoQuote('h3-lite', 5, '768p').cost, 36);
  setServerNow(during); assert.equal(videoQuote('h3-lite', 5, '768p').cost, 20);
  setServerNow(Date.now());
  // Half price still keeps half of what a credit is sold for.
  for (const [d, r] of [[5, '480p'], [10, '480p'], [5, '768p'], [10, '768p']]) { const x = q(d, r, during); assert.ok(x.usd <= x.cost * (14.9 / 1200) * 0.5 + 1e-9, `${d}s ${r}`); }
});

