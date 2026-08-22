"use server";

import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validations/auth";

export type SignInResult = { error: string } | undefined;

export async function signIn(values: unknown): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    return { error: "Revisa el usuario y la contraseña ingresados." };
  }

  const supabase = await createClient();
  // Usernames are a UI-only identifier; the Auth email convention never leaves this server action.
  const email = `${parsed.data.username.toLowerCase()}@ipp.local`;
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (error) {
    console.error("Error de inicio de sesión.", error);
    return { error: "Usuario o contraseña incorrectos." };
  }

  const auth = await getAuthState();
  if (auth.kind !== "authenticated") {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no está habilitada para acceder al panel interno." };
  }

  redirect("/dashboard");
}
