import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | HT Mobile Tire",
  description: "Request a password reset link for your HT Mobile Tire account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

