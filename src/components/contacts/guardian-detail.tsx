"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Eye, Pencil, Plus, Power, Trash2 } from "lucide-react";

import {
  createStudent,
  deactivateStudent,
  deleteStudent,
  updateGuardian,
  updateStudent,
} from "@/app/(dashboard)/dashboard/contacts/actions";
import { Button } from "@/components/ui/button";
import { formatColombianPhone } from "@/lib/utils/phone";
import { useBrowserOrigin } from "@/lib/hooks/use-browser-origin";
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
  fullName: string | null;
  phone: string;
  active: boolean;
  privateAccessToken: string | null;
  students: { id: string; fullName: string; active: boolean }[];
}

export function GuardianDetail({ guardian }: Readonly<{ guardian: GuardianDetailData }>) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string>();
  const origin = useBrowserOrigin();
  const [editingStudentId, setEditingStudentId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const guardianForm = useForm<GuardianUpdateValues>({
    resolver: zodResolver(guardianUpdateSchema),
    defaultValues: { fullName: guardian.fullName ?? "", phone: guardian.phone, active: guardian.active },
  });
  const studentForm = useForm<StudentValues>({ resolver: zodResolver(studentSchema) });
  const studentEditForm = useForm<StudentUpdateValues>({ resolver: zodResolver(studentUpdateSchema) });
  const activeStudentCount = guardian.students.filter((student) => student.active).length;
  const studentLimitReached = activeStudentCount >= 10;
  const privateLink = guardian.privateAccessToken && origin ? `${origin}/clases/t/${guardian.privateAccessToken}` : null;

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

  function onDeleteStudent(student: GuardianDetailData["students"][number]) {
    if (!window.confirm(`¿Eliminar permanentemente a ${student.fullName} y sus inscripciones? Esta acción no se puede deshacer.`)) return;
    setActionError(undefined); startTransition(async () => { handleResult(await deleteStudent(student.id)); });
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
        <h1 className="text-2xl font-bold">{formatColombianPhone(guardian.phone)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatColombianPhone(guardian.phone)} · {guardian.active ? "Activo" : "Inactivo"}</p>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" noValidate onSubmit={guardianForm.handleSubmit(onGuardianSubmit)}>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-name">Nombre (opcional)</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-name" {...guardianForm.register("fullName")} />{guardianForm.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.fullName.message}</p> : null}</div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-phone">Celular</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-phone" inputMode="tel" {...guardianForm.register("phone")} />{guardianForm.formState.errors.phone ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.phone.message}</p> : null}</div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...guardianForm.register("active")} /> Acudiente activo</label>
          <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar cambios"}</Button></div>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-bold">Estudiantes <button aria-label="Agregar estudiante" className="ml-1 inline-flex size-7 items-center justify-center rounded border" disabled={studentLimitReached || isPending} onClick={() => document.getElementById("new-student")?.focus()} title="Agregar estudiante" type="button"><Plus aria-hidden="true" className="size-4" /></button></h2><span className="text-sm text-muted-foreground">{activeStudentCount} de 10 activos</span></div>
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
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{student.fullName}</p><p className={student.active ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{student.active ? "Activo" : "Inactivo"}</p><Link aria-label={`Ver historial de ${student.fullName}`} className="mt-1 inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-secondary" href={`/dashboard/students/${student.id}`} title="Ver historial"><Eye aria-hidden="true" className="size-4" /></Link></div><div className="flex items-center gap-1.5"><Button aria-label={`Editar ${student.fullName}`} onClick={() => beginStudentEdit(student)} size="icon" title="Editar estudiante" type="button" variant="outline"><Pencil aria-hidden="true" /></Button>{student.active ? <Button aria-label={`Desactivar ${student.fullName}`} disabled={isPending} onClick={() => onDeactivateStudent(student)} size="icon" title="Desactivar estudiante" type="button" variant="outline"><Power aria-hidden="true" /></Button> : null}<Button aria-label={`Eliminar ${student.fullName}`} className="border border-transparent bg-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600" disabled={isPending} onClick={() => onDeleteStudent(student)} size="icon" title="Eliminar estudiante" type="button" variant="destructive"><Trash2 aria-hidden="true" /></Button></div></div>
              )}
            </div>
          ))}
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" noValidate onSubmit={studentForm.handleSubmit(onStudentCreate)}>
          <div><label className="sr-only" htmlFor="new-student">Nombre del estudiante</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" disabled={studentLimitReached || isPending} id="new-student" placeholder={studentLimitReached ? "Máximo de 10 estudiantes activos alcanzado" : "Nombre completo del estudiante"} {...studentForm.register("fullName")} />{studentForm.formState.errors.fullName ? <p className="mt-1 text-sm text-destructive" role="alert">{studentForm.formState.errors.fullName.message}</p> : null}</div>
          <Button disabled={studentLimitReached || isPending} type="submit">Agregar estudiante</Button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Enlace privado</h2>
        {privateLink ? <><p className="mt-2 text-sm leading-6 text-muted-foreground">Este es el enlace personal del ciclo actual. Puedes copiarlo si el acudiente lo olvidó.</p><div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center"><input aria-label="Enlace privado del acudiente" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" readOnly value={privateLink} /><Button onClick={copyPrivateLink} type="button" variant="outline">Copiar enlace</Button></div></> : <p className="mt-2 text-sm leading-6 text-muted-foreground">Aún no tiene un enlace privado para el ciclo actual. Se activará cuando complete su nombre y celular desde el enlace general del ciclo.</p>}
      </section>
    </div>
  );
}
