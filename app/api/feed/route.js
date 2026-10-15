import { NextResponse } from 'next/server';
import { getSupabase, IMAGE_COLUMNS, IMAGE_COLUMNS_LEGACY, isMissingModelColumn } from '../../../lib/supabase';
import { getCreatorId } from '../../../lib/identity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

// GET /api/feed?before=<ISO created_at cursor>&limit=20
export async function GET(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ enabled: false, items: [], nextCursor: null });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || PAGE_SIZE, 10) || PAGE_SIZE, 1), 50);
  const before = searchParams.get('before');

  let hideFilter = true;
  const run = (cols) => {
    let q = supabase.from('images').select(cols).eq('is_public', true)
      .order('created_at', { ascending: false }).limit(limit);
    if (before && !Number.isNaN(Date.parse(before))) q = q.lt('created_at', before);
    if (hideFilter) q = q.eq('hidden', false);
    return q;
  };
  let { data, error } = await run(IMAGE_COLUMNS + ', format, daily_day');
  if (error && /format|daily_day/i.test(error.message || '')) ({ data, error } = await run(IMAGE_COLUMNS));
  if (error && /hidden/i.test(error.message || '')) { hideFilter = false; ({ data, error } = await run(IMAGE_COLUMNS)); }
  if (error && isMissingModelColumn(error)) ({ data, error } = await run(IMAGE_COLUMNS_LEGACY));
  if (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: 'Could not load feed.' }, { status: 500 });
  }

  // Mark which items the current visitor already liked
  let liked = new Set();
  const creator = getCreatorId(request);
  if (!creator.isNew && data.length) {
    const { data: likes } = await supabase.from('image_likes').select('image_id')
      .eq('creator_id', creator.id).in('image_id', data.map((d) => d.id));
    liked = new Set((likes || []).map((l) => l.image_id));
  }

  const items = data.map((d) => ({ ...d, liked: liked.has(d.id) }));
  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;
  return NextResponse.json({ enabled: true, items, nextCursor });
}
