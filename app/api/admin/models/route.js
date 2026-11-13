import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/admin';
import { modelRows } from '../../../../lib/modelCheck';
import { probe, noteRun } from '../../../../lib/modelHealth';
import { MODEL_TIERS } from '../../../../lib/models';
import { runReplicate } from '../../../../lib/replicate';
import { ratioFor } from '../../../../lib/imageproc';
import sharp from 'sharp';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SHAPES = ['1:1', '16:9', '9:16'];
// One real image of one shape (admin only; Replicate charges for it). Says whether the model made it, and
// whether the picture really has the shape that was asked for. A model's schema cannot tell this: Ideogram 4.5
// lists sizes it then refuses.
async function realShape(row, shape) {
  const tier = MODEL_TIERS[row.id];
  if (!tier || !SHAPES.includes(shape)) return NextResponse.json({ error: 'Only image models and the shapes 1:1, 16:9, 9:16 can be tested.' }, { status: 400 });
  const run = await runReplicate({ model: tier.model, input: tier.input('A red apple on a white table, studio photo', shape), budgetMs: 50_000 });
  if (run.error) { if (run.error === 'failed') await noteRun(tier.model, false, run.detail); return NextResponse.json({ shape, ok: false, why: run.detail || run.error }); }
  await noteRun(tier.model, true);
  const url = Array.isArray(run.output) ? run.output[0] : run.output;
  try {
    const meta = await sharp(Buffer.from(await (await fetch(String(url), { cache: 'no-store' })).arrayBuffer())).metadata();
    const got = ratioFor(meta.width, meta.height);
    return NextResponse.json({ shape, ok: got === shape, size: `${meta.width}x${meta.height}`, got, why: got === shape ? '' : `asked for ${shape}, the picture is ${meta.width}x${meta.height}` });
  } catch { return NextResponse.json({ shape, ok: true, size: 'unknown', why: 'made a picture, but its size could not be read' }); }
}

// POST { slug } (admin only): asks Replicate whether this one model still runs. Nothing is generated.
// POST { slug, shape }: makes one real image of that shape with an image model (see realShape).
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const row = modelRows().find((r) => r.slug === body?.slug);
  if (!row) return NextResponse.json({ error: 'Unknown model.' }, { status: 400 });
  if (body?.shape) return realShape(row, body.shape);
  const r = await probe(row.slug, row.inputs[0]);
  return NextResponse.json({ slug: row.slug, name: row.name, ...r });
}
