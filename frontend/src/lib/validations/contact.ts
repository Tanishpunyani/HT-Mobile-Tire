import { z } from "zod";

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long."),

  phone: z
    .string()
    .trim()
    .regex(
      /^[+]?[0-9\s\-()]{7,20}$/,
      "Please enter a valid phone number."
    ),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .optional()
    .or(z.literal("")),

  service: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("")),

  location: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("")),

  emergency: z
    .boolean()
    .optional()
    .default(false),

  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters long.")
    .max(2000, "Message is too long."),
});