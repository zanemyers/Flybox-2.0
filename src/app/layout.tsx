import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import type React from "react";
import { FaFacebook, FaGlobe, FaInstagram, FaLinkedinIn } from "react-icons/fa";
import Header from "@/client/components/header";
import "../client/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flybox",
  description: "Fly-fishing data aggregation tools for Rescue River",
};

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
];

const socialLinks = [
  { name: "Website", href: "https://rescueriver.com/", icon: FaGlobe },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/rescue-river/",
    icon: FaLinkedinIn,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/rescueriver",
    icon: FaFacebook,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/rescueriverco/",
    icon: FaInstagram,
  },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-base-100 text-base-content`}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
        >{`(function(){var t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;})();`}</Script>
        <div className="flex flex-col min-h-screen bg-base-100">
          <Header />
          <main className="grow px-4">{children}</main>
          <footer className="bg-base-200 border-t border-base-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <p className="text-base-content/70 text-center md:text-left">Built with ❤️ for the Rescue River team.</p>
                <div className="flex gap-4 md:gap-6">
                  {socialLinks.map(({ name, href, icon: Icon }) => (
                    <a
                      key={name}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base-content/70 transition-colors p-2 rounded-full hover:bg-primary hover:text-primary-content"
                      aria-label={name}
                    >
                      <Icon size={20} />
                    </a>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-base-300 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-base-content/70 text-sm">© 2026 Zane Myers. All rights reserved.</p>
                <div className="flex gap-6 text-sm">
                  {legalLinks.map(({ label, href }) => (
                    <Link key={label} href={href} className="text-base-content/70 hover:text-base-content transition-colors">
                      {label}
                    </Link>
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
