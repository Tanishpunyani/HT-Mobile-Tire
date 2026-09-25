import Image from "next/image";
import Link from "next/link";
import {
  CircleGauge,
  Disc3,
  Truck,
  Wrench,
  CircleDot,
  ArrowRight,
  Calendar,
} from "lucide-react";

type ServiceCardProps = {
  title: string;
  description: string;
  href?: string;
  bookingHref?: string;
  image?: string;
  imageAlt?: string;
  icon?: "tires" | "swap" | "balancing" | "repair" | "fleet";
};

const icons = {
  tires: CircleDot,
  swap: Disc3,
  balancing: CircleGauge,
  repair: Wrench,
  fleet: Truck,
};

export default function ServiceCard({
  title,
  description,
  href = "/services",
  bookingHref,
  image,
  imageAlt,
  icon = "tires",
}: ServiceCardProps) {
  const Icon = icons[icon];
  const directBookingUrl =
    bookingHref ||
    `/booking?service=${encodeURIComponent(title)}`;

  return (
    <div className="service-card group flex flex-col justify-between overflow-hidden rounded-[20px] border border-border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
      <div>
        {image && (
          <div className="relative h-52 w-full overflow-hidden">
            <Image
              src={image}
              alt={imageAlt || title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}

        <div className="p-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm transition-all group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/20">
            <Icon size={24} strokeWidth={1.8} className="text-primary" />
          </div>

          <h3 className="text-xl font-bold text-foreground">
            {title}
          </h3>

          <p className="mt-3 text-sm leading-6 text-text-secondary">
            {description}
          </p>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 flex items-center justify-between gap-3 bg-background-light/50">
        <Link
          href={href}
          className="text-xs font-bold text-text-secondary hover:text-foreground transition-colors flex items-center gap-1"
        >
          Details <ArrowRight size={13} />
        </Link>

        <Link
          href={directBookingUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary-hover shadow-sm"
        >
          <Calendar size={13} />
          Book Now
        </Link>
      </div>
    </div>
  );
}