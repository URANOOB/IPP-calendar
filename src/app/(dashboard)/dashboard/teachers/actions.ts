"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboard } from "@/lib/dashboard/revalidate";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { requireRole } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { TEACHER_AVATAR_TYPES, teacherAvatarError } from "@/lib/validations/teacher-avatar";
import { z } from "zod";

const optionalEmail = z.union([z.string().trim().email().max(254), z.literal("")]).optional();
const timeSchema = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]);
const availabilitySchema = z.object({
  availableDays: z.array(z.number().int().min(1).max(7)).max(7).refine((days) => new Set(days).size === days.length),
  availableFrom: timeSchema,
  availableUntil: timeSchema,
});
function validateAvailability(value: z.infer<typeof availabilitySchema>, context: z.RefinementCtx) {
  if (value.availableDays.length === 0 && (value.availableFrom || value.availableUntil)) context.addIssue({ code: "custom", message: "Selecciona al menos un día para indicar horarios.", path: ["availableDays"] });
  if (value.availableDays.length > 0 && (!value.availableFrom || !value.availableUntil)) context.addIssue({ code: "custom", message: "Indica la hora inicial y final.", path: ["availableFrom"] });
  if (value.availableFrom && value.availableUntil && value.availableFrom >= value.availableUntil) context.addIssue({ code: "custom", message: "La hora final debe ser posterior a la inicial.", path: ["availableUntil"] });
}
const createTeacherSchema = z.object({ displayName: z.string().trim().min(2).max(120), notificationEmail: z.string().trim().email("Ingresa el correo del profesor para sus recordatorios.").max(254) }).safeExtend(availabilitySchema.shape).superRefine(validateAvailability);
export type TeacherActionResult = { success: true } | { success: false; error: string };

export async function createTeacher(values: unknown, formData?: FormData): Promise<TeacherActionResult> {
  const user = await requireDashboardRoute("/dashboard/teachers");
  const parsed = createTeacherSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos del profesor." };
  const file = formData?.get("file");
  if (file && (!(file instanceof File) || teacherAvatarError(file))) {
    return { success: false, error: "Selecciona una imagen JPG, PNG o WebP de máximo 5 MB." };
  }

  const supabase = await createClient();
  const teacherId = crypto.randomUUID();
  let avatarPath: string | null = null;
  if (file instanceof File) {
    avatarPath = `teacher/${teacherId}/${crypto.randomUUID()}.${TEACHER_AVATAR_TYPES.get(file.type)}`;
    const { error } = await supabase.storage.from("teacher-avatars").upload(avatarPath, file, { cacheControl: "3600", contentType: file.type });
    if (error) return { success: false, error: "No fue posible subir la foto. Intenta nuevamente; el profesor aún no se ha creado." };
  }

  // Ownership comes exclusively from the verified session, never browser input.
  const { error } = await supabase.from("teachers").insert({ id: teacherId, profile_id: user.id, display_name: parsed.data.displayName, notification_email: parsed.data.notificationEmail, avatar_path: avatarPath, available_days: parsed.data.availableDays, available_from: parsed.data.availableFrom || null, available_until: parsed.data.availableUntil || null });
  if (error) {
    if (avatarPath) await supabase.storage.from("teacher-avatars").remove([avatarPath]);
    return { success: false, error: "No fue posible crear el profesor. Intenta nuevamente." };
  }
  revalidateDashboard(); revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}

export async function updateTeacher(teacherId: string, values: unknown): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers");
  const parsedId = z.string().uuid().safeParse(teacherId); const parsed = z.object({ displayName: z.string().trim().min(2).max(120), active: z.boolean(), notificationEmail: optionalEmail }).extend(availabilitySchema.shape).superRefine(validateAvailability).safeParse(values);
  if (!parsedId.success || !parsed.success) return { success: false, error: !parsed.success ? parsed.error.issues[0]?.message ?? "Revisa los datos del profesor." : "El profesor no es válido." };
  const supabase = await createClient(); const { data, error } = await supabase.from("teachers").update({ display_name: parsed.data.displayName, active: parsed.data.active, notification_email: parsed.data.notificationEmail || null, available_days: parsed.data.availableDays, available_from: parsed.data.availableFrom || null, available_until: parsed.data.availableUntil || null }).eq("id", parsedId.data).select("id").maybeSingle();
  if (error || !data) return { success: false, error: "No fue posible actualizar el profesor." };
  revalidateDashboard(); revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}

export async function uploadTeacherAvatar(teacherId: string, formData: FormData): Promise<TeacherActionResult> {
  await requireDashboardRoute("/dashboard/teachers");
  const parsedId = z.string().uuid().safeParse(teacherId);
  const file = formData.get("file");
  if (!parsedId.success || !(file instanceof File) || teacherAvatarError(file)) {
    return { success: false, error: "Selecciona una imagen JPG, PNG o WebP de máximo 5 MB." };
  }

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase.from("teachers").select("avatar_path").eq("id", parsedId.data).maybeSingle();
  if (teacherError || !teacher) return { success: false, error: "No encontramos el profesor seleccionado." };

  const path = `teacher/${parsedId.data}/${crypto.randomUUID()}.${TEACHER_AVATAR_TYPES.get(file.type)}`;
  const { error: uploadError } = await supabase.storage.from("teacher-avatars").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (uploadError) return { success: false, error: "No fue posible guardar la foto del profesor." };

  const { error: updateError } = await supabase.from("teachers").update({ avatar_path: path }).eq("id", parsedId.data);
  if (updateError) {
    await supabase.storage.from("teacher-avatars").remove([path]);
    return { success: false, error: "No fue posible asociar la foto al profesor." };
  }

  if (teacher.avatar_path) await supabase.storage.from("teacher-avatars").remove([teacher.avatar_path]);
  revalidateDashboard(); revalidatePath("/dashboard/teachers");
  return { success: true };
}

export async function deleteTeacher(teacherId: string): Promise<TeacherActionResult> {
  await requireRole("admin"); const parsed = z.string().uuid().safeParse(teacherId); if (!parsed.success) return { success: false, error: "El profesor seleccionado no es válido." };
  const supabase = await createClient(); const { data: teacher } = await supabase.from("teachers").select("avatar_path").eq("id", parsed.data).maybeSingle();
  const { error } = await supabase.rpc("delete_teacher", { p_teacher_id: parsed.data });
  if (error) return { success: false, error: "No fue posible eliminar el profesor y sus clases." };
  if (teacher?.avatar_path) await supabase.storage.from("teacher-avatars").remove([teacher.avatar_path]);
  revalidateDashboard(); revalidatePath("/dashboard/teachers"); revalidatePath("/dashboard/classes"); return { success: true };
}
