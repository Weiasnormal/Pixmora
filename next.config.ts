import type { NextConfig } from "next";

/**
 * Browser safety rules sent with every page and file. There is no full Content-Security-Policy
 * yet: Next's inline scripts and the background-removal model (WebAssembly from a CDN) would
 * need nonces and careful testing. These headers are safe without that.
 */
const SECURITY_HEADERS = [
  // Other sites can't show Pixmora inside a frame, so a page can't trick people into clicking it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Files are only ever treated as the type the server says they are.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only "pixmora…" as the referrer, never the full page address.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Pixmora never needs these, so no script on the page can ask for them.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // A page opened from Pixmora can't reach back into it.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers only ever use HTTPS for the site after the first visit. Ignored on http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
