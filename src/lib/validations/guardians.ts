import { z } from "zod";

import { normalizeColombianPhone } from "@/lib/utils/phone";

export const guardianIdSchema = z.string().uuid("El acudiente seleccionado no es válido.");
export const studentIdSchema = z.string().uuid("El estudiante seleccionado no es válido.");

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Ingresa el nombre completo.")
  .max(120, "El nombre no puede superar 120 caracteres.");

export const colombianPhoneSchema = z
  .string()
  .trim()
  .refine((value) => normalizeColombianPhone(value) !== null, "Ingresa un celular colombiano válido.");

export const guardianSchema = z.object({
  fullName: fullNameSchema,
  phone: colombianPhoneSchema,
});

export const guardianUpdateSchema = guardianSchema.extend({
  active: z.boolean(),
});

export const studentSchema = z.object({
  fullName: fullNameSchema,
});

export const studentUpdateSchema = studentSchema.extend({
  active: z.boolean(),
});

/** Exact format created by createPrivateAccessToken (32 random bytes, base64url). */
export const privateTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Token inválido.");

export type GuardianValues = z.infer<typeof guardianSchema>;
export type GuardianUpdateValues = z.infer<typeof guardianUpdateSchema>;
export type StudentValues = z.infer<typeof studentSchema>;
export type StudentUpdateValues = z.infer<typeof studentUpdateSchema>;
