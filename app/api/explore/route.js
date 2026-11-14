import { NextResponse, after } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { hasPreview, makePreview } from '../../../lib/videoPreview';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/explore: the pictures and videos chosen for the Explore gallery, newest choice first.
// Only what the site's owner marked with "Show in Explore" is here; nobody else's work is ever listed.
// The same answer is right for everyone, so it may be kept for a minute on the way.
// A video says whether its light copy exists (`preview`): that copy is what plays inside the tile. A video that
// has none yet gets one made after this answer has been sent, one video per request, so the gallery fills in by
// itself within minutes and nobody waits for it.
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.from('images')
    .select('id, prompt, aspect_ratio, public_url, storage_path, model, featured_at, hidden, removed_at')
    .not('featured_at', 'is', null).order('featured_at', { ascending: false }).limit(80);
  if (error) { console.error('Explore:', error.message); return NextResponse.json({ items: [] }); }
  const rows = data.filter((r) => !r.hidden && !r.removed_at && r.public_url);
  const videos = rows.filter((r) => /\.mp4$/i.test(r.storage_path || ''));
  const have = new Map(await Promise.all(videos.map(async (r) => [r.id, await hasPreview(r.public_url)])));
  const missing = videos.find((r) => !have.get(r.id));
  if (missing) after(() => makePreview(missing));
  const items = rows.map((r) => ({ id: r.id, prompt: r.prompt, aspect_ratio: r.aspect_ratio, public_url: r.public_url, model: r.model, created_at: r.featured_at, ...(have.get(r.id) ? { preview: true } : {}) }));
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
