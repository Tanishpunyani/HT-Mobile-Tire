import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set New Password | HT Mobile Tire",
  description: "Set a new password for your HT Mobile Tire account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

