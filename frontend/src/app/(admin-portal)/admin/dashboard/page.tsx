export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import Link from "next/link";
import Container from "@/app/components/Container";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { SERVICE_NAMES } from "@/lib/constants/services";
import {
  CalendarCheck,
  Clock3,
  CircleCheck,
  CheckCircle2,
  CircleX,
  Siren,
  Mail,
  Users,
  ExternalLink,
  Star,
  Bell,
  Play,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const adminUser = await requireAdminSession();

  // --------------------------------
  // Parallel DB Queries & In-Memory Aggregation
  // --------------------------------

  const [rawAnalyticsBookings, emergencyRequests] = await Promise.all([
    prisma.booking.findMany({
      select: {
        status: true,
        totalAmount: true,
        service: {
          select: {
            name: true,
            depositAmount: true,
          },
        },
      },
    }),
    prisma.emergencyRequest.count(),
  ]);

  const analyticsBookings = serializeDecimal(rawAnalyticsBookings);

  const totalBookings = analyticsBookings.length;
  const pendingBookings = analyticsBookings.filter((b) => b.status === "pending").length;
  const confirmedBookings = analyticsBookings.filter((b) => b.status === "confirmed").length;
  const inProgressBookings = analyticsBookings.filter((b) => b.status === "in_progress").length;
  const completedBookings = analyticsBookings.filter((b) => b.status === "completed").length;
  const cancelledBookings = analyticsBookings.filter((b) => b.status === "cancelled").length;

  // Bookings by service
  const serviceCounts: Record<string, number> = {};

  analyticsBookings.forEach((booking) => {
    const serviceName = booking.service?.name || "Unknown Service";
    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
  });

  const analyticsCompletedBookings = completedBookings;
  const analyticsCancelledBookings = cancelledBookings;

  const stats = [
    {
      title: "Total Bookings",
      value: totalBookings,
      icon: CalendarCheck,
    },
    {
      title: "Pending",
      value: pendingBookings,
      icon: Clock3,
    },
    {
      title: "Confirmed",
      value: confirmedBookings,
      icon: CircleCheck,
    },
    {
      title: "In Progress",
      value: inProgressBookings,
      icon: Play,
    },
    {
      title: "Completed",
      value: completedBookings,
      icon: CheckCircle2,
    },
    {
      title: "Cancelled",
      value: cancelledBookings,
      icon: CircleX,
    },
    {
      title: "Emergency Requests",
      value: emergencyRequests,
      icon: Siren,
    },
  ];

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <Container>
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4">
  <div>
    <p className="text-sm font-bold uppercase tracking-wider text-primary">
      Admin
    </p>

    <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
      Dashboard
    </h1>

    <p className="mt-3 text-text-secondary">
      Manage your tire service business from one place.
    </p>

    <p className="mt-2 text-sm text-text-secondary">
      Signed in as: <span className="font-bold text-foreground">{adminUser.email}</span>
    </p>
  </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-secondary">
                      {stat.title}
                    </p>

                    <p className="mt-3 text-3xl font-extrabold text-foreground">
                      {stat.value}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <Icon size={22} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Management */}
<section className="mt-12">
  <div>
    <p className="text-sm font-bold uppercase tracking-wider text-primary">
      Management
    </p>

    <h2 className="mt-2 text-2xl font-extrabold text-foreground">
      Manage Your Business
    </h2>

    <p className="mt-2 text-text-secondary">
      View and manage bookings, contact messages, and emergency requests.
    </p>
  </div>

  <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

    {/* Bookings */}
    <Link
      href="/admin/bookings"
      prefetch={false}
      className="group rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Bookings
          </h3>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            View and manage customer bookings and update their status.
          </p>
        </div>

        <CalendarCheck
          size={24}
          className="text-primary transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <div className="mt-5 text-sm font-bold text-primary">
        Manage Bookings →
      </div>
    </Link>

    {/* Contact Messages */}
    <Link
      href="/admin/contact-messages"
      prefetch={false}
      className="group rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Contact Messages
          </h3>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            View customer messages and manage contact requests.
          </p>
        </div>

        <Mail
          size={24}
          className="text-primary transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <div className="mt-5 text-sm font-bold text-primary">
        Manage Messages →
      </div>
    </Link>

    {/* Emergency Requests */}
    <Link
      href="/admin/emergency-requests"
      prefetch={false}
      className="group rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Emergency Requests
          </h3>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            View and manage urgent tire service requests.
          </p>
        </div>

        <Siren
          size={24}
          className="text-primary transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <div className="mt-5 text-sm font-bold text-primary">
        Manage Emergencies →
      </div>
    </Link>

    {/* Reviews & Moderation */}
    <Link
      href="/admin/reviews"
      prefetch={false}
      className="group rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Reviews & Moderation
          </h3>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Moderate customer ratings, approve reviews, and publish to website.
          </p>
        </div>

        <Star
          size={24}
          className="text-amber-500 transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <div className="mt-5 text-sm font-bold text-primary">
        Moderate Reviews →
      </div>
    </Link>

    {/* Notification Delivery Logs */}
    <Link
      href="/admin/notifications"
      prefetch={false}
      className="group rounded-[16px] border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Notification Logs
          </h3>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            View message dispatch and email delivery status & retries.
          </p>
        </div>

        <Bell
          size={24}
          className="text-primary transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <div className="mt-5 text-sm font-bold text-primary">
        View Delivery Logs →
      </div>
    </Link>
  </div>
</section>



        {/* Analytics */}
        <section className="mt-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Analytics
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-foreground">
              Business Overview
            </h2>

            <p className="mt-2 text-text-secondary">
              Understand your bookings and service demand.
            </p>
          </div>

          {/* Bookings by Service */}
          <div className="mt-8 rounded-[16px] border border-border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground">
              Bookings by Service
            </h3>

            <div className="mt-6 space-y-4">
              {SERVICE_NAMES.map((serviceName) => {
                const count = serviceCounts[serviceName] || 0;

                return (
                  <div
                    key={serviceName}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-b-0"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {serviceName}
                    </span>

                    <span className="text-lg font-bold text-primary">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed vs Cancelled */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-[16px] border border-border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-text-secondary">
                Completed Bookings
              </p>

              <p className="mt-3 text-3xl font-extrabold text-foreground">
                {analyticsCompletedBookings}
              </p>
            </div>

            <div className="rounded-[16px] border border-border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-text-secondary">
                Cancelled Bookings
              </p>

              <p className="mt-3 text-3xl font-extrabold text-foreground">
                {analyticsCancelledBookings}
              </p>
            </div>
          </div>

          {/* Emergency Requests */}
          <div className="mt-6 rounded-[16px] border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-text-secondary">
              Emergency Requests
            </p>

            <p className="mt-3 text-3xl font-extrabold text-foreground">
              {emergencyRequests}
            </p>
          </div>
        </section>
      </Container>
    </div>
  );
}