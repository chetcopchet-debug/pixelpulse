// Sizes for the Create screen, worked out from the space that is really there. No dependencies; tested.

// The largest box of shape `ar` (width / height) that fits in w x h.
export function fitBox(ar, w, h) {
  if (!(ar > 0) || !(w > 0) || !(h > 0)) return null;
  const bw = Math.floor(Math.min(w, h * ar));
  return { w: bw, h: Math.min(Math.floor(h), Math.round(bw / ar)) };
}

// A comparison: n pictures of shape `ar`, each with a label under it. Tries every number of columns and keeps
// the one that makes the pictures largest; a layout with fewer rows wins when its pictures are nearly as large,
// because side by side is easier to compare. Returns { cols, rows, cw (picture width) } or null.
export function fitGrid(n, ar, w, h, gap = 8, label = 30) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = Math.floor(Math.min((w - (cols - 1) * gap) / cols, ((h - rows * label - (rows - 1) * gap) / rows) * ar));
    if (cw > 0 && (!best || cw > best.cw || (rows < best.rows && cw >= best.cw * 0.87))) best = { cols, rows, cw };
  }
  return best;
}

export const ratioOf = (text) => { const m = /^(\d+):(\d+)$/.exec(text || ""); return m && +m[2] ? +m[1] / +m[2] : 1; };
