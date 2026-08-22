import { TrackingManager, type TrackingRow } from "@/components/tracking/tracking-manager";
import { Button } from "@/components/ui/button";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seguimiento" };

export default async function TrackingPage() {
  await requireDashboardRoute("/dashboard/tracking"); const supabase = await createClient();
  const [{ data: guardians }, { data: tracking }, { data: students }, { data: registrations }, { data: classes }, { data: events }, { data: reminderSettings }] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone").order("full_name"),
    supabase.from("contact_tracking").select("guardian_id, first_contact_at, invitation_sent_at, registered_from_public_at, response_status"),
    supabase.from("students").select("id, guardian_id, full_name"),
    supabase.from("registrations").select("id, student_id, class_id, status").in("status", ["pending", "confirmed", "attended", "absent"]),
    supabase.from("classes").select("id, title, teacher_id, starts_at, ends_at").order("starts_at"),
    supabase.from("contact_events").select("id, guardian_id, event_type, metadata, created_at").order("created_at", { ascending: false }),
    supabase.from("class_reminder_settings").select("first_enabled, first_lead_minutes, second_enabled, second_lead_minutes").eq("singleton", true).maybeSingle(),
  ]);
  const rows: TrackingRow[] = (guardians ?? []).map((guardian) => {
    const item = tracking?.find((entry) => entry.guardian_id === guardian.id);
    const guardianStudents = students?.filter((student) => student.guardian_id === guardian.id) ?? [];
    const guardianRegistrations = registrations?.filter((registration) => guardianStudents.some((student) => student.id === registration.student_id)) ?? [];
    const nextRegistration = guardianRegistrations
      .map((registration) => ({ registration, classItem: classes?.find((classItem) => classItem.id === registration.class_id) }))
      .filter((entry): entry is { registration: NonNullable<typeof guardianRegistrations>[number]; classItem: NonNullable<typeof classes>[number] } => Boolean(entry.classItem))
      .sort((a, b) => a.classItem.starts_at.localeCompare(b.classItem.starts_at))[0];
    const guardianEvents = (events ?? []).filter((event) => event.guardian_id === guardian.id).map((event) => ({ id: event.id, eventType: event.event_type, metadata: typeof event.metadata === "object" && event.metadata !== null && !Array.isArray(event.metadata) ? event.metadata : {}, createdAt: event.created_at }));
    const lastEvent = guardianEvents[0];

    return {
      guardianId: guardian.id,
      guardianName: guardian.full_name ?? "Sin nombre",
      phone: guardian.phone,
      students: guardianStudents.map((student) => student.full_name),
      firstContactAt: item?.first_contact_at ?? null,
      response: item?.response_status ?? "not_contacted",
      booked: guardianRegistrations.length > 0,
      enrolledCount: guardianRegistrations.length,
      nextClass: nextRegistration ? `${nextRegistration.classItem.title} · ${formatBogotaDateTime(nextRegistration.classItem.starts_at)}` : null,
      registeredFromPublicAt: item?.registered_from_public_at ?? null,
      lastUpdatedAt: lastEvent?.createdAt ?? null,
      lastUpdateChannel: lastEvent?.eventType === "whatsapp_opened" ? "WhatsApp" : lastEvent?.eventType === "registered_from_form" ? "Formulario" : lastEvent ? "Seguimiento" : null,
      events: guardianEvents,
    };
  });
  const totalContacted = rows.filter((row) => row.firstContactAt).length; const totalBooked = rows.filter((row) => row.booked).length;
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Seguimiento operativo</h1><p className="mt-2 text-muted-foreground">{rows.length} contactos · {totalContacted} contactados · {totalBooked} agendados</p></div><div className="flex gap-2"><Button asChild variant="outline"><a href="/dashboard/tracking/export?format=csv">Exportar CSV</a></Button><Button asChild><a href="/dashboard/tracking/export?format=xlsx">Exportar XLSX</a></Button></div></div><TrackingManager reminderSettings={{ firstEnabled: reminderSettings?.first_enabled ?? true, firstLeadMinutes: reminderSettings?.first_lead_minutes ?? 1440, secondEnabled: reminderSettings?.second_enabled ?? true, secondLeadMinutes: reminderSettings?.second_lead_minutes ?? 180 }} rows={rows} /></section>;
}
