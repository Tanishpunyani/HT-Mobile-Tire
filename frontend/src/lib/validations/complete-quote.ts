import { z } from "zod";
import { SERVICE_NAMES } from "@/lib/constants/services";

export const extraServiceItemSchema = z.object({
  name: z.enum(SERVICE_NAMES, {
    message: "Invalid service name selected.",
  }),
  price: z
    .number({ message: "Price must be a valid number." })
    .min(0, "Price cannot be negative."),
});

export const completeQuoteSchema = z
  .object({
    bookingId: z.string().uuid("Invalid booking ID format."),
    basePrice: z
      .number({ message: "Primary service price must be a valid number." })
      .min(0.01, "Primary service price must be greater than $0.00."),
    extraServices: z.array(extraServiceItemSchema).default([]),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters.")
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      // Prevent duplicate extra services
      const names = data.extraServices.map((e) => e.name);
      return new Set(names).size === names.length;
    },
    {
      message: "Duplicate additional services are not allowed.",
      path: ["extraServices"],
    }
  );

export type CompleteQuoteInput = z.infer<typeof completeQuoteSchema>;
