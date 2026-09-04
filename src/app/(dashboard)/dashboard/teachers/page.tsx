import { TeachersManager } from "@/components/teachers/teachers-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profesores" };

export default async function TeachersPage() {
  const user = await requireDashboardRoute("/dashboard/teachers");
  const supabase = await createClient(); const results = await Promise.all([supabase.rpc("admin_teacher_directory"), supabase.from("classes").select("teacher_id")]);
  if (results.some((result) => "error" in result && result.error)) throw new Error("No fue posible cargar los datos de esta sección.");
  const [{ data: teachers }, { data: classes }] = results; const counts = new Map<string, number>(); (classes ?? []).forEach((item) => counts.set(item.teacher_id, (counts.get(item.teacher_id) ?? 0) + 1));
  const avatarUrl = (path: string | null) => path ? supabase.storage.from("teacher-avatars").getPublicUrl(path).data.publicUrl : null;
  return <><PageHeader title="Profesores" description="Administra perfiles, recordatorios y disponibilidad semanal de profesores." /><TeachersManager canDelete={user.role === "admin"} currentUserName={user.fullName} teachers={(teachers ?? []).map((item) => ({ id: item.teacher_id, name: item.display_name, email: item.email, notificationEmail: item.notification_email ?? "", avatarUrl: avatarUrl(item.avatar_path), active: item.active, classCount: counts.get(item.teacher_id) ?? 0, availableDays: item.available_days, availableFrom: item.available_from, availableUntil: item.available_until }))} /></>;
}
