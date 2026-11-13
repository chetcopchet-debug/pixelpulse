const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://yelvoai.com';
export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/me', '/admin'] }], sitemap: `${BASE}/sitemap.xml`, host: BASE };
}
