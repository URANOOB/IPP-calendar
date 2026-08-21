import { ClassesManager, type ClassCycleOption, type ClassListItem, type ClassTeacherOption } from "@/components/classes/classes-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Clases" };

export default async function ClassesPage() {
  const user = await requireUser(); const supabase = await createClient();
  const [{ data: classes }, { data: teachers }, { data: cycles }] = await Promise.all([supabase.from("classes").select("*").order("starts_at"), supabase.from("teachers").select("id, display_name").eq("active", true), supabase.from("weekly_cycles").select("id, name, status").in("status", ["draft", "open"]).order("starts_at")]);
  const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher.display_name])); const cycleMap = new Map((cycles ?? []).map((cycle) => [cycle.id, cycle.name]));
  const list: ClassListItem[] = (classes ?? []).map((item) => ({ id: item.id, title: item.title, teacherId: item.teacher_id, teacherName: teacherMap.get(item.teacher_id) ?? "Profesor", cycleId: item.cycle_id, cycleName: cycleMap.get(item.cycle_id) ?? "Ciclo histórico", startsAt: item.starts_at, endsAt: item.ends_at, capacity: item.capacity, status: item.status }));
  const teacherOptions: ClassTeacherOption[] = (teachers ?? []).map((teacher) => ({ id: teacher.id, name: teacher.display_name })); const cycleOptions: ClassCycleOption[] = (cycles ?? []).map((cycle) => ({ id: cycle.id, name: cycle.name }));
  return <><PageHeader title={user.role === "teacher" ? "Mis clases" : "Clases"} description="Gestiona la oferta de clases de cada ciclo semanal." /><ClassesManager classes={list} cycles={cycleOptions} role={user.role} teachers={teacherOptions} /></>;
}
