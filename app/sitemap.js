import { FORMAT_LIST } from '../lib/formats';
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pixelpulse-omega.vercel.app';
export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();
  const entries = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/refund-policy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/content-policy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  entries.push({ url: `${BASE}/formats`, changeFrequency: 'weekly', priority: 0.6 });
  for (const f of FORMAT_LIST) if (f.id !== 'free') entries.push({ url: `${BASE}/formats/${f.id}`, changeFrequency: 'weekly', priority: 0.7 });
  return entries;
}
