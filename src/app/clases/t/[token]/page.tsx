import { BookOpenCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";

import { RegistrationFlow, type PublicRegistrationClass, type PublicRegistrationStudent } from "@/components/public-registration/registration-flow";
import Link from "next/link";
import { PrivateLinkCopy } from "@/components/public-registration/private-link-copy";
import { WaitingRoom, type WaitingRoomClass } from "@/components/public-registration/waiting-room";
import { createClient } from "@/lib/supabase/server";
import { hashPrivateAccessToken } from "@/lib/utils/private-token";
import { privateTokenSchema } from "@/lib/validations/guardians";
import type { Json } from "@/types/database.generated";

export const metadata = { title: "Inscripción a clases" };

function InvalidLink() { return <main className="grid min-h-screen place-items-center px-6 py-12"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><ShieldAlert aria-hidden="true" className="mb-5 size-10 text-destructive" /><h1 className="text-3xl font-bold">Enlace no disponible</h1><p className="mt-3 text-lg leading-7 text-muted-foreground">Este enlace no es válido o el registro todavía no se ha completado.</p><Link className="mt-5 inline-flex rounded-xl bg-primary px-4 py-3 font-semibold text-white" href="/registro">Ir al formulario de inscripción</Link></section></main>; }
function object(value: Json | null): Record<string, Json | undefined> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null; }
function stringValue(value: Json | undefined) { return typeof value === "string" ? value : null; }
function numberValue(value: Json | undefined) { return typeof value === "number" ? value : null; }

function parseStudents(value: Json): PublicRegistrationStudent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); const id = row && stringValue(row.id); const fullName = row && stringValue(row.full_name); const registrationRow = row && object(row.registration ?? null); const title = registrationRow && stringValue(registrationRow.title); const teacherName = registrationRow && stringValue(registrationRow.teacher_name); const startsAt = registrationRow && stringValue(registrationRow.starts_at); const endsAt = registrationRow && stringValue(registrationRow.ends_at); return id && fullName ? [{ id, fullName, registration: title && teacherName && startsAt && endsAt ? { title, teacherName, startsAt, endsAt } : null }] : []; });
}

function parseClasses(value: Json): (PublicRegistrationClass & { teacherAvatarPath: string | null })[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); if (!row) return []; const id = stringValue(row.id); const title = stringValue(row.title); const teacherName = stringValue(row.teacher_name); const teacherAvatarPath = stringValue(row.teacher_avatar_path); const startsAt = stringValue(row.starts_at); const endsAt = stringValue(row.ends_at); const capacity = numberValue(row.capacity); const registered = numberValue(row.registered); const available = numberValue(row.available); return id && title && teacherName && startsAt && endsAt && capacity !== null && registered !== null && available !== null ? [{ id, title, teacherName, teacherAvatarPath, teacherAvatarUrl: null, startsAt, endsAt, capacity, registered, available }] : []; });
}

function parseWaitingClasses(value: Json): WaitingRoomClass[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = object(item); if (!row) return []; const studentId = stringValue(row.student_id); const studentName = stringValue(row.student_name); const classId = stringValue(row.class_id); const title = stringValue(row.title); const teacherName = stringValue(row.teacher_name); const startsAt = stringValue(row.starts_at); const endsAt = stringValue(row.ends_at); const status = stringValue(row.status); return studentId && studentName && classId && title && teacherName && startsAt && endsAt && status ? [{ studentId, studentName, classId, title, teacherName, startsAt, endsAt, status }] : []; });
}

export default async function PrivateClassAccessPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params; const parsed = privateTokenSchema.safeParse(token); if (!parsed.success) return <InvalidLink />;
  const requestHeaders = await headers(); const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""; const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"; const origin = host ? `${protocol}://${host}` : "";
  const supabase = await createClient(); const tokenHash = hashPrivateAccessToken(parsed.data); const [{ data, error }, { data: waitingData, error: waitingError }] = await Promise.all([supabase.rpc("get_guardian_registration_context", { token_hash: tokenHash }), supabase.rpc("get_guardian_waiting_room", { token_hash: tokenHash })]); const context = !error ? data[0] : undefined;
  if (!context) return <InvalidLink />;
  const students = parseStudents(context.students); const classes = parseClasses(context.classes).map(({ teacherAvatarPath, ...classItem }) => ({ ...classItem, teacherAvatarUrl: teacherAvatarPath ? supabase.storage.from("teacher-avatars").getPublicUrl(teacherAvatarPath).data.publicUrl : null })); const waitingClasses = !waitingError && waitingData[0] ? parseWaitingClasses(waitingData[0].classes) : []; const hasCycle = context.cycle_id !== null; const allStudentsRegistered = students.length > 0 && students.every((student) => student.registration);
  const needsCompletion = !context.guardian_name?.trim() || students.length === 0;
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <header className="overflow-hidden rounded-3xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-7"><span className="inline-flex items-center gap-2 text-sm font-bold"><BookOpenCheck aria-hidden="true" className="size-5 text-primary" />IPP · Espacio de familias</span><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4" />Acceso privado</span></div>
        <div className="bg-gradient-to-r from-secondary/70 via-card to-card px-5 py-7 sm:px-7 sm:py-8"><p className="text-sm font-semibold text-primary">Tu agenda de clases</p><h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{context.guardian_name ? `Hola, ${context.guardian_name}` : "Hola"}</h1><p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Aquí puedes organizar las clases de tus niños y acompañar cada paso de su aprendizaje.</p></div>
      </header>
      {needsCompletion ? <section className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-bold">Completa tu registro</h2><p className="mt-2 text-muted-foreground">Completa tu nombre y los estudiantes a tu cargo en el formulario general.</p><Link className="mt-4 inline-flex rounded-xl bg-primary px-4 py-3 font-semibold text-white" href="/registro">Ir al formulario de inscripción</Link></section> : <>
        <PrivateLinkCopy origin={origin} token={parsed.data} />
        <WaitingRoom classes={waitingClasses} serverNow={new Date().toISOString()} token={parsed.data} />
        {!hasCycle ? <section className="rounded-2xl border bg-card p-6 text-muted-foreground">Las inscripciones aún no están disponibles.</section> : allStudentsRegistered ? null : !context.registration_open ? <><section className="rounded-2xl border bg-card p-6 text-muted-foreground">{context.cycle_status === "closed" ? "Las inscripciones de esta semana ya finalizaron." : "Las inscripciones aún no están disponibles."}</section><RegistrationFlow canRegister={false} classes={classes} students={students} token={parsed.data} /></> : <RegistrationFlow canRegister classes={classes} students={students} token={parsed.data} />}
      </>}
    </div>
  </main>;
}
