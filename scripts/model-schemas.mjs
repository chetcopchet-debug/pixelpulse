// TEMPORARY diagnostic (preview builds only): is every model still accepted by Replicate, and what happens to a
// request whose input can never be valid? Nothing is generated: each request is cancelled at once.
const token = process.env.REPLICATE_API_TOKEN;
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const brief = (p) => JSON.stringify({ status: p.status, error: String(p.error || '').slice(0, 140), output: p.output ? 'HAS OUTPUT' : null, metrics: p.metrics || null });
if (process.env.VERCEL_ENV === 'preview' && token) {
  try {
    const old = await (await fetch('https://api.replicate.com/v1/predictions/bhpz1ksd4nrzt0d1smcrtf1t74', { headers: H })).json();
    console.log(`[diag] earlier probe ended :: ${brief(old)}`);
    const { modelRows } = await import('../lib/modelCheck.js');
    const started = Date.now(); const made = [];
    for (const r of modelRows()) {
      if (Date.now() - started > 150_000) { console.log(`[diag] ${r.slug} :: not checked (out of time)`); continue; }
      const input = {};
      for (const [k, v] of Object.entries(r.inputs[0])) { if (k === 'prompt') continue; input[k] = typeof v === 'string' ? '__check__' : typeof v === 'number' ? -987 : v; }
      let line = 'no answer';
      for (let t = 0; t < 3; t++) {
        const res = await fetch(`https://api.replicate.com/v1/models/${r.slug}/predictions`, { method: 'POST', headers: H, body: JSON.stringify({ input }) });
        const d = await res.json().catch(() => ({}));
        if (res.status === 429) { await sleep(Math.min(12, (d.retry_after || 10) + 1) * 1000); line = '429 limited'; continue; }
        if (res.status === 201 && d.id) {
          if (d.urls?.cancel) await fetch(d.urls.cancel, { method: 'POST', headers: H }).catch(() => {});
          made.push([r.slug, d.id]); line = `201 accepted (cancelled) ${d.status}`;
        } else line = `${res.status} ${String(d.title || '')} ${String(d.detail || '').replace(/\s+/g, ' ').slice(0, 160)}`;
        break;
      }
      console.log(`[diag] ${r.slug} :: ${line}`);
      await sleep(250);
    }
    await sleep(4000);
    for (const [slug, id] of made) {
      const p = await (await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: H })).json().catch(() => ({}));
      console.log(`[diag] end ${slug} :: ${brief(p)}`);
    }
  } catch (e) { console.log('[diag] failed', e?.message || e); }
}
