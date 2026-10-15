import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { clearAccountCookie } from '../../../../lib/account';
import { setCreatorCookie } from '../../../../lib/identity';
export const dynamic = 'force-dynamic';
// Signing out detaches this device from the account: it gets a fresh anonymous identity.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAccountCookie(res);
  setCreatorCookie(res, { id: crypto.randomUUID(), isNew: true });
  return res;
}
