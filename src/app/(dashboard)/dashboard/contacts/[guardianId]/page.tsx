import { notFound } from "next/navigation";

import { GuardianDetail, type GuardianDetailData } from "@/components/contacts/guardian-detail";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { getPrivateAccessCycle } from "@/lib/cycles/service";

export const metadata = { title: "Detalle de acudiente" };

export default async function GuardianDetailPage({ params }: Readonly<{ params: Promise<{ guardianId: string }> }>) {
  const user = await requireDashboardRoute("/dashboard/contacts");
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

  const openCycle = await getPrivateAccessCycle();
  const { data: privateAccess, error: accessError } = openCycle
    ? await supabase
      .from("guardian_cycle_invitations")
      .select("access_token")
      .eq("guardian_id", guardian.id)
      .eq("cycle_id", openCycle.id)
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .not("registration_completed_at", "is", null).not("access_token", "is", null)
      .maybeSingle()
    : { data: null, error: null };
  if (accessError) throw new Error("No fue posible consultar el enlace privado.");

  const detail: GuardianDetailData = {
    id: guardian.id,
    fullName: guardian.full_name,
    phone: guardian.phone,
    active: guardian.active,
    privateAccessToken: privateAccess?.access_token ?? null,
    privateAccessCycle: openCycle ? { id: openCycle.id, name: openCycle.name } : null,
    students: students.map((student) => ({ id: student.id, fullName: student.full_name, active: student.active })),
  };

  return <GuardianDetail canDelete={user.role === "admin"} guardian={detail} />;
}
