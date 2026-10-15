import { notFound } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { isUuid } from '../../../lib/identity';
import CardActions from './CardActions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TIER_LABEL = { fast: '⚡ Fast', quality: '💎 Quality', text: '🔤 Text' };

async function getImage(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const sel = (cols) => supabase.from('images').select(cols).eq('id', id).eq('is_public', true).maybeSingle();
  let { data, error } = await sel('id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, model');
  if (error && /model/i.test(error.message || '')) ({ data, error } = await sel('id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of'));
  if (error) { console.error('Pulse Card error:', error); return null; }
  if (data) {
    const { data: h, error: he } = await supabase.from('images').select('hidden').eq('id', id).maybeSingle();
    if (!he && h?.hidden) return null;
  }
  return data;
}

const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function generateMetadata({ params }) {
  const img = await getImage(params.id);
  if (!img) return { title: 'Not found · PixelPulse' };
  const title = `${short(img.prompt, 70)} · PixelPulse`;
  const description = `Made with PixelPulse${img.style ? ` in ${img.style} style` : ''}. Pulse this vibe and make your own.`;
  return {
    title, description,
    alternates: { canonical: `/p/${img.id}` },
    openGraph: { title, description, type: 'article', siteName: 'PixelPulse', images: [{ url: img.public_url, alt: short(img.prompt, 120) }] },
    twitter: { card: 'summary_large_image', title, description, images: [img.public_url] },
  };
}

export default async function PulseCard({ params }) {
  const img = await getImage(params.id);
  if (!img) notFound();
  const ratio = (img.aspect_ratio || '1:1').replace(':', ' / ');
  return (
    <div className="pc-root">
      <style>{CSS}</style>
      <a href="/" className="pc-brand"><span className="pc-logo"><i /></span><b>PixelPulse</b></a>
      <main className="pc-main">
        <div className="pc-frame" style={{ aspectRatio: ratio }}>
          <img src={img.public_url} alt={img.prompt} />
        </div>
        <p className="pc-prompt">“{img.prompt}”</p>
        <div className="pc-meta">
          {img.model && TIER_LABEL[img.model] && <span>{TIER_LABEL[img.model]}</span>}
          {img.style && <span>{img.style}</span>}
          <span>{img.aspect_ratio || '1:1'}</span>
          <span>♥ {img.likes || 0}</span>
          {img.remix_of && <a href={`/p/${img.remix_of}`}>↺ Remix of</a>}
        </div>
        <CardActions id={img.id} prompt={img.prompt} style={img.style} ratio={img.aspect_ratio} tier={img.model} url={img.public_url} />
      </main>
    </div>
  );
}

const CSS = `
body{margin:0;background:#07070a}
.pc-root{min-height:100vh;background:radial-gradient(900px 420px at 50% -160px,rgba(236,72,153,.18),transparent),#07070a;color:#e9e7f5;font-family:system-ui,-apple-system,sans-serif;padding:16px 14px 40px;box-sizing:border-box}
.pc-root *{box-sizing:border-box}
.pc-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-size:18px;margin-bottom:14px}
.pc-brand b{background:linear-gradient(90deg,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pc-logo{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#9333ea,#ec4899);display:grid;place-items:center;position:relative;box-shadow:0 0 16px rgba(147,51,234,.55)}
.pc-logo i{width:9px;height:9px;border-radius:50%;background:#fff}
.pc-logo::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(236,72,153,.7);animation:pcRing 2.8s ease-out infinite}
.pc-main{max-width:620px;margin:0 auto}
.pc-frame{width:100%;max-height:78vh;border-radius:28px;overflow:hidden;background:#101018;border:1px solid #1f1f2e;box-shadow:0 0 0 1px rgba(168,85,247,.25),0 20px 60px rgba(147,51,234,.25)}
.pc-frame img{width:100%;height:100%;object-fit:contain;display:block;animation:pcReveal .7s ease}
.pc-prompt{font-size:15px;line-height:1.5;margin:16px 4px 10px}
.pc-meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 2px 16px}
.pc-meta span,.pc-meta a{padding:5px 11px;border-radius:999px;background:#151520;border:1px solid #2a2a40;font-size:12px;color:#cfcde0;text-decoration:none}
.pc-actions{display:flex;flex-wrap:wrap;gap:8px}
.pc-btn{display:inline-flex;align-items:center;gap:6px;padding:11px 16px;border-radius:999px;border:1px solid #2a2a40;background:#151520;color:#e9e7f5;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;font-family:inherit}
.pc-btn:active{transform:scale(.94)}
.pc-go{background:linear-gradient(90deg,#9333ea,#ec4899);border-color:transparent;color:#fff;box-shadow:0 6px 22px rgba(236,72,153,.35);flex:1 1 100%;justify-content:center;animation:pcBreathe 3s ease-in-out infinite}
.pc-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#1d1830;border:1px solid rgba(236,72,153,.5);padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600}
@keyframes pcRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.7);opacity:0}}
@keyframes pcReveal{from{opacity:0;filter:blur(14px)}to{opacity:1;filter:none}}
@keyframes pcBreathe{50%{box-shadow:0 6px 32px rgba(168,85,247,.6)}}
@media (min-width:640px){.pc-go{flex:0 0 auto}}
@media (prefers-reduced-motion:reduce){.pc-root *{animation:none!important}}
`;
