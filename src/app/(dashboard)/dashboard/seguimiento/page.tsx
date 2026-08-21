import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { requireDashboardRoute } from "@/lib/auth/authorization";

export const metadata = { title: "Seguimiento" };

export default async function FollowUpPage() {
  await requireDashboardRoute("/dashboard/seguimiento");

  return <PlaceholderPage title="Seguimiento" description="El seguimiento se construirá en una tarea posterior." />;
}
