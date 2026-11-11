import { FORMAT_LIST, FORMAT_GROUPS } from '../../lib/formats';
import { FORMAT_SEO } from '../../lib/formatsSeo';
import { SITE_URL } from '../../lib/site';
import Page from '../studio/Page';

export const metadata = {
  title: { absolute: 'Free AI Image Makers — 30 Formats | PixelPulse' },
  description: 'Free AI makers for logos, YouTube thumbnails, headshots, stickers, wallpapers, tattoos, product photos and more. Sign up and get 10 free credits every day.',
  alternates: { canonical: '/formats' },
};

export default function FormatsIndex() {
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: FORMAT_LIST.filter((f) => f.id !== 'free').map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: FORMAT_SEO[f.id].h1, url: `${SITE_URL}/formats/${f.id}` })) };
  return (
    <Page wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <h1>Free AI image makers</h1>
      <p className="lead">Pick a format made for where your image will live. Each one sets the right shape and model for you.</p>
      {Object.entries(FORMAT_GROUPS).map(([g, gl]) => (
        <section key={g}>
          <h2 className="sec">{gl}</h2>
          <div className="tiles">
            {FORMAT_LIST.filter((f) => f.group === g).map((f) => (
              <a key={f.id} href={`/formats/${f.id}`}><span className="b">{f.label}</span><span className="sm t2">{f.blurb}</span></a>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
