import { FORMAT_LIST, FORMAT_GROUPS } from '../../lib/formats';
import { FORMAT_SEO } from '../../lib/formatsSeo';
import { SITE_URL } from '../../lib/site';

export const metadata = {
  title: { absolute: 'Free AI Image Makers — 30 Formats | PixelPulse' },
  description: 'Free AI makers for logos, YouTube thumbnails, headshots, stickers, wallpapers, tattoos, product photos and more. 10 free credits every day.',
  alternates: { canonical: '/formats' },
};

export default function FormatsIndex() {
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: FORMAT_LIST.filter((f) => f.id !== 'free').map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: FORMAT_SEO[f.id].h1, url: `${SITE_URL}/formats/${f.id}` })) };
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 60px', color: '#f4f4f8', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: 'radial-gradient(900px 420px at 50% -160px,rgba(147,51,234,.22),transparent)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <a href="/" style={{ color: '#e9d5ff', textDecoration: 'none', fontSize: 14 }}>← PixelPulse</a>
      <h1 style={{ fontSize: 30, margin: '14px 0 6px' }}>Free AI image makers</h1>
      <p style={{ color: '#a1a1b5', marginTop: 0, lineHeight: 1.5 }}>Pick a format made for where your image will live. Each one sets the right shape, engine and style for you.</p>
      {Object.entries(FORMAT_GROUPS).map(([g, gl]) => (
        <section key={g}>
          <h2 style={{ fontSize: 15, margin: '26px 0 10px', color: '#d8b4fe' }}>{gl}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
            {FORMAT_LIST.filter((f) => f.group === g).map((f) => (
              <a key={f.id} href={`/formats/${f.id}`} style={{ display: 'block', padding: 14, borderRadius: 18, background: '#14141d', border: '1px solid #2a2a3a', color: 'inherit', textDecoration: 'none' }}>
                <div style={{ fontSize: 20 }}>{f.icon}</div><b style={{ display: 'block', margin: '6px 0 4px', fontSize: 14 }}>{f.label}</b><small style={{ color: '#a1a1b5', fontSize: 12 }}>{f.blurb}</small>
              </a>
            ))}
          </div>
        </section>
      ))}
      <p style={{ marginTop: 28 }}><a href="/" style={{ color: '#ec4899' }}>Open the Studio →</a></p>
    </main>
  );
}
