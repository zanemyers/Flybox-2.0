import type { MetadataRoute } from "next";

/* Flybox runs on the operator's own API keys, so there is nothing to gain from
   being crawled and real cost in being hit by bots. Disallow everything. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
