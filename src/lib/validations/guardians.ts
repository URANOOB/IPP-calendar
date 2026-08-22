import { z } from "zod";

import { normalizeColombianPhone } from "@/lib/utils/phone";

export const guardianIdSchema = z.string().uuid("El acudiente seleccionado no es válido.");
export const studentIdSchema = z.string().uuid("El estudiante seleccionado no es válido.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Ingresa el nombre completo.")
  .max(120, "El nombre no puede superar 120 caracteres.");

export const optionalGuardianNameSchema = z
  .string()
  .trim()
  .max(120, "El nombre no puede superar 120 caracteres.")
  .refine((value) => value.length === 0 || value.length >= 2, "El nombre debe tener al menos 2 caracteres.");

export const colombianPhoneSchema = z
  .string()
  .trim()
  .refine((value) => normalizeColombianPhone(value) !== null, "Ingresa un celular colombiano válido.");

export const guardianSchema = z.object({
  fullName: optionalGuardianNameSchema,
  phone: colombianPhoneSchema,
});

export const guardianUpdateSchema = guardianSchema.extend({
  active: z.boolean(),
});

export const studentNamesSchema = z
  .array(fullNameSchema)
  .min(1, "Agrega al menos un estudiante.")
  .max(10, "Puedes agregar máximo 10 estudiantes.")
  .refine((names) => new Set(names.map((name) => name.trim().toLocaleLowerCase("es-CO"))).size === names.length, "Cada estudiante debe aparecer una sola vez.");

/** Used by staff and the public welcome page: every new guardian starts with students. */
export const guardianCreationSchema = z.object({
  fullName: fullNameSchema,
  phone: colombianPhoneSchema,
  studentNames: studentNamesSchema,
});

/** Staff can preload only the phone number; the guardian completes their record publicly. */
export const pendingGuardianCreationSchema = z.object({
  phone: colombianPhoneSchema,
});

export const publicGuardianRegistrationSchema = guardianCreationSchema;

export const studentSchema = z.object({
  fullName: fullNameSchema,
});

export const studentUpdateSchema = studentSchema.extend({
  active: z.boolean(),
});

/** Exact format created by createPrivateAccessToken (32 random bytes, base64url). */
export const privateTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Token inválido.");

/** Exact format generated for each cycle's general welcome link. */
export const cycleRegistrationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Enlace inválido.");

export type GuardianValues = z.infer<typeof guardianSchema>;
export type GuardianCreationValues = z.infer<typeof guardianCreationSchema>;
export type PendingGuardianCreationValues = z.infer<typeof pendingGuardianCreationSchema>;
export type GuardianUpdateValues = z.infer<typeof guardianUpdateSchema>;
export type PublicGuardianRegistrationValues = z.infer<typeof publicGuardianRegistrationSchema>;
export type StudentValues = z.infer<typeof studentSchema>;
export type StudentUpdateValues = z.infer<typeof studentUpdateSchema>;
