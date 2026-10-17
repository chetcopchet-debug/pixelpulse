import { NextResponse } from 'next/server';
import { readAccount } from '../../../lib/account';
import { codeFor, inviteCount, linkFor, REF_BONUS } from '../../../lib/referral';
import { withErrorLog } from '../../../lib/monitor';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
// { enabled, signedIn, link?, invites?, bonus }
async function GETHandler(request) {
  const acct = readAccount(request);
  if (!acct) return NextResponse.json({ enabled: true, signedIn: false, bonus: REF_BONUS });
  const code = await codeFor(acct.uid, request);
  if (!code) return NextResponse.json({ enabled: false, signedIn: true, bonus: REF_BONUS });
  return NextResponse.json({ enabled: true, signedIn: true, link: linkFor(code), invites: await inviteCount(acct.uid), bonus: REF_BONUS });
}

export const GET = withErrorLog('/api/referral', GETHandler);
