import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type WeeklyCycle = Database["public"]["Tables"]["weekly_cycles"]["Row"];

export interface CycleOverview {
  currentOpenCycle: WeeklyCycle | null;
  upcomingCycle: WeeklyCycle | null;
  lastClosedCycle: WeeklyCycle | null;
}

/** Same cycle ordering as ensure_staff_guardian_access: current, then upcoming. */
export async function getPrivateAccessCycle() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").select("id, name")
    .eq("status", "open").gt("registration_closes_at", new Date().toISOString())
    .order("registration_opens_at").order("starts_at").order("id").limit(1).maybeSingle();
  if (error) throw new Error("No fue posible consultar el ciclo del enlace privado.");
  return data;
}

/** One query shared by dashboard and future class/registration modules. */
export async function getCycleOverview(): Promise<CycleOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").select("*").order("starts_at", { ascending: true });
  if (error || !data) {
    throw new Error("No fue posible consultar los ciclos.");
  }

  const now = new Date();
  return {
    currentOpenCycle: data.find((cycle) => cycle.status === "open" && new Date(cycle.starts_at) <= now && now <= new Date(cycle.ends_at)) ?? null,
    upcomingCycle: data.find((cycle) => new Date(cycle.starts_at) > now && cycle.status === "open") ?? null,
    lastClosedCycle: [...data].reverse().find((cycle) => new Date(cycle.ends_at) <= now && cycle.status !== "draft") ?? null,
  };
}

export async function getCycles(): Promise<WeeklyCycle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").select("*").order("starts_at", { ascending: false });
  if (error) {
    throw new Error("No fue posible consultar los ciclos.");
  }
  return data;
}
