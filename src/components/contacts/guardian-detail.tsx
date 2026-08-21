"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  createStudent,
  deactivateStudent,
  generateGuardianLink,
  updateGuardian,
  updateStudent,
} from "@/app/(dashboard)/dashboard/contacts/actions";
import { Button } from "@/components/ui/button";
import { formatColombianPhone } from "@/lib/utils/phone";
import {
  guardianUpdateSchema,
  studentSchema,
  studentUpdateSchema,
  type GuardianUpdateValues,
  type StudentUpdateValues,
  type StudentValues,
} from "@/lib/validations/guardians";

export interface GuardianDetailData {
  id: string;
  fullName: string;
  phone: string;
  active: boolean;
  hasPrivateLink: boolean;
  students: { id: string; fullName: string; active: boolean }[];
  currentSchedule: { studentName: string; classTitle: string; teacherName: string; startsAt: string }[];
  events: { id: string; type: string; createdAt: string; note: string | null }[];
}

export function GuardianDetail({ guardian }: Readonly<{ guardian: GuardianDetailData }>) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string>();
  const [privateLink, setPrivateLink] = useState<string>();
  const [editingStudentId, setEditingStudentId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const guardianForm = useForm<GuardianUpdateValues>({
    resolver: zodResolver(guardianUpdateSchema),
    defaultValues: { fullName: guardian.fullName, phone: guardian.phone, active: guardian.active },
  });
  const studentForm = useForm<StudentValues>({ resolver: zodResolver(studentSchema) });
  const studentEditForm = useForm<StudentUpdateValues>({ resolver: zodResolver(studentUpdateSchema) });
  const studentLimitReached = guardian.students.length >= 4;

  function handleResult(result: { success: boolean; error?: string }) {
    if (!result.success) {
      setActionError(result.error ?? "No fue posible completar la operación.");
      return false;
    }
    router.refresh();
    return true;
  }

  function onGuardianSubmit(values: GuardianUpdateValues) {
    if (guardian.active && !values.active && !window.confirm("¿Desactivar a este acudiente? Su enlace privado dejará de estar disponible.")) return;
    setActionError(undefined);
    startTransition(async () => { handleResult(await updateGuardian(guardian.id, values)); });
  }

  function onStudentCreate(values: StudentValues) {
    setActionError(undefined);
    startTransition(async () => {
      if (handleResult(await createStudent(guardian.id, values))) studentForm.reset();
    });
  }

  function beginStudentEdit(student: GuardianDetailData["students"][number]) {
    setEditingStudentId(student.id);
    studentEditForm.reset({ fullName: student.fullName, active: student.active });
  }

  function onStudentUpdate(values: StudentUpdateValues) {
    if (!editingStudentId) return;
    const currentStudent = guardian.students.find((student) => student.id === editingStudentId);
    if (currentStudent?.active && !values.active && !window.confirm(`¿Desactivar a ${currentStudent.fullName}? No podrá aparecer en futuras inscripciones.`)) return;
    setActionError(undefined);
    startTransition(async () => {
      if (handleResult(await updateStudent(editingStudentId, values))) setEditingStudentId(undefined);
    });
  }

  function onDeactivateStudent(student: GuardianDetailData["students"][number]) {
    if (!window.confirm(`¿Desactivar a ${student.fullName}? No podrá aparecer en futuras inscripciones.`)) return;
    setActionError(undefined);
    startTransition(async () => { handleResult(await deactivateStudent(student.id)); });
  }

  function onGenerateLink() {
    if (guardian.hasPrivateLink && !window.confirm("El enlace anterior dejará de funcionar. ¿Deseas generar uno nuevo?")) return;
    setActionError(undefined);
    startTransition(async () => {
      const result = await generateGuardianLink(guardian.id);
      if (!result.success) {
        handleResult(result);
        return;
      }
      handleResult(result);
      if (result.tokenPath) setPrivateLink(`${window.location.origin}${result.tokenPath}`);
    });
  }

  async function copyPrivateLink() {
    if (!privateLink) return;
    try {
      await navigator.clipboard.writeText(privateLink);
    } catch {
      setActionError("No fue posible copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  }

  return (
    <div className="space-y-8">
      <Button asChild variant="outline"><Link href="/dashboard/contacts">Volver a contactos</Link></Button>
      {actionError ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{actionError}</p> : null}

      <section className="rounded-xl border bg-card p-5">
        <h1 className="text-2xl font-bold">{guardian.fullName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatColombianPhone(guardian.phone)} · {guardian.active ? "Activo" : "Inactivo"}</p>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" noValidate onSubmit={guardianForm.handleSubmit(onGuardianSubmit)}>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-name">Nombre completo</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-name" {...guardianForm.register("fullName")} />{guardianForm.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.fullName.message}</p> : null}</div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-phone">Celular</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-phone" inputMode="tel" {...guardianForm.register("phone")} />{guardianForm.formState.errors.phone ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.phone.message}</p> : null}</div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...guardianForm.register("active")} /> Acudiente activo</label>
          <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar cambios"}</Button></div>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Historial operativo</h2>
        {guardian.events.length ? <ol className="mt-4 space-y-3">{guardian.events.map((event) => <li className="border-l-2 border-primary pl-3" key={event.id}><p className="font-medium">{eventLabel(event.type)}</p><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(event.createdAt))}</p>{event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}</li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No hay acciones registradas todavía.</p>}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Programación del ciclo actual</h2>
        {guardian.currentSchedule.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No tiene clases programadas en el ciclo abierto.</p> : <div className="mt-4 space-y-3">{guardian.currentSchedule.map((item) => <div className="rounded-lg border p-4" key={`${item.studentName}-${item.startsAt}`}><p className="font-medium">{item.studentName}</p><p className="text-sm text-muted-foreground">{item.classTitle} · Prof. {item.teacherName}</p></div>)}</div>}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-bold">Estudiantes</h2><span className="text-sm text-muted-foreground">{guardian.students.length} de 4 registrados</span></div>
        {guardian.students.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Este acudiente todavía no tiene estudiantes registrados.</p> : null}
        <div className="mt-4 space-y-3">
          {guardian.students.map((student) => (
            <div className="rounded-lg border p-4" key={student.id}>
              {editingStudentId === student.id ? (
                <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" noValidate onSubmit={studentEditForm.handleSubmit(onStudentUpdate)}>
                  <div><label className="sr-only" htmlFor={`student-${student.id}`}>Nombre del estudiante</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={`student-${student.id}`} {...studentEditForm.register("fullName")} />{studentEditForm.formState.errors.fullName ? <p className="mt-1 text-sm text-destructive" role="alert">{studentEditForm.formState.errors.fullName.message}</p> : null}</div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...studentEditForm.register("active")} />Activo</label>
                  <div className="flex gap-2"><Button disabled={isPending} type="submit">Guardar</Button><Button onClick={() => setEditingStudentId(undefined)} type="button" variant="outline">Cancelar</Button></div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{student.fullName}</p><p className={student.active ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{student.active ? "Activo" : "Inactivo"}</p></div><div className="flex gap-2"><Button onClick={() => beginStudentEdit(student)} type="button" variant="outline">Editar</Button>{student.active ? <Button disabled={isPending} onClick={() => onDeactivateStudent(student)} type="button" variant="outline">Desactivar</Button> : null}</div></div>
              )}
            </div>
          ))}
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" noValidate onSubmit={studentForm.handleSubmit(onStudentCreate)}>
          <div><label className="sr-only" htmlFor="new-student">Nombre del estudiante</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" disabled={studentLimitReached || isPending} id="new-student" placeholder={studentLimitReached ? "Máximo de 4 estudiantes alcanzado" : "Nombre completo del estudiante"} {...studentForm.register("fullName")} />{studentForm.formState.errors.fullName ? <p className="mt-1 text-sm text-destructive" role="alert">{studentForm.formState.errors.fullName.message}</p> : null}</div>
          <Button disabled={studentLimitReached || isPending} type="submit">Agregar estudiante</Button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Enlace privado</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Por seguridad el enlace solo se muestra al generarlo. Si ya se perdió, genera uno nuevo: el anterior dejará de funcionar.</p>
        <Button className="mt-4" disabled={isPending || !guardian.active} onClick={onGenerateLink} type="button">{guardian.hasPrivateLink ? "Regenerar enlace" : "Generar enlace"}</Button>
        {!guardian.active ? <p className="mt-2 text-sm text-muted-foreground">Activa al acudiente para generar o usar su enlace privado.</p> : null}
        {privateLink ? <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center"><input aria-label="Enlace privado generado" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" readOnly value={privateLink} /><Button onClick={copyPrivateLink} type="button" variant="outline">Copiar enlace</Button></div> : null}
      </section>
    </div>
  );
}

function eventLabel(type: string) { return ({ contacted: "Primer contacto", invitation_sent: "Invitación enviada", response_updated: "Respuesta actualizada", booking_created: "Clases agendadas", whatsapp_opened: "WhatsApp abierto", attendance_updated: "Asistencia actualizada", note_added: "Nota interna", manager_assigned: "Responsable asignado" } as Record<string, string>)[type] ?? "Actualización"; }
