import type { MetadataRoute } from "next";
import { getAllCitySlugs } from "@/lib/cities";
import { getCanonicalBaseUrl, CANONICAL_SITE_URL } from "@/lib/utils/url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getCanonicalBaseUrl();
  const canonicalDomain = CANONICAL_SITE_URL || baseUrl;
  const citySlugs = getAllCitySlugs();

  // Evidence-based static release timestamp derived from repository Git commit history
  // and aligned strictly with Google Search Central guidelines:
  // - Commits 2117cf4 and a685a24 (October 31, 2026) updated canonical domain URLs and
  //   Schema.org AutoRepair JSON-LD structured data in root layout.tsx and city pages.
  // - Google Search Central classifies structured data updates as significant page changes.
  // - For legal compliance pages (/privacy, /terms), lastModified is omitted because their displayed
  //   policy date is "August 2026" and minor wording adjustments do not constitute reliable revision dates.
  const seoReleaseLastModified = new Date("2026-10-31T00:00:00.000Z");

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: canonicalDomain,
      lastModified: seoReleaseLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${canonicalDomain}/services`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/service-areas`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/services/new-used-tires`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/swap-rim-tire`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/wheel-balancing`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/flat-tire-repair`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/services/fleet-tire-service`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/about`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${canonicalDomain}/contact`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${canonicalDomain}/booking`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${canonicalDomain}/emergency`,
      lastModified: seoReleaseLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${canonicalDomain}/privacy`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${canonicalDomain}/terms`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // Dynamically map all local city SEO landing pages
  const cityPages: MetadataRoute.Sitemap = citySlugs.map((slug) => ({
    url: `${canonicalDomain}/service-area/${slug}`,
    lastModified: seoReleaseLastModified,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticPages, ...cityPages];
}
