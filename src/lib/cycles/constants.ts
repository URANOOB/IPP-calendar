import type { Database } from "@/types/database";

export type WeeklyCycleStatus = Database["public"]["Enums"]["weekly_cycle_status"];

export const WEEKLY_CYCLE_STATUS_LABELS: Record<WeeklyCycleStatus, string> = {
  draft: "Borrador",
  open: "Abierto",
  closed: "Cerrado",
  archived: "Archivado",
};

export const CYCLE_TRANSITIONS: Record<WeeklyCycleStatus, readonly WeeklyCycleStatus[]> = {
  draft: ["open", "archived"],
  open: ["closed"],
  closed: ["archived"],
  archived: [],
};
