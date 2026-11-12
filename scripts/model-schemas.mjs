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
  try {
    // 1. Which models take a mask (edit only a marked area)?
    const slugs = ['black-forest-labs/flux-fill-pro', 'black-forest-labs/flux-fill-dev', 'black-forest-labs/flux-2-fill-pro', 'black-forest-labs/flux-2-fill', 'black-forest-labs/flux-3-fill', 'black-forest-labs/flux-2-pro', 'black-forest-labs/flux-3-image', 'black-forest-labs/flux-kontext-max',
      'ideogram-ai/ideogram-4-5', 'ideogram-ai/ideogram-v3-quality', 'ideogram-ai/ideogram-v3-turbo', 'openai/gpt-image-2.6-sunburst', 'google/nano-banana-2.1', 'bytedance/seedream-5-lite', 'recraft-ai/recraft-v4.1', 'xai/grok-imagine-image', 'qwen/qwen-image-edit-plus'];
    for (const s of slugs) {
      const r = await j(`https://api.replicate.com/v1/models/${s}`);
      const props = r.body?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
      const names = Object.keys(props);
      const pick = names.filter((n) => /mask|image|inpaint|outpaint|guidance|steps|strength/i.test(n)).map((n) => `${n}${props[n].default !== undefined ? '=' + JSON.stringify(props[n].default) : ''}${props[n].minimum !== undefined ? `[${props[n].minimum}..${props[n].maximum}]` : ''}`);
      console.log(`[area] ${s} :: ${r.status} runs=${r.body?.run_count ?? '-'} mask=${names.some((n) => /mask/i.test(n))} :: ${pick.join(' ')}`.slice(0, 600));
    }
    // 2. Replicate's own collections about editing and inpainting.
    const cols = await j('https://api.replicate.com/v1/collections');
    for (const c of (cols.body?.results || []).filter((c) => /inpaint|edit|fill/i.test(`${c.slug} ${c.name}`))) {
      const d = await j(`https://api.replicate.com/v1/collections/${c.slug}`);
      const ms = (d.body?.models || []).filter((m) => /inpaint|fill|mask/i.test(`${m.name} ${m.description}`)).sort((a, b) => (b.run_count || 0) - (a.run_count || 0)).slice(0, 14);
      console.log(`[area] collection ${c.slug}: ${ms.map((m) => `${m.owner}/${m.name}(${m.run_count})`).join(' ')}`.slice(0, 900));
    }
    // 3. The translator: does it answer in time, and what does it return for Hebrew?
    for (const text of ['חתול ירוק יושב על ספה אדומה', 'כובע קש עם סרט כחול']) {
      const t0 = Date.now();
      const r = await j('https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions', { method: 'POST', headers: { ...H, Prefer: 'wait=4' }, body: JSON.stringify({ input: { system_prompt: 'You translate prompts for an AI image generator into precise, descriptive English. Output only the English prompt, no notes.', prompt: text, max_tokens: 600, temperature: 0.1 } }) });
      console.log(`[translate] ${r.status} ${r.body?.status || ''} ${Date.now() - t0}ms :: ${JSON.stringify(Array.isArray(r.body?.output) ? r.body.output.join('') : r.body?.output || r.body?.detail || '').slice(0, 200)}`);
      const m = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=he|en`).then((x) => x.json()).catch((e) => ({ err: String(e) }));
      console.log(`[translate] free: ${JSON.stringify(m?.responseData?.translatedText || m).slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, 11000));
    }
    // 4. The two models the admin check could not read.
    for (const s of ['wan-video/wan-2.2-t2v-fast', 'wan-video/wan-2.2-i2v-fast']) {
      const r = await j(`https://api.replicate.com/v1/models/${s}/predictions`, { method: 'POST', body: JSON.stringify({ input: { __check__: '__check__', num_frames: -987, resolution: '__check__', aspect_ratio: '__check__' } }) });
      if (r.body?.urls?.cancel) await j(r.body.urls.cancel, { method: 'POST' });
      console.log(`[health] ${s} :: ${r.status} ${r.body?.status || ''} ${JSON.stringify(r.body?.title || '')} ${JSON.stringify(r.body?.detail || r.body?.error || '').slice(0, 260)}`);
      await new Promise((r) => setTimeout(r, 11000));
    }
  } catch (e) { console.log('[area] skipped:', e?.message || e); }
}
