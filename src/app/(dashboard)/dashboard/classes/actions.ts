"use server";

import { revalidatePath } from "next/cache";

import { requireUser, getCurrentTeacher } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { bogotaInputToUtc } from "@/lib/cycles/dates";
import { classIdSchema, classSchema, teacherIdSchema } from "@/lib/validations/classes";

export type ClassActionResult = { success: true; classId?: string } | { success: false; error: string };

function refreshClasses(classId?: string) {
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/clases");
  revalidatePath("/dashboard/my-classes");
  if (classId) revalidatePath(`/dashboard/classes/${classId}`);
}

function classError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23P01") return "Este profesor ya tiene una clase que se solapa con ese horario.";
  if (error?.message?.includes("within its weekly cycle")) return "La clase debe ocurrir dentro del rango de su ciclo.";
  if (error?.code === "23514") return "Los datos de horario o cupo no son válidos.";
  return null;
}

async function resolveTeacherId(values: { teacherId?: string }): Promise<{ teacherId: string } | { error: string }> {
  const user = await requireUser();
  if (user.role === "teacher") {
    const teacher = await getCurrentTeacher();
    return teacher ? { teacherId: teacher.id } : { error: "Tu cuenta no tiene un perfil de profesor activo." };
  }
  if (user.role !== "admin") return { error: "No tienes permisos para modificar clases." };
  const parsed = teacherIdSchema.safeParse(values.teacherId);
  return parsed.success ? { teacherId: parsed.data } : { error: "Selecciona un profesor válido." };
}

export async function createClass(values: unknown): Promise<ClassActionResult> {
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Revisa los datos de la clase." };
  const assigned = await resolveTeacherId(parsed.data);
  if ("error" in assigned) return { success: false, error: assigned.error };
  const starts = bogotaInputToUtc(parsed.data.startsAt);
  const ends = bogotaInputToUtc(parsed.data.endsAt);
  if (!starts || !ends) return { success: false, error: "Revisa el horario de la clase." };

  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase.from("weekly_cycles").select("status").eq("id", parsed.data.cycleId).maybeSingle();
  if (cycleError || !cycle || (cycle.status !== "draft" && cycle.status !== "open")) return { success: false, error: "Solo puedes crear clases en ciclos borrador o abiertos." };
  const { data, error } = await supabase.from("classes").insert({ teacher_id: assigned.teacherId, cycle_id: parsed.data.cycleId, title: parsed.data.title, description: parsed.data.description || null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: parsed.data.capacity, meeting_url: parsed.data.meetingUrl || null, status: "draft" }).select("id").single();
  const message = classError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible crear la clase." };
  refreshClasses();
  return { success: true, classId: data.id };
}

export async function updateClass(classId: string, values: unknown): Promise<ClassActionResult> {
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
  if (existingError || !existing || existing.teacher_id !== assigned.teacherId) return { success: false, error: "No tienes permiso para editar esta clase." };
  if (existing.status !== "draft" && existing.status !== "published") return { success: false, error: "Esta clase ya no puede editarse." };
  if (existing.status === "published" && (existing.cycle_id !== parsed.data.cycleId || existing.starts_at !== starts.toISOString() || existing.ends_at !== ends.toISOString() || existing.capacity !== parsed.data.capacity || existing.teacher_id !== assigned.teacherId)) return { success: false, error: "En una clase publicada solo puedes cambiar título, descripción y enlace." };
  const { data, error } = await supabase.from("classes").update({ title: parsed.data.title, description: parsed.data.description || null, meeting_url: parsed.data.meetingUrl || null, ...(existing.status === "draft" ? { cycle_id: parsed.data.cycleId, teacher_id: assigned.teacherId, starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: parsed.data.capacity } : {}) }).eq("id", id.data).select("id").maybeSingle();
  const message = classError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible actualizar la clase." };
  refreshClasses(id.data);
  return { success: true };
}

export async function publishClass(classId: string): Promise<ClassActionResult> { return setClassStatus(classId, "draft", "published"); }
export async function cancelClass(classId: string): Promise<ClassActionResult> { return setClassStatus(classId, "published", "cancelled"); }
export async function completeClass(classId: string): Promise<ClassActionResult> { return setClassStatus(classId, "published", "completed"); }

export async function saveClassAttendance(classId: string, entries: { registrationId: string; status: "attended" | "absent" }[]): Promise<ClassActionResult> {
  const id = classIdSchema.safeParse(classId);
  if (!id.success || !Array.isArray(entries) || entries.length === 0 || entries.some((entry) => typeof entry.registrationId !== "string" || (entry.status !== "attended" && entry.status !== "absent"))) return { success: false, error: "La asistencia no pudo guardarse." };
  await requireUser(); const supabase = await createClient();
  const { error } = await supabase.rpc("record_class_attendance", { p_class_id: id.data, p_entries: entries.map((entry) => ({ registration_id: entry.registrationId, status: entry.status })) });
  if (error) return { success: false, error: error.message.includes("permisos") ? "No tienes permisos para registrar asistencia." : "La asistencia no pudo guardarse." };
  refreshClasses(id.data); return { success: true };
}

async function setClassStatus(classId: string, source: "draft" | "published", target: "published" | "cancelled" | "completed"): Promise<ClassActionResult> {
  const id = classIdSchema.safeParse(classId);
  if (!id.success) return { success: false, error: "La clase seleccionada no es válida." };
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "teacher") return { success: false, error: "No tienes permisos para modificar clases." };
  const teacher = user.role === "teacher" ? await getCurrentTeacher() : null;
  if (user.role === "teacher" && !teacher) return { success: false, error: "Tu cuenta no tiene un perfil de profesor activo." };
  const supabase = await createClient();
  let query = supabase.from("classes").update({ status: target }).eq("id", id.data).eq("status", source);
  if (teacher) query = query.eq("teacher_id", teacher.id);
  const { data, error } = await query.select("id").maybeSingle();
  const message = classError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "La transición de estado no es válida o no tienes permiso." };
  refreshClasses(id.data);
  return { success: true };
}
