import { ArrowRight, CalendarCheck, MapPin, CheckCircle2 } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    number: "01",
    icon: CalendarCheck,
    title: "Book Your Service",
    description:
      "Choose the tire service you need and provide your location and preferred time.",
  },
  {
    number: "02",
    icon: MapPin,
    title: "We Come to You",
    description:
      "Our mobile tire service team comes directly to your location with the equipment needed.",
  },
  {
    number: "03",
    icon: CheckCircle2,
    title: "Get Back on the Road",
    description:
      "We complete the service professionally and help get you safely back on the road.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="How It Works"
          title="Tire Service Made Simple"
          description="Getting professional tire service doesn't have to be complicated. We bring the service directly to you."
          centered
        />

        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Connecting line on desktop */}
          <div className="absolute left-[18%] right-[18%] top-10 hidden h-px bg-border md:block" />

          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="group relative z-10 text-center"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-primary text-white shadow-md transition-transform duration-300 group-hover:scale-105">
                  <Icon size={30} strokeWidth={1.8} />
                </div>

                <div className="mt-5 text-xs font-bold tracking-[0.2em] text-primary">
                  STEP {step.number}
                </div>

                <h3 className="mt-2 text-xl font-bold text-foreground">
                  {step.title}
                </h3>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-text-secondary">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}