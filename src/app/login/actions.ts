"use server";

import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validations/auth";

export type SignInResult = { error: string } | undefined;

export async function signIn(values: unknown): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "Revisa el correo y la contraseña ingresados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.error("Error de inicio de sesión.", error);
    return { error: "Correo o contraseña incorrectos." };
  }

  const auth = await getAuthState();
  if (auth.kind !== "authenticated") {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no está habilitada para acceder al panel interno." };
  }

  redirect("/dashboard");
}
