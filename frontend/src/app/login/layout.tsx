import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Sign In | HT Mobile Tire",
  description: "Sign in to your HT Mobile Tire customer account.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

