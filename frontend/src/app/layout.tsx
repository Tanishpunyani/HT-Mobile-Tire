import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import TopBar from "./components/TopBar";
import Navbar from "./components/Navbar";
import ActiveServiceBar from "./components/ActiveServiceBar";
import Footer from "./components/Footer";
import { AuthProvider } from "@/lib/auth/auth-context";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

import { getCanonicalBaseUrl, CANONICAL_SITE_URL } from "@/lib/utils/url";

const baseUrl = getCanonicalBaseUrl();
const siteUrl = CANONICAL_SITE_URL;
const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+16479956665";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "HT Mobile Tire | On-Demand Mobile Tire Service & 24/7 Roadside Assistance",
    template: "%s | HT Mobile Tire",
  },
  description:
    "Professional mobile tire service that comes to your driveway, workplace, or roadside. New & used tires, rim mounting, wheel balancing, flat tire repair, and 24/7 emergency roadside help.",
  keywords: [
    "mobile tire service",
    "mobile tire repair",
    "emergency flat tire service",
    "roadside tire replacement",
    "ht mobile tire",
    "on-site wheel balancing",
    "mobile tire installer",
  ],
  authors: [{ name: "HT Mobile Tire" }],
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: "erZAKKd8QpcdZMSBJTkfiVK_TRmCO7U-DheitzwkNEQ",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "HT Mobile Tire | Professional Mobile Tire Service",
    description:
      "We come to you! On-demand mobile tire repair, new/used tire replacement, wheel balancing, and roadside emergency service.",
    type: "website",
    locale: "en_CA",
    siteName: "HT Mobile Tire",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/images/hero-mobile-tire-clinic.webp`,
        width: 1200,
        height: 630,
        alt: "HT Mobile Tire Van & Professional Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HT Mobile Tire | On-Demand Mobile Tire Service",
    description:
      "Professional mobile tire service brought directly to your location. Fast, reliable, and convenient mobile tire installation & repair.",
    images: [`${siteUrl}/images/hero-mobile-tire-clinic.webp`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#business`,
  name: "HT Mobile Tire",
  url: siteUrl,
  telephone: businessPhone,
  description:
    "Professional mobile tire services brought directly to your location. Fast, reliable, and convenient mobile tire installation, flat repair, and wheel balancing.",
  logo: `${siteUrl}/images/logo.png`,
  image: `${siteUrl}/images/hero-mobile-tire-clinic.webp`,
  areaServed: [
    { "@type": "City", name: "Brampton, ON" },
    { "@type": "City", name: "Toronto, ON" },
    { "@type": "City", name: "Mississauga, ON" },
    { "@type": "AdministrativeArea", name: "Etobicoke, ON" },
    { "@type": "AdministrativeArea", name: "North York, ON" },
    { "@type": "City", name: "Vaughan, ON" },
    { "@type": "AdministrativeArea", name: "Woodbridge, ON" },
    { "@type": "City", name: "Milton, ON" },
    { "@type": "AdministrativeArea", name: "Georgetown, ON" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Mobile Tire Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "New and Used Tires",
          url: `${siteUrl}/services/new-used-tires`,
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Swap Rim Tire On/Off",
          url: `${siteUrl}/services/swap-rim-tire`,
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Wheel Balancing",
          url: `${siteUrl}/services/wheel-balancing`,
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Flat Tire Repair",
          url: `${siteUrl}/services/flat-tire-repair`,
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Fleet Tire Service",
          url: `${siteUrl}/services/fleet-tire-service`,
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "24/7 Emergency Roadside Assistance",
          url: `${siteUrl}/emergency`,
        },
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased bg-background-light text-foreground`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <TopBar />
          <Navbar />
          <ActiveServiceBar />
          <main id="main-content">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}