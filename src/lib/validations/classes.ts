import { z } from "zod";

import { bogotaInputToUtc } from "@/lib/cycles/dates";

export const classIdSchema = z.string().uuid("La clase seleccionada no es válida.");
export const teacherIdSchema = z.string().uuid("Selecciona un profesor válido.");

const localDateSchema = z.string().refine((value) => bogotaInputToUtc(value) !== null, "Ingresa una fecha y hora válidas.");

export const classSchema = z.object({
  title: z.string().trim().min(2, "Ingresa el título de la clase.").max(120, "El título no puede superar 120 caracteres."),
  description: z.string().trim().max(1000, "La descripción no puede superar 1000 caracteres.").optional(),
  cycleId: z.string().uuid("Selecciona un ciclo válido."),
  startsAt: localDateSchema,
  endsAt: localDateSchema,
  capacity: z.number().int().min(1, "El cupo debe ser al menos 1.").max(4, "El cupo máximo es 4."),
  meetingUrl: z.url("Ingresa un enlace HTTPS válido.").refine((url) => url.startsWith("https://"), "El enlace debe usar HTTPS."),
  teacherId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  const starts = bogotaInputToUtc(value.startsAt);
  const ends = bogotaInputToUtc(value.endsAt);
  if (starts && ends && starts >= ends) context.addIssue({ code: "custom", path: ["endsAt"], message: "La hora de finalización debe ser posterior al inicio." });
});

export type ClassValues = z.infer<typeof classSchema>;
