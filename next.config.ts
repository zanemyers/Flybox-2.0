import type { NextConfig } from "next";

/* The CSP is not here: it needs a per-request nonce, so it lives in src/proxy.ts. These are the headers that never vary. */
const securityHeaders = [
  // Stops a response being reinterpreted as a type it never declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Full path to our own origin, bare origin to others, nothing at all over plain HTTP.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here is meant to be embedded, so framing is denied outright.
  { key: "X-Frame-Options", value: "DENY" },
  // The app asks for none of these, so neither can anything injected into it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  /* This host only: includeSubDomains would commit every other zm1.org name to HTTPS, which is not this app's call. */
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Nothing gained by announcing the framework.
  poweredByHeader: false,
  serverExternalPackages: ["playwright", "playwright-extra", "puppeteer-extra-plugin-stealth", "serpapi", "openai", "exceljs"],
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
