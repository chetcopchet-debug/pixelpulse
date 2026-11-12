import test from 'node:test';
import assert from 'node:assert/strict';
import { maskBox, planArea } from '../lib/areaPlan.js';

const mask = (w, h, x0, y0, x1, y1) => { const g = new Uint8Array(w * h); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * w + x] = 255; return g; };

test('the marked box is found, and an empty marking is reported as empty', () => {
  assert.deepEqual(maskBox(mask(100, 80, 10, 20, 30, 50), 100, 80), { x0: 10, y0: 20, x1: 30, y1: 50, count: 21 * 31 });
  assert.equal(maskBox(new Uint8Array(100 * 80), 100, 80), null);
  const faint = new Uint8Array(16); faint[5] = 100; // a faint pixel is not a marking
  assert.equal(maskBox(faint, 4, 4), null);
});

test('a small marking in a large image is cut out with room around it and enlarged for the model', () => {
  const p = planArea({ w: 2048, h: 2048, box: { x0: 900, y0: 900, x1: 1099, y1: 1099 } });
  assert.equal(p.full, false);
  assert.ok(p.crop.w >= 384 && p.crop.w < 700, 'room around the marking, not the whole image');
  assert.ok(p.crop.x <= 900 && p.crop.x + p.crop.w >= 1100 && p.crop.y <= 900 && p.crop.y + p.crop.h >= 1100, 'the marking is inside the cut');
  assert.ok(p.scale > 2, 'enlarged');
  assert.ok(p.model.w * p.model.h > 1_000_000 && p.model.w * p.model.h < 1_800_000, 'the model works at about 1.4 megapixels');
  assert.equal(p.model.w % 16, 0); assert.equal(p.model.h % 16, 0);
});

test('the cut never leaves the image, and is never enlarged more than four times', () => {
  for (const [w, h, box] of [[1024, 1024, { x0: 0, y0: 0, x1: 40, y1: 40 }], [1024, 1024, { x0: 1000, y0: 1000, x1: 1023, y1: 1023 }], [1344, 768, { x0: 1300, y0: 10, x1: 1340, y1: 700 }], [300, 200, { x0: 100, y0: 50, x1: 120, y1: 70 }]]) {
    const p = planArea({ w, h, box });
    assert.ok(p.crop.x >= 0 && p.crop.y >= 0 && p.crop.x + p.crop.w <= w && p.crop.y + p.crop.h <= h, `${w}x${h}`);
    assert.ok(p.crop.x <= box.x0 && p.crop.y <= box.y0 && p.crop.x + p.crop.w > box.x1 && p.crop.y + p.crop.h > box.y1, `${w}x${h} holds the marking`);
    assert.ok(p.scale <= 4);
  }
});

test('a marking that covers most of the image sends the whole image; a huge one is shrunk', () => {
  const p = planArea({ w: 1024, h: 1024, box: { x0: 50, y0: 50, x1: 970, y1: 970 } });
  assert.equal(p.full, true); assert.deepEqual(p.crop, { x: 0, y: 0, w: 1024, h: 1024 });
  const big = planArea({ w: 4096, h: 4096, box: { x0: 0, y0: 0, x1: 4095, y1: 4095 } });
  assert.ok(big.scale < 1 && big.model.w * big.model.h <= 2_400_000);
});

test('a long thin marking gets a cut that is not a sliver', () => {
  const p = planArea({ w: 2048, h: 2048, box: { x0: 100, y0: 1000, x1: 1900, y1: 1020 } });
  assert.ok(p.crop.w / p.crop.h <= 2.01);
});
