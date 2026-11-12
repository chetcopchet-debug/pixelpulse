// Reading Replicate's answer to "start a run", and Auto staying away from models that were switched off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isDiscontinued, readAnswer, refusedInput } from '../lib/modelHealthCore.js';
import { autoPick } from '../app/studio/auto.js';
import { MODEL_TIERS } from '../lib/models.js';

// The exact answer Replicate gave for google/imagen-4-ultra on 2026-11-12.
const GONE = { title: 'Version disabled', detail: 'This deployment is currently disabled:\n- This model has been discontinued by its provider. Choose another supported model explicitly. No replacement is selected automatically.', status: 422 };
// And for a model that runs, asked with an input it must refuse.
const REFUSED = { title: 'Input validation failed', detail: '- input: prompt is required\n- input.aspect_ratio: aspect_ratio must be one of the following: "1:1"', status: 422 };

test('a discontinued model is told apart from a refused input', () => {
  assert.equal(isDiscontinued(422, GONE), true);
  assert.equal(readAnswer(422, GONE), 'dead');
  assert.equal(isDiscontinued(422, REFUSED), false);
  assert.equal(readAnswer(422, REFUSED), 'alive');
  assert.equal(readAnswer(201, { id: 'x', status: 'processing' }), 'alive');
  assert.equal(readAnswer(404, { detail: 'The requested resource could not be found.' }), 'dead');
  assert.equal(readAnswer(429, { detail: 'Request was throttled.' }), 'limited');
  assert.equal(readAnswer(402, { title: 'Insufficient credit' }), 'unknown'); // money trouble says nothing about the model
  assert.equal(readAnswer(500, {}), 'unknown');
});

test('the question sent to Replicate can never produce an image or a video', () => {
  for (const [id, t] of Object.entries(MODEL_TIERS)) {
    const q = refusedInput(t.input('a red apple', '1:1'));
    assert.equal('prompt' in q, false, id);
    for (const [k, v] of Object.entries(q)) assert.ok(typeof v !== 'string' || v === '__check__', `${id}.${k}`);
    for (const v of Object.values(q)) assert.ok(typeof v !== 'number' || v === -987, id);
  }
  assert.deepEqual(refusedInput(undefined), { __check__: '__check__' });
});

test('Auto never picks a model that was switched off', () => {
  const rich = { loaded: true, free: 10, paid: 500 };
  assert.equal(autoPick('studio photo of a watch', rich).id, 'flux-3');
  assert.equal(autoPick('studio photo of a watch', rich, ['flux-3']).id, 'flux-2-pro');
  assert.equal(autoPick('studio photo of a watch', rich, new Set(['flux-3', 'flux-2-pro', 'grok', 'fast'])).id !== 'flux-3', true);
  const all = ['gpt-image', 'ideogram', 'flux-3', 'nano-banana', 'seedream-5', 'recraft-41', 'flux-2-pro', 'grok'];
  assert.equal(autoPick('poster that says "Hi"', rich, all).id, 'fast'); // only one model left
  for (const p of ['"x y"', 'diagram', 'vector icon', 'photo', 'anime', 'apple']) assert.ok(!['ideogram', 'grok'].includes(autoPick(p, rich, ['ideogram', 'grok']).id), p);
});
