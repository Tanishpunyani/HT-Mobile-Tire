"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";

const FAQS = [
  {
    q: "How does HT Mobile Tire service work?",
    a: "You schedule an appointment for regular tire service or call for emergency roadside tire assistance and provide your vehicle location. A technician travels to your agreed location to service your tires on-site, subject to safe and lawful working clearance.",
  },
  {
    q: "Do I need to be present while you change my tires?",
    a: "Service is arranged at an agreed vehicle location, subject to safe, lawful access and working clearance. As long as your vehicle is parked in an accessible location (such as a private driveway or designated workplace parking area) and we have access to your vehicle and wheel lock key, you do not necessarily need to wait outside while service is performed.",
  },
  {
    q: "Can you service custom or alloy rims carefully?",
    a: "Yes. Our technicians take care when servicing alloy and standard wheels, utilizing appropriate procedures and protective equipment to mount, demount, and balance wheels properly.",
  },
  {
    q: "How fast do you respond to an emergency flat tire request?",
    a: "For emergency roadside tire assistance, response times depend on your vehicle location, traffic conditions, and current technician availability. When you submit a request or call our hotline, our dispatch team will assess your location and provide an estimated arrival time.",
  },
  {
    q: "Do you supply new tires, or can I provide my own?",
    a: "Both! We can source new and used tires for your vehicle, or you can provide tires you already own or purchased independently, and our technician will mount and balance them for you.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept major credit and debit cards, as well as electronic payment methods upon completion of service.",
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
          description="Everything you need to know about our mobile tire services and emergency roadside assistance."
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
