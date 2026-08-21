"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, getFilteredRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { createGuardian, deactivateGuardian } from "@/app/(dashboard)/dashboard/contacts/actions";
import { Button } from "@/components/ui/button";
import { formatColombianPhone } from "@/lib/utils/phone";
import { guardianSchema, type GuardianValues } from "@/lib/validations/guardians";

export interface ContactListItem {
  id: string;
  fullName: string;
  phone: string;
  active: boolean;
  studentCount: number;
  hasPrivateLink: boolean;
}

export function ContactsManager({ contacts }: Readonly<{ contacts: ContactListItem[] }>) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [actionError, setActionError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<GuardianValues>({ resolver: zodResolver(guardianSchema) });

  const visibleContacts = contacts.filter((contact) => status === "all" || (status === "active" ? contact.active : !contact.active));
  const columns: ColumnDef<ContactListItem>[] = [
    { accessorKey: "fullName", header: "Nombre" },
    { accessorKey: "phone", header: "Teléfono", cell: ({ row }) => formatColombianPhone(row.original.phone) },
    { accessorKey: "studentCount", header: "Niños", cell: ({ row }) => `${row.original.studentCount} ${row.original.studentCount === 1 ? "niño" : "niños"}` },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => <span className={row.original.active ? "text-emerald-700" : "text-muted-foreground"}>{row.original.active ? "Activo" : "Inactivo"}</span>,
    },
    { id: "link", header: "Enlace", cell: ({ row }) => (row.original.hasPrivateLink ? "Generado" : "Sin generar") },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="default" variant="outline"><Link href={`/dashboard/contacts/${row.original.id}`}>Editar</Link></Button>
          {row.original.active ? (
            <Button disabled={isPending && pendingId === row.original.id} onClick={() => onDeactivate(row.original)} size="default" type="button" variant="outline">
              Desactivar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  // TanStack manages a mutable table instance; this hook is intentionally not React-Compiler memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visibleContacts,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).trim().toLowerCase().replace(/\s/g, "");
      return row.original.fullName.toLowerCase().includes(query) || row.original.phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function onDeactivate(contact: ContactListItem) {
    if (!window.confirm(`¿Desactivar a ${contact.fullName}? Su enlace privado dejará de estar disponible.`)) return;
    setActionError(undefined);
    setPendingId(contact.id);
    startTransition(async () => {
      const result = await deactivateGuardian(contact.id);
      setPendingId(undefined);
      if (!result.success) setActionError(result.error);
      else router.refresh();
    });
  }

  function onCreate(values: GuardianValues) {
    setActionError(undefined);
    startTransition(async () => {
      const result = await createGuardian(values);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      form.reset();
      setShowCreate(false);
      if (result.guardianId) router.push(`/dashboard/contacts/${result.guardianId}`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="contact-search">Buscar acudiente</label>
          <input className="h-10 min-w-0 rounded-lg border bg-card px-3 text-sm" id="contact-search" onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Buscar por nombre o teléfono" value={globalFilter} />
          <label className="sr-only" htmlFor="contact-status">Filtrar por estado</label>
          <select className="h-10 rounded-lg border bg-card px-3 text-sm" id="contact-status" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <Button onClick={() => setShowCreate((visible) => !visible)} type="button">{showCreate ? "Cancelar" : "Agregar acudiente"}</Button>
      </div>

      {showCreate ? (
        <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(onCreate)}>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="guardian-name">Nombre completo</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="guardian-name" {...form.register("fullName")} />{form.formState.errors.fullName ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.fullName.message}</p> : null}</div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="guardian-phone">Celular</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="guardian-phone" inputMode="tel" placeholder="300 123 4567" {...form.register("phone")} />{form.formState.errors.phone ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.phone.message}</p> : null}</div>
          <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar y agregar estudiantes"}</Button></div>
        </form>
      ) : null}

      {actionError ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{actionError}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground"><tr>{table.getFlatHeaders().map((header) => <th className="px-4 py-3 font-medium" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr></thead>
          <tbody>{table.getRowModel().rows.map((row) => <tr className="border-b last:border-0" key={row.id}>{row.getVisibleCells().map((cell) => <td className="px-4 py-3" key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
        {table.getRowModel().rows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay acudientes registrados con estos criterios.</p> : null}
      </div>
    </div>
  );
}
