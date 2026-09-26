import { z } from "zod";

export const emergencySchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters long."),

  phone: z
    .string({ error: "Please enter a valid phone number." })
    .trim()
    .regex(
      /^[+]?[0-9\s\-()]{7,20}$/,
      "Please enter a valid phone number."
    ),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .nullable()
    .optional()
    .or(z.literal("")),

  serviceId: z
    .string()
    .uuid("Please select a valid service.")
    .nullable()
    .optional()
    .or(z.literal("")),

  currentLocation: z
    .string({ error: "Current breakdown location is required." })
    .trim()
    .min(3, "Current location is required."),

  problem: z
    .string({ error: "Please select your tire problem." })
    .trim()
    .min(2, "Please select your tire problem."),

  problemDetails: z
    .string()
    .trim()
    .max(1000, "Problem details are too long.")
    .nullable()
    .optional()
    .or(z.literal("")),

  vehicle: z
    .string({ error: "Vehicle information is required." })
    .trim()
    .min(2, "Vehicle information is required."),

  formattedAddress: z.string().nullable().optional().or(z.literal("")),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  city: z.string().nullable().optional().or(z.literal("")),
  state: z.string().nullable().optional().or(z.literal("")),
  zipCode: z.string().nullable().optional().or(z.literal("")),
});
