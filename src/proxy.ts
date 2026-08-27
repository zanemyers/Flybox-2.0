import { type NextRequest, NextResponse } from "next/server";

/* A nonce is the only way to keep script-src strict: Next inlines its own streaming scripts and the theme script must run before first paint. The cost is static rendering. */

const OSM_TILES = "https://*.tile.openstreetmap.org";
const NOMINATIM = "https://nominatim.openstreetmap.org";

export function policy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    /* strict-dynamic lets the nonced bootstrap pull its chunks without naming each one, and makes host allow-lists moot. */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React eval()s in development to rebuild server stack traces; production does not.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Leaflet positions every tile with an inline style attribute, so this cannot tighten while there is a map.
    "style-src-attr 'unsafe-inline'",
    // data: for DaisyUI's noise texture, the tile host for the map itself.
    `img-src 'self' data: blob: ${OSM_TILES}`,
    // The map's search box calls Nominatim straight from the browser; everything else is our own origin.
    `connect-src 'self' ${NOMINATIM}`,
    // next/font self-hosts under /_next, so no Google Fonts origin is needed.
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Omitted in dev: it would rewrite this http origin's own sub-resources to https.
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = policy(nonce, process.env.NODE_ENV === "development");

  /* On the request as well as the response: Next reads the nonce back off the request to stamp its own script tags. */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      // A prefetch has no document to apply a policy to, and would spend a nonce that never reaches a page.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
