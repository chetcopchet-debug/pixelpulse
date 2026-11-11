// Auto mode: which model a prompt gets, and how the balance changes the pick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPick, promptKind } from '../app/studio/auto.js';
import { imageModels } from '../app/studio/models.js';

const rich = { loaded: true, free: 10, paid: 500 };
const pick = (p, w = rich) => autoPick(p, w).id;

test('words in the image go to the lettering model', () => {
  assert.equal(pick('A coffee shop poster that says "Fresh every morning"'), 'ideogram');
  assert.equal(pick('neon sign with the word OPEN'), 'ideogram');
  assert.equal(pick('לוגו לבית קפה עם הכיתוב ״קפה של בוקר״'), 'ideogram');
  assert.equal(pick("a mug with 'best dad' on it"), 'ideogram');
  assert.equal(promptKind("a dog's bowl and the cat's bed").id, 'any'); // apostrophes are not quotes
});

test('designs, photos and stylised looks each get their model', () => {
  assert.equal(pick('flat vector icon of a rocket, minimal'), 'recraft-41');
  assert.equal(pick('מדבקה של חתול, איור שטוח'), 'recraft-41');
  assert.equal(pick('studio portrait photo of an old fisherman, 85mm, bokeh'), 'flux-3');
  assert.equal(pick('צילום מוצר של בקבוק בושם בסטודיו'), 'flux-3');
  assert.equal(pick('anime girl on a rooftop at night, cinematic, moody'), 'grok');
  assert.equal(pick('a red apple on a table'), 'nano-banana');
  assert.equal(pick(''), 'nano-banana');
});

test('a long or structured prompt goes to the model that follows detail best', () => {
  assert.equal(pick('a labelled diagram of the water cycle, step by step'), 'gpt-image');
  assert.equal(pick(`${'a busy market street with many stalls and people, '.repeat(10)}seen from above`), 'gpt-image');
  // words in the image still win over length
  assert.equal(pick(`${'a busy market street with many stalls, '.repeat(12)} and a banner that says "SALE"`), 'ideogram');
});

test('the pick fits the balance, and says so', () => {
  const small = { loaded: true, free: 8, paid: 0 };
  const a = autoPick('poster that says "Hello"', small);
  assert.deepEqual([a.id, a.fitted], ['nano-banana', true]); // 13 is too much, 7 fits
  const tiny = { loaded: true, free: 3, paid: 0 };
  assert.deepEqual([autoPick('studio photo of a watch', tiny).id, autoPick('studio photo of a watch', tiny).fitted], ['fast', true]);
  assert.equal(autoPick('studio photo of a watch', rich).fitted, false);
  // free and bought credits are not added together: the server pays from one pocket
  assert.equal(pick('poster that says "Hello"', { loaded: true, free: 7, paid: 7 }), 'nano-banana');
});

test('with nothing in the wallet the first choice is shown, so the next step is signing in or buying', () => {
  const none = { loaded: true, free: 0, paid: 0 };
  assert.deepEqual([autoPick('poster that says "Hello"', none).id, autoPick('poster that says "Hello"', none).fitted], ['ideogram', false]);
  assert.equal(pick('a red apple', { loaded: false }), 'nano-banana'); // wallet not loaded yet: the server decides
  assert.equal(pick('a labelled diagram', { loaded: true, admin: true, free: 0, paid: 0 }), 'gpt-image');
});

test('every model Auto can pick exists in the list', () => {
  const ids = new Set(imageModels.map((m) => m.id));
  for (const p of ['"x y"', 'diagram', 'vector icon', 'photo', 'anime', 'apple']) for (const w of [rich, { loaded: true, free: 0, paid: 0 }, { loaded: true, free: 5, paid: 0 }]) assert.ok(ids.has(autoPick(p, w).id), p);
});
