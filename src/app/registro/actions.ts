"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboard } from "@/lib/dashboard/revalidate";

import { createClient } from "@/lib/supabase/server";
import { createPrivateAccessToken, hashPrivateAccessToken } from "@/lib/utils/private-token";
import { normalizeColombianPhone } from "@/lib/utils/phone";
import { publicGuardianRegistrationSchema } from "@/lib/validations/guardians";

export type ActivateGuardianAccessResult =
  | { success: true; privateToken: string }
  | { success: false; error: string };

function friendlyActivationError(message?: string) {
  const knownErrors = [
    "Este enlace general no está disponible para inscripciones en este momento.",
    "Ingresa un celular colombiano válido.",
    "Ingresa tu nombre completo.",
    "Este acudiente está inactivo. Pide ayuda a la organización.",
    "Este registro no tiene estudiantes activos. Pide ayuda a la organización.",
    "Agrega entre uno y diez estudiantes.",
    "Revisa los nombres de los estudiantes.",
    "Cada estudiante debe aparecer una sola vez.",
  ];
  if (message?.includes("more than ten active students")) return "Puedes registrar máximo 10 estudiantes activos.";
  return knownErrors.find((error) => message?.includes(error)) ?? "No fue posible activar tu enlace privado. Inténtalo nuevamente.";
}

export async function activateGuardianCycleAccess(values: unknown): Promise<ActivateGuardianAccessResult> {
  const parsedValues = publicGuardianRegistrationSchema.safeParse(values);
  const phone = parsedValues.success ? normalizeColombianPhone(parsedValues.data.phone) : null;
  if (!parsedValues.success || !phone) return { success: false, error: "Escribe tu nombre, celular y al menos un estudiante." };

  const privateToken = createPrivateAccessToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activate_guardian_cycle_access", {
    p_phone: phone,
    p_full_name: parsedValues.data.fullName,
    p_student_names: parsedValues.data.studentNames,
    p_access_token: privateToken,
    p_token_hash: hashPrivateAccessToken(privateToken),
  });
  const activatedToken = data?.[0]?.access_token;
  if (error || !activatedToken) return { success: false, error: friendlyActivationError(error?.message) };

  revalidateDashboard();
  revalidatePath(`/clases/t/${activatedToken}`);
  return { success: true, privateToken: activatedToken };
}
