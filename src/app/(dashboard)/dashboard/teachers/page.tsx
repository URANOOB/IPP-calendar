import { TeachersManager } from "@/components/teachers/teachers-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profesores" };

export default async function TeachersPage() {
  await requireDashboardRoute("/dashboard/teachers");
  const supabase = await createClient(); const [{ data: teachers }, { data: candidates }, { data: classes }] = await Promise.all([supabase.rpc("admin_teacher_directory"), supabase.rpc("admin_teacher_candidates"), supabase.from("classes").select("teacher_id")]); const counts = new Map<string, number>(); (classes ?? []).forEach((item) => counts.set(item.teacher_id, (counts.get(item.teacher_id) ?? 0) + 1));
  const avatarUrl = (path: string | null) => path ? supabase.storage.from("teacher-avatars").getPublicUrl(path).data.publicUrl : null;
  return <><PageHeader title="Profesores" description="Administra perfiles, recordatorios y disponibilidad semanal de profesores." /><TeachersManager candidates={(candidates ?? []).map((item) => ({ id: item.profile_id, name: item.full_name, email: item.email }))} teachers={(teachers ?? []).map((item) => ({ id: item.teacher_id, name: item.display_name, email: item.email, notificationEmail: item.notification_email ?? "", avatarUrl: avatarUrl(item.avatar_path), active: item.active, classCount: counts.get(item.teacher_id) ?? 0, availableDays: item.available_days, availableFrom: item.available_from, availableUntil: item.available_until }))} /></>;
}
