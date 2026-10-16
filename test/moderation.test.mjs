// Run: node --test test/  (uses node:test, no deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { register } from 'node:module';
// lib/ uses extensionless imports (bundler style); add '.js' when Node can't resolve them.
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.m?js$/.test(s)) return next(s + '.js', c); throw e; } }`));
const { checkPromptText } = await import('../lib/moderation.js');

test('blocks a regular sexual prompt', () => { assert.ok(checkPromptText('a naked woman on a beach')); });
test('blocks a violent prompt', () => { assert.ok(checkPromptText('gore and beheading in a battlefield')); });
test('blocks minor + sexual prompt', () => { assert.match(checkPromptText('sexy teen girl'), /minors/); });
test('blocks a Hebrew prompt with a sexual word', () => { assert.ok(checkPromptText('אישה עירומה על החוף')); });
test('allows a safe prompt', () => { assert.equal(checkPromptText('a cyberpunk samurai in neon Tokyo rain'), null); });

// Static guard: importing the route needs Next.js/Supabase runtime, so verify the order in source instead:
// the original-prompt check returns before chargeCredits/reserveSpend, and the translated check refunds.
test('generate checks the prompt before any charge or spend', () => {
  const src = readFileSync(new URL('../app/api/generate/route.js', import.meta.url), 'utf8');
  const check = src.indexOf('checkPromptText(prompt)');
  assert.ok(check > 0, 'original prompt check missing');
  assert.ok(check < src.indexOf('chargeCredits({'), 'check must run before chargeCredits');
  assert.ok(check < src.indexOf('reserveSpend('), 'check must run before reserveSpend');
  const en = src.indexOf('checkPromptText(englishPrompt)');
  assert.ok(en > src.indexOf('toEnglishPrompt('), 'translated prompt check missing');
  assert.match(src.slice(en, en + 200), /await refund\(\)/);
});
test('no route keeps the published-to-feed exception', () => {
  for (const f of ['generate', 'facelock', 'edit', 'animate']) {
    const src = readFileSync(new URL(`../app/api/${f}/route.js`, import.meta.url), 'utf8');
    assert.ok(!/published to the feed\/\.test/.test(src), f);
  }
});

test('blocks a Hebrew sexual prompt (porn word)', () => { assert.ok(checkPromptText('תמונת פורנו של זוג')); });
test('blocks a mixed English + Hebrew sexual prompt', () => {
  assert.ok(checkPromptText('a beautiful woman עירומה on the beach'));
  assert.ok(checkPromptText('naked אישה בחוף'));
});
test('mixed Hebrew minor + English sexual is treated as minors', () => { assert.match(checkPromptText('ילדה sexy'), /minors/); });

const src = (f) => readFileSync(new URL(`../app/api/${f}/route.js`, import.meta.url), 'utf8');
test('repaint checks original and English prompt inside prepare (before runImageTool charges)', () => {
  const s = src('repaint');
  const o = s.indexOf('checkPromptText(prompt)'), t = s.indexOf('toEnglishPrompt(prompt)'), e = s.indexOf('checkPromptText(english)');
  assert.ok(o > 0 && o < t && t < e, 'order: check original -> translate -> check English');
  assert.ok(e < s.indexOf('return { args }'), 'English check must run before args are returned to the charging tool');
  const tool = readFileSync(new URL('../lib/imagetool.js', import.meta.url), 'utf8');
  assert.ok(tool.indexOf('prepare(body)') < tool.indexOf('chargeCredits({') && tool.indexOf('prepare(body)') < tool.indexOf('reserveSpend('), 'prepare runs before charge/spend');
});
test('amplify checks input before spend, English after translation, and model output', () => {
  const s = src('amplify');
  const i = s.indexOf('checkPromptText(prompt)');
  assert.ok(i > 0 && i < s.indexOf('reserveSpend('), 'input check before reserveSpend');
  const e = s.indexOf('checkPromptText(english)');
  assert.ok(e > s.indexOf('translateIfHebrew(seed)') && e < s.indexOf('runReplicate('), 'English check before the model call');
  assert.match(s.slice(e, e + 120), /spend\.release\(\)/);
  assert.ok(s.indexOf('suggestions.map(checkPromptText)') > s.indexOf('parseSuggestions(text)'), 'output check missing');
});
