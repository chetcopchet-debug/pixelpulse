import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/admin';
import { setBalance, balanceEstimate } from '../../../../lib/balance';
import { parseUsd } from '../../../../lib/parseUsd';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// The owner types in the Replicate balance, as Replicate's billing page shows it. Admin only.
// From then on /admin shows an estimate of what is left (lib/balance.js).
// Two ways in, the same result:
//   JSON { usd }                 -> JSON { ok, estimate }            (the form, when the page's code is running)
//   an ordinary form, field usd  -> back to /admin with ?b=ok / bad  (the same form when it is not: it still saves)
// A "$", spaces and a decimal comma are accepted.
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const isForm = /application\/x-www-form-urlencoded|multipart\/form-data/.test(request.headers.get('content-type') || '');
  const back = (q) => NextResponse.redirect(new URL(`/admin?b=${q}#balance`, request.url), 303);
  const typed = isForm ? (await request.formData().catch(() => null))?.get('usd') : (await request.json().catch(() => ({})))?.usd;
  const usd = parseUsd(typed);
  if (usd === null) return isForm ? back('bad') : NextResponse.json({ error: 'Type the balance in dollars, for example 25.' }, { status: 400 });
  try {
    await setBalance(usd);
    const estimate = await balanceEstimate();
    // Read back: what the page will show must be what was typed. If it is not, say so instead of looking saved.
    if (!estimate || Math.abs(estimate.entered - Math.round(usd * 100) / 100) > 0.005) throw new Error(`saved ${usd}, read back ${estimate ? estimate.entered : 'nothing'}`);
    return isForm ? back('ok') : NextResponse.json({ ok: true, estimate });
  } catch (e) {
    console.error('admin balance: could not save', e?.message || e);
    return isForm ? back('fail') : NextResponse.json({ error: 'The balance could not be saved. Try again.' }, { status: 500 });
  }
}
