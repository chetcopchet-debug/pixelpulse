import { NextResponse } from 'next/server';
import { modelRows } from '../../../../lib/modelCheck';
import { probe, modelHealth, noteRun } from '../../../../lib/modelHealth';
import { MODEL_TIERS } from '../../../../lib/models';
import { runReplicate } from '../../../../lib/replicate';
import { bump } from '../../../../lib/usage';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Runs once a day (vercel.json). Asks Replicate about the models that were not checked today, for as long as
// fits in one run; the rest wait for the next run. Nothing is generated, except one image for each image model
// that is down (at most one a day per model), to see whether it is back.
// Anyone can call this address, so it does real work at most once an hour.
export async function GET() {
  const hour = new Date().toISOString().slice(0, 13);
  if (await bump(`cron:models:${hour}`, 1, 1) === null) return NextResponse.json({ ok: true, skipped: 'already ran this hour' });
  const today = new Date().toISOString().slice(0, 10);
  const { seen, dead, down } = await modelHealth();
  const started = Date.now(); const out = [];
  // An image model that is down is tried for real, once a day: one square image. Replicate still says "yes, I run
  // it" about such a model, so only a picture proves it is back. noteRun() marks it back, or leaves it down.
  const retried = [];
  for (const tier of Object.values(MODEL_TIERS)) {
    if (!down.has(tier.model) || Date.now() - started > 25_000) continue;
    if (await bump(`model:retest:${tier.model}`, 1, 1) === null) continue; // already tried today
    const run = await runReplicate({ model: tier.model, input: tier.input('A red apple on a white table, studio photo', '1:1'), budgetMs: 25_000 });
    if (run.error === 'timeout' || run.error === 'throttled' || run.error === 'config') { retried.push({ slug: tier.model, back: null, why: run.error }); continue; } // says nothing about the model
    await noteRun(tier.model, !run.error, run.detail || run.error);
    retried.push({ slug: tier.model, back: !run.error, why: run.error ? String(run.detail || run.error).slice(0, 120) : '' });
  }
  // Oldest check first, so every model gets its turn even when only a few fit in a run.
  const todo = modelRows().filter((r) => seen[r.slug] !== today || dead.has(r.slug)).sort((a, b) => String(seen[a.slug] || '').localeCompare(String(seen[b.slug] || '')));
  for (const r of todo) {
    if (Date.now() - started > 45_000) break;
    const p = await probe(r.slug, r.inputs[0], { tries: 2 });
    out.push({ slug: r.slug, state: p.state });
    if (p.state === 'dead') console.error('MODEL CHECK: discontinued', r.slug, p.detail);
  }
  return NextResponse.json({ ok: true, retried, checked: out.length, waiting: todo.length - out.length, discontinued: out.filter((x) => x.state === 'dead').map((x) => x.slug) });
}
