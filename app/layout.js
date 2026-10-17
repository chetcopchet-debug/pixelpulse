import VercelAnalytics from './VercelAnalytics';
import ErrorListener from './ErrorListener';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pixelpulse-omega.vercel.app';
const DESC = 'PixelPulse is a free, mobile-first AI image studio. Create, remix, repaint and sharpen images, and share them with the Pulse Feed.';

export const metadata = {
  metadataBase: new URL(BASE),
  title: { default: 'PixelPulse — free AI image studio', template: '%s' },
  description: DESC,
  applicationName: 'PixelPulse',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'PixelPulse', title: 'PixelPulse — free AI image studio', description: DESC, url: '/' },
  twitter: { card: 'summary_large_image', title: 'PixelPulse — free AI image studio', description: DESC },
  appleWebApp: { capable: true, title: 'PixelPulse', statusBarStyle: 'black-translucent' },
};
export const viewport = { themeColor: '#07070a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#07070a' }}>
        {children}
        <ErrorListener />
        <VercelAnalytics />
      </body>
    </html>
  );
}
