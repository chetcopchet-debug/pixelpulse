// Preview builds only: print the input schema Replicate publishes for each model we call, so the inputs in
// lib/models.js can be checked against the real thing without running (and paying for) a generation.
// Never fails the build.
const MODELS = [
  'openai/gpt-image-2.6-sunburst', 'google/nano-banana-2.1', 'black-forest-labs/flux-3-image', 'google/imagen-4-ultra',
  'bytedance/seedream-5-lite', 'ideogram-ai/ideogram-4-5', 'recraft-ai/recraft-v4.1', 'black-forest-labs/flux-2-pro',
  'xai/grok-imagine-image', 'black-forest-labs/flux-schnell',
  'bytedance/seedance-2.5', 'kwaivgi/kling-v4.0', 'kwaivgi/kling-v4-flash', 'google/veo-3.1-fast',
  'google/gemini-omni-1.2-flash', 'xai/grok-imagine-video', 'google/veo-3.1-lite', 'minimax/h3-lite', 'wan-video/wan-2.2-t2v-fast',
];
const token = process.env.REPLICATE_API_TOKEN;
const short = (v) => { const s = JSON.stringify(v); return s && s.length > 160 ? s.slice(0, 157) + '...' : s; };
async function one(id) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${id}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
    if (!r.ok) return `[schema] ${id} :: HTTP ${r.status}`;
    const m = await r.json();
    const sch = m.latest_version?.openapi_schema?.components?.schemas || {};
    const inp = sch.Input || {};
    const lines = [`[schema] ${id} :: runs=${m.run_count} required=${short(inp.required || [])}`];
    for (const [k, p] of Object.entries(inp.properties || {}).sort((a, b) => (a[1]['x-order'] ?? 99) - (b[1]['x-order'] ?? 99))) {
      const ref = p.allOf?.[0]?.$ref || p.$ref; const e = ref ? sch[ref.split('/').pop()] : null;
      const type = p.type || e?.type || (p.anyOf ? 'anyOf' : '?');
      const en = p.enum || e?.enum;
      const range = [p.minimum !== undefined ? `min=${p.minimum}` : '', p.maximum !== undefined ? `max=${p.maximum}` : ''].filter(Boolean).join(' ');
      lines.push(`[schema]   ${k}: ${type}${p.items?.type ? `<${p.items.type}>` : ''}${en ? ` enum=${short(en)}` : ''}${range ? ` ${range}` : ''}${p.default !== undefined ? ` default=${short(p.default)}` : ''}`);
    }
    return lines.join('\n');
  } catch (e) { return `[schema] ${id} :: ${e?.name || 'error'} ${e?.message || ''}`; }
  finally { clearTimeout(t); }
}
if (process.env.VERCEL_ENV === 'preview' && token) {
  try { console.log((await Promise.all(MODELS.map(one))).join('\n')); } catch (e) { console.log('[schema] skipped', e?.message || e); }
}
