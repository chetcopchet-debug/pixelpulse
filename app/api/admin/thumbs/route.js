import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/admin';
import { getSupabase, BUCKET } from '../../../../lib/supabase';
import { makeThumb } from '../../../../lib/generation';
import { CACHE_SECONDS } from '../../../../lib/thumbs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Admin backfill: POST { after?: ISO, limit?: n, recache?: bool } -> thumbnails for older images (+ re-upload originals with 1-year cache).
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
  let q = supabase.from('images').select('id, created_at, storage_path').order('created_at', { ascending: true }).limit(limit);
  if (body.after) q = q.gt('created_at', body.after);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out = { done: 0, recached: 0, failed: [] };
  const started = Date.now();
  let last = body.after || null;
  for (const r of data) {
    if (Date.now() - started > 45_000) break;
    last = r.created_at;
    if (!r.storage_path || !/^i\//.test(r.storage_path)) { out.failed.push(`${r.id}:path`); continue; }
    const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(r.storage_path);
    if (dErr || !blob) { out.failed.push(`${r.id}:download`); continue; }
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (await makeThumb(supabase, r.storage_path, bytes)) out.done++; else out.failed.push(`${r.id}:thumb`);
    if (body.recache) {
      const { error: uErr } = await supabase.storage.from(BUCKET).update(r.storage_path, bytes, { contentType: blob.type || undefined, cacheControl: CACHE_SECONDS, upsert: true });
      if (!uErr) out.recached++; else out.failed.push(`${r.id}:recache`);
    }
  }
  return NextResponse.json({ ...out, next: data.length === limit || last !== data[data.length - 1]?.created_at ? last : null });
}
