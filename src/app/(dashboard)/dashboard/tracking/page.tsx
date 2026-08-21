import { TrackingManager, type TrackingRow } from "@/components/tracking/tracking-manager";
import { Button } from "@/components/ui/button";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seguimiento" };

export default async function TrackingPage() {
  const user = await requireDashboardRoute("/dashboard/tracking"); const supabase = await createClient();
  const [{ data: guardians }, { data: tracking }, { data: students }, { data: registrations }, { data: classes }, { data: reminders }, { data: profiles }] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone").order("full_name"),
    supabase.from("contact_tracking").select("guardian_id, assigned_to, first_contact_at, invitation_sent_at, response_status"),
    supabase.from("students").select("id, guardian_id, full_name"),
    supabase.from("registrations").select("id, student_id, class_id, status").in("status", ["pending", "confirmed", "attended", "absent"]),
    supabase.from("classes").select("id, title, teacher_id, starts_at, ends_at").order("starts_at"),
    supabase.from("class_reminders").select("class_id, status"),
    supabase.from("profiles").select("id, full_name, role, active"),
  ]);
  const rows: TrackingRow[] = (guardians ?? []).map((guardian) => { const item = tracking?.find((entry) => entry.guardian_id === guardian.id); const guardianStudents = students?.filter((student) => student.guardian_id === guardian.id) ?? []; const guardianRegistrations = registrations?.filter((registration) => guardianStudents.some((student) => student.id === registration.student_id)) ?? []; const nextRegistration = guardianRegistrations.map((registration) => ({ registration, classItem: classes?.find((classItem) => classItem.id === registration.class_id) })).filter((item): item is { registration: NonNullable<typeof guardianRegistrations>[number]; classItem: NonNullable<typeof classes>[number] } => Boolean(item.classItem)).sort((a, b) => a.classItem.starts_at.localeCompare(b.classItem.starts_at))[0]; const manager = profiles?.find((profile) => profile.id === item?.assigned_to); const reminderStates = nextRegistration ? reminders?.filter((reminder) => reminder.class_id === nextRegistration.classItem.id).map((reminder) => reminder.status) ?? [] : []; const attendance = guardianRegistrations.some((registration) => registration.status === "absent") ? "Ausencia registrada" : guardianRegistrations.some((registration) => registration.status === "attended") ? "Asistencia registrada" : guardianRegistrations.length ? "Pendiente" : "Sin clases"; return { guardianId: guardian.id, guardianName: guardian.full_name, phone: guardian.phone, students: guardianStudents.map((student) => student.full_name), managerId: item?.assigned_to ?? null, managerName: manager?.full_name ?? null, firstContactAt: item?.first_contact_at ?? null, invitationSentAt: item?.invitation_sent_at ?? null, response: item?.response_status ?? "not_contacted", booked: guardianRegistrations.length > 0, enrolledCount: guardianRegistrations.length, nextClass: nextRegistration ? `${nextRegistration.classItem.title} · ${formatBogotaDateTime(nextRegistration.classItem.starts_at)}` : null, attendance, reminder: reminderStates.includes("failed") ? "Error" : reminderStates.includes("sent") ? "Enviado" : reminderStates.length ? "Pendiente" : "Sin recordatorio" }; });
  const managers = (profiles ?? []).filter((profile) => profile.role === "contact_manager" && profile.active).map((profile) => ({ id: profile.id, name: profile.full_name }));
  const totalContacted = rows.filter((row) => row.firstContactAt).length; const totalBooked = rows.filter((row) => row.booked).length;
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">{user.role === "contact_manager" ? "Mis contactos" : "Seguimiento operativo"}</h1><p className="mt-2 text-muted-foreground">{rows.length} contactos · {totalContacted} contactados · {totalBooked} agendados</p></div><div className="flex gap-2"><Button asChild variant="outline"><a href="/dashboard/tracking/export?format=csv">Exportar CSV</a></Button><Button asChild><a href="/dashboard/tracking/export?format=xlsx">Exportar XLSX</a></Button></div></div><TrackingManager isAdmin={user.role === "admin"} managers={managers} rows={rows} /></section>;
}
