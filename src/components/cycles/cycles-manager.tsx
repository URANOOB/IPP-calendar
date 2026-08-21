"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { archiveCycle, closeCycle, createCycle, openCycle } from "@/app/(dashboard)/dashboard/cycles/actions";
import { Button } from "@/components/ui/button";
import { WEEKLY_CYCLE_STATUS_LABELS, type WeeklyCycleStatus } from "@/lib/cycles/constants";
import { formatBogotaDate, formatBogotaDateTime, getCycleEffectiveStatus, nextWeekCycleDates } from "@/lib/cycles/dates";
import { weeklyCycleSchema, type WeeklyCycleValues } from "@/lib/validations/cycles";

export interface CycleListItem {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  status: WeeklyCycleStatus;
}

export function CyclesManager({ cycles }: Readonly<{ cycles: CycleListItem[] }>) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | WeeklyCycleStatus>("all");
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<WeeklyCycleValues>({ resolver: zodResolver(weeklyCycleSchema) });
  const visibleCycles = filter === "all" ? cycles : cycles.filter((cycle) => cycle.status === filter);

  function handleResult(result: { success: boolean; error?: string }) {
    if (!result.success) setError(result.error ?? "No fue posible completar la operación.");
    else router.refresh();
  }

  function onCreate(values: WeeklyCycleValues) {
    setError(undefined);
    startTransition(async () => {
      const result = await createCycle(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      form.reset();
      setShowCreate(false);
      if (result.cycleId) router.push(`/dashboard/cycles/${result.cycleId}`);
    });
  }

  function onAction(cycle: CycleListItem, action: "open" | "close" | "archive") {
    const messages = {
      open: `¿Abrir inscripciones para ${cycle.name}?`,
      close: `¿Cerrar inscripciones para ${cycle.name}?`,
      archive: `¿Archivar ${cycle.name}? El historial se conservará.`,
    };
    if (!window.confirm(messages[action])) return;
    setError(undefined);
    setPendingId(cycle.id);
    startTransition(async () => {
      const result = action === "open" ? await openCycle(cycle.id) : action === "close" ? await closeCycle(cycle.id) : await archiveCycle(cycle.id);
      setPendingId(undefined);
      handleResult(result);
    });
  }

  function prefillNextWeek() {
    const latest = cycles[0];
    if (!latest) {
      setShowCreate(true);
      return;
    }
    const dates = nextWeekCycleDates({
      starts_at: latest.startsAt,
      ends_at: latest.endsAt,
      registration_opens_at: latest.registrationOpensAt,
      registration_closes_at: latest.registrationClosesAt,
    });
    form.reset({ name: "Semana siguiente", ...dates });
    setShowCreate(true);
  }

  const columns: ColumnDef<CycleListItem>[] = [
    { accessorKey: "name", header: "Nombre" },
    { accessorKey: "startsAt", header: "Inicio", cell: ({ row }) => formatBogotaDate(row.original.startsAt) },
    { accessorKey: "endsAt", header: "Fin", cell: ({ row }) => formatBogotaDate(row.original.endsAt) },
    { accessorKey: "registrationOpensAt", header: "Apertura", cell: ({ row }) => formatBogotaDateTime(row.original.registrationOpensAt) },
    { accessorKey: "registrationClosesAt", header: "Cierre", cell: ({ row }) => formatBogotaDateTime(row.original.registrationClosesAt) },
    { id: "status", header: "Estado", cell: ({ row }) => <span>{WEEKLY_CYCLE_STATUS_LABELS[row.original.status]} · {getCycleEffectiveStatus({ status: row.original.status, starts_at: row.original.startsAt, ends_at: row.original.endsAt, registration_opens_at: row.original.registrationOpensAt, registration_closes_at: row.original.registrationClosesAt })}</span> },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={`/dashboard/cycles/${row.original.id}`}>{row.original.status === "draft" ? "Editar" : "Ver"}</Link></Button>
        {row.original.status === "draft" ? <Button disabled={isPending && pendingId === row.original.id} onClick={() => onAction(row.original, "open")} type="button">Abrir</Button> : null}
        {row.original.status === "open" ? <Button disabled={isPending && pendingId === row.original.id} onClick={() => onAction(row.original, "close")} type="button" variant="outline">Cerrar</Button> : null}
        {(row.original.status === "draft" || row.original.status === "closed") ? <Button disabled={isPending && pendingId === row.original.id} onClick={() => onAction(row.original, "archive")} type="button" variant="outline">Archivar</Button> : null}
      </div>,
    },
  ];
  // TanStack controls a mutable table object; React Compiler intentionally skips memoizing it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: visibleCycles, columns, getCoreRowModel: getCoreRowModel() });

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><label className="sr-only" htmlFor="cycle-filter">Filtrar ciclos</label><select className="h-10 rounded-lg border bg-card px-3 text-sm" id="cycle-filter" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}><option value="all">Todos los estados</option>{Object.entries(WEEKLY_CYCLE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button onClick={prefillNextWeek} type="button" variant="outline">Crear próxima semana</Button></div>
      <Button onClick={() => setShowCreate((visible) => !visible)} type="button">{showCreate ? "Cancelar" : "Crear ciclo"}</Button>
    </div>
    {showCreate ? <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(onCreate)}>
      <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium" htmlFor="cycle-name">Nombre</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="cycle-name" placeholder="Semana 35 · 24–30 agosto" {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.name.message}</p> : null}</div>
      <DateField form={form} id="cycle-start" label="Inicio del ciclo" name="startsAt" />
      <DateField form={form} id="cycle-end" label="Fin del ciclo" name="endsAt" />
      <DateField form={form} id="cycle-registration-open" label="Apertura de inscripción" name="registrationOpensAt" />
      <DateField form={form} id="cycle-registration-close" label="Cierre de inscripción" name="registrationClosesAt" />
      <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar borrador"}</Button></div>
    </form> : null}
    {error ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{error}</p> : null}
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-muted/40 text-muted-foreground"><tr>{table.getFlatHeaders().map((header) => <th className="px-4 py-3 font-medium" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr></thead><tbody>{table.getRowModel().rows.map((row) => <tr className="border-b last:border-0" key={row.id}>{row.getVisibleCells().map((cell) => <td className="px-4 py-3 align-top" key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{visibleCycles.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay ciclos para este estado.</p> : null}</div>
  </div>;
}

function DateField({ form, id, label, name }: Readonly<{ form: ReturnType<typeof useForm<WeeklyCycleValues>>; id: string; label: string; name: keyof Pick<WeeklyCycleValues, "startsAt" | "endsAt" | "registrationOpensAt" | "registrationClosesAt"> }>) {
  const error = form.formState.errors[name];
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label} <span className="text-muted-foreground">(Bogotá)</span></label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={id} type="datetime-local" {...form.register(name)} />{error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}</div>;
}
