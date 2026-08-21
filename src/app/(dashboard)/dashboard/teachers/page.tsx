import { TeachersManager } from "@/components/teachers/teachers-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profesores" };

export default async function TeachersPage() {
  await requireDashboardRoute("/dashboard/teachers");
  const supabase = await createClient(); const [{ data: teachers }, { data: candidates }, { data: classes }] = await Promise.all([supabase.rpc("admin_teacher_directory"), supabase.rpc("admin_teacher_candidates"), supabase.from("classes").select("teacher_id")]); const counts = new Map<string, number>(); (classes ?? []).forEach((item) => counts.set(item.teacher_id, (counts.get(item.teacher_id) ?? 0) + 1));
  return <><PageHeader title="Profesores" description="Asocia usuarios internos con perfiles de profesor." /><TeachersManager candidates={(candidates ?? []).map((item) => ({ id: item.profile_id, name: item.full_name, email: item.email }))} teachers={(teachers ?? []).map((item) => ({ id: item.teacher_id, name: item.display_name, email: item.email, active: item.active, classCount: counts.get(item.teacher_id) ?? 0 }))} /></>;
}
