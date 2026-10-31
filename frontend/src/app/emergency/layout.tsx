import type { Metadata } from "next";
import { CANONICAL_SITE_URL } from "@/lib/utils/url";

export const metadata: Metadata = {
  title: "24/7 Emergency Roadside Assistance",
  description:
    "Fast 24/7 roadside mobile tire help for flat tires, blowouts, and urgent spare replacements across Brampton, Toronto, Mississauga, and the GTA.",
  alternates: {
    canonical: `${CANONICAL_SITE_URL}/emergency`,
  },
  openGraph: {
    title: "24/7 Emergency Roadside Assistance | HT Mobile Tire",
    description:
      "Fast 24/7 roadside mobile tire help for flat tires, blowouts, and urgent spare replacements across Brampton, Toronto, Mississauga, and the GTA.",
    url: `${CANONICAL_SITE_URL}/emergency`,
    type: "website",
    siteName: "HT Mobile Tire",
    images: [
      {
        url: `${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`,
        width: 1200,
        height: 630,
        alt: "HT Mobile Tire 24/7 Emergency Roadside Assistance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "24/7 Emergency Roadside Assistance | HT Mobile Tire",
    description:
      "Fast 24/7 roadside mobile tire help for flat tires, blowouts, and urgent spare replacements across Brampton, Toronto, Mississauga, and the GTA.",
    images: [`${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`],
  },
};

export default function EmergencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

