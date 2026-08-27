import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import type React from "react";
import { FaFacebook, FaGlobe, FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { HookMark } from "@/client/components/brand";
import Header from "@/client/components/header";
import "../client/styles/globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://flybox.zm1.org"),
  title: "Flybox",
  description: "Fly-fishing data aggregation tools for Rescue River",
  openGraph: {
    title: "Flybox",
    description: "Fly-fishing data aggregation tools for Rescue River",
    type: "website",
    siteName: "Flybox",
  },
};

export const viewport: Viewport = {
  themeColor: [
    // Must track --color-base-100 in globals.css for each theme.
    { media: "(prefers-color-scheme: light)", color: "#faf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#011d26" },
  ],
};

/* Must run before first paint, so an inline <script>: `beforeInteractive` is queued into self.__next_s and flashed the light theme on every load. */
const themeInit = `(function(){try{var s=localStorage.getItem('flybox-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
];

const socialLinks = [
  // FaGlobe, not FiExternalLink: it matches the solid weight of the three brand logos beside it.
  { name: "Website", href: "https://rescueriver.com/", icon: FaGlobe },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/rescue-river/", icon: FaLinkedinIn },
  { name: "Facebook", href: "https://www.facebook.com/rescueriver", icon: FaFacebook },
  { name: "Instagram", href: "https://www.instagram.com/rescueriverco/", icon: FaInstagram },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  /* Next nonces its own script tags, but the theme script below is ours. Reading a header here is also what opts every page into dynamic rendering. */
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    /* The font variables MUST be on <html>, not <body>: @theme emits --font-sans/--font-mono on :root, and one level down they were undefined there, so IBM Plex never loaded. */
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, must execute before first paint */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="antialiased bg-base-100 text-base-content">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:border focus:border-stroke focus:bg-base-100 focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <Header />
          {/* tabIndex={-1} keeps main out of the tab sequence but lets the skip link move focus here; without it the link was a no-op. */}
          <main id="main" tabIndex={-1} className="grow focus:outline-none">
            {children}
          </main>
          <footer className="border-t border-rule bg-base-100">
            <div className="shell flex flex-col gap-3 py-4 md:h-14 md:flex-row md:items-center md:justify-between md:gap-0 md:py-0">
              <div className="flex items-center gap-2.5">
                {/* Every page is already dynamic for the nonce, so this is the request's year, not the build's. */}
                <span className="eyebrow">© {new Date().getFullYear()} Zane Myers</span>
                <HookMark className="size-3 text-primary" />
                <span className="text-xs text-base-content/70">Built for the Rescue River team.</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {legalLinks.map(({ label, href }) => (
                  <Link key={label} href={href} className="whitespace-nowrap text-xs text-base-content/70 transition-colors hover:text-base-content">
                    {label}
                  </Link>
                ))}
                <span className="h-4 w-px bg-rule" />
                <div className="flex items-center gap-3">
                  {socialLinks.map(({ name, href, icon: Icon }) => (
                    <a key={name} href={href} className="icon-btn" aria-label={name}>
                      <Icon className="size-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
