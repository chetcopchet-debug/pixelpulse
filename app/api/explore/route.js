import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/explore: the pictures and videos chosen for the Explore gallery, newest choice first.
// Only what the site's owner marked with "Show in Explore" is here; nobody else's work is ever listed.
// The same answer is right for everyone, so it may be kept for a minute on the way.
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.from('images')
    .select('id, prompt, aspect_ratio, public_url, model, featured_at, hidden, removed_at')
    .not('featured_at', 'is', null).order('featured_at', { ascending: false }).limit(80);
  if (error) { console.error('Explore:', error.message); return NextResponse.json({ items: [] }); }
  const items = data.filter((r) => !r.hidden && !r.removed_at && r.public_url)
    .map((r) => ({ id: r.id, prompt: r.prompt, aspect_ratio: r.aspect_ratio, public_url: r.public_url, model: r.model, created_at: r.featured_at }));
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
