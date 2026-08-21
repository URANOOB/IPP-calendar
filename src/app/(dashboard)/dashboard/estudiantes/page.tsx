import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Estudiantes" };

export default async function StudentsPage() {
  await requireDashboardRoute("/dashboard/estudiantes");

  return <PlaceholderPage title="Estudiantes" description="La gestión de estudiantes se construirá en una tarea posterior." />;
}
