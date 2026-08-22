"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { guardianIdSchema } from "@/lib/validations/guardians";
import { createClient } from "@/lib/supabase/server";

type TrackingResult = { success: true; message?: string } | { success: false; error: string };
const refresh = () => { revalidatePath("/dashboard/tracking"); revalidatePath("/dashboard/contacts"); };
const reminderLeadMinutes = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440] as const;
const reminderLeadSchema = z.number().int().refine((value) => reminderLeadMinutes.includes(value as typeof reminderLeadMinutes[number]), "La anticipación del recordatorio no es válida.");
const reminderSettingsSchema = z.object({ firstEnabled: z.boolean(), firstLeadMinutes: reminderLeadSchema, secondEnabled: z.boolean(), secondLeadMinutes: reminderLeadSchema }).refine((value) => !value.firstEnabled || !value.secondEnabled || value.firstLeadMinutes !== value.secondLeadMinutes, { message: "Los recordatorios activos deben tener anticipaciones diferentes." });

async function event(guardianId: string, eventType: "contacted" | "invitation_sent" | "response_updated" | "whatsapp_opened" | "note_added" | "manager_assigned", metadata: Record<string, string> = {}) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  return supabase.from("contact_events").insert({ guardian_id: guardianId, actor_profile_id: user?.id ?? null, event_type: eventType, metadata });
}

export async function markFirstContact(guardianId: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); const { data, error } = await supabase.from("contact_tracking").select("first_contact_at, response_status").eq("guardian_id", parsed.data).maybeSingle();
  if (error || !data) return { success: false, error: "No pudimos actualizar el seguimiento." };
  const update = { first_contact_at: data.first_contact_at ?? new Date().toISOString(), response_status: data.response_status === "not_contacted" ? "contacted" as const : data.response_status };
  if ((await supabase.from("contact_tracking").update(update).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos actualizar el seguimiento." };
  await event(parsed.data, "contacted"); refresh(); return { success: true };
}

export async function updateContactResponse(guardianId: string, response: "no_response" | "interested" | "declined"): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); const { data: tracking, error: trackingError } = await supabase.from("contact_tracking").select("registered_from_public_at").eq("guardian_id", parsed.data).maybeSingle();
  if (trackingError || !tracking) return { success: false, error: "No pudimos actualizar el seguimiento." };
  if (tracking.registered_from_public_at) return { success: false, error: "Este acudiente se registró directamente desde el formulario." };
  const { data: whatsAppContact, error: whatsAppError } = await supabase.from("contact_events").select("id").eq("guardian_id", parsed.data).eq("event_type", "whatsapp_opened").limit(1).maybeSingle();
  if (whatsAppError || !whatsAppContact) return { success: false, error: "Primero registra el contacto por WhatsApp." };
  if ((await supabase.from("contact_tracking").update({ response_status: response }).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos actualizar el seguimiento." };
  await event(parsed.data, "response_updated", { response }); refresh(); return { success: true };
}

export async function addContactNote(guardianId: string, note: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); const clean = note.trim().slice(0, 1000); if (!parsed.success || !clean) return { success: false, error: "Escribe una nota válida." };
  if ((await event(parsed.data, "note_added", { note: clean })).error) return { success: false, error: "No pudimos guardar la nota." }; refresh(); return { success: true };
}

export async function assignContactManager(guardianId: string, profileId: string | null): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking");
  const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); if ((await supabase.from("contact_tracking").update({ assigned_to: profileId }).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos asignar el responsable." };
  await event(parsed.data, "manager_assigned", { profile_id: profileId ?? "" }); refresh(); return { success: true };
}

export async function recordWhatsAppOpened(guardianId: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking");
  const parsed = guardianIdSchema.safeParse(guardianId);
  if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient();
  const { data: tracking, error: trackingError } = await supabase.from("contact_tracking").select("first_contact_at, registered_from_public_at, response_status").eq("guardian_id", parsed.data).maybeSingle();
  if (trackingError || !tracking) return { success: false, error: "No pudimos actualizar el seguimiento." };
  if (tracking.registered_from_public_at) return { success: false, error: "Este acudiente se registró directamente desde el formulario." };
  const { data: existingContact, error: existingContactError } = await supabase.from("contact_events").select("id").eq("guardian_id", parsed.data).eq("event_type", "whatsapp_opened").limit(1).maybeSingle();
  if (existingContactError) return { success: false, error: "No pudimos verificar la actividad." };
  if (existingContact) return { success: true };
  const update = { first_contact_at: tracking.first_contact_at ?? new Date().toISOString(), response_status: tracking.response_status === "not_contacted" ? "contacted" as const : tracking.response_status };
  if ((await supabase.from("contact_tracking").update(update).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos actualizar el seguimiento." };
  if ((await event(parsed.data, "whatsapp_opened")).error) return { success: false, error: "No pudimos registrar la actividad." };
  refresh();
  return { success: true };
}

export async function updateClassReminderSettings(values: unknown): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking");
  const parsed = reminderSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "La configuración de recordatorios no es válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_class_reminder_settings", {
    p_first_enabled: parsed.data.firstEnabled,
    p_first_lead_minutes: parsed.data.firstLeadMinutes,
    p_second_enabled: parsed.data.secondEnabled,
    p_second_lead_minutes: parsed.data.secondLeadMinutes,
  });
  if (error) return { success: false, error: error.message.includes("anticipaciones diferentes") ? error.message : "No pudimos guardar los recordatorios." };
  refresh();
  return { success: true };
}
