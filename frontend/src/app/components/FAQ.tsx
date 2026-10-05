"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const FAQS = [
  {
    q: "How does HT Mobile Tire service work?",
    a: "We operate equipped mobile service vans outfitted with commercial tire changers, computerized wheel balancers, and air compressors. You schedule an appointment or request emergency service, tell us where your vehicle is located, and our technician arrives to service your tires right on your driveway, office parking lot, or roadside location.",
  },
  {
    q: "Do I need to be present while you change my tires?",
    a: "No! As long as your vehicle is parked in an accessible location (driveway, workplace parking lot, street parking) and we have access to your wheel lock key, our technician can perform the entire service while you work, relax inside your home, or go about your day. We'll send you digital photos and a completion notification when done.",
  },
  {
    q: "Can you change custom or expensive alloy rims without scratching them?",
    a: "Absolutely. Our mobile vans use touchless clamping technology and nylon-lined mounting heads designed specifically for luxury, sports, and custom alloy wheels up to 24 inches. We guarantee 100% scratch-free installation.",
  },
  {
    q: "How fast do you arrive for an emergency flat tire blowout?",
    a: "For emergency roadside dispatch, our average arrival time is 30 to 45 minutes depending on your location and traffic conditions. You can submit an emergency request directly on our Emergency page or call our 24/7 dispatch hotline.",
  },
  {
    q: "Do you supply new tires, or can I provide my own?",
    a: "Both! We carry a full inventory of new and certified used tires from top brands (Michelin, Goodyear, Continental, Bridgestone, etc.), or you can supply tires you've purchased online (e.g. TireRack, Amazon) and we will gladly mount and balance them for you.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Our technicians carry mobile point-of-sale terminals that accept all major credit/debit cards (Visa, MasterCard, Amex, Discover), Apple Pay, Google Pay, and corporate invoicing for fleet clients.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-white py-20 sm:py-24 border-b border-border">
      <Container>
        <SectionHeading
          eyebrow="Got Questions?"
          title="Frequently Asked Questions"
          description="Everything you need to know about our on-demand mobile tire service and roadside assistance."
          centered
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-[16px] border border-border bg-background-light transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left transition hover:bg-white sm:p-6"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <HelpCircle size={18} className="shrink-0 text-primary" />
                    <span className="text-sm font-bold text-foreground sm:text-base">{faq.q}</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-white px-5 pb-6 pt-4 sm:px-6">
                    <p className="text-xs sm:text-sm leading-6 text-text-secondary">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
