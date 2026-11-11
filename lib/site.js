// Owner-editable site constants.
export const SITE_NAME = 'PixelPulse';
// The one contact address — used by /contact, legal pages, refunds and removals.
export const CONTACT_EMAIL = 'pixelpulse.app.support@gmail.com';
export const LEGAL_UPDATED = 'November 12, 2026';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pixelpulse-omega.vercel.app';

// Where a sign-in link or Google sign-in should come back to: the address the visitor is on, so a preview
// deployment returns to itself and not to the live site. Only our own hosts qualify; anything else gets SITE_URL.
// (Supabase also checks the address against its own "Redirect URLs" list.)
export function returnOrigin(request) {
  try {
    const u = new URL(request.url);
    const host = u.hostname;
    const ours = u.origin === new URL(SITE_URL).origin || host === 'localhost' || (u.protocol === 'https:' && host.endsWith('.vercel.app'));
    return ours ? u.origin : SITE_URL;
  } catch { return SITE_URL; }
}
