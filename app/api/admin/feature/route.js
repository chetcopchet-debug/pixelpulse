import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { makePreview } from '../../../../lib/videoPreview';

export const maxDuration = 60;

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST { id, on }: put one of the admin's own creations in the Explore gallery, or take it out.
// Admin only, and only for work made on this same identity: nobody else's picture can be shown by mistake.
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Cloud storage is not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  const body = await request.json().catch(() => ({}));
  if (creator.isNew || !isUuid(body?.id)) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  const on = body.on !== false;
  const { data: row } = await supabase.from('images').select('id, model, hidden, removed_at, storage_path, public_url').eq('id', body.id).eq('creator_id', creator.id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Only your own creations can be shown in Explore.' }, { status: 404 });
  if (on && (row.model === 'upload' || row.hidden || row.removed_at)) return NextResponse.json({ error: 'This one cannot be shown in Explore.' }, { status: 400 });
  const { error } = await supabase.from('images').update({ featured_at: on ? new Date().toISOString() : null }).eq('id', row.id).eq('creator_id', creator.id);
  if (error) { console.error('Feature:', error.message); return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 }); }
  // A video gets its light copy now, so it plays in its tile from the first visit.
  if (on && /\.mp4$/i.test(row.storage_path || '')) await makePreview(row);
  return NextResponse.json({ ok: true, id: row.id, featured: on });
}
