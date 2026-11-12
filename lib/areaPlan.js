// Edit an area, the arithmetic. No dependencies, so it is tested on its own.
//
// The model that repaints an area works on a picture of about 1.4 million pixels. Given a whole large image with
// a small marked part, it would spend only a few of those pixels on the part that matters. So the marked part is
// cut out with room around it (the model needs to see the surroundings), enlarged to the model's working size,
// repainted there, shrunk back and laid over the original.

const TARGET = 1_400_000;   // pixels the model gets to work with
const MAX_NATIVE = 2_200_000; // a cut larger than this is shrunk before it is sent
const MAX_UP = 4;           // never enlarge more than this: beyond it the surroundings are only blur
const MIN_SIDE = 384;       // the cut is never smaller than this (when the image allows)

// The rectangle that holds every marked pixel. `gray` is one byte per pixel; marked = 128 or brighter.
export function maskBox(gray, w, h, level = 128) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (gray[row + x] >= level) { count++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return count ? { x0, y0, x1, y1, count } : null;
}

const even16 = (n) => Math.max(256, Math.round(n / 16) * 16);

// Which part of a w x h image to cut for this marked box, and at what size the model works on it.
export function planArea({ w, h, box }) {
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const pad = Math.max(32, Math.round(Math.max(bw, bh) * 0.5)); // room around the marked part
  let cw = Math.max(MIN_SIDE, bw + pad * 2), ch = Math.max(MIN_SIDE, bh + pad * 2);
  // Not a sliver: a very long cut gets more room on its short side.
  if (cw > ch * 2) ch = Math.round(cw / 2); else if (ch > cw * 2) cw = Math.round(ch / 2);
  cw = Math.min(w, cw); ch = Math.min(h, ch);
  let full = cw * ch >= w * h * 0.8; // nearly the whole image anyway: send all of it
  if (full) { cw = w; ch = h; }
  const cx = (box.x0 + box.x1 + 1) / 2, cy = (box.y0 + box.y1 + 1) / 2;
  const x = full ? 0 : Math.min(w - cw, Math.max(0, Math.round(cx - cw / 2)));
  const y = full ? 0 : Math.min(h - ch, Math.max(0, Math.round(cy - ch / 2)));
  const area = cw * ch;
  const scale = area < TARGET ? Math.min(MAX_UP, Math.sqrt(TARGET / area)) : area > MAX_NATIVE ? Math.sqrt(MAX_NATIVE / area) : 1;
  return { crop: { x, y, w: cw, h: ch }, model: { w: even16(cw * scale), h: even16(ch * scale) }, scale, full };
}
