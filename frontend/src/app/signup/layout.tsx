import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an Account | HT Mobile Tire",
  description: "Create an HT Mobile Tire account to manage your bookings and service history.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

