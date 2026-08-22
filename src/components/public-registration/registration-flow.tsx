"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Users } from "lucide-react";
import { useState, useTransition } from "react";

import { confirmPublicClassSelections } from "@/app/clases/t/[token]/actions";
import { Button } from "@/components/ui/button";
import { formatBogotaDate, formatBogotaDateTime } from "@/lib/cycles/dates";

export interface PublicRegistrationClass { id: string; title: string; teacherName: string; teacherAvatarUrl: string | null; startsAt: string; endsAt: string; capacity: number; registered: number; available: number; }
export interface PublicRegistrationStudent { id: string; fullName: string; registration: { title: string; teacherName: string; startsAt: string; endsAt: string } | null; }
const clock = (value: string) => formatBogotaDateTime(value).split(", ").at(-1) ?? "";

export function RegistrationFlow({ token, students, classes, canRegister }: Readonly<{ token: string; students: PublicRegistrationStudent[]; classes: PublicRegistrationClass[]; canRegister: boolean; }>) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selected = students.flatMap((student) => { const classItem = classes.find((item) => item.id === selections[student.id]); return classItem ? [{ student, classItem }] : []; });
  const selectedClasses = selected.reduce<Record<string, { classItem: PublicRegistrationClass; studentNames: string[] }>>((groups, { student, classItem }) => { const group = groups[classItem.id] ?? { classItem, studentNames: [] }; group.studentNames.push(student.fullName); groups[classItem.id] = group; return groups; }, {});
  const currentStudent = students[currentStudentIndex];
  const isLastStudent = currentStudentIndex === students.length - 1;
  const selectedByOthers = (classId: string, studentId: string) => Object.entries(selections).filter(([selectedStudentId, selectedClassId]) => selectedStudentId !== studentId && selectedClassId === classId).length;

  function choose(studentId: string, classId: string) {
    setError(undefined);
    setSelections((current) => ({ ...current, [studentId]: classId }));
  }

  function clearChoice(studentId: string) {
    setSelections((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
  }

  function moveNext() {
    if (isLastStudent) {
      if (selected.length === 0) {
        setError("Selecciona al menos una clase antes de revisar la inscripción.");
        return;
      }
      setReviewing(true);
      return;
    }
    setCurrentStudentIndex((index) => index + 1);
  }

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await confirmPublicClassSelections(token, selected.map(({ student, classItem }) => ({ studentId: student.id, classId: classItem.id })));
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComplete(true);
    });
  }

  if (complete) return <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><CheckCircle2 aria-hidden="true" className="mb-4 size-11 text-emerald-600" /><h2 className="text-3xl font-bold">¡Listo!</h2><p className="mt-3 text-lg leading-7 text-muted-foreground">Tus clases quedaron programadas.</p><div className="mt-6 space-y-3">{Object.entries(selectedClasses).map(([classId, { classItem, studentNames }]) => <ConfirmedClassSummary classItem={classItem} key={classId} studentNames={studentNames} />)}</div><Button className="mt-7 h-12 px-6 text-base" onClick={() => router.refresh()} type="button">Ver mis clases</Button></section>;

  if (reviewing) return <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><p className="text-base font-bold text-primary">PASO {students.length + 1} DE {students.length + 1}</p><h2 className="mt-2 text-3xl font-bold">Confirma las clases</h2><p className="mt-3 text-lg leading-7 text-muted-foreground">Revisa que todo esté correcto antes de confirmar.</p><div className="mt-7 space-y-4">{selected.map(({ student, classItem }) => <ClassSummary classItem={classItem} key={student.id} studentName={student.fullName} />)}</div>{error ? <p className="mt-5 rounded-lg border border-destructive/30 p-4 text-base text-destructive" role="alert">{error}</p> : null}<div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row"><Button className="h-12 px-6 text-base" disabled={pending} onClick={() => setReviewing(false)} type="button" variant="outline"><ChevronLeft />Volver</Button><Button className="h-12 px-6 text-base" disabled={pending} onClick={confirm} type="button">{pending ? "Confirmando…" : "Confirmar clases"}</Button></div></section>;

  if (!currentStudent) return null;
  const currentSelection = selections[currentStudent.id];
  const canContinue = Boolean(currentSelection) || Boolean(currentStudent.registration);
  const nextStudentName = students[currentStudentIndex + 1]?.fullName;
  const continueLabel = isLastStudent ? "Revisar selección" : `Continuar con ${nextStudentName}`;

  return <section className="space-y-7"><div><p className="text-base font-bold text-primary">PASO {currentStudentIndex + 1} DE {students.length + 1}</p><h2 className="mt-2 text-3xl font-bold">Escoge una clase para {currentStudent.fullName}</h2><p className="mt-3 text-lg leading-7 text-muted-foreground">Niño {currentStudentIndex + 1} de {students.length}. Después podrás escoger para el siguiente niño.</p></div><article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><h3 className="text-2xl font-bold">{currentStudent.fullName}</h3>{currentStudent.registration ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-base text-emerald-950"><strong>✓ Ya tiene una clase programada.</strong><br />{formatBogotaDateTime(currentStudent.registration.startsAt)} · {currentStudent.registration.teacherName}</div> : <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{classes.length === 0 ? <p className="text-lg text-muted-foreground">No hay clases disponibles esta semana.</p> : classes.map((classItem) => { const selectedHere = currentSelection === classItem.id; const noCapacity = classItem.available - selectedByOthers(classItem.id, currentStudent.id) <= 0 && !selectedHere; return <ClassChoiceCard classItem={classItem} disabled={!canRegister || noCapacity} key={classItem.id} noCapacity={noCapacity} onChoose={() => choose(currentStudent.id, classItem.id)} remainingSeats={Math.max(0, classItem.available - selectedByOthers(classItem.id, currentStudent.id))} selected={selectedHere} />; })}{currentSelection ? <Button className="h-11 self-start text-base" onClick={() => clearChoice(currentStudent.id)} type="button" variant="outline">Dejar sin clase</Button> : null}</div>}</article>{error ? <p className="rounded-lg border border-destructive/30 p-4 text-base text-destructive" role="alert">{error}</p> : null}{canRegister ? <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">{currentStudentIndex > 0 ? <Button className="h-12 px-6 text-base" onClick={() => setCurrentStudentIndex((index) => index - 1)} type="button" variant="outline"><ChevronLeft />Volver</Button> : <span />}{canContinue ? <Button className="h-12 px-6 text-base" onClick={moveNext} type="button">{continueLabel}<ChevronRight /></Button> : <Button className="h-12 px-6 text-base" onClick={moveNext} type="button" variant="outline">Continuar sin clase<ChevronRight /></Button>}</div> : null}</section>;
}

function ClassChoiceCard({ classItem, disabled, noCapacity, onChoose, remainingSeats, selected }: Readonly<{ classItem: PublicRegistrationClass; disabled: boolean; noCapacity: boolean; onChoose: () => void; remainingSeats: number; selected: boolean; }>) {
  return <button aria-pressed={selected} className={`group relative overflow-hidden rounded-[1.75rem] border bg-card text-left shadow-[0_10px_25px_rgba(15,23,42,0.10)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(15,23,42,0.16)] ${selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"} disabled:cursor-not-allowed disabled:opacity-60`} disabled={disabled} onClick={onChoose} type="button"><div className="relative h-44 overflow-hidden bg-gradient-to-br from-rose-400 via-violet-400 to-indigo-500">{classItem.teacherAvatarUrl ? <Image alt={`Foto de ${classItem.teacherName}`} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" fill sizes="(min-width: 1280px) 26vw, (min-width: 640px) 45vw, 100vw" src={classItem.teacherAvatarUrl} unoptimized /> : null}<div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-white/10" />{selected ? <span className="absolute left-4 top-4 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm">Seleccionada</span> : null}</div><div className="min-h-48 p-5"><h4 className="truncate text-xl font-extrabold text-foreground">{classItem.title}</h4><p className="mt-1 truncate text-sm font-semibold text-primary">Prof. {classItem.teacherName}</p><p className="mt-4 flex items-start gap-2 text-sm leading-5 text-muted-foreground"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-600" />{formatBogotaDate(classItem.startsAt)}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 aria-hidden="true" className="size-4 shrink-0 text-cyan-600" />{clock(classItem.startsAt)} – {clock(classItem.endsAt)}</p><div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${noCapacity ? "bg-rose-50 text-destructive" : "bg-emerald-50 text-emerald-700"}`}><Users aria-hidden="true" className="size-4" /><span>{noCapacity ? "Sin cupos disponibles" : `${remainingSeats} cupos disponibles`}</span></div><p className="mt-2 text-xs text-muted-foreground">{classItem.registered} de {classItem.capacity} inscritos</p></div></button>;
}

function ClassSummary({ studentName, classItem }: { studentName: string; classItem: Pick<PublicRegistrationClass, "title" | "teacherName" | "startsAt" | "endsAt"> }) { return <article className="rounded-xl border p-4"><h3 className="text-xl font-bold">{studentName}</h3><p className="mt-2 text-lg">{classItem.title}</p><p className="text-base text-muted-foreground">{formatBogotaDate(classItem.startsAt)}<br />{clock(classItem.startsAt)} – {clock(classItem.endsAt)}<br />Prof. {classItem.teacherName}</p></article>; }

function ConfirmedClassSummary({ studentNames, classItem }: { studentNames: string[]; classItem: Pick<PublicRegistrationClass, "title" | "teacherName" | "startsAt" | "endsAt"> }) { return <article className="rounded-xl border p-4"><h3 className="text-xl font-bold">{classItem.title}</h3><p className="mt-2 text-base font-medium">Niños: {studentNames.join(", ")}</p><p className="mt-2 text-base text-muted-foreground">{formatBogotaDate(classItem.startsAt)}</p><p className="mt-1 flex items-center gap-2 text-base text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />{clock(classItem.startsAt)} – {clock(classItem.endsAt)}</p><p className="mt-1 text-base text-muted-foreground">Prof. {classItem.teacherName}</p></article>; }
