// The prices the new interface shows must be the prices the server charges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { imageModels, videoModels, videoPlan, madeWith, toItem, TOOLS } from '../app/studio/models.js';
import { MODEL_TIERS, VIDEO_TIERS, PREMIUM, GUIDED } from '../lib/models.js';
import { videoQuote, VIDEO_PRICING } from '../lib/videoPricing.js';

test('every image model shown has the server price', () => {
  assert.equal(imageModels.length, 9);
  assert.ok(!imageModels.some((m) => m.id === 'imagen-ultra')); // Google switched Imagen off
  assert.equal(madeWith('imagen-ultra'), 'Imagen 4 Ultra'); // old items keep the name
  for (const m of imageModels) {
    assert.ok(MODEL_TIERS[m.id], `server knows ${m.id}`);
    assert.equal(m.cost, MODEL_TIERS[m.id].cost, `${m.id} price`);
    assert.ok(m.name && m.by && m.desc);
  }
});

test('every video model shown has the server starting price', () => {
  for (const m of videoModels) {
    assert.ok(VIDEO_TIERS[m.id], `server knows ${m.id}`);
    const def = VIDEO_PRICING[m.id].def;
    assert.equal(m.cost, videoQuote(m.id, def.d, def.r, '16:9').cost, `${m.id} starting price`);
  }
});

test('tool prices match the server', () => {
  assert.equal(TOOLS.animate.cost, PREMIUM.animate.cost);
  assert.equal(TOOLS.facelock.cost, PREMIUM.facelock.cost);
  assert.equal(TOOLS.reference.cost, GUIDED.cost);
});

test('a video plan falls back to options the model supports', () => {
  const p = videoPlan('veo-lite', null, null, '1:1'); // Veo Lite makes only wide and tall
  assert.equal(p.ratio, '16:9');
  assert.equal(p.d, 4);
  const bad = videoPlan('veo', 5, '480p', '16:9'); // not offered: default length and quality are used
  assert.deepEqual([bad.d, bad.r], [4, '720p']);
  assert.equal(videoPlan('nope'), null);
  assert.equal(videoPlan('kling-4', 10, '1080p', '1:1').cost, videoQuote('kling-4', 10, '1080p', '1:1').cost);
});

test('saved items are named and typed for display', () => {
  assert.equal(madeWith('video:kling'), 'Kling 2.5 Turbo Pro'); // retired, still named in the library
  assert.equal(madeWith('quality'), 'FLUX 1.1 Pro');
  assert.equal(madeWith('video:kling-4'), 'Kling 4.0');
  assert.equal(madeWith('gpt-image'), 'GPT Image 2.6 Sunburst');
  assert.equal(madeWith('fast'), 'FLUX Schnell');
  assert.equal(madeWith(null), 'FLUX Schnell');
  assert.equal(madeWith('animate'), 'Animate');
  const v = toItem({ id: 'x', public_url: 'https://a.supabase.co/storage/v1/object/public/images/i/abc.mp4', aspect_ratio: '16:9' });
  assert.equal(v.video, true);
  assert.equal(toItem({ public_url: 'https://a/b.webp' }).video, false);
});

test('comparing: two to four different models, priced as the sum', async () => {
  const { comparePlan, covers, MAX_COMPARE } = await import('../app/studio/models.js');
  assert.equal(comparePlan(['fast']), null);
  assert.equal(comparePlan(['fast', 'fast']), null); // the same model twice is one model
  assert.equal(comparePlan(['fast', 'nope']), null);
  assert.equal(comparePlan(undefined), null);
  const p = comparePlan(['fast', 'grok', 'gpt-image']);
  assert.deepEqual(p.models.map((m) => m.id), ['fast', 'grok', 'gpt-image']);
  assert.equal(p.cost, 1 + 4 + 16);
  assert.equal(comparePlan(imageModels.map((m) => m.id)).models.length, MAX_COMPARE);
  // The server pays each image from one pocket: free credits if they cover it, otherwise bought ones.
  assert.equal(covers({ free: 10, paid: 0 }, [1, 4]), true);
  assert.equal(covers({ free: 10, paid: 0 }, [7, 7]), false);
  assert.equal(covers({ free: 10, paid: 7 }, [7, 7]), true);
  assert.equal(covers({ free: 3, paid: 20 }, [16, 4]), true);
  assert.equal(covers({ free: 0, paid: 19 }, [16, 4]), false);
});
