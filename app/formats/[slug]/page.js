import { notFound } from 'next/navigation';
import { FORMATS, FORMAT_LIST, FORMAT_GROUPS, isFormat } from '../../../lib/formats';
import { FORMAT_SEO } from '../../../lib/formatsSeo';
import { SITE_URL } from '../../../lib/site';
import Page from '../../studio/Page';

export function generateStaticParams() { return FORMAT_LIST.filter((f) => f.id !== 'free').map((f) => ({ slug: f.id })); }

export async function generateMetadata(props) {
  const params = await props.params;
  const f = isFormat(params.slug) && params.slug !== 'free' ? FORMATS[params.slug] : null;
  if (!f) return { title: 'Not found · PixelPulse' };
  const m = FORMAT_SEO[f.id];
  return { title: { absolute: m.title }, description: m.seo, alternates: { canonical: `/formats/${f.id}` },
    openGraph: { title: m.title, description: m.seo, url: `/formats/${f.id}`, type: 'website' }, twitter: { card: 'summary_large_image', title: m.title, description: m.seo } };
}

export default async function FormatPage(props) {
  const params = await props.params;
  const f = isFormat(params.slug) && params.slug !== 'free' ? FORMATS[params.slug] : null;
  if (!f) notFound();
  const m = FORMAT_SEO[f.id];
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
      <a className="btn btn-p btn-wide" style={{ marginTop: 20, height: 52 }} href={go()}>Create {/^[aeiou]/i.test(f.label) ? 'an' : 'a'} {f.label.toLowerCase()}</a>
      <p className="sm t2" style={{ marginTop: 10 }}>Sign up and get 10 free credits every day.</p>
      <ul className="tags" style={{ listStyle: 'none', marginTop: 14 }}><li className="tag">{f.ratio} frame</li><li className="tag">{f.blurb}</li>{f.autoCutout && <li className="tag">Transparent PNG</li>}</ul>

      <h2 className="sec">Try one of these</h2>
      <div className="rows">{m.examples.map((p) => <a key={p} href={go(p)}><span>{p}</span><span className="t3" aria-hidden="true">›</span></a>)}</div>

      <h2 className="sec">Questions</h2>
      <div className="faq">{m.faq.map((x) => <details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}</div>

      <h2 className="sec">Related formats</h2>
      <nav className="tags" aria-label="Related formats">{related.map((o) => <a key={o.id} className="tag" href={`/formats/${o.id}`}>{o.label}</a>)}<a className="tag" href="/formats">All formats</a></nav>
    </Page>
  );
}
