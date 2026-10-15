export default function manifest() {
  return {
    name: 'PixelPulse — AI image studio',
    short_name: 'PixelPulse',
    description: 'Create, remix and repaint AI images for free. Feel the pulse, make the pixel.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07070a',
    theme_color: '#07070a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
