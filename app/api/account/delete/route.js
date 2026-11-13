import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabase, BUCKET } from '../../../../lib/supabase';
import { readAccount, clearAccountCookie } from '../../../../lib/account';
import { setCreatorCookie } from '../../../../lib/identity';
import { thumbPath, viewPath } from '../../../../lib/thumbs';
import { rateLimit } from '../../../../lib/ratelimit';
import { getClientIp } from '../../../../lib/credits';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

// POST { confirm: "DELETE" }: delete the signed-in account and everything it made.
// Removed: every image and video with its files, favorites, projects, video jobs, the credit balance (bought
// credits are lost), and the sign-in itself. Kept: the bare record of past payments (no email, no name), because
// bookkeeping and refunds need it, and safety records about blocked content.
// Everything is matched on the account's own id, taken from its signed cookie, never from the request body.
export async function POST(request) {
  const acct = readAccount(request);
  if (!acct) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  if (!await rateLimit(`acctdel:${acct.uid}:${getClientIp(request)}`, 3, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const uid = acct.uid;
  const fail = (where, e) => { console.error('Account delete failed at', where, e?.message || e); return NextResponse.json({ error: 'Your account could not be deleted. Nothing was lost. Try again, or contact us.' }, { status: 500 }); };

  // The sign-in record: needed at the end, and proof that this id really is an account.
  const { data: account, error: e0 } = await sb.from('accounts').select('user_id').eq('uid', uid).maybeSingle();
  if (e0) return fail('account', e0);
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // 1. Files, a page at a time, then their rows. Favorites, likes and reports of these images go with the rows.
  for (let page = 0; page < 200; page += 1) {
    const { data: rows, error } = await sb.from('images').select('id, storage_path').eq('creator_id', uid).limit(200);
    if (error) return fail('images', error);
    if (!rows.length) break;
    const paths = rows.flatMap((r) => [r.storage_path, thumbPath(r.storage_path), viewPath(r.storage_path)]).filter(Boolean);
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch((e) => console.error('Account delete, files:', e?.message || e));
    const { error: del } = await sb.from('images').delete().eq('creator_id', uid).in('id', rows.map((r) => r.id));
    if (del) return fail('image rows', del);
  }
  // 2. Everything else that carries this id.
  for (const [table, col] of [['favorites', 'uid'], ['image_likes', 'creator_id'], ['video_jobs', 'uid'], ['projects', 'creator_id'], ['daily_streaks', 'uid'], ['referral_codes', 'uid'], ['paid_credits', 'uid']]) {
    const { error } = await sb.from(table).delete().eq(col, uid);
    if (error && !/does not exist|schema cache|PGRST205|42P01/i.test(`${error.message} ${error.code}`)) return fail(table, error);
  }
  // 3. Past payments stay, without the hash of the email address.
  await sb.from('payment_events').update({ email_hash: null }).eq('uid', uid).then(() => {}, () => {});
  // 4. The account and its sign-in.
  const { error: e1 } = await sb.from('accounts').delete().eq('uid', uid);
  if (e1) return fail('account row', e1);
  if (account.user_id) {
    const { error: e2 } = await sb.auth.admin.deleteUser(account.user_id);
    if (e2 && !/not found/i.test(e2.message || '')) console.error('Account delete, sign-in record:', e2.message);
  }
  console.log('An account was deleted at its owner\'s request.');
  const res = NextResponse.json({ ok: true });
  clearAccountCookie(res);
  setCreatorCookie(res, { id: crypto.randomUUID(), isNew: true });
  return res;
}
