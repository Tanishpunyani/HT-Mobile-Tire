import type { Metadata } from "next";
import { CANONICAL_SITE_URL } from "@/lib/utils/url";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with HT Mobile Tire for inquiries, service quotes, or dispatch assistance across the Greater Toronto Area.",
  alternates: {
    canonical: `${CANONICAL_SITE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Us | HT Mobile Tire",
    description:
      "Get in touch with HT Mobile Tire for inquiries, service quotes, or dispatch assistance across the Greater Toronto Area.",
    url: `${CANONICAL_SITE_URL}/contact`,
    type: "website",
    siteName: "HT Mobile Tire",
    images: [
      {
        url: `${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`,
        width: 1200,
        height: 630,
        alt: "Contact HT Mobile Tire",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | HT Mobile Tire",
    description:
      "Get in touch with HT Mobile Tire for inquiries, service quotes, or dispatch assistance across the Greater Toronto Area.",
    images: [`${CANONICAL_SITE_URL}/images/hero-mobile-tire-clinic.webp`],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

