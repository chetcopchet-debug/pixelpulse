// The light picture shown on screen, next to a heavy original.
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewPath, viewUrl, thumbPath } from '../lib/thumbs.js';

test('a PNG or JPG original has a light WebP beside it; a WebP original and a video do not', () => {
  assert.equal(viewPath('i/abc123.png'), 'v/abc123.webp');
  assert.equal(viewPath('i/abc123.jpg'), 'v/abc123.webp');
  assert.equal(viewPath('i/abc123.webp'), null);
  assert.equal(viewPath('i/abc123.mp4'), null);
  assert.equal(viewPath('t/abc123.webp'), null);
});

test('the address shown on screen is the light one, and anything else is left alone', () => {
  const base = 'https://x.supabase.co/storage/v1/object/public/images';
  assert.equal(viewUrl(`${base}/i/abc.png`), `${base}/v/abc.webp`);
  assert.equal(viewUrl(`${base}/i/abc.jpeg?x=1`), `${base}/v/abc.webp`);
  assert.equal(viewUrl(`${base}/i/abc.webp`), `${base}/i/abc.webp`);
  assert.equal(viewUrl('https://replicate.delivery/out.png'), 'https://replicate.delivery/out.png'); // not ours yet: shown as it is
  assert.equal(viewUrl(null), null);
});

test('deleting an image names all three files', () => {
  const p = 'i/abc.png';
  assert.deepEqual([p, thumbPath(p), viewPath(p)], ['i/abc.png', 't/abc.webp', 'v/abc.webp']);
});
