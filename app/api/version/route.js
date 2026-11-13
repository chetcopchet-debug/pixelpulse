import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Which build of the site is live right now. A page that has been open for a while asks this to learn that a
// newer build exists, so nobody keeps using (or testing) an old page without knowing.
export async function GET() {
  return NextResponse.json({ build: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7) }, { headers: { 'Cache-Control': 'no-store' } });
}
