export interface AttendanceEntry {
  registrationId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
}

export function AttendanceManager({ entries }: Readonly<{ entries: AttendanceEntry[] }>) {
  return <section><h2 className="text-lg font-bold">Estudiantes inscritos</h2>{entries.length ? <div className="mt-3 space-y-2">{entries.map((entry) => <div className="rounded-lg border p-3" key={entry.registrationId}><p className="font-medium">{entry.studentName}</p><p className="mt-1 text-sm text-muted-foreground">Acudiente: {entry.guardianName}</p><p className="text-sm text-muted-foreground">Teléfono: {entry.guardianPhone}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay estudiantes inscritos en esta clase.</p>}</section>;
}
