import { CyclesManager, type CycleListItem } from "@/components/cycles/cycles-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getCycleOverview, getCycles } from "@/lib/cycles/service";
import { getCycleEffectiveStatus } from "@/lib/cycles/dates";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Ciclos" };

export default async function CyclesPage() {
  await requireDashboardRoute("/dashboard/cycles");
  const [cycles, overview] = await Promise.all([getCycles(), getCycleOverview()]);
  const listItems: CycleListItem[] = cycles.map((cycle) => ({ id: cycle.id, name: cycle.name, startsAt: cycle.starts_at, endsAt: cycle.ends_at, registrationOpensAt: cycle.registration_opens_at, registrationClosesAt: cycle.registration_closes_at, status: cycle.status }));

  return <><PageHeader title="Ciclos semanales" description="Crea semanas independientes y controla sus ventanas de inscripción." />
    {overview.currentOpenCycle ? <section className="mb-6 rounded-xl border bg-card p-5"><p className="text-sm font-semibold text-primary">Ciclo operativo actual</p><h2 className="mt-1 text-xl font-bold">{overview.currentOpenCycle.name}</h2><p className="mt-2 text-sm text-muted-foreground">{getCycleEffectiveStatus(overview.currentOpenCycle)}</p></section> : <section className="mb-6 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">No hay un ciclo abierto actualmente.</section>}
    <CyclesManager cycles={listItems} /></>;
}
