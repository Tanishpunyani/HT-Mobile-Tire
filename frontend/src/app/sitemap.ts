import type { MetadataRoute } from "next";
import { getAllCitySlugs } from "@/lib/cities";
import { getCanonicalBaseUrl, CANONICAL_SITE_URL } from "@/lib/utils/url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getCanonicalBaseUrl();
  const canonicalDomain = CANONICAL_SITE_URL || baseUrl;
  const citySlugs = getAllCitySlugs();

  // Stable, credible content release timestamp for active service & landing pages
  const contentLastModified = new Date("2026-10-16T00:00:00.000Z");

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: canonicalDomain,
      lastModified: contentLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${canonicalDomain}/services`,
      lastModified: contentLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/service-areas`,
      lastModified: contentLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/services/new-used-tires`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/swap-rim-tire`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/wheel-balancing`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/flat-tire-repair`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/fleet-tire-service`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/about`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${canonicalDomain}/contact`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${canonicalDomain}/booking`,
      lastModified: contentLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/emergency`,
      lastModified: contentLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/privacy`,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${canonicalDomain}/terms`,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // Dynamically map all local city SEO landing pages
  const cityPages: MetadataRoute.Sitemap = citySlugs.map((slug) => ({
    url: `${canonicalDomain}/service-area/${slug}`,
    lastModified: contentLastModified,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticPages, ...cityPages];
}
