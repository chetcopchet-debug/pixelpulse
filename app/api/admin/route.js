import { NextResponse } from 'next/server';
import { adminEnabled, checkAdminKey, setAdminCookie, clearAdminCookie } from '../../../lib/admin';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST only. Accepts the hidden /admin form (form-encoded, redirects) or JSON { key }.
export async function POST(request) {
  const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  const back = (q) => NextResponse.redirect(new URL(q, request.url), 303);
  if (!adminEnabled()) return isForm ? back('/admin?e=off') : NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!await rateLimit(`admin:ip:${getClientIp(request)}`, 10, 10 * 60_000)) {
    return isForm ? back('/admin?e=rate') : NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  }
  let key = '', logout = false;
  if (isForm) { const f = await request.formData().catch(() => null); key = String(f?.get('key') || ''); logout = f?.get('logout') === '1'; }
  else { const b = await request.json().catch(() => ({})); key = b?.key; logout = b?.logout === true; }
  if (logout) { const r = isForm ? back('/') : NextResponse.json({ success: true, admin: false }); clearAdminCookie(r); return r; }
  if (!checkAdminKey(key)) return isForm ? back('/admin?e=key') : NextResponse.json({ error: 'Invalid key.' }, { status: 401 });
  const res = isForm ? back('/') : NextResponse.json({ success: true, admin: true });
  setAdminCookie(res);
  return res;
}
