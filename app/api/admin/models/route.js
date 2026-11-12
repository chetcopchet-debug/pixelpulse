import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/admin';
import { modelRows } from '../../../../lib/modelCheck';
import { probe } from '../../../../lib/modelHealth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST { slug } (admin only): asks Replicate whether this one model still runs. Nothing is generated.
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const row = modelRows().find((r) => r.slug === body?.slug);
  if (!row) return NextResponse.json({ error: 'Unknown model.' }, { status: 400 });
  const r = await probe(row.slug, row.inputs[0]);
  return NextResponse.json({ slug: row.slug, name: row.name, ...r });
}
