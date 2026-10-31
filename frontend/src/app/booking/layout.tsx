import type { Metadata } from "next";
import { CANONICAL_SITE_URL } from "@/lib/utils/url";

export const metadata: Metadata = {
  title: "Book Mobile Tire Service",
  description:
    "Schedule your mobile tire service appointment online. Fast, convenient mobile tire repair, new & used tire installation, and wheel balancing brought directly to your home or office.",
  alternates: {
    canonical: `${CANONICAL_SITE_URL}/booking`,
  },
  openGraph: {
    title: "Book Mobile Tire Service | HT Mobile Tire",
    description:
      "Schedule your mobile tire service appointment online. Fast, convenient mobile tire repair, new & used tire installation, and wheel balancing brought directly to your home or office.",
    url: `${CANONICAL_SITE_URL}/booking`,
    type: "website",
    siteName: "HT Mobile Tire",
    images: [
      {
        url: `${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`,
        width: 1200,
        height: 630,
        alt: "Book HT Mobile Tire Service Online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book Mobile Tire Service | HT Mobile Tire",
    description:
      "Schedule your mobile tire service appointment online. Fast, convenient mobile tire repair, new & used tire installation, and wheel balancing brought directly to your home or office.",
    images: [`${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`],
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
