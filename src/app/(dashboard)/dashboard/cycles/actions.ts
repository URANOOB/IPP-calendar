"use server";

import { revalidatePath } from "next/cache";

import { bogotaInputToUtc } from "@/lib/cycles/dates";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { cycleIdSchema, weeklyCycleSchema } from "@/lib/validations/cycles";

export type CycleActionResult = { success: true; cycleId?: string } | { success: false; error: string };

function refreshCycles(cycleId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cycles");
  if (cycleId) revalidatePath(`/dashboard/cycles/${cycleId}`);
}

function cycleDatabaseError(error: { code?: string; constraint?: string; message?: string } | null): string | null {
  if (error?.code === "23P01" && error.constraint === "weekly_cycles_no_registration_window_overlap") {
    return "La ventana de inscripción se superpone con otro ciclo activo.";
  }
  if (error?.code === "23P01") return "Las fechas de este ciclo se superponen con otra semana.";
  if (error?.code === "23514") return "Las fechas del ciclo no cumplen las reglas requeridas.";
  if (error?.message?.includes("A cycle cannot exclude existing classes")) {
    return "No puedes dejar clases existentes fuera del rango del ciclo.";
  }
  return null;
}

export async function createCycle(values: unknown): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const parsed = weeklyCycleSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Revisa las fechas y el nombre del ciclo." };

  const starts = bogotaInputToUtc(parsed.data.startsAt);
  const ends = bogotaInputToUtc(parsed.data.endsAt);
  const opens = bogotaInputToUtc(parsed.data.registrationOpensAt);
  const closes = bogotaInputToUtc(parsed.data.registrationClosesAt);
  if (!starts || !ends || !opens || !closes) return { success: false, error: "Revisa las fechas del ciclo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_cycles")
    .insert({
      name: parsed.data.name,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      registration_opens_at: opens.toISOString(),
      registration_closes_at: closes.toISOString(),
      status: "open",
      opened_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const message = cycleDatabaseError(error);
  if (message) return { success: false, error: message };
  if (error || !data) {
    console.error("No fue posible crear el ciclo.");
    return { success: false, error: "No fue posible crear el ciclo." };
  }
  refreshCycles();
  return { success: true, cycleId: data.id };
}

export async function updateDraftCycle(cycleId: string, values: unknown): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const id = cycleIdSchema.safeParse(cycleId);
  const parsed = weeklyCycleSchema.safeParse(values);
  if (!id.success || !parsed.success) return { success: false, error: "Revisa los datos del ciclo." };

  const starts = bogotaInputToUtc(parsed.data.startsAt);
  const ends = bogotaInputToUtc(parsed.data.endsAt);
  const opens = bogotaInputToUtc(parsed.data.registrationOpensAt);
  const closes = bogotaInputToUtc(parsed.data.registrationClosesAt);
  if (!starts || !ends || !opens || !closes) return { success: false, error: "Revisa las fechas del ciclo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_cycles")
    .update({
      name: parsed.data.name,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      registration_opens_at: opens.toISOString(),
      registration_closes_at: closes.toISOString(),
    })
    .eq("id", id.data)
    .in("status", ["open", "closed"])
    .select("id")
    .maybeSingle();
  const message = cycleDatabaseError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible actualizar el ciclo." };
  refreshCycles(id.data);
  return { success: true };
}

export async function setCycleActive(cycleId: string, active: boolean): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const id = cycleIdSchema.safeParse(cycleId);
  if (!id.success) return { success: false, error: "El ciclo seleccionado no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_cycles")
    .update(active ? { status: "open", opened_at: new Date().toISOString(), closed_at: null } : { status: "closed", closed_at: new Date().toISOString() })
    .eq("id", id.data)
    .in("status", ["open", "closed"])
    .select("id")
    .maybeSingle();
  const message = cycleDatabaseError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible actualizar el estado del ciclo." };
  refreshCycles(id.data);
  return { success: true };
}

export async function deleteCycle(cycleId: string): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles"); const id = cycleIdSchema.safeParse(cycleId); if (!id.success) return { success: false, error: "El ciclo seleccionado no es válido." };
  const supabase = await createClient(); const { error } = await supabase.rpc("delete_cycle", { p_cycle_id: id.data });
  if (error) return { success: false, error: "No fue posible eliminar el ciclo y sus clases." };
  refreshCycles(); revalidatePath("/dashboard/classes"); return { success: true };
}
