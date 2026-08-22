import type { Database } from "@/types/database";

export type WeeklyCycleStatus = Database["public"]["Enums"]["weekly_cycle_status"];

export const WEEKLY_CYCLE_STATUS_LABELS: Record<WeeklyCycleStatus, string> = {
  draft: "Activo",
  open: "Activo",
  closed: "Inactivo",
  archived: "Inactivo",
};
