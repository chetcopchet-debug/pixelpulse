import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

// Display and text faces of the studio. Self-hosted by Next at build time (no request to Google from the browser).
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['700'], variable: '--font-display', display: 'swap' });
const text = Instrument_Sans({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-text', display: 'swap' });

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pixelpulse-omega.vercel.app';
const DESC = 'The best AI image and video models in one place, with one credit wallet. Veo, Kling, FLUX, Imagen, Ideogram and more. See the price before every generation.';

export const metadata = {
  metadataBase: new URL(BASE),
  title: { default: 'PixelPulse — the best AI image and video models, one wallet', template: '%s' },
  description: DESC,
  applicationName: 'PixelPulse',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'PixelPulse', title: 'PixelPulse — the best AI image and video models, one wallet', description: DESC, url: '/' },
  twitter: { card: 'summary_large_image', title: 'PixelPulse — the best AI image and video models, one wallet', description: DESC },
  appleWebApp: { capable: true, title: 'PixelPulse', statusBarStyle: 'black-translucent' },
};
export const viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before the page is drawn: tells the browser (and screen readers, and its own translate offer) which
// language the page is in. The same choice the studio makes: the saved language, else the browser's, else English.
const SET_LANG = `(function(){try{var T={en:'en',es:'es',pt:'pt-BR',fr:'fr',de:'de',it:'it',ja:'ja',ko:'ko',zh:'zh-CN',id:'id'};var m=document.cookie.match(/(?:^|; )pp_lang=([a-z]{2})/);var l=m?m[1]:localStorage.getItem('pp_lang');if(!T[l]){l='en';var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var b=String(n[i]||'').toLowerCase().split(/[-_]/)[0];if(b==='in')b='id';if(T[b]){l=b;break}}}document.documentElement.lang=T[l]}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SET_LANG }} /></head>
      <body style={{ margin: 0, padding: 0, background: '#07070a' }}>{children}</body>
    </html>
  );
}
