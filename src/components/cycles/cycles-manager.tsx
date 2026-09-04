"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useWatch, useForm } from "react-hook-form";
import { CalendarPlus, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { createCycle, deleteCycle, setCycleActive } from "@/app/(dashboard)/dashboard/cycles/actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { type WeeklyCycleStatus } from "@/lib/cycles/constants";
import { formatBogotaDate, formatBogotaDateTime, nextWeekCycleDates } from "@/lib/cycles/dates";
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

export function CyclesManager({ cycles, canDelete }: Readonly<{ cycles: CycleListItem[]; canDelete: boolean }>) {
  const confirm = useConfirmation();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
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
      router.refresh();
    });
  }

  async function onDelete(cycle: CycleListItem) {
    if (!(await confirm({ title: "Eliminar ciclo", description: `Se eliminará el ciclo “${cycle.name}”, junto con sus clases, inscripciones e invitaciones.`, confirmLabel: "Eliminar ciclo" }))) return;
    setError(undefined);
    setPendingId(cycle.id);
    startTransition(async () => {
      const result = await deleteCycle(cycle.id);
      setPendingId(undefined);
      handleResult(result);
    });
  }

  function toggleActive(cycle: CycleListItem) {
    const active = cycle.status !== "open";
    setError(undefined);
    setPendingId(cycle.id);
    startTransition(async () => {
      const result = await setCycleActive(cycle.id, active);
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
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => {
        const active = row.original.status === "open";
        const pending = isPending;
        return <div className="flex items-center gap-2.5">
          <button
            aria-checked={active}
            aria-label={`${active ? "Desactivar" : "Activar"} ${row.original.name}`}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-emerald-500" : "bg-slate-300"}`}
            disabled={pending}
            onClick={() => toggleActive(row.original)}
            role="switch"
            title={active ? "Desactivar ciclo" : "Activar ciclo"}
            type="button"
          >
            <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className={`text-xs font-semibold ${active ? "text-emerald-700" : "text-muted-foreground"}`}>{active ? "Activo" : "Inactivo"}</span>
        </div>;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <div className="flex items-center gap-1.5">
        <Button asChild aria-label={`Ver ${row.original.name}`} size="icon" title="Ver ciclo" variant="outline"><Link href={`/dashboard/cycles/${row.original.id}`}><Eye aria-hidden="true" /></Link></Button>
        <Button asChild aria-label={`Editar ${row.original.name}`} size="icon" title="Editar ciclo" variant="outline"><Link href={`/dashboard/cycles/${row.original.id}/edit`}><Pencil aria-hidden="true" /></Link></Button>
        {canDelete ? <Button aria-label={`Eliminar ${row.original.name}`} className="border border-transparent bg-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600" disabled={isPending && pendingId === row.original.id} onClick={() => onDelete(row.original)} size="icon" title="Eliminar ciclo" type="button" variant="destructive"><Trash2 aria-hidden="true" /></Button> : null}
      </div>,
    },
  ];
  // TanStack controls a mutable table object; React Compiler intentionally skips memoizing it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: visibleCycles, columns, getCoreRowModel: getCoreRowModel() });

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><label className="sr-only" htmlFor="cycle-filter">Filtrar ciclos</label><select className="h-10 rounded-lg border bg-card px-3 text-sm" id="cycle-filter" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}><option value="all">Todos los estados</option><option value="open">Activos</option><option value="closed">Inactivos</option></select><Button onClick={prefillNextWeek} type="button" variant="outline"><CalendarPlus aria-hidden="true" />Crear próxima semana</Button></div>
      <Button onClick={() => setShowCreate((visible) => !visible)} type="button">{showCreate ? "Cancelar" : <><Plus aria-hidden="true" />Crear ciclo</>}</Button>
    </div>
    {showCreate ? <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(onCreate)}>
      <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium" htmlFor="cycle-name">Nombre</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="cycle-name" placeholder="Semana 35 · 24–30 agosto" {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.name.message}</p> : null}</div>
      <DateField form={form} id="cycle-start" label="Inicio del ciclo" name="startsAt" />
      <DateField form={form} id="cycle-end" label="Fin del ciclo" name="endsAt" />
      <DateField form={form} id="cycle-registration-open" label="Apertura de inscripción" name="registrationOpensAt" />
      <DateField form={form} id="cycle-registration-close" label="Cierre de inscripción" name="registrationClosesAt" />
      <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar ciclo activo"}</Button></div>
    </form> : null}
    {error ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{error}</p> : null}
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-muted/40 text-muted-foreground"><tr>{table.getFlatHeaders().map((header) => <th className="px-4 py-3 font-medium" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr></thead><tbody>{table.getRowModel().rows.map((row) => <tr className="border-b last:border-0" key={row.id}>{row.getVisibleCells().map((cell) => <td className="px-4 py-3 align-top" key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{visibleCycles.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay ciclos para este estado.</p> : null}</div>
  </div>;
}

function DateField({ form, id, label, name }: Readonly<{ form: ReturnType<typeof useForm<WeeklyCycleValues>>; id: string; label: string; name: keyof Pick<WeeklyCycleValues, "startsAt" | "endsAt" | "registrationOpensAt" | "registrationClosesAt"> }>) {
  const error = form.formState.errors[name];
  const values = useWatch({ control: form.control });
  const min = name === "endsAt" ? values.startsAt : name === "registrationClosesAt" ? values.registrationOpensAt : undefined;
  const max = name === "startsAt" || name === "registrationClosesAt" ? values.endsAt : name === "registrationOpensAt" ? values.registrationClosesAt : undefined;
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label} <span className="text-muted-foreground">(Bogotá)</span></label><Controller control={form.control} name={name} render={({ field }) => <DateTimePicker {...field} id={id} label={label} min={min} max={max} invalid={Boolean(error)} />} />{error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}</div>;
}
