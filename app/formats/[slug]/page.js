import { notFound } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { FORMATS, FORMAT_LIST, FORMAT_GROUPS, isFormat } from '../../../lib/formats';
import { FORMAT_SEO } from '../../../lib/formatsSeo';
import { SITE_URL } from '../../../lib/site';
import Thumb from '../../Thumb';

export const revalidate = 600;
export function generateStaticParams() { return FORMAT_LIST.filter((f) => f.id !== 'free').map((f) => ({ slug: f.id })); }

export async function generateMetadata(props) {
  const params = await props.params;
  const f = isFormat(params.slug) && params.slug !== 'free' ? FORMATS[params.slug] : null;
  if (!f) return { title: 'Not found · PixelPulse' };
  const m = FORMAT_SEO[f.id];
  return { title: { absolute: m.title }, description: m.seo, alternates: { canonical: `/formats/${f.id}` },
    openGraph: { title: m.title, description: m.seo, url: `/formats/${f.id}`, type: 'website' }, twitter: { card: 'summary_large_image', title: m.title, description: m.seo } };
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
  const m = FORMAT_SEO[f.id];
  const items = await examples(f);
  const shape = f.id === 'avatar' || f.id === 'anime-avatar' ? 'fp-circle' : f.ratio === '9:16' ? 'fp-tall' : f.ratio === '16:9' ? 'fp-wide' : 'fp-sq';
  const related = FORMAT_LIST.filter((o) => o.group === f.group && o.id !== f.id);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: `PixelPulse ${m.h1}`, url: `${SITE_URL}/formats/${f.id}`, applicationCategory: 'DesignApplication', operatingSystem: 'Any (web)', description: m.seo, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: m.faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Formats', item: `${SITE_URL}/formats` }, { '@type': 'ListItem', position: 2, name: f.label, item: `${SITE_URL}/formats/${f.id}` }] },
  ];
  const go = (p) => `/?format=${f.id}${p ? `&vibe=1&p=${encodeURIComponent(p)}` : ''}`;
  return (
    <div className="fp-root">
      <style>{CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <a href="/" className="fp-brand"><span className="fp-logo"><i /></span><b>PixelPulse</b></a>
      <main>
        <nav className="fp-crumbs"><a href="/formats">Formats</a> › <span>{f.label}</span></nav>
        <span className="fp-kicker">{f.icon} {FORMAT_GROUPS[f.group]}</span>
        <h1>{m.h1}</h1>
        <p className="fp-lead">{m.intro}</p>
        <a className="fp-go" href={go()}>✦ Create {/^[aeiou]/i.test(f.label) ? 'an' : 'a'} {f.label.toLowerCase()} — free</a>
        <ul className="fp-facts"><li>{f.ratio} frame</li><li>{f.blurb}</li>{f.autoCutout && <li>Transparent PNG</li>}</ul>
        <h2>Try one of these</h2>
        <div className="fp-ex">{m.examples.map((p) => <a key={p} href={go(p)}>✦ {p}</a>)}</div>
        {items.length > 0 && <h2>From the Pulse Feed</h2>}
        <div className="fp-grid">
          {items.map((x) => (
            <a key={x.id} href={`/p/${x.id}`} className={shape}><Thumb src={x.public_url} ratio={f.ratio || "1:1"} alt={x.prompt} /></a>
          ))}
        </div>
        <h2>Questions</h2>
        <div className="fp-faq">{m.faq.map((x) => <details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}</div>
        <h2>Related formats</h2>
        <nav className="fp-others">{related.map((o) => <a key={o.id} href={`/formats/${o.id}`}>{o.icon} {o.label}</a>)}<a href="/formats">All formats →</a></nav>
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
.fp-wide{aspect-ratio:16/9;border-radius:16px}
.fp-crumbs{font-size:12px;color:#8a8aa3;margin-bottom:10px}.fp-crumbs a{color:#c4b5fd;text-decoration:none}
.fp-ex{display:flex;flex-direction:column;gap:8px}
.fp-ex a{padding:12px 14px;border-radius:16px;background:#151520;border:1px solid #2a2a40;color:#e9e7f5;text-decoration:none;font-size:14px}
.fp-faq details{border-bottom:1px solid #22223a;padding:12px 2px}
.fp-faq summary{cursor:pointer;font-weight:700;font-size:14px}
.fp-faq p{color:#b9b7cc;line-height:1.55;font-size:14px;margin:8px 0 0}
h2{margin-top:26px!important}
.fp-others{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}
.fp-others a{padding:9px 14px;border-radius:999px;border:1px solid #2a2a40;background:#151520;color:#e9e7f5;text-decoration:none;font-size:13px}
`;
