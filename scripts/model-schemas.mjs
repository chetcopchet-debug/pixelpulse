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

// TEMPORARY (removed in the next commit): questions that only Replicate can answer. Nothing is generated.
if (process.env.VERCEL_ENV === 'preview' && process.env.REPLICATE_API_TOKEN) {
  const H = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' };
  const j = async (url, init) => { try { const r = await fetch(url, { headers: H, ...init }); return { status: r.status, body: await r.json().catch(() => ({})) }; } catch (e) { return { status: 0, body: { detail: String(e) } }; } };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    // 1. Which language model translates a Hebrew prompt correctly? ("straw hat", "sunset on the beach", a quoted sign that must stay Hebrew)
    const system = 'You translate prompts for an AI image generator into precise, descriptive English. Keep every detail; do not add new ideas. Any text in double quotes must stay EXACTLY as written, in its original language. Output only the English prompt, no notes.';
    const text = 'כובע קש עם סרט כחול מונח על שולחן עץ בחוף הים בשקיעה, לידו שלט שכתוב עליו "ברוכים הבאים"';
    for (const s of ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano', 'openai/gpt-5-nano', 'openai/gpt-5-mini', 'anthropic/claude-4.5-haiku', 'anthropic/claude-3.5-haiku', 'google/gemini-2.5-flash', 'google/gemini-3-flash', 'meta/meta-llama-3-70b-instruct', 'meta/meta-llama-3-8b-instruct']) {
      const m = await j(`https://api.replicate.com/v1/models/${s}`);
      const props = Object.keys(m.body?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {});
      if (m.status !== 200) { console.log(`[tr] ${s} :: ${m.status}`); continue; }
      const t0 = Date.now();
      let r = await j(`https://api.replicate.com/v1/models/${s}/predictions`, { method: 'POST', headers: { ...H, Prefer: 'wait=8' }, body: JSON.stringify({ input: { system_prompt: system, prompt: text } }) });
      if (r.status === 429) { await pause(11000); r = await j(`https://api.replicate.com/v1/models/${s}/predictions`, { method: 'POST', headers: { ...H, Prefer: 'wait=8' }, body: JSON.stringify({ input: { system_prompt: system, prompt: text } }) }); }
      const out = Array.isArray(r.body?.output) ? r.body.output.join('') : r.body?.output;
      console.log(`[tr] ${s} :: ${r.status} ${r.body?.status || ''} ${Date.now() - t0}ms props=${props.join(',').slice(0, 160)} :: ${JSON.stringify(out || r.body?.detail || r.body?.error || '').slice(0, 300)}`);
      await pause(10500);
    }
    // 2. The two models the admin check could not read: what do they answer to an empty input?
    for (const s of ['wan-video/wan-2.2-t2v-fast', 'wan-video/wan-2.2-i2v-fast']) {
      const r = await j(`https://api.replicate.com/v1/models/${s}/predictions`, { method: 'POST', body: JSON.stringify({ input: {} }) });
      if (r.body?.urls?.cancel) await j(r.body.urls.cancel, { method: 'POST' });
      console.log(`[health] ${s} empty input :: ${r.status} ${r.body?.status || ''} ${JSON.stringify(r.body?.title || '')} ${JSON.stringify(r.body?.detail || r.body?.error || '').slice(0, 200)}`);
      await pause(10500);
    }
    // 3. How Ideogram 4.5 takes a mask.
    const ig = await j('https://api.replicate.com/v1/models/ideogram-ai/ideogram-4-5');
    const ip = ig.body?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
    for (const k of ['mask', 'images', 'size', 'quality']) console.log(`[area] ideogram-4-5 ${k}: ${JSON.stringify(ip[k] || null).slice(0, 420)}`);
  } catch (e) { console.log('[tr] skipped:', e?.message || e); }
}
