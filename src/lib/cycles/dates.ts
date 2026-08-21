import { addDays, isValid } from "date-fns";

import type { WeeklyCycleStatus } from "@/lib/cycles/constants";

export const BOGOTA_TIME_ZONE = "America/Bogota";

export interface CycleDateWindow {
  status: WeeklyCycleStatus;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
}

function validDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

/** Converts a datetime-local input interpreted in Colombia (UTC-05:00) to an instant for timestamptz. */
export function bogotaInputToUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return validDate(`${value}:00-05:00`);
}

export function utcToBogotaInput(value: string | Date): string {
  const date = validDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatBogotaDate(value: string | Date): string {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("es-CO", { timeZone: BOGOTA_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(date) : "";
}

export function formatBogotaDateTime(value: string | Date): string {
  const date = validDate(value);
  return date
    ? new Intl.DateTimeFormat("es-CO", { timeZone: BOGOTA_TIME_ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date)
    : "";
}

export function canRegisterInCycle(cycle: CycleDateWindow, now = new Date()): boolean {
  const opens = validDate(cycle.registration_opens_at);
  const closes = validDate(cycle.registration_closes_at);
  return cycle.status === "open" && opens !== null && closes !== null && now >= opens && now <= closes;
}

export function getCycleEffectiveStatus(cycle: CycleDateWindow, now = new Date()): string {
  if (cycle.status !== "open") return cycle.status === "closed" ? "Inscripciones cerradas" : cycle.status === "archived" ? "Archivado" : "Borrador";
  const opens = validDate(cycle.registration_opens_at);
  const closes = validDate(cycle.registration_closes_at);
  if (!opens || !closes) return "Fechas inválidas";
  if (now < opens) return "Apertura programada";
  if (now > closes) return "Inscripción vencida";
  return "Inscripciones abiertas";
}

export function nextWeekCycleDates(cycle: Pick<CycleDateWindow, "starts_at" | "ends_at" | "registration_opens_at" | "registration_closes_at">) {
  return {
    startsAt: utcToBogotaInput(addDays(new Date(cycle.starts_at), 7)),
    endsAt: utcToBogotaInput(addDays(new Date(cycle.ends_at), 7)),
    registrationOpensAt: utcToBogotaInput(addDays(new Date(cycle.registration_opens_at), 7)),
    registrationClosesAt: utcToBogotaInput(addDays(new Date(cycle.registration_closes_at), 7)),
  };
}
