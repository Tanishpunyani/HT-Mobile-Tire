import type { Metadata } from "next";
import Container from "../components/Container";
import SectionHeading from "../components/SectionHeading";

export const metadata: Metadata = {
  title: "Terms of Service | HT Mobile Tire",
  description: "Terms and conditions for scheduling and receiving mobile tire services from HT Mobile Tire.",
};

export default function TermsPage() {
  return (
    <div className="bg-background-light py-16 sm:py-24 min-h-screen">
      <Container>
        <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-white p-8 shadow-sm sm:p-12">
          <SectionHeading
            eyebrow="Legal & Service Agreement"
            title="Terms of Service"
            description="Last Updated: August 2026"
          />

          <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary">
            <p>
              Welcome to HT Mobile Tire. By booking appointments, requesting emergency roadside aid, or using our mobile tire services, you agree to comply with and be bound by the following terms and conditions.
            </p>

            <h3 className="text-base font-bold text-foreground">1. Mobile Service Delivery & Accessibility</h3>
            <p>
              Customers are responsible for providing safe, legal, and accessible parking for our mobile technician van and your vehicle. The service area must be reasonably flat and clear of hazards.
            </p>

            <h3 className="text-base font-bold text-foreground">2. Appointments, Pricing & Cancellation</h3>
            <p>
              Estimated quotes are provided upfront. You may cancel or reschedule a scheduled booking without fee up to 2 hours prior to the dispatch window. Emergency roadside dispatch requests are dispatched immediately upon submission.
            </p>

            <h3 className="text-base font-bold text-foreground">3. Touchless Warranty & Workmanship Guarantee</h3>
            <p>
              We warranty all mounting, balancing, and puncture repairs against workmanship defects. All wheel lugs are torqued with calibrated precision torque wrenches to vehicle manufacturer specifications.
            </p>

            <h3 className="text-base font-bold text-foreground">4. Inquiries</h3>
            <p>
              For inquiries regarding service agreements or fleet contracts, reach us at{" "}
              <a href="mailto:support@mobiletire.clinic" className="font-semibold text-primary underline">
                support@mobiletire.clinic
              </a>.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
