import { notFound } from "next/navigation";

import { GuardianDetail, type GuardianDetailData } from "@/components/contacts/guardian-detail";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Detalle de acudiente" };

export default async function GuardianDetailPage({ params }: Readonly<{ params: Promise<{ guardianId: string }> }>) {
  await requireDashboardRoute("/dashboard/contacts");
  const { guardianId } = await params;
  const supabase = await createClient();
  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("id, full_name, phone, active, access_token_hash")
    .eq("id", guardianId)
    .maybeSingle();

  if (guardianError || !guardian) notFound();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, active")
    .eq("guardian_id", guardian.id)
    .order("created_at");
  if (studentsError) notFound();
  const { data: events } = await supabase.from("contact_events").select("id, event_type, metadata, created_at").eq("guardian_id", guardian.id).order("created_at", { ascending: false }).limit(30);

  const { data: openCycle } = await supabase.from("weekly_cycles").select("id").eq("status", "open").maybeSingle();
  const studentIds = students.map((student) => student.id);
  const { data: registrations } = openCycle && studentIds.length > 0
    ? await supabase.from("registrations").select("student_id, class_id").eq("cycle_id", openCycle.id).in("student_id", studentIds).in("status", ["pending", "confirmed", "attended", "absent"])
    : { data: [] as { student_id: string; class_id: string }[] };
  const classIds = registrations?.map((registration) => registration.class_id) ?? [];
  const { data: scheduledClasses } = classIds.length > 0
    ? await supabase.from("classes").select("id, title, starts_at, teacher_id").in("id", classIds)
    : { data: [] as { id: string; title: string; starts_at: string; teacher_id: string }[] };
  const teacherIds = scheduledClasses?.map((classItem) => classItem.teacher_id) ?? [];
  const { data: teachers } = teacherIds.length > 0
    ? await supabase.from("teachers").select("id, display_name").in("id", teacherIds)
    : { data: [] as { id: string; display_name: string }[] };

  const detail: GuardianDetailData = {
    id: guardian.id,
    fullName: guardian.full_name,
    phone: guardian.phone,
    active: guardian.active,
    hasPrivateLink: guardian.access_token_hash !== null,
    students: students.map((student) => ({ id: student.id, fullName: student.full_name, active: student.active })),
    currentSchedule: (registrations ?? []).flatMap((registration) => {
      const student = students.find((item) => item.id === registration.student_id);
      const classItem = scheduledClasses?.find((item) => item.id === registration.class_id);
      const teacher = teachers?.find((item) => item.id === classItem?.teacher_id);
      return student && classItem && teacher ? [{ studentName: student.full_name, classTitle: classItem.title, teacherName: teacher.display_name, startsAt: classItem.starts_at }] : [];
    }),
    events: (events ?? []).map((event) => ({ id: event.id, type: event.event_type, createdAt: event.created_at, note: typeof event.metadata === "object" && event.metadata !== null && !Array.isArray(event.metadata) && typeof event.metadata.note === "string" ? event.metadata.note : null })),
  };

  return <GuardianDetail guardian={detail} />;
}
