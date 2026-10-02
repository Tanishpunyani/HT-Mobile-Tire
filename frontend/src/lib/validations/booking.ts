import { z } from "zod";

export const bookingSchema = z.object({
  name: z
    .string({ error: "Please enter your name." })
    .trim()
    .min(1, "Please enter your name."),

  phone: z
    .string({ error: "Please enter a valid phone number." })
    .trim()
    .min(7, "Please enter a valid phone number (at least 7 digits)."),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .nullable()
    .optional()
    .or(z.literal("")),

  service: z
    .string({ error: "Please select a tire service." })
    .trim()
    .min(1, "Please select a tire service."),

  vehicle: z
    .string({ error: "Please enter your vehicle details." })
    .trim()
    .min(1, "Please enter your vehicle details (e.g. 2022 Honda Civic)."),

  location: z
    .string({ error: "Please provide your service location address." })
    .trim()
    .min(1, "Please provide your service location address."),

  date: z
    .string()
    .trim()
    .nullable()
    .optional()
    .or(z.literal("")),

  time: z
    .string()
    .trim()
    .nullable()
    .optional()
    .or(z.literal("")),

  message: z
    .string()
    .trim()
    .max(1000, "Message is too long.")
    .nullable()
    .optional()
    .or(z.literal("")),

  formattedAddress: z.string().nullable().optional().or(z.literal("")),
  latitude: z.any().nullable().optional(),
  longitude: z.any().nullable().optional(),
  city: z.string().nullable().optional().or(z.literal("")),
  state: z.string().nullable().optional().or(z.literal("")),
  zipCode: z.string().nullable().optional().or(z.literal("")),
  tireSize: z.string().nullable().optional().or(z.literal("")),
});