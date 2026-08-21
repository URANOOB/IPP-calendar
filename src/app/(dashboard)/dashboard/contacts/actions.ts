"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { createPrivateAccessToken, hashPrivateAccessToken } from "@/lib/utils/private-token";
import { normalizeColombianPhone } from "@/lib/utils/phone";
import {
  guardianIdSchema,
  guardianSchema,
  guardianUpdateSchema,
  studentIdSchema,
  studentSchema,
  studentUpdateSchema,
} from "@/lib/validations/guardians";

export type ContactActionResult =
  | { success: true; guardianId?: string; tokenPath?: string }
  | { success: false; error: string };

function revalidateContacts(guardianId?: string) {
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/contactos");
  if (guardianId) {
    revalidatePath(`/dashboard/contacts/${guardianId}`);
  }
}

function isDuplicatePhone(error: { code?: string } | null) {
  return error?.code === "23505";
}

function isStudentLimitError(error: { message?: string } | null) {
  return error?.message?.includes("maximum of four students") ?? false;
}

export async function createGuardian(values: unknown): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const parsed = guardianSchema.safeParse(values);
  const phone = parsed.success ? normalizeColombianPhone(parsed.data.phone) : null;

  if (!parsed.success || !phone) {
    return { success: false, error: "Revisa el nombre y el número telefónico." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .insert({ full_name: parsed.data.fullName, phone })
    .select("id")
    .single();

  if (isDuplicatePhone(error)) {
    return { success: false, error: "Ya existe un acudiente registrado con este número." };
  }

  if (error || !data) {
    console.error("No fue posible crear el acudiente.");
    return { success: false, error: "No fue posible crear el acudiente. Inténtalo nuevamente." };
  }

  revalidateContacts();
  return { success: true, guardianId: data.id };
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
    .update({ full_name: parsed.data.fullName, phone, active: parsed.data.active })
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
    .eq("guardian_id", id.data);

  if (countError) return { success: false, error: "No fue posible verificar los estudiantes del acudiente." };
  if ((count ?? 0) >= 4) return { success: false, error: "Este acudiente ya tiene el máximo de 4 estudiantes." };

  const { error } = await supabase.from("students").insert({ guardian_id: id.data, full_name: parsed.data.fullName });
  if (isStudentLimitError(error)) return { success: false, error: "Este acudiente ya tiene el máximo de 4 estudiantes." };
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

export async function generateGuardianLink(guardianId: string): Promise<ContactActionResult> {
  await requireDashboardRoute("/dashboard/contacts");
  const id = guardianIdSchema.safeParse(guardianId);
  if (!id.success) return { success: false, error: "El acudiente seleccionado no es válido." };

  const token = createPrivateAccessToken();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .update({ access_token_hash: hashPrivateAccessToken(token) })
    .eq("id", id.data)
    .eq("active", true)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("No fue posible generar el enlace privado.");
    return { success: false, error: "No fue posible generar el enlace privado." };
  }

  revalidateContacts(id.data);
  return { success: true, tokenPath: `/clases/t/${token}` };
}
