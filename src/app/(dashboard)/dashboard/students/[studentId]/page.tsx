import Link from "next/link";
import { notFound } from "next/navigation";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Detalle de estudiante" };

export default async function StudentDetailPage({ params }: Readonly<{ params: Promise<{ studentId: string }> }>) {
  await requireDashboardRoute("/dashboard/students");
  const { studentId } = await params; const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("id, guardian_id, full_name, active").eq("id", studentId).maybeSingle();
  if (!student) notFound();
  const [{ data: guardian }, { data: registrations }, { data: cycles }] = await Promise.all([supabase.from("guardians").select("full_name").eq("id", student.guardian_id).maybeSingle(), supabase.from("registrations").select("id, class_id, status").eq("student_id", student.id).order("created_at", { ascending: false }), supabase.from("weekly_cycles").select("id, name, status, starts_at, ends_at").order("starts_at", { ascending: false })]);
  const classIds = (registrations ?? []).map((registration) => registration.class_id);
  const { data: classes } = classIds.length ? await supabase.from("classes").select("id, title, starts_at, teacher_id, cycle_id").in("id", classIds) : { data: [] as { id: string; title: string; starts_at: string; teacher_id: string; cycle_id: string }[] };
  const teacherIds = (classes ?? []).map((item) => item.teacher_id);
  const { data: teachers } = teacherIds.length ? await supabase.from("teachers").select("id, display_name").in("id", teacherIds) : { data: [] as { id: string; display_name: string }[] };
  const now = new Date();
  const currentCycleId = cycles?.find((cycle) => cycle.status === "open" && new Date(cycle.starts_at) <= now && now <= new Date(cycle.ends_at))?.id;
  return <section className="space-y-5"><Link className="text-sm text-primary underline" href="/dashboard/students">Volver a estudiantes</Link><div className="rounded-xl border bg-card p-5"><h1 className="text-2xl font-bold">{student.full_name}</h1><p className="mt-2 text-muted-foreground">Acudiente: {guardian?.full_name ?? "—"} · {student.active ? "Activo" : "Inactivo"}</p></div><div className="rounded-xl border bg-card"><h2 className="border-b px-5 py-4 text-lg font-bold">Historial de clases</h2><ol className="divide-y">{(registrations ?? []).map((registration) => { const classItem = classes?.find((item) => item.id === registration.class_id); const teacher = teachers?.find((item) => item.id === classItem?.teacher_id); const cycle = cycles?.find((item) => item.id === classItem?.cycle_id); const isHistorical = Boolean(classItem && (classItem.cycle_id !== currentCycleId && (currentCycleId || cycle?.status === "closed" || cycle?.status === "archived" || (cycle && new Date(cycle.ends_at) < now)))); const attendance = registration.status === "attended" ? "Asistió" : registration.status === "absent" ? "No asistió" : isHistorical ? "Asistencia no marcada" : "Pendiente de marcar"; return <li className="p-5" key={registration.id}><p className="font-medium">{classItem?.title ?? "Clase histórica"}</p><p className="mt-1 text-sm text-muted-foreground">{classItem ? formatBogotaDateTime(classItem.starts_at) : "Fecha no disponible"} · {teacher?.display_name ?? "Profesor no disponible"}</p><p className="mt-1 text-sm">{attendance} · {cycle?.name ?? "Ciclo histórico"}</p></li>; })}</ol>{!registrations?.length ? <p className="p-5 text-sm text-muted-foreground">Este estudiante aún no tiene clases en su historial.</p> : null}</div></section>;
}
