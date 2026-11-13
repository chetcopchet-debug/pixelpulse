const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://replicate.delivery https://*.replicate.delivery",
  "connect-src 'self' https://*.supabase.co https://replicate.delivery https://*.replicate.delivery",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The build's short name, known to the page itself (see app/api/version): shown in Account, and used to
  // notice when the page on screen is older than the site.
  env: { NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7) },
  // Video conversion (lib/transcode.js) runs the ffmpeg program from the ffmpeg-static package. The package must
  // stay a plain node module (not bundled) so it can find its own file, and the file must be shipped with the
  // functions that save or repair videos; Next would otherwise leave a program it cannot see in the code behind.
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/animate': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/webhooks/replicate': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/video/*': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/admin': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
  // The site's first address. Pages opened there go to the same page on yelvoai.com. Addresses under /api are
  // left alone, so a payment or video service that still calls the old address is answered, not sent away.
  async redirects() {
    const has = [{ type: 'host', value: 'pixelpulse-omega.vercel.app' }];
    return [
      { source: '/', has, destination: 'https://yelvoai.com/', permanent: true },
      { source: '/:path((?!api/).+)', has, destination: 'https://yelvoai.com/:path', permanent: true },
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }];
  },
};
export default nextConfig;
