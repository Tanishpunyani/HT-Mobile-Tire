import type { MetadataRoute } from "next";
import { getCanonicalBaseUrl, CANONICAL_SITE_URL } from "@/lib/utils/url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalBaseUrl();
  const canonicalDomain = CANONICAL_SITE_URL || baseUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/account/"],
    },
    sitemap: `${canonicalDomain}/sitemap.xml`,
  };
}
