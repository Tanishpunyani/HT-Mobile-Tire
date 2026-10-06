"use client";

import { Edit3, AlertCircle } from "lucide-react";
import Container from "@/app/components/Container";
import SignOutButton from "@/app/components/SignOutButton";
import { Customer, Booking, EmergencyRequest, ContactInquiry } from "../types";

interface AccountProfileCardProps {
  customer: Customer;
  bookings: Booking[];
  emergencyRequests: EmergencyRequest[];
  contactInquiries: ContactInquiry[];
  unauthorizedAdminError: boolean;
  onEditProfile: () => void;
}

export default function AccountProfileCard({
  customer,
  bookings,
  emergencyRequests,
  contactInquiries,
  unauthorizedAdminError,
  onEditProfile,
}: AccountProfileCardProps) {
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed" || b.status === "in_progress"
  ).length;

  const completedBookingsCount = bookings.filter((b) => b.status === "completed").length;

  const initials = customer.name
    ? customer.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CU";

  return (
    <section className="border-b border-border bg-secondary py-12 sm:py-16">
      <Container>
        {unauthorizedAdminError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/50 bg-red-950/60 p-4 text-xs font-semibold text-red-200 backdrop-blur-md">
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <span>
              <strong>Access Restricted:</strong> Administrator credentials are required to access the administrative console. You have been safely redirected to your customer portal.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-white shadow-md shadow-primary/20">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Customer Account
                </span>
                {customer.createdAt && (
                  <span className="text-xs text-slate-400">
                    • Member since{" "}
                    {new Date(customer.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                {customer.name}
              </h1>
              <p className="text-sm text-slate-300">
                {customer.email || "No email linked"} • {customer.phone || "No phone linked"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEditProfile}
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Edit3 size={16} />
              Edit Profile
            </button>
            <div className="rounded-[10px] border border-white/20 px-4 py-2 text-center">
              <SignOutButton />
            </div>
          </div>
        </div>

        {/* Quick Stat Badges */}
        <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-400">Total Bookings</p>
            <p className="mt-1 text-2xl font-extrabold text-white">{bookings.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-400">Active Services</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{activeBookingsCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-400">Completed</p>
            <p className="mt-1 text-2xl font-extrabold text-green-400">{completedBookingsCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-slate-400">Emergency Requests</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-400">{emergencyRequests.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-slate-400">Inquiries & Messages</p>
            <p className="mt-1 text-2xl font-extrabold text-sky-400">{contactInquiries.length}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
