import { NextResponse } from 'next/server';
import { getSupabase, IMAGE_COLUMNS } from '../../../lib/supabase';
import { getCreatorId } from '../../../lib/identity';
import { withErrorLog } from '../../../lib/monitor';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

// GET /api/feed?before=<ISO created_at cursor>&limit=20
async function GETHandler(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ enabled: false, items: [], nextCursor: null });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || PAGE_SIZE, 10) || PAGE_SIZE, 1), 50);
  const before = searchParams.get('before');

  const run = (cols) => {
    let q = supabase.from('images').select(cols).eq('is_public', true)
      .order('created_at', { ascending: false }).limit(limit);
    if (before && !Number.isNaN(Date.parse(before))) q = q.lt('created_at', before);
    q = q.eq('hidden', false);
    return q;
  };
  // All migrations (002-004) are installed; no legacy fallbacks (the old one could show hidden items on a DB error).
  const { data, error } = await run(IMAGE_COLUMNS + ', format, daily_day');
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

export const GET = withErrorLog('/api/feed', GETHandler);
