// TEMPORARY diagnostic (preview builds only): how does Replicate describe a model its provider has discontinued?
const token = process.env.REPLICATE_API_TOKEN;
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'openapi_schema' || k === 'default_example' || k === 'cover_image_url' || k === 'description' ? undefined : v)).slice(0, 900);
async function look(id) {
  try {
    const m = await (await fetch(`https://api.replicate.com/v1/models/${id}`, { headers: H })).json();
    console.log(`[diag] ${id} model :: ${strip(m)}`);
    const sch = m.latest_version?.openapi_schema || {};
    console.log(`[diag] ${id} schema-meta :: ${JSON.stringify({ info: sch.info, keys: Object.keys(sch), xkeys: Object.keys(sch).filter((k) => k.startsWith('x-')), inputKeys: Object.keys(sch.components?.schemas?.Input || {}) }).slice(0, 600)}`);
    // An input that can never be valid: the answer shows whether Replicate would accept runs at all. Nothing is generated.
    const r = await fetch(`https://api.replicate.com/v1/models/${id}/predictions`, { method: 'POST', headers: H, body: JSON.stringify({ input: { aspect_ratio: '__check__', __not_an_input__: true } }) });
    console.log(`[diag] ${id} probe :: ${r.status} ${(await r.text()).slice(0, 400)}`);
  } catch (e) { console.log(`[diag] ${id} error ${e?.message}`); }
}
if (process.env.VERCEL_ENV === 'preview' && token) { await look('google/imagen-4-ultra'); await look('black-forest-labs/flux-schnell'); }
