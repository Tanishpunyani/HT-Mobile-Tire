import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Portal Sign In | HT Mobile Tire",
  description: "Sign in to the HT Mobile Tire administrator portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

