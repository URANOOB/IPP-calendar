"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export interface PlatformSearchResult {
  id: string;
  label: string;
  description: string;
  href: string;
  type: "Acudiente" | "Estudiante" | "Profesor" | "Clase" | "Ciclo";
}

const idSchema = z.string().uuid();

function searchTerm(value: string) {
  return value.trim().replace(/[%_(),.]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

export async function searchPlatform(value: string): Promise<PlatformSearchResult[]> {
  await requireDashboardRoute("/dashboard");
  const term = searchTerm(value);
  if (term.length < 2) return [];
  const pattern = `%${term}%`;
  const supabase = await createClient();

  const [guardians, students, teachers, classes, cycles] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone").or(`full_name.ilike.${pattern},phone.ilike.${pattern}`).limit(6),
    supabase.from("students").select("id, full_name").ilike("full_name", pattern).limit(6),
    supabase.from("teachers").select("id, display_name, notification_email").or(`display_name.ilike.${pattern},notification_email.ilike.${pattern}`).limit(6),
    supabase.from("classes").select("id, title, description").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(6),
    supabase.from("weekly_cycles").select("id, name, status").ilike("name", pattern).limit(6),
  ]);

  if ([guardians, students, teachers, classes, cycles].some((result) => result.error)) {
    throw new Error("No se pudo completar la búsqueda.");
  }

  return [
    ...(guardians.data ?? []).map((item) => ({ id: item.id, label: item.full_name ?? item.phone, description: item.phone, href: `/dashboard/contacts/${item.id}`, type: "Acudiente" as const })),
    ...(students.data ?? []).map((item) => ({ id: item.id, label: item.full_name, description: "Estudiante", href: `/dashboard/students/${item.id}`, type: "Estudiante" as const })),
    ...(teachers.data ?? []).map((item) => ({ id: item.id, label: item.display_name, description: item.notification_email ?? "Profesor", href: "/dashboard/teachers", type: "Profesor" as const })),
    ...(classes.data ?? []).map((item) => ({ id: item.id, label: item.title, description: item.description ?? "Clase", href: `/dashboard/classes/${item.id}`, type: "Clase" as const })),
    ...(cycles.data ?? []).map((item) => ({ id: item.id, label: item.name, description: item.status === "open" ? "Ciclo activo" : "Ciclo inactivo", href: `/dashboard/cycles/${item.id}`, type: "Ciclo" as const })),
  ];
}

export async function deletePlatformActivity(activityId: string): Promise<{ success: boolean; error?: string }> {
  await requireDashboardRoute("/dashboard");
  const parsed = idSchema.safeParse(activityId);
  if (!parsed.success) return { success: false };
  const supabase = await createClient();
  const { error } = await supabase.from("platform_activity").delete().eq("id", parsed.data);
  if (error) return { success: false };
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function clearPlatformActivity(through: string): Promise<{ success: boolean; error?: string }> {
  await requireDashboardRoute("/dashboard");
  const parsed = z.string().datetime({ offset: true }).safeParse(through);
  if (!parsed.success || new Date(parsed.data).getTime() > Date.now()) return { success: false, error: "No se pudo validar la fecha de las notificaciones." };
  const supabase = await createClient();
  // Preserve activity that arrives after the newest notification in the user's view.
  const { error } = await supabase.from("platform_activity").delete().lte("created_at", parsed.data);
  if (error) return { success: false, error: "No se pudieron limpiar las notificaciones. Intenta nuevamente." };
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
