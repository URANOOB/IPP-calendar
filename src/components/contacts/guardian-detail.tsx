"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, Copy, Eye, Link2, Pencil, Phone, Plus, Power, Trash2, Users } from "lucide-react";

import {
  createStudent,
  deactivateStudent,
  deleteStudent,
  updateGuardian,
  updateStudent,
} from "@/app/(dashboard)/dashboard/contacts/actions";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
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
  privateAccessCycle: { id: string; name: string } | null;
  students: { id: string; fullName: string; active: boolean }[];
}

export function GuardianDetail({ guardian, canDelete }: Readonly<{ guardian: GuardianDetailData; canDelete: boolean }>) {
  const confirm = useConfirmation();
  const router = useRouter();
  const [success, setSuccess] = useState<string>();
  const [showStudentCreate, setShowStudentCreate] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const profileComplete = Boolean(guardian.fullName?.trim()) && activeStudentCount > 0;
  const generalLink = origin ? `${origin}/registro` : "";
  const privateLink = guardian.active && profileComplete && guardian.privateAccessToken && origin ? `${origin}/clases/t/${guardian.privateAccessToken}` : null;

  function handleResult(result: { success: boolean; error?: string; warning?: string }) {
    if (!result.success) {
      setActionError(result.error ?? "No fue posible completar la operación.");
      return false;
    }
    setActionError(result.warning);
    setSuccess(result.warning ? undefined : "Cambios guardados.");
    router.refresh();
    return true;
  }

  async function onGuardianSubmit(values: GuardianUpdateValues) {
    if (guardian.active && !values.active && !(await confirm({ title: "Desactivar acudiente", description: `Se desactivará a ${guardian.fullName || formatColombianPhone(guardian.phone)}. Su enlace privado dejará de estar disponible.`, confirmLabel: "Desactivar", variant: "warning" }))) return;
    setSuccess(undefined);
    setActionError(undefined);
    startTransition(async () => { if (handleResult(await updateGuardian(guardian.id, values))) setEditingGuardian(false); });
  }

  function onStudentCreate(values: StudentValues) {
    setActionError(undefined);
    startTransition(async () => {
      if (handleResult(await createStudent(guardian.id, values))) { studentForm.reset({ fullName: "" }); setShowStudentCreate(false); }
    });
  }

  function beginStudentEdit(student: GuardianDetailData["students"][number]) {
    setShowStudentCreate(false);
    setEditingStudentId(student.id);
    studentEditForm.reset({ fullName: student.fullName, active: student.active });
  }

  async function onStudentUpdate(values: StudentUpdateValues) {
    if (!editingStudentId) return;
    const currentStudent = guardian.students.find((student) => student.id === editingStudentId);
    if (currentStudent?.active && !values.active && !(await confirm({ title: "Desactivar estudiante", description: `${currentStudent.fullName} dejará de aparecer en futuras inscripciones.`, confirmLabel: "Desactivar", variant: "warning" }))) return;
    setActionError(undefined);
    startTransition(async () => {
      if (handleResult(await updateStudent(editingStudentId, values))) setEditingStudentId(undefined);
    });
  }

  async function onDeactivateStudent(student: GuardianDetailData["students"][number]) {
    if (!(await confirm({ title: "Desactivar estudiante", description: `${student.fullName} dejará de aparecer en futuras inscripciones.`, confirmLabel: "Desactivar", variant: "warning" }))) return;
    setActionError(undefined);
    startTransition(async () => { handleResult(await deactivateStudent(student.id)); });
  }

  async function onDeleteStudent(student: GuardianDetailData["students"][number]) {
    if (!(await confirm({ title: "Eliminar estudiante", description: `Se eliminará a ${student.fullName} y todas sus inscripciones.`, confirmLabel: "Eliminar estudiante" }))) return;
    setActionError(undefined); startTransition(async () => { handleResult(await deleteStudent(student.id)); });
  }

  async function copyPrivateLink() {
    if (!privateLink) return;
    try {
      await navigator.clipboard.writeText(privateLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("No fue posible copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  }

  async function copyGeneralLink() {
    if (!generalLink) return;
    try { await navigator.clipboard.writeText(generalLink); setSuccess("Enlace general copiado."); }
    catch { setActionError("No fue posible copiar el enlace general. Selecciónalo y cópialo manualmente."); }
  }

  return (
    <div className="space-y-4">
      {success ? <p className="text-sm text-emerald-700" role="status">{success}</p> : null}
      <Link className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-muted-foreground hover:text-primary" href="/dashboard/contacts"><ArrowLeft aria-hidden="true" className="size-4" />Volver a contactos</Link>
      {actionError ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{actionError}</p> : null}

      <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-col justify-between gap-4 px-5 py-6 sm:flex-row sm:items-start sm:px-7">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">{guardian.fullName || "Contacto sin nombre"}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${guardian.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{guardian.active ? "Activo" : "Inactivo"}</span></div><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Phone aria-hidden="true" className="size-4 shrink-0" />{formatColombianPhone(guardian.phone)}</p></div>
        <Button className="self-start" disabled={isPending} onClick={() => { guardianForm.reset({ fullName: guardian.fullName ?? "", phone: guardian.phone, active: guardian.active }); setEditingGuardian((value) => !value); setActionError(undefined); }} type="button" variant="outline"><Pencil aria-hidden="true" />{editingGuardian ? "Cancelar edición" : "Editar contacto"}</Button>
      </header>
        {editingGuardian ? <form className="grid gap-4 border-t bg-background/40 px-5 py-5 sm:grid-cols-2 sm:px-7" noValidate onSubmit={guardianForm.handleSubmit(onGuardianSubmit)}>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-name">Nombre (opcional)</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-name" {...guardianForm.register("fullName")} />{guardianForm.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.fullName.message}</p> : null}</div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="edit-guardian-phone">Celular</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="edit-guardian-phone" inputMode="tel" {...guardianForm.register("phone")} />{guardianForm.formState.errors.phone ? <p className="text-sm text-destructive" role="alert">{guardianForm.formState.errors.phone.message}</p> : null}</div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...guardianForm.register("active")} /> Acudiente activo</label>
          <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar cambios"}</Button></div>
        </form> : null}

      <section className="space-y-3 border-t bg-background/50 px-5 py-5 sm:px-7" aria-labelledby="private-access-heading">
        <h2 className="flex items-center gap-2 font-semibold" id="private-access-heading"><Link2 aria-hidden="true" className="size-4 text-primary" />Enlace privado</h2>
        {guardian.privateAccessCycle ? <p className="text-sm text-muted-foreground">Ciclo: <Link className="font-medium text-primary hover:underline" href={`/dashboard/cycles/${guardian.privateAccessCycle.id}`}>{guardian.privateAccessCycle.name}</Link></p> : null}
        {!guardian.active ? <p className="text-sm text-muted-foreground">El contacto está inactivo. Sus enlaces no están disponibles.</p> : privateLink ? <><p className="text-sm text-muted-foreground">El registro está completo. Este enlace permite elegir y confirmar clases, consultar las inscripciones y ver cuánto falta para cada clase.</p><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Enlace privado del acudiente" className="h-11 w-full min-w-0 shrink-0 rounded-xl border bg-card px-3 text-sm sm:w-auto sm:flex-1" onFocus={(event) => event.target.select()} readOnly value={privateLink} /><Button onClick={copyPrivateLink} type="button" variant="outline">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? "Copiado" : "Copiar enlace"}</span></Button></div></> : <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status"><p className="font-semibold">Enlace privado pendiente</p><p className="mt-1 leading-relaxed">{!profileComplete ? "El enlace privado aún no está habilitado porque el perfil no se encuentra completo. El acudiente debe completar su nombre y los estudiantes a su cargo en el formulario general de inscripción." : "El acudiente debe completar el formulario general de inscripción para habilitar su enlace privado de este ciclo."}</p></div>
          {!guardian.privateAccessCycle ? <p className="text-xs text-muted-foreground">El formulario permitirá registrarse cuando haya un ciclo con inscripciones abiertas.</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Enlace general de inscripción" className="h-11 w-full min-w-0 shrink-0 rounded-xl border bg-card px-3 text-sm sm:w-auto sm:flex-1" onFocus={(event) => event.target.select()} readOnly value={generalLink} /><Button disabled={!generalLink} onClick={copyGeneralLink} type="button" variant="outline"><Copy aria-hidden="true" />Copiar enlace general</Button></div>
          <p className="text-xs text-muted-foreground">Después de registrarse, su enlace privado aparecerá aquí automáticamente.</p>
        </>}
      </section>

      <section className="border-t px-5 py-6 sm:px-7" id="students">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Estudiantes</h2><p className="mt-1 text-xs text-muted-foreground">{activeStudentCount} de 10 activos</p></div><Button disabled={studentLimitReached || isPending} aria-expanded={showStudentCreate} onClick={() => { setEditingStudentId(undefined); setShowStudentCreate((value) => !value); }} type="button" variant="outline"><Plus aria-hidden="true" />{showStudentCreate ? "Cancelar" : "Agregar estudiante"}</Button></div>
        {guardian.students.length === 0 && !showStudentCreate ? <div className="mt-4 flex items-start gap-3 rounded-xl bg-background p-4"><Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Aún no hay estudiantes registrados</p><p className="mt-1 text-sm text-muted-foreground">El acudiente los agregará desde el formulario general de inscripción. También puedes registrarlos aquí.</p></div></div> : null}
        <div className="mt-4 divide-y">
          {guardian.students.map((student) => (
            <div className="py-4" key={student.id}>
              {editingStudentId === student.id ? (
                <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" noValidate onSubmit={studentEditForm.handleSubmit(onStudentUpdate)}>
                  <div><label className="sr-only" htmlFor={`student-${student.id}`}>Nombre del estudiante</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={`student-${student.id}`} {...studentEditForm.register("fullName")} />{studentEditForm.formState.errors.fullName ? <p className="mt-1 text-sm text-destructive" role="alert">{studentEditForm.formState.errors.fullName.message}</p> : null}</div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...studentEditForm.register("active")} />Activo</label>
                  <div className="flex gap-2"><Button disabled={isPending} type="submit">Guardar</Button><Button onClick={() => setEditingStudentId(undefined)} type="button" variant="outline">Cancelar</Button></div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{student.fullName}</p><p className={student.active ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{student.active ? "Activo" : "Inactivo"}</p><Link aria-label={`Ver historial de ${student.fullName}`} className="mt-1 inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-secondary" href={`/dashboard/students/${student.id}`} title="Ver historial"><Eye aria-hidden="true" className="size-4" /></Link></div><div className="flex items-center gap-1.5"><Button aria-label={`Editar ${student.fullName}`} onClick={() => beginStudentEdit(student)} size="icon" title="Editar estudiante" type="button" variant="outline"><Pencil aria-hidden="true" /></Button>{student.active ? <Button aria-label={`Desactivar ${student.fullName}`} disabled={isPending} onClick={() => onDeactivateStudent(student)} size="icon" title="Desactivar estudiante" type="button" variant="outline"><Power aria-hidden="true" /></Button> : null}{canDelete ? <Button aria-label={`Eliminar ${student.fullName}`} className="border border-transparent bg-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600" disabled={isPending} onClick={() => onDeleteStudent(student)} size="icon" title="Eliminar estudiante" type="button" variant="destructive"><Trash2 aria-hidden="true" /></Button> : null}</div></div>
              )}
            </div>
          ))}
        </div>
        {showStudentCreate ? <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" noValidate onSubmit={studentForm.handleSubmit(onStudentCreate)}>
          <div><label className="sr-only" htmlFor="new-student">Nombre del estudiante</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" disabled={studentLimitReached || isPending} id="new-student" autoFocus placeholder={studentLimitReached ? "Máximo de 10 estudiantes activos alcanzado" : "Nombre completo del estudiante"} {...studentForm.register("fullName")} />{studentForm.formState.errors.fullName ? <p className="mt-1 text-sm text-destructive" role="alert">{studentForm.formState.errors.fullName.message}</p> : null}</div>
          <div className="flex gap-2"><Button disabled={studentLimitReached || isPending} type="submit">Agregar estudiante</Button><Button disabled={isPending} onClick={() => setShowStudentCreate(false)} type="button" variant="outline">Cancelar</Button></div>
        </form> : null}
      </section>

      </article>
    </div>
  );
}
