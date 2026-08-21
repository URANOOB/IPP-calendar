import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requireDashboardRoute("/dashboard/settings");
  return <PlaceholderPage title="Configuración" description="La configuración administrativa se habilitará en una tarea posterior." />;
}
