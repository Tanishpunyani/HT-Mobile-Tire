import { prisma } from "@/lib/prisma";
import { emergencySchema } from "@/lib/validations/emergency";
import { sendEmergencyAlert } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/constants/phone";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`emergency_${clientIp}`, 5, 60 * 1000);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          success: false,
          error: `Too many emergency requests. Please call central dispatch immediately at ${BUSINESS_PHONE_DISPLAY}.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    const result = emergencySchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid emergency request information.",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      phone,
      email,
      serviceId,
      currentLocation,
      formattedAddress,
      latitude,
      longitude,
      city,
      state,
      zipCode,
      problem,
      problemDetails,
      vehicle,
    } = result.data;

    // If a service was supplied, make sure it exists.
    let serviceIdToUse: string | null = null;

    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: {
          id: serviceId,
        },
      });

      if (!service || !service.isActive) {
        return Response.json(
          {
            success: false,
            error: "Selected service is not available.",
          },
          { status: 400 }
        );
      }

      serviceIdToUse = service.id;
    }

    // Find existing customer by phone to avoid duplicates.
    let customer = await prisma.customer.findFirst({
      where: {
        phone,
      },
    });

    // Create customer only if one doesn't already exist.
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name,
          phone,
          email: email || null,
        },
      });
    }

    // Create emergency request
    const emergencyRequest = await prisma.emergencyRequest.create({
      data: {
        customerId: customer.id,
        serviceId: serviceIdToUse,
        currentLocation: formattedAddress || currentLocation,
        formattedAddress: formattedAddress || null,
        latitude: latitude || null,
        longitude: longitude || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        problem,
        problemDetails: problemDetails || null,
        vehicle,
      },
      include: {
        customer: true,
        service: true,
      },
    });


    // Automated emergency alerts (non-blocking)
    try {
      await sendEmergencyAlert({
        id: emergencyRequest.id,
        currentLocation: emergencyRequest.currentLocation,
        formattedAddress: emergencyRequest.formattedAddress,
        latitude: emergencyRequest.latitude,
        longitude: emergencyRequest.longitude,
        problem: emergencyRequest.problem,
        problemDetails: emergencyRequest.problemDetails,
        vehicle: emergencyRequest.vehicle,
        status: emergencyRequest.status,
        createdAt: emergencyRequest.createdAt,
        customer: emergencyRequest.customer,
        service: emergencyRequest.service,
      });
    } catch (notifErr) {
      logger.error("emergency_request.notification_failed", { error: notifErr });
    }

    return Response.json(
      {
        success: true,
        message: "Emergency request created successfully.",
        emergencyRequest,
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error("emergency_request.create_failed", { error });

    return Response.json(
      {
        success: false,
        error: "Unable to create emergency request.",
      },
      { status: 500 }
    );
  }
}