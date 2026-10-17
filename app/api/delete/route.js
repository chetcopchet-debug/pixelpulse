import { thumbPath } from '../../../lib/thumbs';
import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';
import { deletionLocked, selectImages } from '../../../lib/trustSafety';

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

  const { data: found, error } = await selectImages(supabase, 'id, storage_path, removed_at, quarantine_path', (q) => q.eq('creator_id', creator.id).in('id', ids));
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  if (!found.length) return NextResponse.json({ error: 'Image not found or not yours.' }, { status: 404 });
  // Evidence preservation: removed items and items reported as involving a minor cannot be deleted by the owner.
  const { data: reps } = await supabase.from('image_reports').select('image_id, reason_code').in('image_id', found.map((r) => r.id)).eq('reason_code', 'minor');
  const minorIds = new Set((reps || []).map((r) => r.image_id));
  const locked = found.filter((r) => deletionLocked(r, minorIds.has(r.id) ? ['minor'] : [])).map((r) => r.id);
  const rows = found.filter((r) => !locked.includes(r.id));
  if (!rows.length) return NextResponse.json({ error: 'This item is under review and can’t be deleted right now.', locked }, { status: 409 });
  const own = rows.map((r) => r.id);
  const { error: delErr } = await supabase.from('images').delete().eq('creator_id', creator.id).in('id', own);
  if (delErr) { console.error('Delete error:', delErr); return NextResponse.json({ error: 'Could not delete.' }, { status: 500 }); }
  const paths = rows.flatMap((r) => [r.storage_path, thumbPath(r.storage_path)]).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch((e) => console.error('Storage remove:', e));
  return NextResponse.json({ success: true, deleted: own, ...(locked.length ? { locked } : {}) });
}
