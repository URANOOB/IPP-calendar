import { z } from "zod";

export const signInSchema = z.object({
  username: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,31}$/i, "Ingresa un usuario válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignInValues = z.infer<typeof signInSchema>;
