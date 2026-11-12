// Preview builds only: ask Replicate whether every model we offer exists and accepts the inputs we send
// (lib/modelCheck.js), and print the result in the build log. Nothing is generated, nothing is charged.
// Whether a model still RUNS is a separate question (lib/modelHealth.js): /admin and a daily job ask that.
// Never fails the build.
if (process.env.VERCEL_ENV === 'preview' && process.env.REPLICATE_API_TOKEN) {
  try {
    const { liveCheck } = await import('../lib/modelCheck.js');
    const rows = await liveCheck();
    const bad = rows.filter((r) => r.ok !== true);
    console.log(`[models] ${rows.length} checked against Replicate, ${rows.length - bad.length} fine, ${bad.length} with a problem; ${rows.reduce((n, r) => n + r.inputs.length, 0)} inputs tried`);
    for (const r of bad) console.log(`[models] PROBLEM ${r.slug}: ${r.problems.join(' | ')}`);
  } catch (e) { console.log('[models] check skipped:', e?.message || e); }
}

// TEMPORARY (removed in the next commit): why did FLUX Fill Pro answer "Server side error" to an area edit?
// Sends what the area edit sends, on a made-up picture, and changes one thing at a time until it works.
if (process.env.VERCEL_ENV === 'preview' && process.env.REPLICATE_API_TOKEN) {
  try {
    const sharp = (await import('sharp')).default;
    const { prepareArea } = await import('../lib/areaEdit.js');
    const A = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` };
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const up = async (buf, name, type) => {
      const fd = new FormData(); fd.append('content', new Blob([buf], { type }), name);
      const r = await fetch('https://api.replicate.com/v1/files', { method: 'POST', headers: A, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!d.urls?.get) console.log('[fill] upload failed', r.status, JSON.stringify(d).slice(0, 200));
      return d.urls?.get || null;
    };
    const run = async (tag, model, input) => {
      let r, p;
      for (let i = 0; i < 3; i++) {
        r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, { method: 'POST', headers: { ...A, 'Content-Type': 'application/json', Prefer: 'wait=45' }, body: JSON.stringify({ input }) });
        p = await r.json().catch(() => ({}));
        if (r.status !== 429) break;
        await pause(((Number(p.retry_after) || 10) + 1) * 1000);
      }
      const t0 = Date.now();
      while (r.ok && !['succeeded', 'failed', 'canceled'].includes(p.status) && p.urls?.get && Date.now() - t0 < 60000) { await pause(1500); const s = await fetch(p.urls.get, { headers: A }); if (s.ok) p = await s.json(); }
      const out = Array.isArray(p.output) ? p.output[0] : p.output;
      let dims = '';
      if (out) { try { const b = Buffer.from(await (await fetch(out)).arrayBuffer()); const m = await sharp(b).metadata(); dims = `${m.width}x${m.height} ${m.format}`; } catch (e) { dims = 'output not readable'; } }
      console.log(`[fill] ${tag} :: http ${r.status} ${p.status || ''} ${p.metrics?.predict_time ? p.metrics.predict_time.toFixed(1) + 's' : ''} ${dims} ${JSON.stringify(p.error || p.detail || '').slice(0, 260)}`);
      await pause(10500);
      return p.status === 'succeeded';
    };
    // A made-up picture (sky, ground, a ball) and a marking like the one a finger paints.
    const W = 1024, H = 1024;
    const scene = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2e5"/><stop offset="1" stop-color="#e9f1f8"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#s)"/><rect y="640" width="100%" height="384" fill="#6f9a52"/><circle cx="700" cy="620" r="90" fill="#c9412b"/><rect x="180" y="420" width="160" height="260" fill="#8a6a4b"/></svg>`);
    const image = await sharp(scene).jpeg({ quality: 90 }).toBuffer();
    const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/><path d="M640 560 L700 620 L770 600" stroke="#fff" stroke-width="150" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`)).ensureAlpha().png().toBuffer();
    const prep = await prepareArea(image, mask);
    const pm = await sharp(prep.image).metadata(), mm = await sharp(prep.mask).metadata();
    console.log(`[fill] what the area edit sends: image ${pm.width}x${pm.height} ${pm.format} ${(prep.image.length / 1024) | 0}KB, mask ${mm.width}x${mm.height} ${mm.format} ${mm.channels}ch ${(prep.mask.length / 1024) | 0}KB, cut ${prep.plan.crop.w}x${prep.plan.crop.h}`);
    const fill = (img, msk) => ({ image: img, mask: msk, prompt: 'a yellow beach ball', steps: 50, guidance: 60, output_format: 'png', safety_tolerance: 2, prompt_upsampling: false });
    const F = 'black-forest-labs/flux-fill-pro';
    const hard = await sharp(prep.mask).threshold(128).png().toBuffer(); // pure black and white
    const uImg = await up(prep.image, 'cut.jpg', 'image/jpeg'), uSoft = await up(prep.mask, 'mask-soft.png', 'image/png'), uHard = await up(hard, 'mask-hard.png', 'image/png');
    let ok = uImg && uSoft && await run('1 as sent now (soft-edged mask)', F, fill(uImg, uSoft));
    if (!ok && uImg && uHard) ok = await run('2 same size, pure black-and-white mask', F, fill(uImg, uHard));
    if (!ok) {
      const sImg = await up(await sharp(prep.image).resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer(), 'cut-1024.jpg', 'image/jpeg');
      const sMask = await up(await sharp(hard).resize(1024, 1024, { fit: 'fill' }).threshold(128).png().toBuffer(), 'mask-1024.png', 'image/png');
      ok = sImg && sMask && await run('3 shrunk to 1024x1024, pure mask', F, fill(sImg, sMask));
    }
    if (!ok) {
      const oImg = await up(image, 'whole.jpg', 'image/jpeg'), oMask = await up(mask, 'whole-mask.png', 'image/png');
      ok = oImg && oMask && await run('4 the old way: whole image, mask as painted', F, fill(oImg, oMask));
    }
    console.log(`[fill] FLUX Fill Pro ${ok ? 'worked in the step above' : 'failed in every form'}`);
    // Ideogram 4.5 takes a mask too (black = change), so its mask is the opposite picture.
    const uInv = await up(await sharp(hard).negate({ alpha: false }).png().toBuffer(), 'mask-inverted.png', 'image/png');
    if (uImg && uInv) await run('5 Ideogram 4.5 with a mask', 'ideogram-ai/ideogram-4-5', { prompt: 'a yellow beach ball', images: [uImg], mask: uInv, quality: 'medium', num_images: 1 });
  } catch (e) { console.log('[fill] skipped:', e?.stack || e); }
}
