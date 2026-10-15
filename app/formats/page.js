import { FORMAT_LIST } from '../../lib/formats';

export const metadata = { title: 'AI image formats — wallpapers, stickers, avatars & more · PixelPulse', alternates: { canonical: '/formats' },
  description: 'Free AI makers for phone wallpapers, transparent stickers, profile avatars, posters and stories.' };

export default function FormatsIndex() {
  const list = FORMAT_LIST.filter((f) => f.id !== 'free');
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px 18px 60px', color: '#f4f4f8', fontFamily: 'system-ui, sans-serif' }}>
      <a href="/" style={{ color: '#e9d5ff', textDecoration: 'none', fontSize: 14 }}>← PixelPulse</a>
      <h1 style={{ fontSize: 28, margin: '14px 0 6px' }}>Formats</h1>
      <p style={{ color: '#a1a1b5', marginTop: 0 }}>Pick a shape made for where your image will live.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginTop: 18 }}>
        {list.map((f) => (
          <a key={f.id} href={`/formats/${f.id}`} style={{ display: 'block', padding: 16, borderRadius: 18, background: '#14141d', border: '1px solid #2a2a3a', color: 'inherit', textDecoration: 'none' }}>
            <div style={{ fontSize: 22 }}>{f.icon}</div><b style={{ display: 'block', margin: '6px 0 4px' }}>{f.label}</b><small style={{ color: '#a1a1b5' }}>{f.blurb}</small>
          </a>
        ))}
      </div>
      <p style={{ marginTop: 26 }}><a href="/" style={{ color: '#ec4899' }}>Open the Studio →</a></p>
    </main>
  );
}
