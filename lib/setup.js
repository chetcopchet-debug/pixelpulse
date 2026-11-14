// What this deployment has been given to work with. Shown on /admin so a missing setting is visible
// from a phone, without reading build logs. Only names and yes/no are reported, never values.
import { provider } from './pay/index.js';
const has = (k) => Boolean(process.env[k]);
const all = (...keys) => keys.every(has);

// Is Google sign-in switched on in Supabase Auth? (cached for two minutes)
export async function googleEnabled() {
  if (!all('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')) return false;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }, next: { revalidate: 120 } });
    const d = await r.json();
    return Boolean(d?.external?.google);
  } catch { return false; }
}

export function setupChecks() {
  const pay = provider()?.needs || []; // what the payment company in use requires (lib/pay)
  const missing = (keys) => keys.filter((k) => !has(k));
  return [
    { name: 'Admin key', ok: has('ADMIN_KEY'), missing: missing(['ADMIN_KEY']), why: 'Opens this page.' },
    { name: 'Database', ok: all('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'), missing: missing(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']), why: 'Saves images, accounts and credits. Without it nobody can sign in and nothing is saved.' },
    { name: 'Image and video models', ok: has('REPLICATE_API_TOKEN'), missing: missing(['REPLICATE_API_TOKEN']), why: 'Without it nothing can be generated.' },
    { name: 'Signing secret', ok: has('CREDITS_SECRET') || has('ADMIN_KEY'), missing: has('CREDITS_SECRET') || has('ADMIN_KEY') ? [] : ['CREDITS_SECRET'], why: 'Keeps people signed in. The admin key is used when no separate secret is set.' },
    { name: 'Payments', ok: all(...pay), missing: missing(pay), why: 'Needed only to sell credits.', optional: true },
  ];
}
export const deploymentKind = () => process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
