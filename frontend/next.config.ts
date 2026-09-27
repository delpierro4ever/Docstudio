import type { NextConfig } from "next";

// The browser talks only to this Next.js server; /backend/* is relayed to
// the Express gateway. That way a single public port (3000) serves the
// whole app, requests are same-origin (no CORS), and the backend and
// formatter can stay bound to localhost.
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // The home page is the static marketing page in public/landing.html.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }],
    };
  },
  experimental: {
    // Formatting (LLM classification + proofreading) can outlast the 30s
    // default; match the backend's FORMATTER_TIMEOUT_MS.
    proxyTimeout: 300_000,
  },
};

export default nextConfig;
