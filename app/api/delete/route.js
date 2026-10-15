import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST /api/delete { ids: [uuid, ...] } — deletes the visitor's own rows + storage objects.
export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Cloud storage is not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  if (creator.isNew) return NextResponse.json({ error: 'Nothing to delete.' }, { status: 403 });
  if (!await rateLimit(`del:${creator.id}:${getClientIp(request)}`, 30, 60_000)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).filter(isUuid))].slice(0, 100);
  if (!ids.length) return NextResponse.json({ error: 'No images selected.' }, { status: 400 });

  const { data: rows, error } = await supabase.from('images').select('id, storage_path').eq('creator_id', creator.id).in('id', ids);
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  if (!rows.length) return NextResponse.json({ error: 'Image not found or not yours.' }, { status: 404 });
  const own = rows.map((r) => r.id);
  const { error: delErr } = await supabase.from('images').delete().eq('creator_id', creator.id).in('id', own);
  if (delErr) { console.error('Delete error:', delErr); return NextResponse.json({ error: 'Could not delete.' }, { status: 500 }); }
  const paths = rows.map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch((e) => console.error('Storage remove:', e));
  return NextResponse.json({ success: true, deleted: own });
}
