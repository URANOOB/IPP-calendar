"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createPrivateAccessToken, hashPrivateAccessToken } from "@/lib/utils/private-token";
import { guardianIdSchema } from "@/lib/validations/guardians";
import { createClient } from "@/lib/supabase/server";

type TrackingResult = { success: true; message?: string } | { success: false; error: string };
const refresh = () => { revalidatePath("/dashboard/tracking"); revalidatePath("/dashboard/contacts"); };

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

export async function markInvitationSent(guardianId: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); const { error } = await supabase.from("contact_tracking").update({ invitation_sent_at: new Date().toISOString() }).eq("guardian_id", parsed.data); if (error) return { success: false, error: "No pudimos actualizar el seguimiento." };
  await event(parsed.data, "invitation_sent"); refresh(); return { success: true };
}

export async function updateContactResponse(guardianId: string, response: "no_response" | "interested" | "declined"): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); if ((await supabase.from("contact_tracking").update({ response_status: response }).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos actualizar el seguimiento." };
  await event(parsed.data, "response_updated", { response }); refresh(); return { success: true };
}

export async function addContactNote(guardianId: string, note: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); const clean = note.trim().slice(0, 1000); if (!parsed.success || !clean) return { success: false, error: "Escribe una nota válida." };
  if ((await event(parsed.data, "note_added", { note: clean })).error) return { success: false, error: "No pudimos guardar la nota." }; refresh(); return { success: true };
}

export async function assignContactManager(guardianId: string, profileId: string | null): Promise<TrackingResult> {
  const user = await requireDashboardRoute("/dashboard/tracking"); if (user.role !== "admin") return { success: false, error: "No tienes permisos para asignar responsables." };
  const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const supabase = await createClient(); if ((await supabase.from("contact_tracking").update({ assigned_to: profileId }).eq("guardian_id", parsed.data)).error) return { success: false, error: "No pudimos asignar el responsable." };
  await event(parsed.data, "manager_assigned", { profile_id: profileId ?? "" }); refresh(); return { success: true };
}

export async function recordWhatsAppOpened(guardianId: string): Promise<void> { await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (parsed.success) { await event(parsed.data, "whatsapp_opened"); } }

export async function createTrackingInvitation(guardianId: string, guardianName: string): Promise<TrackingResult> {
  await requireDashboardRoute("/dashboard/tracking"); const parsed = guardianIdSchema.safeParse(guardianId); if (!parsed.success) return { success: false, error: "El contacto no es válido." };
  const token = createPrivateAccessToken(); const supabase = await createClient(); const { data, error } = await supabase.from("guardians").update({ access_token_hash: hashPrivateAccessToken(token) }).eq("id", parsed.data).eq("active", true).select("id").maybeSingle();
  if (error || !data) return { success: false, error: "No pudimos generar la invitación." };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"; const message = `Hola, ${guardianName}.\n\nYa están disponibles las clases de Inglés pa' la Paz para esta semana. Puedes revisar los horarios y programar las clases de tus niños desde tu enlace personal:\n\n${baseUrl}/clases/t/${token}`;
  await event(parsed.data, "invitation_sent"); refresh(); return { success: true, message };
}
