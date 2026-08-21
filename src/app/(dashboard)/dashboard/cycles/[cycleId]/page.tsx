import { notFound } from "next/navigation";

import { CycleDetail, type CycleDetailData } from "@/components/cycles/cycle-detail";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Detalle de ciclo" };

export default async function CycleDetailPage({ params }: Readonly<{ params: Promise<{ cycleId: string }> }>) {
  await requireDashboardRoute("/dashboard/cycles");
  const { cycleId } = await params;
  const supabase = await createClient();
  const { data: cycle, error } = await supabase.from("weekly_cycles").select("*").eq("id", cycleId).maybeSingle();
  if (error || !cycle) notFound();
  const detail: CycleDetailData = { id: cycle.id, name: cycle.name, startsAt: cycle.starts_at, endsAt: cycle.ends_at, registrationOpensAt: cycle.registration_opens_at, registrationClosesAt: cycle.registration_closes_at, status: cycle.status };
  return <CycleDetail cycle={detail} />;
}
