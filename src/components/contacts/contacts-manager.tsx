"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";

import { createPendingGuardian, deactivateGuardian, deleteGuardian } from "@/app/(dashboard)/dashboard/contacts/actions";
import { Button } from "@/components/ui/button";
import { formatColombianPhone } from "@/lib/utils/phone";
import { useBrowserOrigin } from "@/lib/hooks/use-browser-origin";
import { pendingGuardianCreationSchema, type PendingGuardianCreationValues } from "@/lib/validations/guardians";

export interface ContactListItem {
  id: string;
  phone: string;
  active: boolean;
  studentCount: number;
  privateAccessToken: string | null;
}

type ContactStatus = "all" | "active" | "inactive";

interface ContactsManagerProps {
  contacts: ContactListItem[];
  page: number;
  pageSize: number;
  search: string;
  status: ContactStatus;
  total: number;
}

export function ContactsManager({ contacts, page, pageSize, search, status, total }: Readonly<ContactsManagerProps>) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [generalLinkCopied, setGeneralLinkCopied] = useState(false);
  const origin = useBrowserOrigin();
  const [isPending, startTransition] = useTransition();
  const form = useForm<PendingGuardianCreationValues>({ resolver: zodResolver(pendingGuardianCreationSchema), defaultValues: { phone: "" } });
  const generalRegistrationLink = origin ? `${origin}/registro` : "";

  const columns: ColumnDef<ContactListItem>[] = [
    { accessorKey: "phone", header: "Teléfono", cell: ({ row }) => formatColombianPhone(row.original.phone) },
    { accessorKey: "studentCount", header: "Niños", cell: ({ row }) => `${row.original.studentCount} ${row.original.studentCount === 1 ? "niño" : "niños"}` },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => <span className={row.original.active ? "text-emerald-700" : "text-muted-foreground"}>{row.original.active ? "Activo" : "Inactivo"}</span>,
    },
    { id: "link", header: "Enlace", cell: ({ row }) => <PrivateLinkCell accessToken={row.original.privateAccessToken} origin={origin} /> },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button asChild aria-label={`Editar acudiente ${formatColombianPhone(row.original.phone)}`} size="icon" title="Editar acudiente" variant="outline"><Link href={`/dashboard/contacts/${row.original.id}`}><Pencil aria-hidden="true" /></Link></Button>
          {row.original.active ? (
            <Button aria-label={`Desactivar acudiente ${formatColombianPhone(row.original.phone)}`} disabled={isPending && pendingId === row.original.id} onClick={() => onDeactivate(row.original)} size="icon" title="Desactivar acudiente" type="button" variant="outline"><Power aria-hidden="true" /></Button>
          ) : null}
          <Button aria-label={`Eliminar acudiente ${formatColombianPhone(row.original.phone)}`} className="border border-transparent bg-transparent text-rose-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600" disabled={isPending && pendingId === row.original.id} onClick={() => onDelete(row.original)} size="icon" title="Eliminar acudiente" type="button" variant="destructive"><Trash2 aria-hidden="true" /></Button>
        </div>
      ),
    },
  ];
  // TanStack manages a mutable table instance; this hook is intentionally not React-Compiler memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryForPage = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/dashboard/contacts?${query}` : "/dashboard/contacts";
  };

  function onDeactivate(contact: ContactListItem) {
    if (!window.confirm(`¿Desactivar el acudiente ${formatColombianPhone(contact.phone)}? Su enlace privado dejará de estar disponible.`)) return;
    setActionError(undefined);
    setPendingId(contact.id);
    startTransition(async () => {
      const result = await deactivateGuardian(contact.id);
      setPendingId(undefined);
      if (!result.success) setActionError(result.error);
      else router.refresh();
    });
  }

  function onCreate(values: PendingGuardianCreationValues) {
    setActionError(undefined);
    startTransition(async () => {
      const result = await createPendingGuardian(values);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      form.reset();
      setShowCreate(false);
      router.refresh();
    });
  }

  function onDelete(contact: ContactListItem) {
    if (!window.confirm(`¿Eliminar permanentemente el acudiente ${formatColombianPhone(contact.phone)}, sus estudiantes, inscripciones e invitaciones? Esta acción no se puede deshacer.`)) return;
    setActionError(undefined); setPendingId(contact.id); startTransition(async () => { const result = await deleteGuardian(contact.id); setPendingId(undefined); if (!result.success) setActionError(result.error); else router.refresh(); });
  }

  async function copyGeneralRegistrationLink() {
    if (!generalRegistrationLink) return;
    await navigator.clipboard.writeText(generalRegistrationLink);
    setGeneralLinkCopied(true);
    window.setTimeout(() => setGeneralLinkCopied(false), 1800);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">Enlace general de inscripción</h2><p className="mt-2 text-sm text-muted-foreground">Compártelo con los acudientes. Es siempre el mismo: el sistema habilita el registro únicamente durante la ventana de un ciclo activo.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="Enlace general de inscripción" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" readOnly value={generalRegistrationLink} /><Button disabled={!generalRegistrationLink} onClick={() => void copyGeneralRegistrationLink()} type="button" variant="outline">{generalLinkCopied ? "Copiado" : "Copiar enlace"}</Button></div></section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="contact-search">Buscar acudiente</label>
          <form className="flex gap-2" method="get">
            <input className="h-10 min-w-0 rounded-lg border bg-card px-3 text-sm" defaultValue={search} id="contact-search" name="search" placeholder="Buscar por teléfono" />
            {status !== "all" ? <input name="status" type="hidden" value={status} /> : null}
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
          <label className="sr-only" htmlFor="contact-status">Filtrar por estado</label>
          <form method="get">
            {search ? <input name="search" type="hidden" value={search} /> : null}
            <select className="h-10 rounded-lg border bg-card px-3 text-sm" id="contact-status" name="status" defaultValue={status} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            </select>
          </form>
        </div>
        <Button onClick={() => setShowCreate((visible) => !visible)} type="button">{showCreate ? "Cancelar" : <><Plus aria-hidden="true" />Agregar acudiente</>}</Button>
      </div>

      {showCreate ? (
        <form className="grid gap-4 rounded-xl border bg-card p-5" noValidate onSubmit={form.handleSubmit(onCreate)}>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="guardian-phone">Celular</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="guardian-phone" inputMode="tel" placeholder="300 123 4567" {...form.register("phone")} />{form.formState.errors.phone ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.phone.message}</p> : null}</div>
          <div><p className="text-sm text-muted-foreground">Guardaremos solo el celular. El acudiente completará su nombre y los datos de sus niños al registrarse desde el enlace general.</p><Button className="mt-4" disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar número"}</Button></div>
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{total} {total === 1 ? "acudiente" : "acudientes"}</span>
        <nav aria-label="Paginación de contactos" className="flex items-center gap-2">
          {page > 1 ? <Button asChild variant="outline"><Link href={queryForPage(page - 1)}>Anterior</Link></Button> : <Button disabled variant="outline">Anterior</Button>}
          <span>Página {Math.min(page, totalPages)} de {totalPages}</span>
          {page < totalPages ? <Button asChild variant="outline"><Link href={queryForPage(page + 1)}>Siguiente</Link></Button> : <Button disabled variant="outline">Siguiente</Button>}
        </nav>
      </div>
    </div>
  );
}

function PrivateLinkCell({ accessToken, origin }: Readonly<{ accessToken: string | null; origin: string }>) {
  const [copied, setCopied] = useState(false);
  if (!accessToken) return "Sin generar";
  const link = origin ? `${origin}/clases/t/${accessToken}` : "";
  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className="flex items-center gap-2"><span className="max-w-28 truncate text-muted-foreground" title={link}>Generado</span><Button disabled={!link} onClick={() => void copy()} size="default" type="button" variant="outline">{copied ? "Copiado" : "Copiar"}</Button></div>;
}
