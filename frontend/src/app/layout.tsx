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

function getValidBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl !== "..." && envUrl.trim() !== "") {
    try {
      new URL(envUrl);
      return envUrl;
    } catch {
      // Fallback on malformed URL
    }
  }
  return "https://mobiletire.clinic";
}

const baseUrl = getValidBaseUrl();
const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "+18005558473";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "HT Mobile Tires | On-Demand Mobile Tire Service & 24/7 Roadside Assistance",
    template: "%s | HT Mobile Tires",
  },
  description:
    "Professional mobile tire service that comes to your driveway, workplace, or roadside. New & used tires, rim mounting, laser wheel balancing, flat tire repair, and 24/7 emergency dispatch.",
  keywords: [
    "mobile tire service",
    "mobile tire repair",
    "emergency flat tire service",
    "roadside tire replacement",
    "ht mobile tires",
    "on-site wheel balancing",
    "mobile tire installer",
  ],
  authors: [{ name: "HT Mobile Tires" }],
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: "HT Mobile Tires | Professional Mobile Tire Service",
    description:
      "We come to you! On-demand mobile tire repair, new/used tire replacement, wheel balancing, and 24/7 roadside emergency service.",
    type: "website",
    locale: "en_US",
    siteName: "HT Mobile Tires",
    url: baseUrl,
    images: [
      {
        url: `${baseUrl}/images/hero-mobile-tire-clinic.webp`,
        width: 1200,
        height: 630,
        alt: "HT Mobile Tires Van & Professional Technician Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HT Mobile Tires | On-Demand Mobile Tire Service",
    description:
      "Professional mobile tire service brought directly to your location 24/7. Fast, reliable, and hassle-free tire installation & repair.",
    images: [`${baseUrl}/images/hero-mobile-tire-clinic.webp`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoRepair",
  name: "HT Mobile Tires",
  image: `${baseUrl}/images/hero-mobile-tire-clinic.webp`,
  description:
    "Professional mobile tire services brought directly to your location. Fast, reliable, and convenient mobile tire installation, flat repair, and wheel balancing.",
  telephone: businessPhone,
  priceRange: "$$",
  url: baseUrl,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Dallas",
    addressRegion: "TX",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 32.7767,
    longitude: -96.797,
  },
  areaServed: [
    { "@type": "City", name: "Dallas, TX" },
    { "@type": "City", name: "Fort Worth, TX" },
    { "@type": "City", name: "Plano, TX" },
    { "@type": "City", name: "Arlington, TX" },
    { "@type": "City", name: "Irving, TX" },
    { "@type": "City", name: "Frisco, TX" },
    { "@type": "City", name: "Garland, TX" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Mobile Tire Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Flat Tire Repair",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "New and Used Tires",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Swap Rim Tire On/Off",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Wheel Balancing",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "24/7 Emergency Roadside Assistance",
        },
      },
    ],
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "215",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  ],
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