"use server";

import { revalidatePath } from "next/cache";

import { CYCLE_TRANSITIONS, type WeeklyCycleStatus } from "@/lib/cycles/constants";
import { bogotaInputToUtc } from "@/lib/cycles/dates";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { cycleIdSchema, weeklyCycleSchema } from "@/lib/validations/cycles";

export type CycleActionResult = { success: true; cycleId?: string } | { success: false; error: string };

function refreshCycles(cycleId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cycles");
  revalidatePath("/dashboard/ciclos");
  if (cycleId) revalidatePath(`/dashboard/cycles/${cycleId}`);
}

function cycleDatabaseError(error: { code?: string } | null): string | null {
  if (error?.code === "23P01") return "Las fechas de este ciclo se superponen con otra semana.";
  if (error?.code === "23505") return "Ya existe un ciclo abierto.";
  if (error?.code === "23514") return "Las fechas del ciclo no cumplen las reglas requeridas.";
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
      status: "draft",
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
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  const message = cycleDatabaseError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "Solo los ciclos en borrador pueden editarse." };
  refreshCycles(id.data);
  return { success: true };
}

export async function openCycle(cycleId: string): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const id = cycleIdSchema.safeParse(cycleId);
  if (!id.success) return { success: false, error: "El ciclo seleccionado no es válido." };

  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase.from("weekly_cycles").select("*").eq("id", id.data).maybeSingle();
  if (cycleError || !cycle || cycle.status !== "draft") return { success: false, error: "Solo un ciclo en borrador puede abrirse." };
  if (new Date(cycle.registration_closes_at) < new Date()) return { success: false, error: "No puedes abrir un ciclo con inscripciones ya vencidas." };

  const { data, error } = await supabase
    .from("weekly_cycles")
    .update({ status: "open", opened_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  const message = cycleDatabaseError(error);
  if (message) return { success: false, error: message };
  if (error || !data) return { success: false, error: "No fue posible abrir el ciclo." };
  refreshCycles(id.data);
  return { success: true };
}

export async function closeCycle(cycleId: string): Promise<CycleActionResult> {
  return transitionCycle(cycleId, "closed");
}

export async function archiveCycle(cycleId: string): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const id = cycleIdSchema.safeParse(cycleId);
  if (!id.success) return { success: false, error: "El ciclo seleccionado no es válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").update({ status: "archived" }).eq("id", id.data).in("status", ["draft", "closed"]).select("id").maybeSingle();
  if (error || !data) return { success: false, error: "Solo los ciclos en borrador o cerrados pueden archivarse." };
  refreshCycles(id.data);
  return { success: true };
}

async function transitionCycle(cycleId: string, target: WeeklyCycleStatus): Promise<CycleActionResult> {
  await requireDashboardRoute("/dashboard/cycles");
  const id = cycleIdSchema.safeParse(cycleId);
  if (!id.success || !CYCLE_TRANSITIONS.open.includes(target)) return { success: false, error: "La transición solicitada no es válida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_cycles")
    .update({ status: target, closed_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (error || !data) return { success: false, error: "Solo un ciclo abierto puede cerrarse." };
  refreshCycles(id.data);
  return { success: true };
}
