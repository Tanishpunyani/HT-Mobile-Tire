import { MapPin, Navigation } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const serviceAreas = [
  "Local roadside locations",
  "Residential areas",
  "Workplaces",
  "Commercial locations",
];

export default function ServiceArea() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Content */}
          <div>
            <SectionHeading
              eyebrow="Service Area"
              title="We Bring Tire Service to You"
              description="Whether you're at home, at work, on the roadside, or at a commercial location, our mobile service is designed to come directly to you."
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {serviceAreas.map((area) => (
                <div
                  key={area}
                  className="flex items-center gap-3 rounded-[10px] border border-border bg-background-light p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-primary">
                    <MapPin size={18} />
                  </div>

                  <span className="text-sm font-semibold text-foreground">
                    {area}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Service Area Visual */}
          <div className="relative min-h-[350px] overflow-hidden rounded-[20px] bg-secondary p-8 shadow-md sm:min-h-[400px]">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />

            <div className="relative flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                <Navigation size={34} />
              </div>

              <h3 className="mt-6 text-2xl font-bold text-white">
                Mobile Service
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                Tell us where you are and we'll bring the tire service to
                your location.
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300">
                <MapPin size={15} className="text-primary" />
                Service at your location
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}