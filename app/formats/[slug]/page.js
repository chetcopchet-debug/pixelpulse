import { notFound } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { FORMATS, FORMAT_LIST, FORMAT_GROUPS, isFormat } from '../../../lib/formats';
import { FORMAT_SEO } from '../../../lib/formatsSeo';
import { SITE_URL } from '../../../lib/site';
import Thumb from '../../Thumb';
import Page from '../../studio/Page';

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
  const shape = f.id === 'avatar' || f.id === 'anime-avatar' ? 'circle' : f.ratio === '9:16' ? 'tall' : f.ratio === '16:9' ? 'wide' : 'square';
  const related = FORMAT_LIST.filter((o) => o.group === f.group && o.id !== f.id);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: `PixelPulse ${m.h1}`, url: `${SITE_URL}/formats/${f.id}`, applicationCategory: 'DesignApplication', operatingSystem: 'Any (web)', description: m.seo, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: m.faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Formats', item: `${SITE_URL}/formats` }, { '@type': 'ListItem', position: 2, name: f.label, item: `${SITE_URL}/formats/${f.id}` }] },
  ];
  const go = (p) => `/?format=${f.id}${p ? `&vibe=1&p=${encodeURIComponent(p)}` : ''}`;
  return (
    <Page>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <nav className="sm t3 r" style={{ gap: 6, minHeight: 44 }} aria-label="Breadcrumb"><a className="link r" style={{ minHeight: 44 }} href="/formats">Formats</a><span aria-hidden="true">/</span><span>{f.label}</span></nav>
      <h1 style={{ marginTop: 4 }}>{m.h1}</h1>
      <p className="lead">{m.intro}</p>
      <a className="btn btn-p btn-wide" style={{ marginTop: 20, height: 52 }} href={go()}>Create {/^[aeiou]/i.test(f.label) ? 'an' : 'a'} {f.label.toLowerCase()}, free to try</a>
      <ul className="tags" style={{ listStyle: 'none', marginTop: 14 }}><li className="tag">{f.ratio} frame</li><li className="tag">{f.blurb}</li>{f.autoCutout && <li className="tag">Transparent PNG</li>}</ul>

      <h2 className="sec">Try one of these</h2>
      <div className="rows">{m.examples.map((p) => <a key={p} href={go(p)}><span>{p}</span><span className="t3" aria-hidden="true">›</span></a>)}</div>

      {items.length > 0 && <h2 className="sec">Made on PixelPulse</h2>}
      <div className="grid3" style={{ gap: 6 }}>
        {items.map((x) => (
          <a key={x.id} href={`/p/${x.id}`} className="tile" style={{ aspectRatio: shape === 'tall' ? '9 / 16' : shape === 'wide' ? '16 / 9' : '1', borderRadius: shape === 'circle' ? '50%' : 8 }}><Thumb src={x.public_url} ratio={f.ratio || "1:1"} alt={x.prompt} /></a>
        ))}
      </div>

      <h2 className="sec">Questions</h2>
      <div className="faq">{m.faq.map((x) => <details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}</div>

      <h2 className="sec">Related formats</h2>
      <nav className="tags" aria-label="Related formats">{related.map((o) => <a key={o.id} className="tag" href={`/formats/${o.id}`}>{o.label}</a>)}<a className="tag" href="/formats">All formats</a></nav>
    </Page>
  );
}
