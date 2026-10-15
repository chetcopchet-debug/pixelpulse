import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

import { isAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Community feed is not available yet.' }, { status: 503 });

  const creator = getCreatorId(request);
  if (creator.isNew) return NextResponse.json({ error: 'You can only publish your own images.' }, { status: 403 });

  const ip = getClientIp(request);
  if (!isAdmin(request) && (!rateLimit(`pub:ip:${ip}`, 10, 60_000) || !rateLimit(`pub:uid:${creator.id}`, 30, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });
  const makePublic = body.public !== false;
  if (makePublic) {
    const { data: row } = await supabase.from('images').select('model').eq('id', body.id).eq('creator_id', creator.id).maybeSingle();
    if (row?.model === 'upload') return NextResponse.json({ error: 'Uploaded photos (and edits of them) stay private and cannot be published to the feed.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('images')
    .update({ is_public: makePublic })
    .eq('id', body.id)
    .eq('creator_id', creator.id)
    .select('id, is_public')
    .maybeSingle();

  if (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: 'Could not publish. Please try again.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Image not found or not yours.' }, { status: 404 });
  return NextResponse.json({ success: true, id: data.id, isPublic: data.is_public });
}
