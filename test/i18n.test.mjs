import test from 'node:test';
import assert from 'node:assert/strict';
import { problems } from '../scripts/i18n.mjs';
import { pickLang, makeT } from '../app/i18n/core.js';

test('every language has every text, with the same {values} and <marks> as the English', async () => {
  const { keys, out } = await problems();
  assert.ok(keys.length > 300, 'the texts were found');
  for (const [id, p] of Object.entries(out)) {
    assert.deepEqual(p.missing, [], `${id} is missing texts (run: node scripts/i18n.mjs)`);
    assert.deepEqual(p.broken, [], `${id} has texts whose values differ from the English`);
  }
});

test("the browser's language picks ours, and anything else gets English", () => {
  assert.equal(pickLang(['pt-BR', 'en']), 'pt');
  assert.equal(pickLang(['zh-Hans-CN']), 'zh');
  assert.equal(pickLang(['de-AT']), 'de');
  assert.equal(pickLang(['in-ID']), 'id');
  assert.equal(pickLang(['he-IL', 'ja']), 'ja'); // the first one we have
  assert.equal(pickLang(['he-IL', 'ar']), 'en');
  assert.equal(pickLang([]), 'en');
});

test('values are filled in, and server messages are found by their words or their shape', () => {
  const { t, tm, sm } = makeT({ '{n} credits': '{n} Credits', 'Prompt is too long (max {n}).': 'Der Prompt ist zu lang (max. {n}).', 'Your credits were refunded.': 'Deine Credits wurden erstattet.', 'Image not found.': 'Bild nicht gefunden.', 'Something went wrong. Try again.': 'Etwas ist schiefgelaufen.' });
  assert.equal(t('{n} credits', { n: 5 }), '5 Credits');
  assert.equal(t('Not translated yet'), 'Not translated yet');
  assert.equal(tm('Prompt is too long (max 1500).'), 'Der Prompt ist zu lang (max. 1500).');
  assert.equal(tm('Image not found. Your credits were refunded.'), 'Bild nicht gefunden. Deine Credits wurden erstattet.');
  assert.equal(sm('Some technical message nobody wrote words for'), 'Etwas ist schiefgelaufen.');
  assert.equal(makeT(null).sm('Anything'), 'Anything'); // English: shown as it is
});

test('the sign-in email has every language, and the file to paste into the email service is up to date', async () => {
  const { emailTexts, build } = await import('../scripts/email.mjs');
  const { readFileSync } = await import('node:fs');
  const texts = await emailTexts();
  assert.deepEqual(Object.keys(texts).sort(), ['de', 'en', 'es', 'fr', 'id', 'it', 'ja', 'ko', 'pt', 'zh']);
  const { html, subject } = await build();
  assert.equal(readFileSync(new URL('../supabase/email/sign-in.html', import.meta.url), 'utf8'), html, 'run: node scripts/email.mjs');
  assert.equal(readFileSync(new URL('../supabase/email/sign-in.subject.txt', import.meta.url), 'utf8'), subject, 'run: node scripts/email.mjs');
  assert.ok(html.includes('{{ .ConfirmationURL }}') && html.includes('{{ .Token }}'));
});
