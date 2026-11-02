import type { NextConfig } from 'next';

// The backoffice (v1.3.0 plan, task 2): the security headers that do not
// change per request; the CSP, which carries a nonce, comes from proxy.ts.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Every page carries personal data: no browser or proxy keeps it.
  { key: 'Cache-Control', value: 'no-store' },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]);
  },
};

export default config;
