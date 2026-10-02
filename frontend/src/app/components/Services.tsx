import Container from "./Container";
import SectionHeading from "./SectionHeading";
import ServiceCard from "./ServiceCard";

const services = [
  {
    title: "New and Used Tires",
    description:
      "Choose from quality new and used tires for your vehicle, with professional installation at your location.",
    icon: "tires" as const,
    href: "/services/new-used-tires",
    bookingHref: "/booking?service=new-used-tires",
    image: "/images/mobile-van-service.webp",
    imageAlt: "New and used tires",
  },
  {
    title: "Swap Rim Tire On/Off",
    description:
      "Professional tire removal and installation when you need to change tires on or off your rims.",
    icon: "swap" as const,
    href: "/services/swap-rim-tire",
    bookingHref: "/booking?service=swap-rim-tire",
    image: "/images/Swap_Tire_rim_ON_OFF.webp",
    imageAlt: "Swap Rim Tire On/Off",
  },
  {
    title: "Wheel Balancing",
    description:
      "Improve your ride quality and tire performance with professional wheel balancing service.",
    icon: "balancing" as const,
    href: "/services/wheel-balancing",
    bookingHref: "/booking?service=wheel-balancing",
    image: "/images/Wheel_Balancing.webp",
    imageAlt: "Wheel Balancing",
  },
  {
    title: "Flat Tire Repair",
    description:
      "Fast and convenient flat tire repair to help get you safely back on the road.",
    icon: "repair" as const,
    href: "/services/flat-tire-repair",
    bookingHref: "/booking?service=flat-tire-repair",
    image: "/images/flat_tire_repair.webp",
    imageAlt: "Flat Tire Repair",
  },
  {
    title: "Fleet Tire Service",
    description:
      "Reliable mobile tire service to help businesses keep their vehicles and fleets moving.",
    icon: "fleet" as const,
    href: "/services/fleet-tire-service",
    bookingHref: "/booking?service=fleet-tire-service",
    image: "/images/fleet_tire_services.webp",
    imageAlt: "Fleet Tire Service",
  },
];

export default function Services() {
  return (
    <section className="bg-slate-50 py-20 border-b border-border">
      <Container>
        <SectionHeading
          eyebrow="Our Services"
          title="Professional Tire Services at Your Location"
          description="From everyday tire needs to emergency repairs, we bring the service to you."
          centered
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.title}
              title={service.title}
              description={service.description}
              icon={service.icon}
              href={service.href}
              bookingHref={service.bookingHref}
              image={service.image}
              imageAlt={service.imageAlt}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}