import { BookOpenCheck, ShieldAlert } from "lucide-react";

import { RegistrationFlow, type PublicRegistrationClass, type PublicRegistrationStudent } from "@/components/public-registration/registration-flow";
import { WaitingRoom, type WaitingRoomClass } from "@/components/public-registration/waiting-room";
import { createClient } from "@/lib/supabase/server";
import { hashPrivateAccessToken } from "@/lib/utils/private-token";
import { privateTokenSchema } from "@/lib/validations/guardians";
import type { Json } from "@/types/database.generated";

export const metadata = { title: "Inscripción a clases" };

function InvalidLink() { return <main className="grid min-h-screen place-items-center px-6 py-12"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><ShieldAlert aria-hidden="true" className="mb-5 size-10 text-destructive" /><h1 className="text-3xl font-bold">Enlace no disponible</h1><p className="mt-3 text-lg leading-7 text-muted-foreground">Este enlace no es válido o ya no está disponible.</p></section></main>; }
function object(value: Json | null): Record<string, Json | undefined> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null; }
function stringValue(value: Json | undefined) { return typeof value === "string" ? value : null; }
function numberValue(value: Json | undefined) { return typeof value === "number" ? value : null; }

function parseStudents(value: Json): PublicRegistrationStudent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); const id = row && stringValue(row.id); const fullName = row && stringValue(row.full_name); const registrationRow = row && object(row.registration ?? null); const title = registrationRow && stringValue(registrationRow.title); const teacherName = registrationRow && stringValue(registrationRow.teacher_name); const startsAt = registrationRow && stringValue(registrationRow.starts_at); const endsAt = registrationRow && stringValue(registrationRow.ends_at); return id && fullName ? [{ id, fullName, registration: title && teacherName && startsAt && endsAt ? { title, teacherName, startsAt, endsAt } : null }] : []; });
}

function parseClasses(value: Json): PublicRegistrationClass[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); if (!row) return []; const id = stringValue(row.id); const title = stringValue(row.title); const teacherName = stringValue(row.teacher_name); const startsAt = stringValue(row.starts_at); const endsAt = stringValue(row.ends_at); const capacity = numberValue(row.capacity); const registered = numberValue(row.registered); const available = numberValue(row.available); return id && title && teacherName && startsAt && endsAt && capacity !== null && registered !== null && available !== null ? [{ id, title, teacherName, startsAt, endsAt, capacity, registered, available }] : []; });
}

function parseWaitingClasses(value: Json): WaitingRoomClass[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); if (!row) return []; const studentId = stringValue(row.student_id); const studentName = stringValue(row.student_name); const classId = stringValue(row.class_id); const title = stringValue(row.title); const teacherName = stringValue(row.teacher_name); const startsAt = stringValue(row.starts_at); const endsAt = stringValue(row.ends_at); const status = stringValue(row.status); return studentId && studentName && classId && title && teacherName && startsAt && endsAt && status ? [{ studentId, studentName, classId, title, teacherName, startsAt, endsAt, status }] : []; });
}

export default async function PrivateClassAccessPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params; const parsed = privateTokenSchema.safeParse(token); if (!parsed.success) return <InvalidLink />;
  const supabase = await createClient(); const tokenHash = hashPrivateAccessToken(parsed.data); const [{ data, error }, { data: waitingData, error: waitingError }] = await Promise.all([supabase.rpc("get_guardian_registration_context", { token_hash: tokenHash }), supabase.rpc("get_guardian_waiting_room", { token_hash: tokenHash })]); const context = !error ? data[0] : undefined;
  if (!context) return <InvalidLink />;
  const students = parseStudents(context.students); const classes = parseClasses(context.classes); const waitingClasses = !waitingError && waitingData[0] ? parseWaitingClasses(waitingData[0].classes) : []; const hasCycle = context.cycle_id !== null;
  return <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto w-full max-w-3xl"><header className="mb-8 rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8"><BookOpenCheck aria-hidden="true" className="mb-4 size-10" /><h1 className="text-3xl font-bold">Hola, {context.guardian_name}</h1><p className="mt-3 text-lg leading-7 text-primary-foreground/90">Consulta y programa las clases de tus niños.</p></header><WaitingRoom classes={waitingClasses} serverNow={new Date().toISOString()} token={parsed.data} />{!hasCycle ? <section className="rounded-2xl border bg-card p-6 text-lg shadow-sm">Las inscripciones aún no están disponibles.</section> : !context.registration_open ? <><section className="mb-6 rounded-2xl border bg-card p-6 text-lg shadow-sm">{context.cycle_status === "closed" ? "Las inscripciones de esta semana ya finalizaron." : "Las inscripciones aún no están disponibles."}</section><RegistrationFlow canRegister={false} classes={classes} students={students} token={parsed.data} /></> : <RegistrationFlow canRegister classes={classes} students={students} token={parsed.data} />}</div></main>;
}
