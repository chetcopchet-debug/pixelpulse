import test from 'node:test';
import assert from 'node:assert/strict';
import { fitBox, fitGrid, ratioOf } from '../app/studio/layout.js';
import { stageOf, stageTime, answers } from '../app/studio/models.js';

test('the result is as large as the space allows and keeps its shape', () => {
  assert.deepEqual(fitBox(1, 390, 478), { w: 390, h: 390 });           // square on a phone: full width
  assert.deepEqual(fitBox(9 / 16, 390, 478), { w: 268, h: 476 });      // tall: limited by the height
  assert.deepEqual(fitBox(16 / 9, 390, 478), { w: 390, h: 219 });
  assert.equal(fitBox(1, 0, 100), null);
  assert.equal(ratioOf('16:9'), 16 / 9); assert.equal(ratioOf('nonsense'), 1);
});

test('a comparison picks the number of columns that makes the pictures largest', () => {
  assert.equal(fitGrid(2, 1, 366, 478).cols, 2);
  assert.equal(fitGrid(3, 16 / 9, 366, 478).cols, 1);  // wide pictures on a phone: one under the other
  assert.equal(fitGrid(4, 9 / 16, 366, 478).cols, 2);  // four tall pictures: two rows of two
  assert.equal(fitGrid(2, 1, 872, 700).cols, 2);
  assert.equal(fitGrid(4, 1, 900, 700).cols, 2);
  const g = fitGrid(3, 1, 366, 478);
  assert.ok(g.cols * g.cw + (g.cols - 1) * 8 <= 366);
  assert.ok(g.rows * (g.cw + 30) + (g.rows - 1) * 8 <= 478);
});

test('the Create screen shows whatever produced a result last', () => {
  const a = { key: 'a', kind: 'image', status: 'done', item: { id: '1' }, doneAt: 100 };
  const b = { key: 'b', kind: 'image', status: 'running', t0: 150 };
  const c = { key: 'c', kind: 'image', status: 'done', item: { id: '2' }, doneAt: 200 };
  const failed = { key: 'f', kind: 'image', status: 'failed', t0: 300 };
  assert.equal(stageOf([]), null);
  assert.equal(stageOf([b, failed]), null);                 // nothing finished yet: nothing to show large
  assert.equal(stageOf([a, b]).key, 'a');                   // the old result stays while the new one is being made
  assert.equal(stageOf([c, a, failed]).key, 'c');           // the latest to finish wins, whatever the order they started in
  const cmp = { key: 'm', kind: 'compare', status: 'running', t0: 250, parts: [{ id: 'x', status: 'running' }, { id: 'y', status: 'done', doneAt: 260, item: { id: '3' } }] };
  assert.equal(stageOf([a, c, cmp]).key, 'm');              // a comparison is shown from the moment it starts
  assert.equal(stageTime(cmp), 260);
  assert.equal(stageOf([cmp, { ...c, doneAt: 300 }]).key, 'c');
});

test('a waiting request only takes an image that it could have made', () => {
  const t0 = Date.parse('2026-11-12T00:57:20Z');
  const w = { model: 'grok', prompt: ' חתול ירוק ', t0, skip: ['old'] };
  const item = (o) => ({ id: 'new', prompt: 'חתול ירוק', model: 'grok', at: '2026-11-12T00:57:45.846Z', video: false, ...o });
  const none = new Set();
  assert.equal(answers(item(), w, none), true);
  assert.equal(answers(item({ model: 'fast' }), w, none), false);                    // another model
  assert.equal(answers(item({ prompt: 'חתול אדום' }), w, none), false);              // other words
  assert.equal(answers(item({ at: '2026-11-12T00:50:00Z' }), w, none), false);       // made before the request
  assert.equal(answers(item({ id: 'old' }), w, none), false);                        // was already in the Library when the request started
  assert.equal(answers(item(), w, new Set(['new'])), false);                         // already shown for another request
  assert.equal(answers(item({ video: true }), w, none), false);
});
