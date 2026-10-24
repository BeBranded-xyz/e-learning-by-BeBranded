import type { NextConfig } from "next";

/** Security headers recommended to hosts (spec 08); the demo applies them. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  // pg has an optional native binding: Node loads it at runtime instead of bundling it.
  // playwright-core starts a browser process: it runs from node_modules, never bundled.
  serverExternalPackages: ["pg", "playwright-core"],
  poweredByHeader: false,
  headers: () => Promise.resolve([{ source: "/:path*", headers: securityHeaders }]),
};

export default config;
