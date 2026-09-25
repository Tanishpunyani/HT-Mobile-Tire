import {
  Clock3,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const benefits = [
  {
    icon: Zap,
    title: "Fast Response",
    description:
      "We help you get back on the road quickly with convenient mobile tire service.",
  },
  {
    icon: MapPin,
    title: "We Come to You",
    description:
      "No need to drive to a tire shop. Our mobile service comes directly to your location.",
  },
  {
    icon: ShieldCheck,
    title: "Professional Service",
    description:
      "Get reliable tire service from professionals who focus on quality and safety.",
  },
  {
    icon: Clock3,
    title: "Convenient & Reliable",
    description:
      "Choose a service time that works for you and avoid unnecessary waiting at a shop.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why Choose Us"
          title="Tire Service Without the Shop Visit"
          description="We make tire service easier by bringing professional service directly to you."
          centered
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <div
                key={benefit.title}
                className="group rounded-[16px] border border-border bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary/30 hover:shadow-md"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Icon size={27} strokeWidth={1.8} />
                </div>

                <h3 className="mt-5 text-lg font-bold text-foreground">
                  {benefit.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}