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

  function toggleAttendance() {
    setError(undefined);
    startTransition(async () => {
      const result = await saveClassAttendance(classId, [{ registrationId, status: attended ? "absent" : "attended" }]);
      if (!result.success) {
        setError(result.error ?? "No pudimos actualizar la asistencia.");
        return;
      }
      router.refresh();
    });
  }

  return <div className="flex flex-col items-start gap-1"><div className="flex items-center gap-2"><span className={`text-xs font-medium ${attended ? "text-emerald-700" : status === "absent" ? "text-destructive" : "text-muted-foreground"}`}>{attendanceLabel}</span><button aria-checked={attended} aria-label={`Marcar asistencia de ${studentName}`} className={`relative h-6 w-11 rounded-full transition-colors ${attended ? "bg-emerald-600" : "bg-muted-foreground/35"}`} disabled={pending} onClick={toggleAttendance} role="switch" type="button"><span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${attended ? "translate-x-6" : "translate-x-1"}`} /></button></div>{error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}</div>;
}
