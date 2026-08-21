"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createTeacherSchema = z.object({ profileId: z.string().uuid(), displayName: z.string().trim().min(2).max(120) });
export type TeacherActionResult = { success: true } | { success: false; error: string };

export async function createTeacher(values: unknown): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers"); const parsed = createTeacherSchema.safeParse(values); if (!parsed.success) return { success: false, error: "Selecciona un usuario y un nombre válido." };
  const supabase = await createClient(); const { error } = await supabase.from("teachers").insert({ profile_id: parsed.data.profileId, display_name: parsed.data.displayName });
  if (error?.code === "23505") return { success: false, error: "Este usuario ya está asociado a un profesor." }; if (error) return { success: false, error: "No fue posible crear el profesor. Verifica que el perfil tenga rol de profesor." };
  revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}
