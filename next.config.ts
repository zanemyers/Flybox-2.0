import type { NextConfig } from "next";

/* The Content-Security-Policy is not here. It needs a per-request nonce, which a static header cannot carry, so it
   lives in src/proxy.ts. These are the ones that are the same on every response. */
const securityHeaders = [
  // Stops a response being reinterpreted as a type it never declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Full path to our own origin, bare origin to others, nothing at all over plain HTTP.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here is meant to be embedded, so framing is denied outright.
  { key: "X-Frame-Options", value: "DENY" },
  // The app asks for none of these, so neither can anything injected into it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  /* This host only. includeSubDomains would commit every other zm1.org name to HTTPS, which is not this app's call.
     Browsers ignore the header when it arrives over plain HTTP, so it is inert in local dev. */
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Nothing gained by announcing the framework.
  poweredByHeader: false,
  serverExternalPackages: ["playwright", "playwright-extra", "puppeteer-extra-plugin-stealth", "serpapi", "openai", "exceljs"],
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
