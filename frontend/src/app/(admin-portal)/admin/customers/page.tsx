export const dynamic = "force-dynamic";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import CustomersManagementClient, {
  Customer,
} from "./CustomersManagementClient";
import { logger } from "@/lib/logger";

export default async function AdminCustomersPage() {
  await requireAdminSession();

  let initialCustomers: Customer[] = [];

  try {
    const rawCustomers = await prisma.customer.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        bookings: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            service: true,
          },
        },
      },
    });

    const customerData = rawCustomers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      bookings: customer.bookings.length,
      serviceHistory: customer.bookings.map((booking) => ({
        service: booking.service?.name || "Unknown Service",
        vehicle: booking.vehicle,
        date: booking.bookingDate,
        status: booking.status,
      })),
    }));

    initialCustomers = serializeDecimal(customerData) as unknown as Customer[];
  } catch (error: any) {
    logger.error("admin_customers_page.fetch_failed", { error });
  }

  return <CustomersManagementClient initialCustomers={initialCustomers} />;
}