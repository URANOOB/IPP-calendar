"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

export interface DashboardCalendarClass {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  teacherName: string;
  cycleId: string;
  cycleName: string;
  status: "draft" | "published" | "cancelled" | "completed";
  capacity: number;
  registered: number;
}

export interface DashboardCalendarCycle {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "open" | "closed" | "archived";
}

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const colorClasses = ["border-cyan-200 bg-cyan-50 text-cyan-900", "border-indigo-200 bg-indigo-50 text-indigo-900", "border-violet-200 bg-violet-50 text-violet-900", "border-amber-200 bg-amber-50 text-amber-900"];

function bogotaParts(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
}

function localCalendarDate(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const { year, month, day } = bogotaParts(value);
  return new Date(year, month - 1, day);
}

function dateKey(value: Date | string) {
  const { year, month, day } = bogotaParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function time(value: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(value);
}

export function ClassCalendar({ classes, cycles }: Readonly<{ classes: DashboardCalendarClass[]; cycles: DashboardCalendarCycle[] }>) {
  const [month, setMonth] = useState(() => {
    const today = localCalendarDate(new Date());
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const classByDate = useMemo(() => classes.reduce<Map<string, DashboardCalendarClass[]>>((result, item) => {
    const key = dateKey(item.startsAt);
    result.set(key, [...(result.get(key) ?? []), item]);
    return result;
  }, new Map()), [classes]);
  const cycleIndex = useMemo(() => new Map(cycles.map((cycle, index) => [cycle.id, index])), [cycles]);
  const selectedClasses = classByDate.get(selectedDate) ?? [];
  const selectedCycle = cycles.find((cycle) => {
    const date = localCalendarDate(selectedDate);
    return date >= localCalendarDate(cycle.startsAt) && date <= localCalendarDate(cycle.endsAt);
  });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const monthTitle = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(month);
  const todayKey = dateKey(new Date());

  return <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-card shadow-[0_12px_32px_rgba(47,92,158,0.09)]">
    <header className="flex flex-col gap-4 border-b border-border/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div><p className="flex items-center gap-2 text-sm font-bold text-primary"><CalendarDays aria-hidden="true" className="size-4" />Agenda por ciclos</p><h2 className="mt-1 text-xl font-extrabold text-foreground">Calendario de clases</h2></div>
      <div className="flex items-center gap-2"><Button aria-label="Mes anterior" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} size="icon" title="Mes anterior" type="button" variant="outline"><ChevronLeft aria-hidden="true" /></Button><p className="min-w-40 text-center text-sm font-bold capitalize text-foreground">{monthTitle}</p><Button aria-label="Mes siguiente" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} size="icon" title="Mes siguiente" type="button" variant="outline"><ChevronRight aria-hidden="true" /></Button></div>
    </header>

    {cycles.length ? <div className="flex flex-wrap gap-2 border-b border-border/70 px-5 py-3 sm:px-6">{cycles.map((cycle, index) => <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorClasses[index % colorClasses.length]}`} key={cycle.id}>{cycle.name} · {cycle.status === "open" ? "Activo" : "Inactivo"}</span>)}</div> : null}

    <div className="overflow-x-auto"><div className="min-w-[760px] p-3 sm:p-5"><div className="grid grid-cols-7 border-l border-t border-border/70">{weekdayLabels.map((label) => <div className="border-b border-r border-border/70 bg-muted/35 px-3 py-2 text-center text-xs font-bold text-muted-foreground" key={label}>{label}</div>)}{days.map((day) => {
      const key = dateKey(day);
      const dayClasses = classByDate.get(key) ?? [];
      const isCurrentMonth = day.getMonth() === month.getMonth();
      const isSelected = key === selectedDate;
      return <button aria-label={`${dateLabel(day)}${dayClasses.length ? `, ${dayClasses.length} clases` : ""}`} className={`min-h-30 border-b border-r border-border/70 p-2 text-left transition-colors ${isCurrentMonth ? "bg-card" : "bg-muted/20 text-muted-foreground"} ${isSelected ? "bg-indigo-50/70 ring-2 ring-inset ring-primary/45" : "hover:bg-muted/45"}`} key={key} onClick={() => setSelectedDate(key)} type="button">
        <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${key === todayKey ? "bg-primary text-primary-foreground" : ""}`}>{day.getDate()}</span>
        <div className="mt-1.5 space-y-1">{dayClasses.slice(0, 2).map((classItem) => <span className={`block truncate rounded-md border px-1.5 py-1 text-[11px] font-semibold ${colorClasses[(cycleIndex.get(classItem.cycleId) ?? 0) % colorClasses.length]}`} key={classItem.id}>{time(classItem.startsAt)} · {classItem.title}</span>)}{dayClasses.length > 2 ? <span className="block px-1.5 text-[11px] font-semibold text-primary">+{dayClasses.length - 2} clases</span> : null}</div>
      </button>;
    })}</div></div></div>

    <div className="grid border-t border-border/80 bg-slate-50/55 sm:grid-cols-[1.1fr_1.9fr]">
      <div className="border-b border-border/80 p-5 sm:border-b-0 sm:border-r sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Día seleccionado</p><h3 className="mt-1 capitalize text-lg font-extrabold text-foreground">{dateLabel(localCalendarDate(selectedDate))}</h3>{selectedCycle ? <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3"><p className="text-xs font-bold text-primary">Ciclo</p><p className="mt-1 text-sm font-semibold text-foreground">{selectedCycle.name}</p><p className="mt-1 text-xs text-muted-foreground">{selectedCycle.status === "open" ? "Activo para programación" : "Ciclo no activo"}</p></div> : <p className="mt-4 text-sm leading-6 text-muted-foreground">No hay un ciclo programado para esta fecha.</p>}</div>
      <div className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Clases del día</p>{selectedClasses.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{selectedClasses.map((classItem) => <Link className="rounded-xl border bg-white p-3 transition-shadow hover:shadow-md" href={`/dashboard/classes/${classItem.id}`} key={classItem.id}><div className="flex items-start justify-between gap-2"><strong className="text-sm text-foreground">{classItem.title}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${classItem.status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{classItem.status === "cancelled" ? "Cancelada" : classItem.status === "completed" ? "Finalizada" : "Activa"}</span></div><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{time(classItem.startsAt)} – {time(classItem.endsAt)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound aria-hidden="true" className="size-3.5" />{classItem.teacherName}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Users aria-hidden="true" className="size-3.5" />{classItem.registered} de {classItem.capacity} inscritos · {classItem.cycleName}</p></Link>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No hay clases creadas para este día.</p>}</div>
    </div>
  </section>;
}
