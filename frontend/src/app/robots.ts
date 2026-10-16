import type { MetadataRoute } from "next";
import { getCanonicalBaseUrl } from "@/lib/utils/url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/account/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
