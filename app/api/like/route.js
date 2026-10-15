import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

import { isAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Community feed is not available yet.' }, { status: 503 });

  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!isAdmin(request) && (!await rateLimit(`like:ip:${ip}`, 30, 60_000) || !await rateLimit(`like:uid:${creator.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many likes. Slow down a bit.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });

  const { data, error } = await supabase.rpc('like_image', { p_image: body.id, p_creator: creator.id });
  if (error) {
    console.error('Like error:', error);
    return NextResponse.json({ error: 'Could not like. Please try again.' }, { status: 500 });
  }

  let likes = data;
  const alreadyLiked = data === null;
  if (alreadyLiked) {
    const { data: row } = await supabase.from('images').select('likes').eq('id', body.id).eq('is_public', true).maybeSingle();
    if (!row) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    likes = row.likes;
  }
  const res = NextResponse.json({ success: true, likes, liked: true, alreadyLiked });
  setCreatorCookie(res, creator);
  return res;
}
