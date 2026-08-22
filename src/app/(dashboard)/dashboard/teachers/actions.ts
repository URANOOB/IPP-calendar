"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { requireRole } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const optionalEmail = z.union([z.string().trim().email().max(254), z.literal("")]).optional();
const timeSchema = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]);
const availabilitySchema = z.object({
  availableDays: z.array(z.number().int().min(1).max(7)).max(7).refine((days) => new Set(days).size === days.length),
  availableFrom: timeSchema,
  availableUntil: timeSchema,
}).superRefine((value, context) => {
  if (value.availableDays.length === 0 && (value.availableFrom || value.availableUntil)) context.addIssue({ code: "custom", message: "Selecciona al menos un día para indicar horarios.", path: ["availableDays"] });
  if (value.availableDays.length > 0 && (!value.availableFrom || !value.availableUntil)) context.addIssue({ code: "custom", message: "Indica la hora inicial y final.", path: ["availableFrom"] });
  if (value.availableFrom && value.availableUntil && value.availableFrom >= value.availableUntil) context.addIssue({ code: "custom", message: "La hora final debe ser posterior a la inicial.", path: ["availableUntil"] });
});
const createTeacherSchema = z.object({ profileId: z.string().uuid(), displayName: z.string().trim().min(2).max(120), notificationEmail: optionalEmail }).merge(availabilitySchema);
export type TeacherActionResult = { success: true } | { success: false; error: string };

export async function createTeacher(values: unknown): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers"); const parsed = createTeacherSchema.safeParse(values); if (!parsed.success) return { success: false, error: "Selecciona un usuario y un nombre válido." };
  const supabase = await createClient(); const { error } = await supabase.from("teachers").insert({ profile_id: parsed.data.profileId, display_name: parsed.data.displayName, notification_email: parsed.data.notificationEmail || null, available_days: parsed.data.availableDays, available_from: parsed.data.availableFrom || null, available_until: parsed.data.availableUntil || null });
  if (error?.code === "23505") return { success: false, error: "Este usuario ya está asociado a un profesor." }; if (error) return { success: false, error: "No fue posible crear el profesor. Verifica que el perfil exista y esté activo." };
  revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}

export async function updateTeacher(teacherId: string, values: unknown): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers");
  const parsedId = z.string().uuid().safeParse(teacherId); const parsed = z.object({ displayName: z.string().trim().min(2).max(120), active: z.boolean(), notificationEmail: optionalEmail }).merge(availabilitySchema).safeParse(values);
  if (!parsedId.success || !parsed.success) return { success: false, error: "Revisa los datos del profesor." };
  const supabase = await createClient(); const { error } = await supabase.from("teachers").update({ display_name: parsed.data.displayName, active: parsed.data.active, notification_email: parsed.data.notificationEmail || null, available_days: parsed.data.availableDays, available_from: parsed.data.availableFrom || null, available_until: parsed.data.availableUntil || null }).eq("id", parsedId.data);
  if (error) return { success: false, error: "No fue posible actualizar el profesor." };
  revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}

export async function uploadTeacherAvatar(teacherId: string, formData: FormData): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers");
  const parsedId = z.string().uuid().safeParse(teacherId);
  const file = formData.get("file");
  const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
  if (!parsedId.success || !(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    return { success: false, error: "Selecciona una imagen JPG, PNG o WebP de máximo 5 MB." };
  }

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase.from("teachers").select("avatar_path").eq("id", parsedId.data).maybeSingle();
  if (teacherError || !teacher) return { success: false, error: "No encontramos el profesor seleccionado." };

  const path = `teacher/${parsedId.data}/${crypto.randomUUID()}.${allowedTypes.get(file.type)}`;
  const { error: uploadError } = await supabase.storage.from("teacher-avatars").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (uploadError) return { success: false, error: "No fue posible guardar la foto del profesor." };

  const { error: updateError } = await supabase.from("teachers").update({ avatar_path: path }).eq("id", parsedId.data);
  if (updateError) {
    await supabase.storage.from("teacher-avatars").remove([path]);
    return { success: false, error: "No fue posible asociar la foto al profesor." };
  }

  if (teacher.avatar_path) await supabase.storage.from("teacher-avatars").remove([teacher.avatar_path]);
  revalidatePath("/dashboard/teachers");
  return { success: true };
}

export async function deleteTeacher(teacherId: string): Promise<TeacherActionResult> {
  await requireRole("admin"); const parsed = z.string().uuid().safeParse(teacherId); if (!parsed.success) return { success: false, error: "El profesor seleccionado no es válido." };
  const supabase = await createClient(); const { data: teacher } = await supabase.from("teachers").select("avatar_path").eq("id", parsed.data).maybeSingle();
  const { error } = await supabase.rpc("delete_teacher", { p_teacher_id: parsed.data });
  if (error) return { success: false, error: "No fue posible eliminar el profesor, sus clases y su cuenta." };
  if (teacher?.avatar_path) await supabase.storage.from("teacher-avatars").remove([teacher.avatar_path]);
  revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}
