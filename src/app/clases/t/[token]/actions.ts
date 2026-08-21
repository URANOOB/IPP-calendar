"use server";

import { revalidatePath } from "next/cache";

import { hashPrivateAccessToken } from "@/lib/utils/private-token";
import { privateTokenSchema } from "@/lib/validations/guardians";
import { publicClassSelectionsSchema } from "@/lib/validations/public-registration";
import { studentIdSchema } from "@/lib/validations/guardians";
import { createClient } from "@/lib/supabase/server";

export type PublicRegistrationActionResult = { success: true } | { success: false; error: string };

function friendlyBookingError(message?: string) {
  const knownErrors = ["Este enlace no es válido o ya no está disponible.", "Las inscripciones aún no están disponibles.", "Las inscripciones de esta semana ya finalizaron.", "Cada niño solo puede tener una clase esta semana.", "Uno de tus niños ya tiene una clase programada esta semana.", "Esta clase acaba de llenarse.", "La clase seleccionada ya no está disponible."];
  return knownErrors.find((error) => message?.includes(error)) ?? "No pudimos completar la inscripción. Revisa las clases seleccionadas.";
}

/** The token and every submitted ID are re-checked inside the transactional database RPC. */
export async function confirmPublicClassSelections(token: string, selections: unknown): Promise<PublicRegistrationActionResult> {
  const parsedToken = privateTokenSchema.safeParse(token);
  const parsedSelections = publicClassSelectionsSchema.safeParse(selections);
  if (!parsedToken.success || !parsedSelections.success) return { success: false, error: "Revisa las clases seleccionadas antes de confirmar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_guardian_classes", { token_hash: hashPrivateAccessToken(parsedToken.data), selections: parsedSelections.data.map((selection) => ({ student_id: selection.studentId, class_id: selection.classId })) });
  if (error) return { success: false, error: friendlyBookingError(error.message) };
  revalidatePath(`/clases/t/${parsedToken.data}`);
  return { success: true };
}

export async function getPublicMeetingAccess(token: string, studentId: string, classId: string): Promise<{ success: true; meetingUrl: string } | { success: false; error: string }> {
  const parsedToken = privateTokenSchema.safeParse(token); const parsedStudent = studentIdSchema.safeParse(studentId); const parsedClass = studentIdSchema.safeParse(classId);
  if (!parsedToken.success || !parsedStudent.success || !parsedClass.success) return { success: false, error: "El enlace no está disponible todavía." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guardian_meeting_access", { token_hash: hashPrivateAccessToken(parsedToken.data), requested_student_id: parsedStudent.data, requested_class_id: parsedClass.data });
  if (error || !data) return { success: false, error: "El enlace no está disponible todavía." };
  return { success: true, meetingUrl: data };
}
