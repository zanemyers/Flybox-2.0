import type { MetadataRoute } from "next";

/* Flybox runs on the operator's own keys: nothing to gain from being crawled, real cost in being hit by bots. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
