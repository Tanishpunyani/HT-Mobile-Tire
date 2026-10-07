export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import BookingsManagementClient, {
  Booking,
  Technician,
} from "./BookingsManagementClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export default async function AdminBookingsPage() {
  await requireAdminSession();

  let initialBookings: Booking[] = [];
  let initialTechnicians: Technician[] = [];

  try {
    const [rawBookings, rawTechnicians] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          service: true,
          technician: true,
        },
      }),
      prisma.technician.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    initialBookings = serializeDecimal(rawBookings) as unknown as Booking[];
    initialTechnicians = serializeDecimal(rawTechnicians) as unknown as Technician[];
  } catch (prismaErr) {
    logger.warn("admin_bookings_page.prisma_fallback", { error: prismaErr });
    try {
      const supabase: any = createAdminClient();
      const { data: bookingsData, error: sbError } = await (supabase.from("bookings") as any)
        .select("*, customer:customers(*), service:services(*)")
        .order("created_at", { ascending: false });

      if (!sbError && bookingsData) {
        const formatted = bookingsData.map((b: any) => ({
          id: b.id,
          primaryService: b.primary_service,
          extraServices: b.extra_services,
          vehicle: b.vehicle,
          location: b.location,
          formattedAddress: b.formatted_address,
          latitude: b.latitude,
          longitude: b.longitude,
          bookingDate: b.booking_date,
          bookingTime: b.booking_time,
          status: b.status,
          paymentStatus: b.payment_status,
          totalAmount: b.total_amount,
          notes: b.notes,
          tireSize: b.tire_size,
          message: b.message,
          customer: b.customer,
          service: b.service,
          createdAt: b.created_at,
        }));
        initialBookings = serializeDecimal(formatted) as unknown as Booking[];
      }
    } catch (fallbackErr) {
      logger.error("admin_bookings_page.fallback_failed", { error: fallbackErr });
    }
  }

  return (
    <BookingsManagementClient
      initialBookings={initialBookings}
      initialTechnicians={initialTechnicians}
    />
  );
}