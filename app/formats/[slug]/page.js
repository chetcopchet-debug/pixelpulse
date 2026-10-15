import { notFound } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { FORMATS, FORMAT_LIST, isFormat } from '../../../lib/formats';
import Thumb from '../../Thumb';

export const revalidate = 600;
export function generateStaticParams() { return FORMAT_LIST.filter((f) => f.id !== 'free').map((f) => ({ slug: f.id })); }

export async function generateMetadata(props) {
  const params = await props.params;
  const f = isFormat(params.slug) && params.slug !== 'free' ? FORMATS[params.slug] : null;
  if (!f) return { title: 'Not found · PixelPulse' };
  const title = `AI ${f.label} maker — free · PixelPulse`;
  return { title, description: f.seo, alternates: { canonical: `/formats/${f.id}` }, openGraph: { title, description: f.seo, url: `/formats/${f.id}` } };
}

async function examples(f) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const cols = 'id, prompt, public_url, aspect_ratio';
  let { data, error } = await supabase.from('images').select(cols).eq('is_public', true).eq('hidden', false).eq('format', f.id).order('likes', { ascending: false }).limit(12);
  if (error || !data || data.length < 3) {
    // Before migration 004 (or few tagged images): show public images with the same shape
    const r = await supabase.from('images').select(cols).eq('is_public', true).eq('hidden', false).eq('aspect_ratio', f.ratio || '1:1').neq('model', 'upload').order('likes', { ascending: false }).limit(12);
    if (!r.error) data = [...(error ? [] : data || []), ...(r.data || [])].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 12);
  }
  return data || [];
}

export default async function FormatPage(props) {
  const params = await props.params;
  const f = isFormat(params.slug) && params.slug !== 'free' ? FORMATS[params.slug] : null;
  if (!f) notFound();
  const items = await examples(f);
  const shape = f.id === 'avatar' ? 'fp-circle' : f.ratio === '9:16' ? 'fp-tall' : 'fp-sq';
  return (
    <div className="fp-root">
      <style>{CSS}</style>
      <a href="/" className="fp-brand"><span className="fp-logo"><i /></span><b>PixelPulse</b></a>
      <main>
        <span className="fp-kicker">{f.icon} Pulse Format</span>
        <h1>AI {f.label} maker</h1>
        <p className="fp-lead">{f.seo}</p>
        <a className="fp-go" href={`/?format=${f.id}`}>✦ Create a {f.label.toLowerCase()} — free</a>
        <ul className="fp-facts"><li>{f.ratio} frame</li><li>{f.blurb}</li>{f.autoCutout && <li>Transparent PNG</li>}</ul>
        {items.length > 0 && <h2>From the Pulse Feed</h2>}
        <div className="fp-grid">
          {items.map((x) => (
            <a key={x.id} href={`/p/${x.id}`} className={shape}><Thumb src={x.public_url} ratio={f.ratio || "1:1"} alt={x.prompt} /></a>
          ))}
        </div>
        <nav className="fp-others">{FORMAT_LIST.filter((o) => o.id !== 'free' && o.id !== f.id).map((o) => <a key={o.id} href={`/formats/${o.id}`}>{o.icon} {o.label}</a>)}</nav>
      </main>
    </div>
  );
}

const CSS = `
body{margin:0;background:#07070a}
.fp-root{min-height:100vh;background:radial-gradient(900px 420px at 50% -160px,rgba(147,51,234,.22),transparent),#07070a;color:#e9e7f5;font-family:system-ui,-apple-system,sans-serif;padding:16px 16px 48px;box-sizing:border-box}
.fp-root *{box-sizing:border-box}
.fp-root main{max-width:760px;margin:0 auto}
.fp-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-size:18px;margin-bottom:22px}
.fp-brand b{background:linear-gradient(90deg,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.fp-logo{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#9333ea,#ec4899);display:grid;place-items:center;box-shadow:0 0 16px rgba(147,51,234,.55)}
.fp-logo i{width:9px;height:9px;border-radius:50%;background:#fff}
.fp-kicker{display:inline-block;padding:5px 12px;border-radius:999px;border:1px solid rgba(236,72,153,.5);font-size:12px;color:#f0abfc}
h1{font-size:32px;margin:12px 0 8px;letter-spacing:-.02em}
.fp-lead{color:#b9b7cc;line-height:1.55;margin:0 0 18px}
.fp-go{display:flex;justify-content:center;padding:15px;border-radius:999px;background:linear-gradient(90deg,#9333ea,#ec4899);color:#fff;font-weight:800;text-decoration:none;box-shadow:0 8px 26px rgba(236,72,153,.35)}
.fp-facts{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:14px 0 22px}
.fp-facts li{padding:6px 12px;border-radius:999px;background:#151520;border:1px solid #2a2a40;font-size:12px;color:#cfcde0}
h2{font-size:16px;margin:8px 0 12px}
.fp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.fp-grid a{display:block;overflow:hidden;background:#101018}
.fp-grid img{width:100%;height:100%;object-fit:cover;display:block}
.fp-sq{aspect-ratio:1;border-radius:16px}.fp-tall{aspect-ratio:9/16;border-radius:16px}.fp-circle{aspect-ratio:1;border-radius:50%}
.fp-others{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}
.fp-others a{padding:9px 14px;border-radius:999px;border:1px solid #2a2a40;background:#151520;color:#e9e7f5;text-decoration:none;font-size:13px}
`;
