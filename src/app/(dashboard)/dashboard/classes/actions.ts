"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateDashboard } from "@/lib/dashboard/revalidate";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { requireRole } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { bogotaInputToUtc } from "@/lib/cycles/dates";
import { classIdSchema, classSchema, teacherIdSchema } from "@/lib/validations/classes";

export type ClassActionResult = { success: true; classId?: string } | { success: false; error: string };

function refreshClasses(classId?: string) {
  revalidateDashboard();
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  if (classId) revalidatePath(`/dashboard/classes/${classId}`);
}

function classError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23P01") return "Este profesor ya tiene una clase que se solapa con ese horario.";
  if (error?.message?.includes("within its weekly cycle")) return "La clase debe ocurrir dentro del rango de su ciclo.";
  if (error?.message?.includes("active cycle")) return "Solo puedes asociar clases a ciclos activos.";
  if (error?.message?.includes("active teacher")) return "Selecciona un profesor activo.";
  if (error?.code === "23503") return "No puedes cambiar de ciclo una clase que ya tiene inscripciones.";
  if (error?.code === "23514") return "Los datos de horario o cupo no son válidos. La capacidad debe estar entre 1 y 4.";
  if (error?.message?.includes("capacity cannot be lower")) return "La capacidad no puede ser menor que los estudiantes inscritos.";
  return null;
}

async function resolveTeacherId(values: { teacherId?: string }): Promise<{ teacherId: string } | { error: string }> {
  await requireDashboardRoute("/dashboard/classes");
  const parsed = teacherIdSchema.safeParse(values.teacherId);
  return parsed.success ? { teacherId: parsed.data } : { error: "Selecciona un profesor válido." };
}

export async function createClass(values: unknown): Promise<ClassActionResult> {
  await requireDashboardRoute("/dashboard/classes");
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Revisa los datos de la clase." };
  const assigned = await resolveTeacherId(parsed.data);
  if ("error" in assigned) return { success: false, error: assigned.error };
  const starts = bogotaInputToUtc(parsed.data.startsAt);
  const ends = bogotaInputToUtc(parsed.data.endsAt);
  if (!starts || !ends) return { success: false, error: "Revisa el horario de la clase." };

  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase.from("weekly_cycles").select("status, starts_at, ends_at").eq("id", parsed.data.cycleId).maybeSingle();
  if (cycleError || !cycle || cycle.status !== "open") return { success: false, error: "Solo puedes asociar clases a ciclos activos." };
  if (starts < new Date(cycle.starts_at) || ends > new Date(cycle.ends_at)) return { success: false, error: "La clase debe ocurrir dentro del inicio y el fin de su ciclo." };
  const { data, error } = await supabase.from("classes").insert({ teacher_id: assigned.teacherId, cycle_id: parsed.data.cycleId, title: parsed.data.title, description: parsed.data.description || null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: parsed.data.capacity, meeting_url: parsed.data.meetingUrl, status: "published" }).select("id").single();
  const message = classError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible crear la clase." };
  refreshClasses();
  return { success: true, classId: data.id };
}

export async function updateClass(classId: string, values: unknown): Promise<ClassActionResult> {
  await requireDashboardRoute("/dashboard/classes");
  const id = classIdSchema.safeParse(classId);
  const parsed = classSchema.safeParse(values);
  if (!id.success || !parsed.success) return { success: false, error: "Revisa los datos de la clase." };
  const assigned = await resolveTeacherId(parsed.data);
  if ("error" in assigned) return { success: false, error: assigned.error };
  const starts = bogotaInputToUtc(parsed.data.startsAt);
  const ends = bogotaInputToUtc(parsed.data.endsAt);
  if (!starts || !ends) return { success: false, error: "Revisa el horario de la clase." };
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from("classes").select("*").eq("id", id.data).maybeSingle();
  if (existingError || !existing) return { success: false, error: "No tienes permiso para editar esta clase." };
  if (existing.status !== "draft" && existing.status !== "published") return { success: false, error: "Esta clase ya no puede editarse." };
  const { data, error } = await supabase.from("classes").update({ title: parsed.data.title, description: parsed.data.description || null, meeting_url: parsed.data.meetingUrl || null, cycle_id: parsed.data.cycleId, teacher_id: assigned.teacherId, starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: parsed.data.capacity }).eq("id", id.data).select("id").maybeSingle();
  const message = classError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible actualizar la clase." };
  refreshClasses(id.data);
  return { success: true };
}

export async function deleteClass(classId: string): Promise<ClassActionResult> {
  await requireRole("admin");
  const id = classIdSchema.safeParse(classId); if (!id.success) return { success: false, error: "La clase seleccionada no es válida." };
  const supabase = await createClient(); const { error } = await supabase.rpc("delete_class", { p_class_id: id.data });
  if (error) return { success: false, error: "No fue posible eliminar la clase y sus inscripciones." };
  refreshClasses(id.data); return { success: true };
}

export async function saveClassAttendance(classId: string, entries: { registrationId: string; status: "attended" | "absent" }[]): Promise<ClassActionResult> {
  await requireDashboardRoute("/dashboard/classes");
  const id = classIdSchema.safeParse(classId);
  const parsed = z.array(z.object({ registrationId: z.string().uuid(), status: z.enum(["attended", "absent"]) })).min(1).max(4).refine((items) => new Set(items.map((item) => item.registrationId)).size === items.length).safeParse(entries);
  if (!id.success || !parsed.success) return { success: false, error: "La asistencia no pudo guardarse." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_class_attendance", { p_class_id: id.data, p_entries: parsed.data.map((entry) => ({ registration_id: entry.registrationId, status: entry.status })) });
  if (error) return { success: false, error: error.message.includes("permisos") ? "No tienes permisos para registrar asistencia." : "La asistencia no pudo guardarse." };
  refreshClasses(id.data); return { success: true };
}
