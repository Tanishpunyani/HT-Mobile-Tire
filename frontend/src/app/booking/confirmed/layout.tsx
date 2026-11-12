import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Confirmed | HT Mobile Tire",
  description: "Your mobile tire service booking has been confirmed.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BookingConfirmedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

