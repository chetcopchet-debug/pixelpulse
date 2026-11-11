import { NextResponse } from 'next/server';
import { googleEnabled } from '../../../../lib/setup';
// Asked on every visit, never frozen at build time: a deployment built before its settings were complete
// must not keep hiding the Google button.
export const dynamic = 'force-dynamic';
// Which sign-in buttons to show. Google appears when it is switched on in Supabase Auth.
export async function GET() {
  return NextResponse.json({ google: await googleEnabled() }, { headers: { 'Cache-Control': 'public, s-maxage=120' } });
}
