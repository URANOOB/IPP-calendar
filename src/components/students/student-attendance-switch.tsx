"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveClassAttendance } from "@/app/(dashboard)/dashboard/classes/actions";

export function StudentAttendanceSwitch({ classId, registrationId, status, studentName }: Readonly<{ classId: string; registrationId: string; status: "pending" | "confirmed" | "attended" | "absent" | "cancelled"; studentName: string }>) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const attended = status === "attended";
  const attendanceLabel = status === "attended" ? "Asistió" : status === "absent" ? "No asistió" : "Pendiente de marcar";

  function setAttendance(nextStatus: "attended" | "absent") {
    setError(undefined);
    startTransition(async () => {
      const result = await saveClassAttendance(classId, [{ registrationId, status: nextStatus }]);
      if (!result.success) {
        setError(result.error ?? "No pudimos actualizar la asistencia.");
        return;
      }
      router.refresh();
    });
  }

  return <div className="flex flex-col items-start gap-1"><select aria-label={`Asistencia de ${studentName}`} className={`h-10 max-w-full rounded-lg border bg-background px-2 text-sm ${attended ? "text-emerald-700" : status === "absent" ? "text-destructive" : "text-muted-foreground"}`} disabled={pending || status === "cancelled"} onChange={(event) => setAttendance(event.target.value as "attended" | "absent")} value={attended || status === "absent" ? status : ""}><option disabled value="">{attendanceLabel}</option><option value="attended">Asistió</option><option value="absent">No asistió</option></select>{error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}</div>;
}
