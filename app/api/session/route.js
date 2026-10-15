import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { readUidCookie, setCreatorCookie } from '../../../lib/identity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Called once on page load. Upgrades a legacy unsigned pp_uid to a signed cookie by
// re-assigning that uid's rows to a fresh random uid. Works once per old uid: afterwards the old uid owns nothing.
// Trade-off (documented): whoever presents a legacy uid first after deploy claims it. Old uids were public
// in feed URLs until /api/admin/rekey ran, so upgrades are only accepted until LEGACY_UNTIL.
const LEGACY_UNTIL = Date.parse('2026-11-15T00:00:00Z');

export async function POST(request) {
  const c = readUidCookie(request);
  if (!c) return NextResponse.json({ ok: true, state: 'none' });
  if (c.signed) return NextResponse.json({ ok: true, state: 'signed' });
  const res = NextResponse.json({ ok: true, state: 'upgraded' });
  const fresh = { id: crypto.randomUUID(), isNew: true };
  const supabase = getSupabase();
  if (supabase && Date.now() < LEGACY_UNTIL) {
    const { error: e1 } = await supabase.from('images').update({ creator_id: fresh.id }).eq('creator_id', c.id);
    const { error: e2 } = await supabase.from('image_likes').update({ creator_id: fresh.id }).eq('creator_id', c.id);
    if (e1 || e2) {
      console.error('Legacy upgrade failed:', e1 || e2);
      return NextResponse.json({ ok: false, error: 'Could not upgrade session, try again.' }, { status: 500 });
    }
  }
  setCreatorCookie(res, fresh);
  return res;
}
