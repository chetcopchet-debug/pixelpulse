import { NextResponse } from 'next/server';
import { modelRows } from '../../../../lib/modelCheck';
import { probe, modelHealth } from '../../../../lib/modelHealth';
import { bump } from '../../../../lib/usage';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Runs once a day (vercel.json). Asks Replicate about the models that were not checked today, for as long as
// fits in one run; the rest wait for the next run. Nothing is generated.
// Anyone can call this address, so it does real work at most once an hour.
export async function GET() {
  const hour = new Date().toISOString().slice(0, 13);
  if (await bump(`cron:models:${hour}`, 1, 1) === null) return NextResponse.json({ ok: true, skipped: 'already ran this hour' });
  const today = new Date().toISOString().slice(0, 10);
  const { seen, dead } = await modelHealth();
  const started = Date.now(); const out = [];
  // Oldest check first, so every model gets its turn even when only a few fit in a run.
  const todo = modelRows().filter((r) => seen[r.slug] !== today && !dead.has(r.slug)).sort((a, b) => String(seen[a.slug] || '').localeCompare(String(seen[b.slug] || '')));
  for (const r of todo) {
    if (Date.now() - started > 40_000) break;
    const p = await probe(r.slug, r.inputs[0], { tries: 2 });
    out.push({ slug: r.slug, state: p.state });
    if (p.state === 'dead') console.error('MODEL CHECK: discontinued', r.slug, p.detail);
  }
  return NextResponse.json({ ok: true, checked: out.length, waiting: todo.length - out.length, discontinued: out.filter((x) => x.state === 'dead').map((x) => x.slug) });
}
