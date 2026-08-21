import { differenceInMinutes } from "date-fns";

import type { ClassStatus } from "@/lib/classes/constants";
import { formatBogotaDate, formatBogotaDateTime } from "@/lib/cycles/dates";

export interface ClassTimeData { starts_at: string; ends_at: string; status: ClassStatus; }

export function getClassTemporalStatus(classItem: ClassTimeData, now = new Date()): string {
  if (classItem.status === "cancelled") return "Cancelada";
  if (classItem.status === "draft") return "Borrador";
  if (classItem.status === "completed") return "Finalizada";
  if (now < new Date(classItem.starts_at)) return "Próxima";
  if (now <= new Date(classItem.ends_at)) return "En curso";
  return "Finalizada según horario";
}

export function getClassDurationMinutes(classItem: Pick<ClassTimeData, "starts_at" | "ends_at">) {
  return Math.max(0, differenceInMinutes(new Date(classItem.ends_at), new Date(classItem.starts_at)));
}

export function getClassCapacity(capacity: number, registered = 0) {
  const available = Math.max(0, capacity - registered);
  return { capacity, registered, available, full: available === 0 };
}

export function getClassCapacitySummary(capacity: number, usedCapacity = 0) {
  const summary = getClassCapacity(capacity, usedCapacity);
  return { usedCapacity: summary.registered, availableCapacity: summary.available };
}

export function buildWhatsAppClassMessage(classItem: { title: string; teacherName: string; startsAt: string }) {
  return `¡Hola!\n\nYa se encuentra disponible una nueva clase de Inglés pa' la Paz.\n\nClase: ${classItem.title}\nProfesor: ${classItem.teacherName}\nFecha: ${formatBogotaDate(classItem.startsAt)}\nHora: ${formatBogotaDateTime(classItem.startsAt)}\n\nPuedes revisar las clases disponibles desde tu enlace personal.`;
}
