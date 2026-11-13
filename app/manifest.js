export default function manifest() {
  return {
    name: 'Yelvo — AI image and video studio',
    short_name: 'Yelvo',
    description: 'The best AI image and video models in one place, with one credit wallet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
