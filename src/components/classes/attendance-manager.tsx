import { StudentAttendanceSwitch } from "@/components/students/student-attendance-switch";
import { Users } from "lucide-react";

export interface AttendanceEntry {
  registrationId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  status: "pending" | "confirmed" | "attended" | "absent" | "cancelled";
}

export function AttendanceManager({ entries, classId }: Readonly<{ entries: AttendanceEntry[]; classId: string }>) {
  return <section aria-labelledby="class-students-heading">
    <div className="flex items-center gap-2"><h2 className="text-lg font-bold" id="class-students-heading">Estudiantes inscritos</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{entries.length}</span></div>
    {entries.length ? <><p className="mt-1 text-sm text-muted-foreground">Consulta al acudiente y registra la asistencia de cada estudiante.</p><ul className="mt-4 divide-y">{entries.map((entry) => <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={entry.registrationId}><div className="min-w-0"><p className="break-words font-semibold">{entry.studentName}</p><p className="mt-1 break-words text-sm text-muted-foreground">Acudiente: {entry.guardianName}</p><p className="text-sm text-muted-foreground">{entry.guardianPhone}</p></div><StudentAttendanceSwitch classId={classId} registrationId={entry.registrationId} status={entry.status} studentName={entry.studentName} /></li>)}</ul></> : <div className="mt-4 flex items-start gap-3 rounded-xl bg-background px-4 py-5"><Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Aún no hay estudiantes inscritos</p><p className="mt-1 text-sm text-muted-foreground">Las inscripciones aparecerán aquí para consultar sus datos y registrar la asistencia.</p></div></div>}
  </section>;
}
