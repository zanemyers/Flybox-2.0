import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "serpapi",
    "@google/genai",
    "exceljs",
  ],
};

export default nextConfig;
