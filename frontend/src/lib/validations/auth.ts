import { z } from "zod";

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long."),

    email: z
      .string()
      .trim()
      .email("Please enter a valid email address."),

    phone: z
      .string()
      .trim()
      .min(7, "Phone number must be at least 7 characters long.")
      .max(20, "Phone number is too long.")
      .regex(
        /^[+]?[0-9\s\-()]+$/,
        "Please enter a valid phone number."
      ),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters long."),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address."),

  password: z
    .string()
    .min(1, "Please enter your password."),
});