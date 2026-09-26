import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { serializeDecimal } from "@/lib/utils/serialize-prisma";
import { getAuthenticatedUser, getOrCreateCustomerForUser, isCustomer } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/logger";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 characters long.")
    .max(20, "Phone number is too long.")
    .regex(/^[+]?[0-9\s\-()]+$/, "Please enter a valid phone number."),
});

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      logger.warn("customer_profile.unauthorized");
      return Response.json(
        {
          success: false,
          error: "Your session has expired. Please sign in again.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    if (!isCustomer(authUser)) {
      logger.warn("customer_profile.forbidden_admin_access", { userEmail: authUser.email });
      return Response.json(
        {
          success: false,
          isAdmin: true,
          error: "This area is for customers only. Administrators should use the Admin Portal.",
          code: "ADMIN_ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    // 15-second timeout allows sufficient time for remote cloud database connections
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database request timed out after 15000ms")), 15000)
    );

    let customer: any;
    try {
      customer = await Promise.race([
        getOrCreateCustomerForUser(authUser),
        timeoutPromise,
      ]);
    } catch (dbErr: any) {
      logger.error("customer_profile.db_failed", { error: dbErr });
      return Response.json(
        {
          success: false,
          error: "Database service temporarily unavailable. Please retry.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    if (!customer) {
      logger.warn("customer_profile.not_found", { userId: authUser.id });
      return Response.json(
        {
          success: false,
          needsOnboarding: true,
          error: "Customer profile not found. Please complete your profile details.",
          code: "PROFILE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 1. Determine authorized Customer IDs for this customer
    const userPhone = customer.phone && customer.phone !== "N/A" ? customer.phone : authUser.phone && authUser.phone !== "N/A" ? authUser.phone : null;
    const userEmail = customer.email || authUser.email || null;

    const authorizedCustomerOrConditions: any[] = [{ id: customer.id }, { userId: authUser.id }];
    if (userPhone) {
      authorizedCustomerOrConditions.push({ phone: userPhone, userId: null });
    }
    if (userEmail) {
      authorizedCustomerOrConditions.push({ email: userEmail, userId: null });
    }

    let authorizedCustomerIds = [customer.id];
    try {
      const matchedCustomers = await prisma.customer.findMany({
        where: { OR: authorizedCustomerOrConditions },
        select: { id: true },
      });
      authorizedCustomerIds = Array.from(new Set([customer.id, ...matchedCustomers.map((c) => c.id)]));
    } catch (authCustErr) {
      logger.warn("customer_profile.authorized_customers_failed", { error: authCustErr });
    }

    // 2. Fetch emergency requests and dispatcher updates concurrently
    let emergencyRequests: any[] = [];
    try {
      const rawEmergencies = await prisma.emergencyRequest.findMany({
        where: { customerId: { in: authorizedCustomerIds } },
        orderBy: { createdAt: "desc" },
        include: { service: true },
      });

      if (rawEmergencies.length > 0) {
        const emergencyIds = rawEmergencies.map((r) => r.id);
        const emergencyLogs = await prisma.notificationLog.findMany({
          where: {
            OR: [
              { emergencyRequestId: { in: emergencyIds } },
              { entityId: { in: emergencyIds }, entityType: "emergency_request" },
            ],
          },
          orderBy: { createdAt: "asc" },
        });

        const logsByEmergencyId: Record<string, any[]> = {};
        for (const log of emergencyLogs) {
          const targetId = log.emergencyRequestId || (log.entityType === "emergency_request" ? log.entityId : null);
          if (targetId) {
            if (!logsByEmergencyId[targetId]) {
              logsByEmergencyId[targetId] = [];
            }
            logsByEmergencyId[targetId].push({
              id: log.id,
              subject: log.subject,
              body: log.body || log.content || "",
              createdAt: log.createdAt,
              channel: log.channel,
              status: log.status,
            });
          }
        }

        emergencyRequests = rawEmergencies.map((r) => ({
          id: r.id,
          currentLocation: r.currentLocation,
          formattedAddress: r.formattedAddress,
          problem: r.problem,
          problemDetails: r.problemDetails,
          vehicle: r.vehicle,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          service: r.service ? { name: r.service.name } : null,
          dispatcherUpdates: logsByEmergencyId[r.id] || [],
        }));
      }
    } catch {
      try {
        const supabase: any = createAdminClient();
        const { data: emData } = await (supabase.from("emergency_requests") as any)
          .select("*, service:services(*)")
          .in("customer_id", authorizedCustomerIds)
          .order("created_at", { ascending: false });

        if (emData) {
          emergencyRequests = emData.map((r: any) => ({
            id: r.id,
            currentLocation: r.current_location,
            formattedAddress: r.formatted_address,
            problem: r.problem,
            problemDetails: r.problem_details,
            vehicle: r.vehicle,
            status: r.status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            service: r.service ? { name: r.service.name } : null,
            dispatcherUpdates: [],
          }));
        }
      } catch (restErr) {
        logger.warn("customer_profile.emergency_fetch_failed", { error: restErr });
      }
    }

    // 3. Fetch customer's contact messages and dispatcher replies
    let contactInquiries: any[] = [];
    try {
      const emailFilter = userEmail;
      const phoneFilter = userPhone;

      const orConditions: any[] = [];
      if (emailFilter) {
        orConditions.push({ email: emailFilter });
      }
      if (phoneFilter) {
        orConditions.push({ phone: phoneFilter });
      }

      if (orConditions.length > 0) {
        const messages = await prisma.contactMessage.findMany({
          where: {
            OR: orConditions,
          },
          orderBy: { createdAt: "desc" },
        });

        if (messages.length > 0) {
          const messageIds = messages.map((m) => m.id);
          const logs = await prisma.notificationLog.findMany({
            where: {
              entityId: { in: messageIds },
              entityType: "contact_message",
            },
            orderBy: { createdAt: "asc" },
          });

          // Group logs by contact message ID
          const logsByEntityId: Record<string, any[]> = {};
          for (const log of logs) {
            if (log.entityId) {
              if (!logsByEntityId[log.entityId]) {
                logsByEntityId[log.entityId] = [];
              }
              logsByEntityId[log.entityId].push({
                id: log.id,
                subject: log.subject,
                body: log.body || log.content || "",
                createdAt: log.createdAt,
                channel: log.channel,
                status: log.status,
              });
            }
          }

          contactInquiries = messages.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            phone: m.phone,
            service: m.service,
            location: m.location,
            emergency: m.emergency,
            message: m.message,
            status: m.status,
            createdAt: m.createdAt,
            dispatcherResponses: logsByEntityId[m.id] || [],
          }));
        }
      }
    } catch (inquiryErr) {
      logger.warn("customer_profile.contact_inquiries_fetch_failed", { error: inquiryErr });
    }

    return Response.json({
      success: true,
      customer: {
        id: customer.id,
        userId: customer.userId,
        name: customer.name,
        email: customer.email || authUser.email,
        phone: customer.phone,
        createdAt: customer.createdAt,
      },
      emergencyRequests: serializeDecimal(emergencyRequests),
      contactInquiries: serializeDecimal(contactInquiries),
    });
  } catch (error: any) {
    logger.error("customer_profile.critical_exception", { error });

    return Response.json(
      {
        success: false,
        error: "Database service temporarily unavailable. Please retry.",
        code: "SERVER_ERROR",
      },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return Response.json(
        {
          success: false,
          error: "Your session has expired. Please sign in again.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: result.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { name, phone } = result.data;

    try {
      const updatedUser = await prisma.user.upsert({
        where: { id: authUser.id },
        update: { name, phone },
        create: {
          id: authUser.id,
          name,
          email: authUser.email || `${authUser.id}@temporary.clinic`,
          phone,
          role: authUser.role || "customer",
        },
      });

      let customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { userId: updatedUser.id },
            ...(authUser.email ? [{ email: authUser.email }] : []),
          ],
        },
      });

      if (customer) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            userId: updatedUser.id,
            name,
            phone,
          },
        });
      } else {
        customer = await prisma.customer.create({
          data: {
            userId: updatedUser.id,
            name,
            email: authUser.email || null,
            phone,
          },
        });
      }

      return Response.json({
        success: true,
        message: "Profile updated successfully.",
        customer: {
          id: customer.id,
          userId: customer.userId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt,
        },
      });
    } catch (prismaErr) {
      const supabase: any = createAdminClient();
      await (supabase.from("users") as any).upsert({
        id: authUser.id,
        name,
        phone,
        email: authUser.email,
        role: authUser.role || "customer",
      });

      const { data: updatedCustomer, error: updateError } = await (supabase.from("customers") as any)
        .upsert({
          user_id: authUser.id,
          name,
          phone,
          email: authUser.email || null,
        })
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      return Response.json({
        success: true,
        message: "Profile updated successfully.",
        customer: {
          id: updatedCustomer.id,
          userId: updatedCustomer.user_id,
          name: updatedCustomer.name,
          email: updatedCustomer.email,
          phone: updatedCustomer.phone,
          createdAt: updatedCustomer.created_at,
        },
      });
    }
  } catch (error: any) {
    logger.error("customer_profile.patch_exception", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to update profile. Please try again.",
      },
      { status: 500 }
    );
  }
}
