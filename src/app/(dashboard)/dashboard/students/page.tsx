import Link from "next/link";
import { Eye } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StudentAttendanceSwitch } from "@/components/students/student-attendance-switch";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Estudiantes" };

export default async function StudentsPage() {
  await requireDashboardRoute("/dashboard/students");
  const supabase = await createClient();
  const [{ data: students }, { data: guardians }, { data: registrations }, { data: classes }, { data: cycles }] = await Promise.all([
    supabase.from("students").select("id, guardian_id, full_name, active").order("full_name"),
    supabase.from("guardians").select("id, full_name"),
    supabase.from("registrations").select("id, student_id, class_id, status").in("status", ["pending", "confirmed", "attended", "absent"]),
    supabase.from("classes").select("id, title, starts_at, cycle_id").order("starts_at"),
    supabase.from("weekly_cycles").select("id, name, status, starts_at, ends_at").eq("status", "open").order("starts_at"),
  ]);
  const guardianById = new Map((guardians ?? []).map((guardian) => [guardian.id, guardian.full_name]));
  const now = new Date();
  const currentCycle = cycles?.find((cycle) => new Date(cycle.starts_at) <= now && now <= new Date(cycle.ends_at));
  return <section className="space-y-5"><PageHeader title="Estudiantes" description={currentCycle ? `Gestiona la asistencia del ${currentCycle.name} y consulta el historial de cada estudiante.` : "Consulta el historial y la programación de cada estudiante."} /><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-muted/40 text-muted-foreground"><tr>{["Estudiante", "Acudiente", "Estado", "Clases tomadas", "Próxima clase", "Inscripción", "Acción"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{(students ?? []).map((student) => { const entries = (registrations ?? []).filter((item) => item.student_id === student.id); const currentEntries = currentCycle ? entries.filter((entry) => classes?.find((item) => item.id === entry.class_id)?.cycle_id === currentCycle.id) : []; const currentEntriesWithClass = currentEntries.map((entry) => ({ entry, classItem: classes?.find((item) => item.id === entry.class_id) })).filter((item): item is { entry: NonNullable<typeof registrations>[number]; classItem: NonNullable<typeof classes>[number] } => Boolean(item.classItem)); const taken = entries.filter((item) => item.status === "attended").length; const next = currentEntriesWithClass.filter((item) => new Date(item.classItem.starts_at) >= new Date()).sort((a, b) => a.classItem.starts_at.localeCompare(b.classItem.starts_at))[0]; const latest = [...currentEntriesWithClass].sort((a, b) => b.classItem.starts_at.localeCompare(a.classItem.starts_at))[0]; const registration = next?.entry ?? latest?.entry; const registrationClass = next?.classItem ?? latest?.classItem; return <tr className="border-b last:border-0" key={student.id}><td className="px-4 py-3 font-medium">{student.full_name}</td><td className="px-4 py-3">{guardianById.get(student.guardian_id) ?? "—"}</td><td className="px-4 py-3">{student.active ? "Activo" : "Inactivo"}</td><td className="px-4 py-3">{taken}</td><td className="px-4 py-3">{next ? `${next.classItem.title} · ${formatBogotaDateTime(next.classItem.starts_at)}` : "—"}</td><td className="px-4 py-3">{registration && registrationClass ? <div className="flex flex-wrap items-center gap-3"><span>{registration.status}</span><StudentAttendanceSwitch classId={registrationClass.id} registrationId={registration.id} status={registration.status} studentName={student.full_name} /></div> : currentCycle ? "Sin inscripción en este ciclo" : "No hay ciclo activo"}</td><td className="px-4 py-3"><Link aria-label={`Ver historial de ${student.full_name}`} className="inline-flex size-10 items-center justify-center rounded-lg border text-primary transition-colors hover:bg-secondary" href={`/dashboard/students/${student.id}`} title="Ver historial"><Eye aria-hidden="true" className="size-4" /></Link></td></tr>; })}</tbody></table>{!students?.length ? <p className="p-6 text-sm text-muted-foreground">No hay estudiantes visibles.</p> : null}</div></section>;
}
