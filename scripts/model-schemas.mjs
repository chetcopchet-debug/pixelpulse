// TEMPORARY (one preview build): ask Replicate whether the models that were not reached last time still run.
// Nothing is generated: each request carries an input the model refuses, and is cancelled if queued.
const token = process.env.REPLICATE_API_TOKEN;
if (process.env.VERCEL_ENV === 'preview' && token) {
  try {
    const { modelRows } = await import('../lib/modelCheck.js');
    const { readAnswer, refusedInput } = await import('../lib/modelHealthCore.js');
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const want = new Set(['google/veo-3.1-lite', 'minimax/h3-lite', 'wan-video/wan-2.2-t2v-fast']);
    const rows = modelRows().filter((r) => r.tool || want.has(r.slug));
    const started = Date.now();
    for (const r of rows) {
      if (Date.now() - started > 170_000) { console.log(`[live] ${r.slug} :: not checked (out of time)`); continue; }
      let line = 'no answer';
      for (let t = 0; t < 3; t++) {
        const res = await fetch(`https://api.replicate.com/v1/models/${r.slug}/predictions`, { method: 'POST', headers: H, body: JSON.stringify({ input: refusedInput(r.inputs[0]) }) });
        const d = await res.json().catch(() => ({}));
        if (d?.urls?.cancel) await fetch(d.urls.cancel, { method: 'POST', headers: H }).catch(() => {});
        const state = readAnswer(res.status, d);
        line = `${state} (${res.status} ${String(d.title || d.status || '').slice(0, 40)})`;
        if (state !== 'limited') break;
        await new Promise((x) => setTimeout(x, Math.min(12, (Number(d.retry_after) || 10) + 1) * 1000));
      }
      console.log(`[live] ${r.slug} :: ${line}`);
    }
  } catch (e) { console.log('[live] failed', e?.message || e); }
}
