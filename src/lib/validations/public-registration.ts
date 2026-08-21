import { z } from "zod";

export const publicClassSelectionSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
});

export const publicClassSelectionsSchema = z.array(publicClassSelectionSchema).min(1).max(4).superRefine((items, ctx) => {
  const studentIds = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (studentIds.has(item.studentId)) {
      ctx.addIssue({ code: "custom", path: [index, "studentId"], message: "Cada niño solo puede tener una clase." });
    }
    studentIds.add(item.studentId);
  }
});

export type PublicClassSelection = z.infer<typeof publicClassSelectionSchema>;
