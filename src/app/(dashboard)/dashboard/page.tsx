import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { getCycleOverview } from "@/lib/cycles/service";
import { getCycleEffectiveStatus } from "@/lib/cycles/dates";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireDashboardRoute("/dashboard");
  const overview = await getCycleOverview();
  const supabase = await createClient(); const cycleId = overview.currentOpenCycle?.id;
  const [{ count: guardianCount }, { count: contactedCount }, { count: bookedCount }, { count: registrationCount }] = await Promise.all([
    supabase.from("guardians").select("id", { count: "exact", head: true }), supabase.from("contact_tracking").select("id", { count: "exact", head: true }).not("first_contact_at", "is", null), supabase.from("contact_tracking").select("id", { count: "exact", head: true }).not("booked_at", "is", null), cycleId ? supabase.from("registrations").select("id", { count: "exact", head: true }).eq("cycle_id", cycleId).in("status", ["pending", "confirmed", "attended", "absent"]) : Promise.resolve({ count: 0 }),
  ]);

  return (
    <>
      <PageHeader eyebrow={ROLE_LABELS[user.role]} title={`Bienvenido, ${user.fullName}`} description="Los módulos disponibles para tu rol aparecerán aquí a medida que se habiliten." />
      <section className="rounded-xl border border-dashed bg-card px-6 py-8 text-sm text-muted-foreground">
        {overview.currentOpenCycle ? <><p className="font-semibold text-foreground">Ciclo actual: {overview.currentOpenCycle.name}</p><p className="mt-2">{getCycleEffectiveStatus(overview.currentOpenCycle)}</p></> : "No hay un ciclo activo."}
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Acudientes" value={guardianCount ?? 0} /><Metric label="Contactados" value={contactedCount ?? 0} /><Metric label="Agendados" value={bookedCount ?? 0} /><Metric label="Niños inscritos" value={registrationCount ?? 0} /></section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }
