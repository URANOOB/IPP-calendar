import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, GraduationCap, Pencil, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { BOGOTA_TIME_ZONE, formatBogotaDate } from "@/lib/cycles/dates";
import { formatColombianPhone } from "@/lib/utils/phone";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Detalle de estudiante" };

export default async function StudentDetailPage({ params }: Readonly<{ params: Promise<{ studentId: string }> }>) {
  await requireDashboardRoute("/dashboard/students");
  const { studentId } = await params;
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase.from("students").select("id, guardian_id, full_name, active").eq("id", studentId).maybeSingle();
  if (studentError) throw new Error("No se pudo cargar el estudiante.");
  if (!student) notFound();

  const [guardianResult, registrationResult] = await Promise.all([
    supabase.from("guardians").select("full_name, phone").eq("id", student.guardian_id).maybeSingle(),
    supabase.from("registrations").select("id, class_id, status").eq("student_id", student.id).order("created_at", { ascending: false }),
  ]);
  if (guardianResult.error || registrationResult.error) throw new Error("No se pudo cargar el historial del estudiante.");
  const guardian = guardianResult.data;
  const registrations = registrationResult.data ?? [];
  const classIds = [...new Set(registrations.map((item) => item.class_id))];
  const classResult = classIds.length
    ? await supabase.from("classes").select("id, title, starts_at, ends_at, status, teacher_id, cycle_id").in("id", classIds)
    : { data: [], error: null };
  if (classResult.error) throw new Error("No se pudieron cargar las clases del estudiante.");
  const classes = classResult.data ?? [];
  const teacherIds = [...new Set(classes.map((item) => item.teacher_id))];
  const cycleIds = [...new Set(classes.map((item) => item.cycle_id))];
  const [teacherResult, cycleResult] = await Promise.all([
    teacherIds.length ? supabase.from("teachers").select("id, display_name").in("id", teacherIds) : { data: [], error: null },
    cycleIds.length ? supabase.from("weekly_cycles").select("id, name").in("id", cycleIds) : { data: [], error: null },
  ]);
  if (teacherResult.error || cycleResult.error) throw new Error("No se pudo cargar la información de las clases.");
  const classById = new Map(classes.map((item) => [item.id, item]));
  const teacherById = new Map((teacherResult.data ?? []).map((item) => [item.id, item]));
  const cycleById = new Map((cycleResult.data ?? []).map((item) => [item.id, item]));
  const now = new Date().getTime();
  const timeFormat = new Intl.DateTimeFormat("es-CO", { timeZone: BOGOTA_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  const history = registrations.map((registration) => ({ registration, classItem: classById.get(registration.class_id) }))
    .sort((a, b) => (b.classItem ? Date.parse(b.classItem.starts_at) : 0) - (a.classItem ? Date.parse(a.classItem.starts_at) : 0));
  const upcomingCount = history.filter(({ registration, classItem }) =>
    ["pending", "confirmed"].includes(registration.status) && classItem?.status === "published" && Date.parse(classItem.starts_at) > now).length;
  const attendedCount = registrations.filter((item) => item.status === "attended").length;
  const guardianUrl = `/dashboard/contacts/${student.guardian_id}`;

  return <div className="space-y-4">
    <Link className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-muted-foreground hover:text-primary" href="/dashboard/students"><ArrowLeft aria-hidden="true" className="size-4" />Volver a estudiantes</Link>
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-col justify-between gap-4 px-5 py-6 sm:flex-row sm:items-start sm:px-7">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">{student.full_name}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{student.active ? "Activo" : "Inactivo"}</span></div>
          <p className="text-sm text-muted-foreground">Información del estudiante y seguimiento de sus clases.</p>
        </div>
        <Button asChild className="self-start shrink-0"><Link href={`${guardianUrl}#students`}><Pencil aria-hidden="true" />Editar estudiante</Link></Button>
      </header>
      <div className="grid gap-6 border-y bg-background/60 px-5 py-5 sm:grid-cols-2 sm:px-7">
        <section aria-labelledby="guardian-heading" className="min-w-0">
          <h2 id="guardian-heading" className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><UserRound aria-hidden="true" className="size-4" />Acudiente</h2>
          <Link href={guardianUrl} className="mt-2 inline-flex max-w-full items-center gap-2 font-semibold hover:text-primary"><span className="min-w-0 break-words">{guardian?.full_name || "Nombre pendiente de completar"}</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">: ver contacto</span></Link>
          <p className="mt-1 text-sm text-muted-foreground">{guardian?.phone ? formatColombianPhone(guardian.phone) : "Teléfono no disponible"}</p>
        </section>
        <dl className="grid grid-cols-2 gap-4 self-center">
          <div><dt className="text-sm text-muted-foreground">Próximas clases</dt><dd className="mt-1 text-2xl font-bold">{upcomingCount}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Clases asistidas</dt><dd className="mt-1 text-2xl font-bold">{attendedCount}</dd></div>
        </dl>
      </div>
      <section aria-labelledby="history-heading">
        <div className="px-5 py-5 sm:px-7"><h2 id="history-heading" className="flex items-center gap-2 text-lg font-bold"><GraduationCap aria-hidden="true" className="size-5 text-primary" />Historial de clases</h2><p className="mt-1 text-sm text-muted-foreground">Inscripciones y asistencia · Horarios de Bogotá.</p></div>
        {history.length ? <ol className="divide-y border-t">{history.map(({ registration, classItem }) => {
          const teacher = classItem ? teacherById.get(classItem.teacher_id) : undefined;
          const cycle = classItem ? cycleById.get(classItem.cycle_id) : undefined;
          const finished = Boolean(classItem && (classItem.status === "completed" || Date.parse(classItem.ends_at) <= now));
          const status = registration.status === "cancelled" ? "Inscripción cancelada"
            : registration.status === "attended" ? "Asistió"
              : registration.status === "absent" ? "No asistió"
                : classItem?.status === "cancelled" ? "Clase cancelada"
                  : finished ? "Asistencia no marcada"
                    : classItem && Date.parse(classItem.starts_at) <= now ? "Pendiente de marcar"
                      : registration.status === "confirmed" ? "Inscripción confirmada" : "Inscripción pendiente";
          const tone = registration.status === "attended" ? "bg-emerald-50 text-emerald-700"
            : registration.status === "absent" ? "bg-rose-50 text-rose-700"
              : status.includes("cancelada") ? "bg-muted text-muted-foreground"
                : finished || registration.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-primary/10 text-primary";
          return <li key={registration.id} className="space-y-4 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 break-words font-semibold">{classItem?.title ?? "Clase histórica"}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span></div>
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div className="flex gap-2 text-sm"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{classItem ? <time dateTime={classItem.starts_at}><span className="block font-medium">{formatBogotaDate(classItem.starts_at)}</span><span className="mt-1 block text-muted-foreground">{timeFormat.format(new Date(classItem.starts_at))} – {formatBogotaDate(classItem.starts_at) !== formatBogotaDate(classItem.ends_at) ? `${formatBogotaDate(classItem.ends_at)}, ` : ""}{timeFormat.format(new Date(classItem.ends_at))}</span></time> : <span>Fecha no disponible</span>}</div>
              <dl className="min-w-0 text-sm"><dt className="text-muted-foreground">Profesor</dt><dd className="mt-1 break-words font-medium">{teacher?.display_name ?? "Profesor no disponible"}</dd></dl>
              <dl className="min-w-0 text-sm"><dt className="text-muted-foreground">Ciclo</dt><dd className="mt-1 break-words font-medium">{cycle ? <Link className="hover:text-primary hover:underline" href={`/dashboard/cycles/${cycle.id}`}>{cycle.name}</Link> : "Ciclo histórico"}</dd></dl>
              {classItem ? <Button asChild variant="outline" className="justify-self-start"><Link href={`/dashboard/classes/${classItem.id}`} aria-label={`Ver clase ${classItem.title}`}>Ver clase<ArrowUpRight aria-hidden="true" /></Link></Button> : null}
            </div>
          </li>;
        })}</ol> : <div className="border-t px-5 py-8 text-center sm:px-7"><CalendarDays aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">Aún no tiene clases inscritas</p><p className="mt-1 text-sm text-muted-foreground">Las inscripciones y la asistencia aparecerán aquí cuando se registre en una clase.</p></div>}
      </section>
    </article>
  </div>;
}
