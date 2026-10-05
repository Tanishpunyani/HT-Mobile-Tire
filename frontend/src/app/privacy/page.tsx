import type { Metadata } from "next";
import Container from "../components/Container";
import SectionHeading from "../components/SectionHeading";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";

export const metadata: Metadata = {
  title: "Privacy Policy | HT Mobile Tire",
  description: "Learn how HT Mobile Tire collects, protects, and uses customer information for mobile tire services.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-background-light py-16 sm:py-24 min-h-screen">
      <Container>
        <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-white p-8 shadow-sm sm:p-12">
          <SectionHeading
            eyebrow="Legal & Compliance"
            title="Privacy Policy"
            description="Last Updated: August 2026"
          />

          <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary">
            <p>
              HT Mobile Tire (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) values your trust and is committed to protecting your personal information. This Privacy Policy describes our practices concerning data collection, usage, and disclosure when you use our website and mobile tire services.
            </p>

            <h3 className="text-base font-bold text-foreground">1. Information We Collect</h3>
            <p>
              To provide mobile tire services at your home, workplace, or roadside location, we collect details including your name, contact phone number, email address, service location, vehicle make/model/year, and service requests.
            </p>

            <h3 className="text-base font-bold text-foreground">2. How We Use Your Information</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Dispatching certified technicians to your specified service address.</li>
              <li>Sending booking confirmations, arrival status notifications, and receipts.</li>
              <li>Responding to emergency roadside assistance requests.</li>
              <li>Ensuring payment processing and account profile management.</li>
            </ul>

            <h3 className="text-base font-bold text-foreground">3. Information Protection & Sharing</h3>
            <p>
              We do not sell, rent, or trade your personal information to third parties. Data is only shared with essential infrastructure partners (e.g. secure database providers, communication gateways) strictly necessary for delivering service.
            </p>

            <h3 className="text-base font-bold text-foreground">4. Contact Us</h3>
            <p>
              If you have any questions regarding this Privacy Policy, please contact our team at{" "}
              <a href="mailto:support@mobiletire.clinic" className="font-semibold text-primary underline">
                support@mobiletire.clinic
              </a>{" "}
              or call {BUSINESS_PHONE_DISPLAY}.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
