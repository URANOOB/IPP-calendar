import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader eyebrow="Vista general" title="Dashboard" description="El resumen de actividad aparecerá aquí cuando los módulos estén disponibles." />
      <section className="rounded-xl border border-dashed bg-card px-6 py-10 text-sm text-muted-foreground">
        Aún no hay información para mostrar.
      </section>
    </>
  );
}
