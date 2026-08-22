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
    .select("id, full_name, phone, active")
    .eq("id", guardianId)
    .maybeSingle();

  if (guardianError || !guardian) notFound();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, active")
    .eq("guardian_id", guardian.id)
    .order("created_at");
  if (studentsError) notFound();

  const { data: openCycle } = await supabase
    .from("weekly_cycles")
    .select("id")
    .eq("status", "open")
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  const { data: privateAccess } = openCycle
    ? await supabase
      .from("guardian_cycle_invitations")
      .select("access_token")
      .eq("guardian_id", guardian.id)
      .eq("cycle_id", openCycle.id)
      .eq("active", true)
      .not("access_token", "is", null)
      .maybeSingle()
    : { data: null };

  const detail: GuardianDetailData = {
    id: guardian.id,
    fullName: guardian.full_name,
    phone: guardian.phone,
    active: guardian.active,
    privateAccessToken: privateAccess?.access_token ?? null,
    students: students.map((student) => ({ id: student.id, fullName: student.full_name, active: student.active })),
  };

  return <GuardianDetail guardian={detail} />;
}
