import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Clases" };

export default async function ClassesPage() {
  await requireDashboardRoute("/dashboard/clases");

  return <PlaceholderPage title="Clases" description="La programación de clases se construirá en una tarea posterior." />;
}
