"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { createTeacher, deleteTeacher, updateTeacher, uploadTeacherAvatar } from "@/app/(dashboard)/dashboard/teachers/actions";
import { Button } from "@/components/ui/button";

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  notificationEmail: string;
  avatarUrl: string | null;
  active: boolean;
  classCount: number;
  availableDays: number[];
  availableFrom: string | null;
  availableUntil: string | null;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
}

const WEEKDAYS = [
  { value: 1, label: "L", name: "Lunes" },
  { value: 2, label: "M", name: "Martes" },
  { value: 3, label: "M", name: "Miércoles" },
  { value: 4, label: "J", name: "Jueves" },
  { value: 5, label: "V", name: "Viernes" },
  { value: 6, label: "S", name: "Sábado" },
  { value: 7, label: "D", name: "Domingo" },
];

export function TeachersManager({ teachers, candidates }: Readonly<{ teachers: TeacherRow[]; candidates: Candidate[] }>) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingDays, setEditingDays] = useState<number[]>([]);
  const [editingFrom, setEditingFrom] = useState("");
  const [editingUntil, setEditingUntil] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    start(async () => {
      const result = await createTeacher({ profileId, displayName, notificationEmail, availableDays, availableFrom, availableUntil });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShow(false);
      setProfileId("");
      setDisplayName("");
      setNotificationEmail("");
      setAvailableDays([]);
      setAvailableFrom("");
      setAvailableUntil("");
      router.refresh();
    });
  }

  function beginEdit(teacher: TeacherRow) {
    setEditingId(teacher.id);
    setEditingName(teacher.name);
    setEditingEmail(teacher.notificationEmail);
    setEditingDays(teacher.availableDays);
    setEditingFrom(teacher.availableFrom?.slice(0, 5) ?? "");
    setEditingUntil(teacher.availableUntil?.slice(0, 5) ?? "");
    setError(undefined);
  }

  function saveEdit(teacher: TeacherRow) {
    setError(undefined);
    start(async () => {
      const result = await updateTeacher(teacher.id, { displayName: editingName, active: teacher.active, notificationEmail: editingEmail, availableDays: editingDays, availableFrom: editingFrom, availableUntil: editingUntil });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingId(undefined);
      router.refresh();
    });
  }

  function remove(teacher: TeacherRow) {
    if (!window.confirm(`¿Eliminar permanentemente a ${teacher.name}, sus clases y su cuenta? Esta acción no se puede deshacer.`)) return;
    setError(undefined);
    start(async () => {
      const result = await deleteTeacher(teacher.id);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function uploadAvatar(teacher: TeacherRow, file: File | undefined) {
    if (!file) return;
    setError(undefined);
    const formData = new FormData();
    formData.append("file", file);
    start(async () => {
      const result = await uploadTeacherAvatar(teacher.id, formData);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Button onClick={() => setShow((value) => !value)} type="button">{show ? "Cancelar" : <><Plus aria-hidden="true" />Asociar profesor</>}</Button>
      {show ? (
        <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" onSubmit={submit}>
          <div>
            <label className="text-sm font-medium" htmlFor="teacher-profile">Usuario con rol profesor</label>
            <select className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm" id="teacher-profile" onChange={(event) => { const candidate = candidates.find((item) => item.id === event.target.value); setProfileId(event.target.value); setNotificationEmail(candidate?.email ?? ""); }} value={profileId}>
              <option value="">Selecciona un usuario</option>
              {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="teacher-name">Nombre visible</label>
            <input className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm" id="teacher-name" onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="teacher-email">Correo de recordatorios</label>
            <input className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm" id="teacher-email" onChange={(event) => setNotificationEmail(event.target.value)} placeholder="profesor@ejemplo.com" type="email" value={notificationEmail} />
            <p className="mt-1 text-xs text-muted-foreground">Si se deja vacío, se usará el correo de su usuario.</p>
          </div>
          <TeacherAvailabilityFields days={availableDays} from={availableFrom} idPrefix="new-teacher" onDaysChange={setAvailableDays} onFromChange={setAvailableFrom} onUntilChange={setAvailableUntil} until={availableUntil} />
          <div className="flex items-end sm:col-span-2"><Button disabled={pending || !profileId} type="submit">{pending ? "Guardando…" : "Crear profesor"}</Button></div>
        </form>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground"><tr>{["Foto", "Nombre", "Correo de recordatorios", "Disponibilidad", "Estado", "Clases", "Acción"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {teachers.map((teacher) => {
              const initials = teacher.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
              return <tr className="border-b last:border-0" key={teacher.id}>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="size-10 overflow-hidden rounded-full bg-muted text-center text-sm font-semibold leading-10 text-muted-foreground">{teacher.avatarUrl ? <Image alt={`Foto de ${teacher.name}`} className="size-full object-cover" height={40} src={teacher.avatarUrl} unoptimized width={40} /> : initials}</div><label className="cursor-pointer text-xs text-primary underline"><span className="sr-only">Cambiar foto de {teacher.name}</span>Subir<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending} onChange={(event) => uploadAvatar(teacher, event.target.files?.[0])} type="file" /></label></div></td>
                <td className="px-4 py-3">{editingId === teacher.id ? <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setEditingName(event.target.value)} value={editingName} /> : teacher.name}</td>
                <td className="px-4 py-3">{editingId === teacher.id ? <input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setEditingEmail(event.target.value)} placeholder={teacher.email} type="email" value={editingEmail} /> : <><span>{teacher.email}</span>{teacher.notificationEmail && teacher.notificationEmail !== teacher.email ? <span className="mt-1 block text-xs text-muted-foreground">Correo personalizado</span> : null}</>}</td>
                <td className="px-4 py-3">{editingId === teacher.id ? <TeacherAvailabilityFields compact days={editingDays} from={editingFrom} idPrefix={`teacher-${teacher.id}`} onDaysChange={setEditingDays} onFromChange={setEditingFrom} onUntilChange={setEditingUntil} until={editingUntil} /> : <AvailabilitySummary days={teacher.availableDays} from={teacher.availableFrom} until={teacher.availableUntil} />}</td>
                <td className="px-4 py-3">{teacher.active ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-3">{teacher.classCount}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1.5">{editingId === teacher.id ? <><Button aria-label={`Guardar cambios de ${teacher.name}`} disabled={pending} onClick={() => saveEdit(teacher)} size="icon" title="Guardar cambios" type="button"><Check aria-hidden="true" /></Button><Button aria-label={`Cancelar edición de ${teacher.name}`} disabled={pending} onClick={() => setEditingId(undefined)} size="icon" title="Cancelar edición" type="button" variant="outline"><X aria-hidden="true" /></Button></> : <Button aria-label={`Editar ${teacher.name}`} disabled={pending} onClick={() => beginEdit(teacher)} size="icon" title="Editar profesor" type="button" variant="outline"><Pencil aria-hidden="true" /></Button>}<Button aria-label={`Eliminar ${teacher.name}`} className="border border-transparent bg-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600" disabled={pending} onClick={() => remove(teacher)} size="icon" title="Eliminar profesor" type="button" variant="destructive"><Trash2 aria-hidden="true" /></Button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
        {teachers.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay profesores asociados todavía.</p> : null}
      </div>
    </div>
  );
}

function TeacherAvailabilityFields({ days, from, until, onDaysChange, onFromChange, onUntilChange, idPrefix, compact = false }: Readonly<{ days: number[]; from: string; until: string; onDaysChange: (days: number[]) => void; onFromChange: (value: string) => void; onUntilChange: (value: string) => void; idPrefix: string; compact?: boolean }>) {
  function toggleDay(day: number) { onDaysChange(days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort((a, b) => a - b)); }
  return <fieldset className={compact ? "min-w-52 space-y-2" : "space-y-2 sm:col-span-2"}><legend className="text-sm font-medium">Disponibilidad semanal <span className="font-normal text-muted-foreground">(Bogotá)</span></legend><div className="flex gap-1" role="group" aria-label="Días disponibles">{WEEKDAYS.map((day) => <button aria-label={day.name} aria-pressed={days.includes(day.value)} className={`h-9 w-8 rounded text-sm font-semibold ${days.includes(day.value) ? "bg-primary text-primary-foreground underline decoration-2 underline-offset-4" : "border bg-background text-muted-foreground"}`} key={day.value} onClick={() => toggleDay(day.value)} type="button">{day.label}</button>)}</div><div className="flex items-center gap-2"><label className="sr-only" htmlFor={`${idPrefix}-from`}>Disponible desde</label><input className="h-10 rounded-lg border bg-background px-2 text-sm" id={`${idPrefix}-from`} onChange={(event) => onFromChange(event.target.value)} type="time" value={from} /><span className="text-sm text-muted-foreground">a</span><label className="sr-only" htmlFor={`${idPrefix}-until`}>Disponible hasta</label><input className="h-10 rounded-lg border bg-background px-2 text-sm" id={`${idPrefix}-until`} onChange={(event) => onUntilChange(event.target.value)} type="time" value={until} /></div><p className="text-xs text-muted-foreground">Selecciona días y una franja; déjalo vacío si aún no se ha definido.</p></fieldset>;
}

function AvailabilitySummary({ days, from, until }: Readonly<{ days: number[]; from: string | null; until: string | null }>) {
  if (!days.length || !from || !until) return <span className="text-muted-foreground">Sin definir</span>;
  return <div><div className="flex gap-1">{WEEKDAYS.map((day) => <span className={days.includes(day.value) ? "font-bold underline decoration-2 underline-offset-4" : "text-muted-foreground"} key={day.value} title={day.name}>{day.label}</span>)}</div><span className="mt-1 block text-xs text-muted-foreground">{from.slice(0, 5)} – {until.slice(0, 5)}</span></div>;
}
