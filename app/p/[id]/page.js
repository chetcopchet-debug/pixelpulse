import { notFound } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { isUuid } from '../../../lib/identity';
import CardActions from './CardActions';
import { FORMATS } from '../../../lib/formats';
import Page from '../../studio/Page';
import { madeWith } from '../../studio/models';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function getImage(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const sel = (cols) => supabase.from('images').select(cols).eq('id', id).eq('is_public', true).maybeSingle();
  let { data, error } = await sel('id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, model');
  if (error && /model/i.test(error.message || '')) ({ data, error } = await sel('id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of'));
  if (error) { console.error('Shared image error:', error); return null; }
  if (data) {
    const { data: h, error: he } = await supabase.from('images').select('hidden').eq('id', id).maybeSingle();
    if (!he && h?.hidden) return null;
    const { data: x, error: xe } = await supabase.from('images').select('format').eq('id', id).maybeSingle();
    if (!xe && x) Object.assign(data, x);
  }
  return data;
}

const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function generateMetadata(props) {
  const params = await props.params;
  const img = await getImage(params.id);
  if (!img) return { title: 'Not found · PixelPulse' };
  const title = `${short(img.prompt, 70)} · PixelPulse`;
  const description = `Made with PixelPulse${img.style ? ` in ${img.style} style` : ''}. Start from this idea and make your own.`;
  return {
    title, description,
    alternates: { canonical: `/p/${img.id}` },
    openGraph: { title, description, type: 'article', siteName: 'PixelPulse', images: [{ url: img.public_url, alt: short(img.prompt, 120) }] },
    twitter: { card: 'summary_large_image', title, description, images: [img.public_url] },
  };
}

export default async function SharedImage(props) {
  const params = await props.params;
  const img = await getImage(params.id);
  if (!img) notFound();
  const ratio = (img.aspect_ratio || '1:1').replace(':', ' / ');
  const fmt = img.format && FORMATS[img.format];
  return (
    <Page>
      <div className="shot" style={{ aspectRatio: ratio, maxHeight: '76vh', marginTop: 8 }}>
        {/\.mp4(\?|$)/i.test(img.public_url) ? <video src={img.public_url} controls loop playsInline style={{ width: '100%', height: '100%' }} /> : <img src={img.public_url} alt={img.prompt} />}
      </div>
      <p style={{ fontSize: 16, lineHeight: '24px', margin: '16px 0 10px', overflowWrap: 'anywhere' }}>{img.prompt}</p>
      <div className="tags links" style={{ marginBottom: 16 }}>
        {img.model && <span className="tag">{madeWith(img.model)}</span>}
        {fmt && fmt.id !== 'free' && <a className="tag" href={`/formats/${fmt.id}`}>{fmt.label}</a>}
        <span className="tag num">{img.aspect_ratio || '1:1'}</span>
        {img.remix_of && <a className="tag" href={`/p/${img.remix_of}`}>Based on another image</a>}
      </div>
      <CardActions format={img.format} id={img.id} prompt={img.prompt} ratio={img.aspect_ratio} tier={img.model} />
    </Page>
  );
}
