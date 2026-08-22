"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { normalizeColombianPhone } from "@/lib/utils/phone";
import {
  guardianIdSchema,
  guardianCreationSchema,
  pendingGuardianCreationSchema,
  guardianUpdateSchema,
  studentIdSchema,
  studentSchema,
  studentUpdateSchema,
} from "@/lib/validations/guardians";

export type ContactActionResult =
  | { success: true; guardianId?: string }
  | { success: false; error: string };

function revalidateContacts(guardianId?: string) {
  revalidatePath("/dashboard/contacts");
  if (guardianId) {
    revalidatePath(`/dashboard/contacts/${guardianId}`);
  }
}

function isDuplicatePhone(error: { code?: string } | null) {
  return error?.code === "23505";
}

function isStudentLimitError(error: { message?: string } | null) {
  return error?.message?.includes("more than ten active students") ?? false;
}

export async function createGuardian(values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const parsed = guardianCreationSchema.safeParse(values);
  const phone = parsed.success ? normalizeColombianPhone(parsed.data.phone) : null;

  if (!parsed.success || !phone) {
    return { success: false, error: "Revisa el nombre, celular y estudiantes del acudiente." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_guardian_with_students", {
    p_full_name: parsed.data.fullName,
    p_phone: phone,
    p_student_names: parsed.data.studentNames,
  });

  if (isDuplicatePhone(error) || error?.message.includes("Ya existe un acudiente")) {
    return { success: false, error: "Ya existe un acudiente registrado con este número." };
  }

  if (isStudentLimitError(error)) return { success: false, error: "Este acudiente ya tiene el máximo de 10 estudiantes activos." };

  if (error || !data) {
    console.error("No fue posible crear el acudiente.");
    return { success: false, error: "No fue posible crear el acudiente. Inténtalo nuevamente." };
  }

  revalidateContacts();
  return { success: true, guardianId: data };
}

export async function createPendingGuardian(values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const parsed = pendingGuardianCreationSchema.safeParse(values);
  const phone = parsed.success ? normalizeColombianPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { success: false, error: "Ingresa un celular colombiano válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_pending_guardian", { p_phone: phone });
  if (isDuplicatePhone(error) || error?.message.includes("Ya existe un acudiente")) return { success: false, error: "Ya existe un acudiente registrado con este número." };
  if (error || !data) return { success: false, error: "No fue posible guardar el número del acudiente." };

  revalidateContacts();
  revalidatePath("/dashboard/tracking");
  return { success: true, guardianId: data };
}

export async function updateGuardian(guardianId: string, values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = guardianIdSchema.safeParse(guardianId);
  const parsed = guardianUpdateSchema.safeParse(values);
  const phone = parsed.success ? normalizeColombianPhone(parsed.data.phone) : null;

  if (!id.success || !parsed.success || !phone) {
    return { success: false, error: "Revisa los datos del acudiente." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .update({ full_name: parsed.data.fullName || null, phone, active: parsed.data.active })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (isDuplicatePhone(error)) {
    return { success: false, error: "Ya existe un acudiente registrado con este número." };
  }

  if (error || !data) {
    console.error("No fue posible actualizar el acudiente.");
    return { success: false, error: "No fue posible actualizar el acudiente." };
  }

  revalidateContacts(id.data);
  return { success: true };
}

export async function deactivateGuardian(guardianId: string): Promise<ContactActionResult> {
  const result = await updateGuardianActive(guardianId, false);
  return result;
}

export async function deleteGuardian(guardianId: string): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = guardianIdSchema.safeParse(guardianId); if (!id.success) return { success: false, error: "El acudiente seleccionado no es válido." };
  const supabase = await createClient(); const { error } = await supabase.rpc("delete_guardian", { p_guardian_id: id.data });
  if (error) return { success: false, error: "No fue posible eliminar el acudiente y sus datos relacionados." };
  revalidateContacts(); revalidatePath("/dashboard/students"); revalidatePath("/dashboard/tracking"); return { success: true };
}

async function updateGuardianActive(guardianId: string, active: boolean): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = guardianIdSchema.safeParse(guardianId);
  if (!id.success) return { success: false, error: "El acudiente seleccionado no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("guardians").update({ active }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { success: false, error: "No fue posible actualizar el estado del acudiente." };

  revalidateContacts(id.data);
  return { success: true };
}

export async function createStudent(guardianId: string, values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = guardianIdSchema.safeParse(guardianId);
  const parsed = studentSchema.safeParse(values);
  if (!id.success || !parsed.success) return { success: false, error: "Revisa el nombre del estudiante." };

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("guardian_id", id.data)
    .eq("active", true);

  if (countError) return { success: false, error: "No fue posible verificar los estudiantes del acudiente." };
  if ((count ?? 0) >= 10) return { success: false, error: "Este acudiente ya tiene el máximo de 10 estudiantes activos." };

  const { error } = await supabase.from("students").insert({ guardian_id: id.data, full_name: parsed.data.fullName });
  if (isStudentLimitError(error)) return { success: false, error: "Este acudiente ya tiene el máximo de 10 estudiantes activos." };
  if (error) {
    console.error("No fue posible crear el estudiante.");
    return { success: false, error: "No fue posible crear el estudiante." };
  }

  revalidateContacts(id.data);
  return { success: true };
}

export async function updateStudent(studentId: string, values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = studentIdSchema.safeParse(studentId);
  const parsed = studentUpdateSchema.safeParse(values);
  if (!id.success || !parsed.success) return { success: false, error: "Revisa los datos del estudiante." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ full_name: parsed.data.fullName, active: parsed.data.active })
    .eq("id", id.data)
    .select("guardian_id")
    .maybeSingle();
  if (error || !data) return { success: false, error: "No fue posible actualizar el estudiante." };

  revalidateContacts(data.guardian_id);
  return { success: true };
}

export async function deactivateStudent(studentId: string): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = studentIdSchema.safeParse(studentId);
  if (!id.success) return { success: false, error: "El estudiante seleccionado no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ active: false })
    .eq("id", id.data)
    .select("guardian_id")
    .maybeSingle();
  if (error || !data) return { success: false, error: "No fue posible desactivar el estudiante." };

  revalidateContacts(data.guardian_id);
  return { success: true };
}

export async function deleteStudent(studentId: string): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = studentIdSchema.safeParse(studentId); if (!id.success) return { success: false, error: "El estudiante seleccionado no es válido." };
  const supabase = await createClient(); const { error } = await supabase.rpc("delete_student", { p_student_id: id.data });
  if (error) return { success: false, error: "No fue posible eliminar el estudiante." };
  revalidateContacts(); revalidatePath("/dashboard/students"); revalidatePath("/dashboard/tracking"); return { success: true };
}
