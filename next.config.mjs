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
