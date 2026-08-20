import { z } from "zod";

/** Ready for the future staff-only Supabase Auth form. */
export const signInSchema = z.object({
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignInValues = z.infer<typeof signInSchema>;
