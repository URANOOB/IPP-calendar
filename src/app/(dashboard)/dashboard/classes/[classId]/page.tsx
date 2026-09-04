import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Bell, CalendarDays, ChevronDown, Clock3, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { ClassDetailPanel } from "@/components/classes/class-detail-panel";
import { AttendanceManager } from "@/components/classes/attendance-manager";
import { MeetingLink } from "@/components/classes/meeting-link";
import { formatBogotaDate, formatBogotaDateTime, utcToBogotaInput } from "@/lib/cycles/dates";
import { CLASS_STATUS_LABELS } from "@/lib/classes/constants";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export default async function ClassDetailPage({ params, searchParams }: Readonly<{ params: Promise<{ classId: string }>; searchParams: Promise<{ edit?: string }> }>) {
  const initiallyEditing = (await searchParams).edit === "1";
  const user = await requireUser(); const { classId } = await params; const supabase = await createClient();
  const { data: item, error } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle(); if (error || !item) notFound();
  const [{ data: teacher }, { data: cycle }, { data: registrations }, { data: reminders }, { data: activeTeachers }, { data: activeCycles }] = await Promise.all([supabase.from("teachers").select("display_name, avatar_path").eq("id", item.teacher_id).maybeSingle(), supabase.from("weekly_cycles").select("name").eq("id", item.cycle_id).maybeSingle(), supabase.from("registrations").select("id, student_id, status").eq("class_id", item.id).in("status", ["pending", "confirmed", "attended", "absent"]), supabase.from("class_reminders").select("id, reminder_type, status, attempts, last_error").eq("class_id", item.id).order("created_at"), supabase.from("teachers").select("id, display_name").or(`active.eq.true,id.eq.${item.teacher_id}`).order("display_name"), supabase.from("weekly_cycles").select("id, name, starts_at, ends_at").or(`status.eq.open,id.eq.${item.cycle_id}`).order("starts_at")]);
  const studentIds = registrations?.map((registration) => registration.student_id) ?? [];
  const { data: students } = studentIds.length > 0 ? await supabase.from("students").select("id, full_name").in("id", studentIds).order("full_name") : { data: [] as { id: string; full_name: string }[] };
  const { data: studentGuardians } = studentIds.length > 0 ? await supabase.from("students").select("id, guardian_id").in("id", studentIds) : { data: [] as { id: string; guardian_id: string }[] };
  const guardianIds = studentGuardians?.map((student) => student.guardian_id) ?? []; const { data: guardians } = guardianIds.length > 0 ? await supabase.from("guardians").select("id, full_name, phone").in("id", guardianIds) : { data: [] as { id: string; full_name: string | null; phone: string }[] };
  const attendance = (registrations ?? []).flatMap((registration) => { const student = students?.find((item) => item.id === registration.student_id); const guardianId = studentGuardians?.find((item) => item.id === registration.student_id)?.guardian_id; const guardian = guardians?.find((item) => item.id === guardianId); return student && guardian ? [{ registrationId: registration.id, studentName: student.full_name, guardianName: guardian.full_name ?? "Sin nombre", guardianPhone: guardian.phone, status: registration.status }] : []; });
  const enrolled = registrations?.length ?? 0;
  const remaining = Math.max(0, item.capacity - enrolled);
  const avatarUrl = teacher?.avatar_path ? supabase.storage.from("teacher-avatars").getPublicUrl(teacher.avatar_path).data.publicUrl : null;
  const sameDay = utcToBogotaInput(item.starts_at).slice(0, 10) === utcToBogotaInput(item.ends_at).slice(0, 10);
  const timeFormat = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  const duration = Math.round((new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000);
  const failedReminders = reminders?.filter((reminder) => reminder.status === "failed").length ?? 0;
  const reminderTypes = { teacher_24h: "Profesor · 24 horas antes", teacher_3h: "Profesor · 3 horas antes", manager_24h: "Gestor · 24 horas antes", manager_3h: "Gestor · 3 horas antes" };
  const reminderStatuses = { pending: "Pendiente", processing: "En proceso", sent: "Enviado", failed: "No enviado", cancelled: "Cancelado" };

  return <div className="space-y-4">
    <Link className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-muted-foreground hover:text-primary" href="/dashboard/classes"><ArrowLeft aria-hidden="true" className="size-4" />Volver a clases</Link>
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="space-y-3 px-5 pb-5 pt-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">{item.title}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-muted text-muted-foreground"}`}>{CLASS_STATUS_LABELS[item.status]}</span></div>
        <p className="text-sm text-muted-foreground">Ciclo: <Link className="font-medium text-primary hover:underline" href={`/dashboard/cycles/${item.cycle_id}`}>{cycle?.name ?? "No disponible"}</Link></p>
        {item.description ? <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{item.description}</p> : null}
      </header>
      <dl className="grid gap-5 border-y bg-background/60 px-5 py-5 sm:grid-cols-2 sm:px-7 xl:grid-cols-3">
        <div className="flex gap-3"><CalendarDays aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div><dt className="text-xs font-semibold text-muted-foreground">Fecha y horario</dt><dd className="mt-1 text-sm"><p className="font-semibold">{formatBogotaDate(item.starts_at)}</p><p className="mt-1">{timeFormat.format(new Date(item.starts_at))} — {sameDay ? timeFormat.format(new Date(item.ends_at)) : formatBogotaDateTime(item.ends_at)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3" />{duration} min · Hora de Bogotá</p></dd></div></div>
        <div className="flex gap-3">{avatarUrl ? <Image alt="" className="size-11 shrink-0 rounded-full object-cover" height={44} src={avatarUrl} unoptimized width={44} /> : <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary font-bold text-primary">{teacher?.display_name?.trim().charAt(0).toUpperCase() || "P"}</span>}<div className="min-w-0"><dt className="text-xs font-semibold text-muted-foreground">Profesor</dt><dd className="mt-1 break-words text-sm font-semibold">{teacher?.display_name ?? "No disponible"}</dd></div></div>
        <div className="flex gap-3"><Users aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><dt className="text-xs font-semibold text-muted-foreground">Cupos</dt><dd className="mt-1 text-sm"><p><span className="text-lg font-bold">{enrolled}</span><span className="text-muted-foreground"> / {item.capacity} inscritos</span></p><div aria-label="Ocupación de la clase" aria-valuemax={item.capacity} aria-valuemin={0} aria-valuenow={enrolled} className="my-2 h-1.5 max-w-48 overflow-hidden rounded-full bg-border" role="meter"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, enrolled / Math.max(1, item.capacity) * 100)}%` }} /></div><p className="text-xs text-muted-foreground">{remaining === 0 ? "Cupo completo" : `${remaining} ${remaining === 1 ? "cupo disponible" : "cupos disponibles"}`}</p></dd></div></div>
      </dl>
      <div className="space-y-4 px-5 py-5 sm:px-7">
        {item.meeting_url ? <MeetingLink url={item.meeting_url} /> : <p className="text-sm text-muted-foreground">Esta clase aún no tiene enlace de reunión.</p>}
        <ClassDetailPanel initiallyEditing={initiallyEditing} classItem={{ id: item.id, status: item.status, title: item.title, description: item.description ?? "", cycleId: item.cycle_id, teacherId: item.teacher_id, startsAt: utcToBogotaInput(item.starts_at), endsAt: utcToBogotaInput(item.ends_at), capacity: item.capacity, meetingUrl: item.meeting_url ?? "" }} cycles={(activeCycles ?? []).map((cycle) => ({ id: cycle.id, name: cycle.name, startsAt: cycle.starts_at, endsAt: cycle.ends_at }))} role={user.role} teachers={(activeTeachers ?? []).map((teacher) => ({ id: teacher.id, name: teacher.display_name }))} />
      </div>
      <div className="border-t px-5 py-6 sm:px-7"><AttendanceManager classId={item.id} entries={attendance} /></div>
      <details className="group border-t px-5 py-4 sm:px-7" open={failedReminders > 0}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded text-sm [&::-webkit-details-marker]:hidden"><Bell aria-hidden="true" className="size-4 text-muted-foreground" /><h2 className="font-semibold">Recordatorios</h2><span className="text-xs text-muted-foreground">{reminders?.length ?? 0} registrados</span>{failedReminders > 0 ? <span className="text-xs font-medium text-rose-600">{failedReminders} sin enviar</span> : null}<ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-open:rotate-180" /></summary>
        {reminders?.length ? <ul className="mt-3 divide-y">{reminders.map((reminder) => <li className="py-3 text-sm" key={reminder.id}><div className="flex flex-wrap justify-between gap-2"><span>{reminderTypes[reminder.reminder_type]}</span><strong className={reminder.status === "failed" ? "text-rose-600" : "text-muted-foreground"}>{reminderStatuses[reminder.status]}</strong></div>{reminder.attempts > 0 ? <p className="mt-1 text-xs text-muted-foreground">Intentos: {reminder.attempts}</p> : null}{reminder.last_error ? <p className="mt-1 break-words text-xs text-rose-600">{reminder.last_error}</p> : null}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay recordatorios registrados para esta clase.</p>}
      </details>
    </article>
  </div>;
}