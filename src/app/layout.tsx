import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
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

/* Must run synchronously before first paint, so it is an inline <script> rather
   than next/script — `beforeInteractive` is queued into self.__next_s and runs
   after the initial paint, which flashed the light theme on every load. */
const themeInit = `(function(){try{var s=localStorage.getItem('flybox-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
];

const socialLinks = [
  // FaGlobe, not FiExternalLink: it sits at the same solid weight as the three
  // brand logos beside it, which a 2px-stroke glyph does not.
  { name: "Website", href: "https://rescueriver.com/", icon: FaGlobe },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/rescue-river/", icon: FaLinkedinIn },
  { name: "Facebook", href: "https://www.facebook.com/rescueriver", icon: FaFacebook },
  { name: "Instagram", href: "https://www.instagram.com/rescueriverco/", icon: FaInstagram },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /* The font variables MUST live on <html>, not <body>: Tailwind's @theme emits
       --font-sans/--font-mono on :root, and a custom property is resolved on the
       element that declares it. With the variables one level down on <body>,
       var(--font-plex-mono) was undefined at :root, so --font-mono computed to
       the guaranteed-invalid value and inherited as empty — IBM Plex never
       loaded and every .eyebrow/.readout/.console rendered in proportional sans. */
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, must execute before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
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
          <main id="main" className="grow">
            {children}
          </main>
          <footer className="border-t border-rule bg-base-100">
            <div className="shell flex flex-col gap-3 py-4 md:h-14 md:flex-row md:items-center md:justify-between md:gap-0 md:py-0">
              <div className="flex items-center gap-2.5">
                <span className="eyebrow">© 2026 Zane Myers</span>
                <HookMark className="size-3 text-primary" />
                <span className="text-xs text-base-content/70">Built for the Rescue River team.</span>
              </div>
              <div className="flex items-center gap-4">
                {legalLinks.map(({ label, href }) => (
                  <Link key={label} href={href} className="text-xs text-base-content/70 transition-colors hover:text-base-content">
                    {label}
                  </Link>
                ))}
                <span className="h-4 w-px bg-rule" />
                <div className="flex items-center gap-3">
                  {socialLinks.map(({ name, href, icon: Icon }) => (
                    <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label={name}>
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
