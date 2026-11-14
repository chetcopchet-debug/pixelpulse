// Falling snow, drawn on a canvas over the quiet loop of the Create screen (app/studio/Lion.js). The loop video has
// snow of its own, but its flakes are smaller than a phone's pixel, so on a phone nothing was seen to fall.
// It is meant to look like filmed snowfall, not like drawn snowflakes: soft white specks at three depths.
// Far: many, small and sharp, slow. Middle: many, medium, clearly seen against the ice and the sky. Near: a few,
// larger and out of focus, faster, fainter. They fall all the time, lean with a light wind that comes and goes,
// and each one sways a little on its own. Nothing here is a star or a crystal, and nothing is huge.
// startSnow(canvas) starts it and returns a function that stops it.

const LAYERS = [
  // per: flakes per 100,000 px² of the canvas (in CSS pixels); r: radius; a: opacity; v: fall speed (px/s);
  // soft: how far the edge fades (0 = hard, 1 = all fade); wind: how much of the wind it takes; sway: px
  { per: 60, r: [0.9, 1.6], a: [0.75, 1], v: [24, 40], soft: 0.4, wind: 0.5, sway: [1, 4] },
  { per: 36, r: [1.8, 3.1], a: [0.8, 1], v: [44, 72], soft: 0.6, wind: 0.8, sway: [3, 8] },
  { per: 6, r: [3.6, 5.6], a: [0.3, 0.5], v: [88, 130], soft: 1, wind: 1.2, sway: [6, 14] },
];
const rnd = (a, b) => a + Math.random() * (b - a);

// One flake's picture: a soft, slightly uneven blob (two or three overlapping glows), never a perfect disc.
function sprite(radius, soft, scale) {
  const r = Math.max(1, radius * scale), pad = 2, size = Math.ceil(r * 2 + pad * 2);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), mid = size / 2;
  const blob = (x, y, rr, alpha) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(Math.max(0.05, 1 - soft), `rgba(255,255,255,${alpha * (soft >= 1 ? 0.55 : 0.9)})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  };
  blob(mid, mid, r, 1);
  const n = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) { const ang = rnd(0, Math.PI * 2), d = r * rnd(0.15, 0.4); blob(mid + Math.cos(ang) * d, mid + Math.sin(ang) * d, r * rnd(0.5, 0.8), 0.6); }
  return c;
}

export function startSnow(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  let w = 0, h = 0, scale = 1, flakes = [], raf = 0, last = 0, t = 0, stopped = false;
  const build = () => {
    const box = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(box.width)); h = Math.max(1, Math.round(box.height));
    scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    flakes = [];
    LAYERS.forEach((L, li) => {
      const shapes = Array.from({ length: 5 }, () => { const r = rnd(L.r[0], L.r[1]); return { r, img: sprite(r, L.soft, scale) }; });
      const count = Math.round((w * h / 100000) * L.per);
      for (let i = 0; i < count; i++) {
        const s = shapes[Math.floor(Math.random() * shapes.length)];
        flakes.push({ li, img: s.img, r: s.r, x: rnd(0, w), y: rnd(0, h), v: rnd(L.v[0], L.v[1]), a: rnd(L.a[0], L.a[1]), wind: L.wind * rnd(0.8, 1.2),
          sway: rnd(L.sway[0], L.sway[1]), ph: rnd(0, 6.28), fq: rnd(0.25, 0.7), stretch: li === 0 ? 1 : rnd(1.05, 1.3), tw: rnd(0, 6.28) });
      }
    });
  };
  const frame = (now) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t += dt;
    // The wind: a light drift to the left that swells and eases, with a slower turn under it.
    const wind = -7 + Math.sin(t * 0.21) * 6 + Math.sin(t * 0.057 + 1.3) * 5;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.v * dt; f.x += wind * f.wind * dt;
      const m = f.r + 3;
      if (f.y > h + m) { f.y = -m; f.x = rnd(0, w); }
      if (f.x < -m) f.x = w + m; else if (f.x > w + m) f.x = -m;
      const x = f.x + Math.sin(f.ph + t * f.fq) * f.sway;
      const sz = f.img.width / scale;
      ctx.globalAlpha = f.a * (0.85 + 0.15 * Math.sin(f.tw + t * 1.7)); // a faint shimmer, as flakes turn in the light
      ctx.drawImage(f.img, x - sz / 2, f.y - (sz * f.stretch) / 2, sz, sz * f.stretch);
    }
    ctx.globalAlpha = 1;
  };
  build();
  const onSize = () => build();
  window.addEventListener("resize", onSize);
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onSize); };
}
