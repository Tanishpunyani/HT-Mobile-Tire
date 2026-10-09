import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const scriptSrcPolicy = isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' ${scriptSrcPolicy} https://maps.googleapis.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com; img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/service-area/dallas",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/fort-worth",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/plano",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/arlington",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/irving",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/garland",
        destination: "/service-areas",
        permanent: true,
      },
      {
        source: "/service-area/frisco",
        destination: "/service-areas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
