import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Profesores" };

export default async function TeachersPage() {
  await requireDashboardRoute("/dashboard/profesores");

  return <PlaceholderPage title="Profesores" description="La gestión de profesores se construirá en una tarea posterior." />;
}
