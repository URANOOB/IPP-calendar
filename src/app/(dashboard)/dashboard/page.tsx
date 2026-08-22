import { ClassCalendar, type DashboardCalendarClass, type DashboardCalendarCycle } from "@/components/dashboard/class-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { getCycleOverview } from "@/lib/cycles/service";
import { getCycleEffectiveStatus } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireDashboardRoute("/dashboard");
  const overview = await getCycleOverview();
  const supabase = await createClient(); const cycleId = overview.currentOpenCycle?.id;
  const [{ count: guardianCount }, { count: contactedCount }, { count: bookedCount }, { count: registrationCount }, { data: classes }, { data: teachers }, { data: cycles }, { data: registrations }] = await Promise.all([
    supabase.from("guardians").select("id", { count: "exact", head: true }), supabase.from("contact_tracking").select("id", { count: "exact", head: true }).not("first_contact_at", "is", null), supabase.from("contact_tracking").select("id", { count: "exact", head: true }).not("booked_at", "is", null), cycleId ? supabase.from("registrations").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId).in("status", ["pending", "confirmed", "attended", "absent"]) : Promise.resolve({ count: 0 }), supabase.from("classes").select("id, title, starts_at, ends_at, teacher_id, cycle_id, capacity, status").order("starts_at"), supabase.from("teachers").select("id, display_name"), supabase.from("weekly_cycles").select("id, name, starts_at, ends_at, status").order("starts_at"), supabase.from("registrations").select("class_id").in("status", ["pending", "confirmed", "attended", "absent"]),
  ]);
  const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher.display_name]));
  const cycleMap = new Map((cycles ?? []).map((cycle) => [cycle.id, cycle]));
  const registrationsByClass = new Map<string, number>();
  (registrations ?? []).forEach((registration) => registrationsByClass.set(registration.class_id, (registrationsByClass.get(registration.class_id) ?? 0) + 1));
  const calendarClasses: DashboardCalendarClass[] = (classes ?? []).map((classItem) => {
    const cycle = cycleMap.get(classItem.cycle_id);
    return { id: classItem.id, title: classItem.title, startsAt: classItem.starts_at, endsAt: classItem.ends_at, teacherName: teacherMap.get(classItem.teacher_id) ?? "Profesor sin asignar", cycleId: classItem.cycle_id, cycleName: cycle?.name ?? "Ciclo histórico", status: classItem.status, capacity: classItem.capacity, registered: registrationsByClass.get(classItem.id) ?? 0 };
  });
  const calendarCycles: DashboardCalendarCycle[] = (cycles ?? []).map((cycle) => ({ id: cycle.id, name: cycle.name, startsAt: cycle.starts_at, endsAt: cycle.ends_at, status: cycle.status }));

  return (
    <>
      <PageHeader title="Bienvenid@" />
      <section className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 px-6 py-7 text-sm text-muted-foreground shadow-[0_12px_28px_rgba(59,130,246,0.08)]">
        <div aria-hidden="true" className="absolute -right-12 -top-16 size-48 rounded-full bg-cyan-200/35 blur-2xl" />
        <div className="relative">
        {overview.currentOpenCycle ? <><p className="font-semibold text-foreground">Ciclo actual: {overview.currentOpenCycle.name}</p><p className="mt-2">{getCycleEffectiveStatus(overview.currentOpenCycle)}</p></> : "No hay un ciclo activo."}
        </div>
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Acudientes" value={guardianCount ?? 0} /><Metric label="Contactados" value={contactedCount ?? 0} /><Metric label="Agendados" value={bookedCount ?? 0} /><Metric label="Niños inscritos" value={registrationCount ?? 0} /></section>
      <ClassCalendar classes={calendarClasses} cycles={calendarCycles} />
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-100 bg-card p-5 shadow-[0_8px_22px_rgba(47,92,158,0.08)]"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{value}</p></div>; }
