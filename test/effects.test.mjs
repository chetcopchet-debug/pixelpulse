import test from 'node:test';
import assert from 'node:assert/strict';
const { EFFECTS, EFFECT_COST } = await import('../lib/effects.js');
const { EFFECT_PROMPTS } = await import('../lib/effectPrompts.js');
const { PREMIUM } = await import('../lib/models.js');
test('8-12 effects, each with a tuned server prompt', () => {
  assert.ok(EFFECTS.length >= 8 && EFFECTS.length <= 12);
  for (const e of EFFECTS) assert.ok(EFFECT_PROMPTS[e.id]?.length > 40, e.id);
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length);
});
test('effects price and model match Animate (wan-2.2-i2v-fast, paid only)', () => {
  assert.equal(EFFECT_COST, PREMIUM.animate.cost);
  assert.equal(PREMIUM.animate.model, 'wan-video/wan-2.2-i2v-fast');
  assert.ok(PREMIUM.animate.paidOnly);
});
