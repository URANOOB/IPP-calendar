import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type WeeklyCycle = Database["public"]["Tables"]["weekly_cycles"]["Row"];

export interface CycleOverview {
  currentOpenCycle: WeeklyCycle | null;
  upcomingCycle: WeeklyCycle | null;
  lastClosedCycle: WeeklyCycle | null;
}

/** One query shared by dashboard and future class/registration modules. */
export async function getCycleOverview(): Promise<CycleOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").select("*").order("starts_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("No fue posible consultar los ciclos.");
    return { currentOpenCycle: null, upcomingCycle: null, lastClosedCycle: null };
  }

  const now = new Date();
  return {
    currentOpenCycle: data.find((cycle) => cycle.status === "open") ?? null,
    upcomingCycle: data.find((cycle) => new Date(cycle.starts_at) > now && cycle.status !== "archived") ?? null,
    lastClosedCycle: [...data].reverse().find((cycle) => (cycle.status === "closed" || cycle.status === "archived") && new Date(cycle.ends_at) <= now) ?? null,
  };
}

export async function getCycles(): Promise<WeeklyCycle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_cycles").select("*").order("starts_at", { ascending: false });
  if (error) {
    console.error("No fue posible consultar los ciclos.");
    return [];
  }
  return data;
}
