// The model list, its prices, and the inputs sent to Replicate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_MODELS, VIDEO_MODELS } from '../lib/catalog.js';
import { MODEL_TIERS, VIDEO_TIERS } from '../lib/models.js';
import { CREDIT_USD } from '../lib/videoPricing.js';
import { modelRows, checkInput } from '../lib/modelCheck.js';

test('every model in the list can be run, and nothing else can', () => {
  assert.deepEqual(Object.keys(MODEL_TIERS), IMAGE_MODELS.map((m) => m.id));
  assert.deepEqual(Object.keys(VIDEO_TIERS), VIDEO_MODELS.map((m) => m.id));
  for (const t of [...Object.values(MODEL_TIERS), ...Object.values(VIDEO_TIERS)]) {
    assert.match(t.model, /^[a-z0-9-]+\/[a-z0-9.-]+$/); assert.equal(typeof t.input, 'function'); assert.ok(t.cost >= 1 && t.usd > 0 && t.label);
  }
});

test('image credits are the ones agreed with the owner, and never below cost', () => {
  const cost = Object.fromEntries(IMAGE_MODELS.map((m) => [m.id, m.cost]));
  assert.deepEqual(cost, { 'gpt-image': 16, ideogram: 13, 'flux-3': 10, 'nano-banana': 7, 'seedream-5': 7, 'recraft-41': 8, 'flux-2-pro': 7, grok: 4, fast: 1 });
  for (const m of IMAGE_MODELS) assert.ok(m.cost * CREDIT_USD >= m.usd - 1e-9, m.id);
});

test('the six prices that were not verified are marked, and charged 15% above the list price', () => {
  const approx = [...IMAGE_MODELS, ...VIDEO_MODELS].filter((m) => m.approx).map((m) => m.id);
  assert.deepEqual(approx, ['ideogram', 'flux-3', 'nano-banana', 'recraft-41', 'flux-2-pro', 'omni']);
  for (const m of IMAGE_MODELS) assert.equal(m.usd, Math.round(m.listUsd * (m.approx ? 1.15 : 1) * 10000) / 10000, m.id);
  const rows = modelRows();
  assert.equal(rows.filter((r) => !r.tool).length, 17);
  assert.equal(rows.filter((r) => r.tool).length, 9); // the models behind the tools are watched too
  assert.equal(rows.filter((r) => r.approx).length, 6);
  for (const r of rows.filter((x) => !x.tool)) assert.ok(r.src && r.slug && r.inputs.length >= 1, r.id);
  assert.equal(new Set(rows.map((r) => r.slug)).size, 26);
});

test('GPT Image always runs at medium quality, whatever is asked', () => {
  for (const ratio of ['1:1', '16:9', '9:16']) {
    const i = MODEL_TIERS['gpt-image'].input('a cat', ratio);
    assert.equal(i.quality, 'medium'); assert.equal(i.number_of_images, 1);
  }
  // The function takes a prompt and a ratio; anything else a caller passes is dropped.
  const i = MODEL_TIERS['gpt-image'].input('a cat', '1:1', 'auto', { quality: 'auto' });
  assert.equal(i.quality, 'medium');
  assert.equal(Object.values(i).includes('auto') && i.moderation !== 'auto', false);
});

// The schemas Replicate published for these models on 2026-11-12 (read from a preview build log), trimmed to what is checked.
const en = (...v) => ({ type: 'string', enum: v });
const PUBLISHED = {
  'openai/gpt-image-2.6-sunburst': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', 'auto'), number_of_images: { type: 'integer', minimum: 1, maximum: 10 }, quality: en('low', 'medium', 'high', 'xhigh', 'max', 'auto'), output_format: en('png', 'jpeg', 'webp', 'gif', 'svg'), moderation: en('auto', 'low') } },
  'ideogram-ai/ideogram-4-5': { required: ['prompt'], properties: { prompt: { type: 'string' }, size: en('source', '1024x1024', '1280x896', '896x1280', '1344x768', '768x1344', '1536x640', '640x1536'), quality: en('very_low', 'low', 'medium', 'high'), num_images: { type: 'integer', minimum: 1, maximum: 8 } } },
  'black-forest-labs/flux-3-image': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('auto', '21:9', '2:1', '16:9', '3:2', '7:5', '4:3', '5:4', '1:1', '4:5', '3:4', '5:7', '2:3', '9:16', '1:2', '9:21'), resolution: en('768sq', '1k', '1.5k', '2k', '4k'), grounding: { type: 'boolean' }, safety_tolerance: { type: 'integer', minimum: 0, maximum: 4 }, output_format: en('webp', 'jpg', 'png'), output_quality: { type: 'integer', minimum: 0, maximum: 100 } } },
  'google/nano-banana-2.1': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('match_input_image', '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'), resolution: en('1K', '2K', '4K'), google_search: { type: 'boolean' }, image_search: { type: 'boolean' }, output_format: en('jpg', 'png') } },
  'bytedance/seedream-5-lite': { required: ['prompt'], properties: { prompt: { type: 'string' }, size: en('2K', '3K'), aspect_ratio: en('match_input_image', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'), sequential_image_generation: en('disabled', 'auto'), max_images: { type: 'integer', minimum: 1, maximum: 15 }, output_format: en('png', 'jpeg') } },
  'recraft-ai/recraft-v4.1': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('Not set', '1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16', '1:2', '2:1', '14:10', '10:14', '4:5', '5:4', '6:10') } },
  'black-forest-labs/flux-2-pro': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('match_input_image', 'custom', '1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '9:16', '3:4', '4:3'), resolution: en('match_input_image', '0.5 MP', '1 MP', '2 MP', '4 MP'), safety_tolerance: { type: 'integer', minimum: 1, maximum: 5 }, output_format: en('webp', 'jpg', 'png'), output_quality: { type: 'integer', minimum: 0, maximum: 100 } } },
  'bytedance/seedance-2.5': { required: [], properties: { prompt: { type: 'string' }, duration: { type: 'integer', minimum: -1, maximum: 30 }, resolution: en('480p', '720p'), aspect_ratio: en('16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'), generate_audio: { type: 'boolean' }, watermark: { type: 'boolean' } } },
  'kwaivgi/kling-v4.0': { required: ['prompt'], properties: { prompt: { type: 'string' }, resolution: en('720p', '1080p'), aspect_ratio: en('16:9', '9:16', '1:1', '21:9'), duration: { type: 'integer', minimum: 3, maximum: 30 } } },
  'kwaivgi/kling-v4-flash': { required: ['prompt'], properties: { prompt: { type: 'string' }, aspect_ratio: en('16:9', '9:16', '1:1', '21:9'), duration: { type: 'integer', minimum: 3, maximum: 20 } } },
  'google/gemini-omni-1.2-flash': { required: ['prompt'], properties: { prompt: { type: 'string' }, duration: { type: 'integer', minimum: 3, maximum: 15 }, aspect_ratio: en('16:9', '9:16'), resolution: en('360p', '720p', '1080p', '4k') } },
  'minimax/h3-lite': { required: ['prompt'], properties: { prompt: { type: 'string' }, duration: { type: 'integer', enum: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }, resolution: en('480P', '768P'), ratio: en('21:9', '16:9', '4:3', '1:1', '3:4', '9:16') } },
};

test('every input sent to a new model is one its published schema accepts', () => {
  const rows = modelRows();
  for (const [slug, Input] of Object.entries(PUBLISHED)) {
    const row = rows.find((r) => r.slug === slug); assert.ok(row, slug);
    for (const input of row.inputs) assert.deepEqual(checkInput({ Input }, input), [], `${slug} ${JSON.stringify(input)}`);
  }
});

test('the check catches a wrong value, an unknown input and a missing one', () => {
  const Input = PUBLISHED['minimax/h3-lite'];
  assert.match(checkInput({ Input }, { prompt: 'x', resolution: '768p' })[0], /resolution: "768p" is not one of/);
  assert.match(checkInput({ Input }, { prompt: 'x', aspect_ratio: '16:9' })[0], /aspect_ratio is not an input/);
  assert.match(checkInput({ Input }, { duration: 5 })[0], /prompt is required/);
  assert.match(checkInput({ Input: PUBLISHED['kwaivgi/kling-v4-flash'] }, { prompt: 'x', duration: 25 })[0], /above 20/);
  assert.deepEqual(checkInput({}, { prompt: 'x' }), ['no input schema published']);
});
