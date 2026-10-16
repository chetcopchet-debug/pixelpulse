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
test('defaults keep the #54 prices', () => {
  for (const [m, t] of Object.entries(VIDEO_TIERS)) { const d = VIDEO_PRICING[m].def; assert.equal(videoQuote(m, d.d, d.r).cost, t.cost, m); }
});
test('server rejects combos the model does not support', () => {
  assert.equal(videoQuote('hailuo', 10, '1080p'), null);
  assert.equal(videoQuote('veo', 5, '720p'), null);
  assert.equal(videoQuote('wan', 5, '1080p'), null);
  assert.equal(videoQuote('nope', 5, '720p'), null);
});
