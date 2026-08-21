import { z } from "zod";

import { bogotaInputToUtc } from "@/lib/cycles/dates";

export const cycleIdSchema = z.string().uuid("El ciclo seleccionado no es válido.");

const bogotaDateTimeSchema = z.string().refine((value) => bogotaInputToUtc(value) !== null, "Ingresa una fecha y hora válidas.");

export const weeklyCycleSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresa un nombre para el ciclo.").max(120, "El nombre no puede superar 120 caracteres."),
    startsAt: bogotaDateTimeSchema,
    endsAt: bogotaDateTimeSchema,
    registrationOpensAt: bogotaDateTimeSchema,
    registrationClosesAt: bogotaDateTimeSchema,
  })
  .superRefine((value, context) => {
    const starts = bogotaInputToUtc(value.startsAt);
    const ends = bogotaInputToUtc(value.endsAt);
    const opens = bogotaInputToUtc(value.registrationOpensAt);
    const closes = bogotaInputToUtc(value.registrationClosesAt);
    if (!starts || !ends || !opens || !closes) return;
    if (starts >= ends) context.addIssue({ code: "custom", path: ["endsAt"], message: "El fin debe ser posterior al inicio." });
    if (opens >= closes) context.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "El cierre debe ser posterior a la apertura." });
    if (closes > ends) context.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "El cierre no puede ser posterior al final del ciclo." });
  });

export type WeeklyCycleValues = z.infer<typeof weeklyCycleSchema>;
