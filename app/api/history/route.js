import { NextResponse } from 'next/server';
import { getSupabase, isMissingModelColumn } from '../../../lib/supabase';
import { getCreatorId } from '../../../lib/identity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ enabled: false, items: [] });

  const creator = getCreatorId(request);
  if (creator.isNew) return NextResponse.json({ enabled: true, items: [] });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10) || 24, 1), 50);

  const run = (cols) => supabase.from('images').select(cols)
    .eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(limit);
  const base = 'id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, is_public';
  let { data, error } = await run(base + ', model');
  if (error && isMissingModelColumn(error)) ({ data, error } = await run(base));
  if (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'Could not load history.' }, { status: 500 });
  }
  return NextResponse.json({ enabled: true, items: data });
}
