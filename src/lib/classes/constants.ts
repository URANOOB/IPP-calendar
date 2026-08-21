import type { Database } from "@/types/database";

export type ClassStatus = Database["public"]["Enums"]["class_status"];
export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = { draft: "Borrador", published: "Publicada", cancelled: "Cancelada", completed: "Finalizada" };
export const CLASS_TRANSITIONS: Record<ClassStatus, readonly ClassStatus[]> = { draft: ["published", "cancelled"], published: ["cancelled", "completed"], cancelled: [], completed: [] };
