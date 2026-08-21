"use client";

import { useState, useTransition } from "react";

import { saveClassAttendance } from "@/app/(dashboard)/dashboard/classes/actions";
import { Button } from "@/components/ui/button";

export interface AttendanceEntry { registrationId: string; studentName: string; guardianName: string; status: "pending" | "attended" | "absent"; }

export function AttendanceManager({ classId, entries, canManage }: { classId: string; entries: AttendanceEntry[]; canManage: boolean }) {
  const [values, setValues] = useState<Record<string, "attended" | "absent">>(() => entries.reduce<Record<string, "attended" | "absent">>((result, entry) => { if (entry.status === "attended" || entry.status === "absent") result[entry.registrationId] = entry.status; return result; }, {})); const [error, setError] = useState<string>(); const [pending, startTransition] = useTransition();
  function save() { const selected = Object.entries(values).map(([registrationId, status]) => ({ registrationId, status })); if (!selected.length) { setError("Selecciona al menos una asistencia."); return; } setError(undefined); startTransition(async () => { const result = await saveClassAttendance(classId, selected); if (!result.success) setError(result.error); }); }
  return <section><h2 className="text-lg font-bold">Asistencia</h2><div className="mt-3 space-y-2">{entries.map((entry) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={entry.registrationId}><div><strong>{entry.studentName}</strong><p className="text-sm text-muted-foreground">Acudiente: {entry.guardianName}</p></div>{canManage ? <div className="flex gap-2"><Button onClick={() => setValues((current) => ({ ...current, [entry.registrationId]: "attended" }))} type="button" variant={values[entry.registrationId] === "attended" ? "default" : "outline"}>Asistió</Button><Button onClick={() => setValues((current) => ({ ...current, [entry.registrationId]: "absent" }))} type="button" variant={values[entry.registrationId] === "absent" ? "default" : "outline"}>No asistió</Button></div> : <span>{entry.status === "attended" ? "Asistió" : entry.status === "absent" ? "No asistió" : "Pendiente"}</span>}</div>)}</div>{canManage ? <><Button className="mt-4" disabled={pending} onClick={save} type="button">{pending ? "Guardando…" : "Guardar asistencia"}</Button>{error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}</> : null}</section>;
}
