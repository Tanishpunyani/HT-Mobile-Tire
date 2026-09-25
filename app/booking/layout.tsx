import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Mobile Tire Service",
  description:
    "Schedule your mobile tire service appointment online. Fast, convenient mobile tire repair, new & used tire installation, and wheel balancing brought directly to your home or office.",
  openGraph: {
    title: "Book Mobile Tire Service | HT Mobile Tires",
    description:
      "Select your service, tire size, vehicle, and preferred arrival time for on-site mobile tire installation.",
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
