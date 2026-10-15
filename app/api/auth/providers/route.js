import { NextResponse } from 'next/server';
export const revalidate = 300;
// Which OAuth providers are enabled in Supabase Auth (cached 5 min). Feature flag for the Google button.
export async function GET() {
  let google = false;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }, next: { revalidate: 300 } });
    const d = await r.json();
    google = Boolean(d?.external?.google);
  } catch {}
  return NextResponse.json({ google }, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
