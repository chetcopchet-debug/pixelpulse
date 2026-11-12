// Checks every model we offer against what Replicate publishes for it, without running (or paying for) anything:
// the model must exist, and each input we would send must be one its schema accepts.
import { IMAGE_MODELS, VIDEO_MODELS } from './catalog.js';
import { MODEL_TIERS, VIDEO_TIERS } from './models.js';
import { VIDEO_PRICING, videoQuote } from './videoPricing.js';
import { PREMIUM, GUIDED } from './models.js';

const IMAGE_RATIOS = ['1:1', '16:9', '9:16'];

// One row per model: what we call, what it costs, whether the price was confirmed on Replicate, and every input we can send.
export function modelRows() {
  const rows = [];
  for (const m of IMAGE_MODELS) {
    const t = MODEL_TIERS[m.id];
    rows.push({ kind: 'image', id: m.id, name: m.label, slug: t.model, usd: m.usd, listUsd: m.listUsd, cost: m.cost, unit: 'one image', approx: m.approx, src: m.src,
      inputs: IMAGE_RATIOS.map((r) => t.input('a red apple', r)) });
  }
  for (const m of VIDEO_MODELS) {
    const t = VIDEO_TIERS[m.id]; const p = VIDEO_PRICING[m.id]; const inputs = [];
    for (const d of p.durations) for (const r of p.resolutions) for (const ratio of p.ratios) { if (videoQuote(m.id, d, r)) inputs.push(t.input('a red apple', ratio, d, r)); }
    rows.push({ kind: 'video', id: m.id, name: m.label, slug: t.model, usd: m.usd, listUsd: Math.round(p.usd(m.secs, m.res) * 1000) / 1000, cost: m.cost, unit: `${m.secs} s at ${m.res}`, approx: m.approx, src: m.src, inputs });
  }
  // The models behind the tools. Only "does Replicate still run it" is checked for these.
  for (const [id, name, slug] of TOOL_MODELS) rows.push({ kind: 'tool', id: `tool:${id}`, name, slug, inputs: [], tool: true });
  return rows;
}
export const TOOL_MODELS = [
  ['animate', 'Animate', PREMIUM.animate.model], ['facelock', 'Keep the face', PREMIUM.facelock.model], ['reference', 'From a reference image', GUIDED.model],
  ['edit', 'Edit with words', 'black-forest-labs/flux-kontext-pro'], ['repaint', 'Edit an area', 'black-forest-labs/flux-fill-pro'],
  ['sharpen', 'Upscale', 'nightmareai/real-esrgan'], ['translate', 'Prompt translation', 'openai/gpt-5-nano'], ['translate2', 'Prompt translation, backup', 'anthropic/claude-4.5-haiku'],
  ['amplify', 'Improve prompt', 'meta/meta-llama-3-8b-instruct'],
];

// Problems with one input object against a model's published input schema ([] = fine).
export function checkInput(schemas, input) {
  const spec = schemas?.Input; if (!spec?.properties) return ['no input schema published'];
  const out = [];
  for (const k of spec.required || []) if (input[k] === undefined) out.push(`${k} is required`);
  for (const [k, v] of Object.entries(input)) {
    const p = spec.properties[k]; if (!p) { out.push(`${k} is not an input of this model`); continue; }
    const ref = p.allOf?.[0]?.$ref || p.$ref; const e = ref ? schemas[ref.split('/').pop()] : null;
    const en = p.enum || e?.enum; const type = p.type || e?.type;
    if (en && !en.includes(v)) out.push(`${k}: ${JSON.stringify(v)} is not one of ${en.map((x) => JSON.stringify(x)).join(', ')}`);
    if (type === 'integer' && !Number.isInteger(v)) out.push(`${k}: ${JSON.stringify(v)} is not a whole number`);
    if (type === 'boolean' && typeof v !== 'boolean') out.push(`${k}: ${JSON.stringify(v)} is not true/false`);
    if (type === 'string' && typeof v !== 'string') out.push(`${k}: ${JSON.stringify(v)} is not text`);
    if (typeof v === 'number' && p.minimum !== undefined && v < p.minimum) out.push(`${k}: ${v} is below ${p.minimum}`);
    if (typeof v === 'number' && p.maximum !== undefined && v > p.maximum) out.push(`${k}: ${v} is above ${p.maximum}`);
  }
  return out;
}

async function schemaOf(slug, token) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.replicate.com/v1/models/${slug}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal, next: { revalidate: 3600 } });
    if (!r.ok) return { error: r.status === 404 ? 'Replicate has no model with this name' : `Replicate answered ${r.status}` };
    const m = await r.json();
    return { schemas: m.latest_version?.openapi_schema?.components?.schemas || null };
  } catch (e) { return { error: e?.name === 'AbortError' ? 'Replicate did not answer in time' : 'could not reach Replicate' }; }
  finally { clearTimeout(timer); }
}

// Asks Replicate about every model. Returns the rows with `ok` and `problems` filled in.
export async function liveCheck(token = process.env.REPLICATE_API_TOKEN) {
  const rows = modelRows();
  if (!token) return rows.map((r) => ({ ...r, ok: null, problems: ['no Replicate token on this deployment'] }));
  return Promise.all(rows.map(async (r) => {
    const s = await schemaOf(r.slug, token);
    if (s.error) return { ...r, ok: s.error.startsWith('Replicate has no') ? false : null, problems: [s.error] };
    const problems = [...new Set(r.inputs.flatMap((i) => checkInput(s.schemas, i)))];
    return { ...r, ok: problems.length === 0, problems };
  }));
}
