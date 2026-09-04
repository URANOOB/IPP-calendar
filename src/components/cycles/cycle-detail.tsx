"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useWatch, useForm, type UseFormReturn } from "react-hook-form";
import { ArrowLeft, CalendarDays, Clock3, Pencil, Ticket } from "lucide-react";

import { updateDraftCycle } from "@/app/(dashboard)/dashboard/cycles/actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { WEEKLY_CYCLE_STATUS_LABELS, type WeeklyCycleStatus } from "@/lib/cycles/constants";
import { formatBogotaDate, getCycleEffectiveStatus, utcToBogotaInput } from "@/lib/cycles/dates";
import { weeklyCycleSchema, type WeeklyCycleValues } from "@/lib/validations/cycles";

export interface CycleDetailData {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  status: WeeklyCycleStatus;
}

export function CycleDetail({ cycle, mode = "view" }: Readonly<{ cycle: CycleDetailData; mode?: "view" | "edit" }>) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const form = useForm<WeeklyCycleValues>({ resolver: zodResolver(weeklyCycleSchema), defaultValues: { name: cycle.name, startsAt: utcToBogotaInput(cycle.startsAt), endsAt: utcToBogotaInput(cycle.endsAt), registrationOpensAt: utcToBogotaInput(cycle.registrationOpensAt), registrationClosesAt: utcToBogotaInput(cycle.registrationClosesAt) } });

  function onSubmit(values: WeeklyCycleValues) {
    setError(undefined);
    startTransition(async () => {
      const result = await updateDraftCycle(cycle.id, values);
      if (!result.success) setError(result.error);
      else router.push("/dashboard/cycles");
    });
  }

  const effectiveStatus = getCycleEffectiveStatus({ status: cycle.status, starts_at: cycle.startsAt, ends_at: cycle.endsAt, registration_opens_at: cycle.registrationOpensAt, registration_closes_at: cycle.registrationClosesAt });

  return <div className="space-y-4">
    <Link className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-muted-foreground hover:text-primary" href={mode === "edit" ? `/dashboard/cycles/${cycle.id}` : "/dashboard/cycles"}><ArrowLeft aria-hidden="true" className="size-4" />{mode === "edit" ? "Volver al ciclo" : "Volver a ciclos"}</Link>
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-col justify-between gap-4 px-5 py-6 sm:flex-row sm:items-start sm:px-7">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">{mode === "edit" ? "Editar ciclo" : cycle.name}</h1>{mode === "view" ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cycle.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{cycle.status === "draft" ? "Borrador" : WEEKLY_CYCLE_STATUS_LABELS[cycle.status]}</span> : null}</div>
          <p className="text-sm text-muted-foreground">{mode === "edit" ? "Actualiza el nombre y los horarios de este ciclo." : effectiveStatus}</p>
        </div>
        {mode === "view" ? <Button asChild className="self-start"><Link href={`/dashboard/cycles/${cycle.id}/edit`}><Pencil aria-hidden="true" />Editar ciclo</Link></Button> : null}
      </header>
      {mode === "edit" ? <form className="space-y-6 border-t px-5 py-6 sm:px-7" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600" role="alert">{error}</p> : null}
        <div className="space-y-2"><label className="text-sm font-medium" htmlFor="detail-cycle-name">Nombre del ciclo</label><input className="h-11 w-full rounded-xl border bg-background px-3 text-sm" id="detail-cycle-name" {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-rose-600" role="alert">{form.formState.errors.name.message}</p> : null}</div>
        <fieldset className="space-y-4"><legend className="mb-1 flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" className="size-4 text-primary" />Período del ciclo</legend><p className="text-sm text-muted-foreground">Las clases se programan dentro de estas fechas.</p><div className="grid gap-4 sm:grid-cols-2"><CycleDateField form={form} id="detail-cycle-start" label="Inicio del ciclo" name="startsAt" /><CycleDateField form={form} id="detail-cycle-end" label="Fin del ciclo" name="endsAt" /></div></fieldset>
        <fieldset className="space-y-4 border-t pt-4"><legend className="flex items-center gap-2 pr-3 font-semibold"><Ticket aria-hidden="true" className="size-4 text-primary" />Inscripciones</legend><p className="text-sm text-muted-foreground">Define cuándo se reciben las inscripciones.</p><div className="grid gap-4 sm:grid-cols-2"><CycleDateField form={form} id="detail-cycle-registration-open" label="Apertura de inscripción" name="registrationOpensAt" /><CycleDateField form={form} id="detail-cycle-registration-close" label="Cierre de inscripción" name="registrationClosesAt" /></div></fieldset>
        <div className="flex flex-wrap gap-2 border-t pt-5"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar cambios"}</Button><Button asChild variant="outline"><Link href={`/dashboard/cycles/${cycle.id}`}>Cancelar edición</Link></Button></div>
      </form> : <CycleInformation cycle={cycle} />}
      <p className="flex items-center gap-2 border-t bg-background/50 px-5 py-3 text-xs text-muted-foreground sm:px-7"><Clock3 aria-hidden="true" className="size-3.5 shrink-0" />Todos los horarios están en hora de Bogotá.</p>
    </article>
  </div>;
}

function CycleInformation({ cycle }: Readonly<{ cycle: CycleDetailData }>) {
  return <div className="grid divide-y border-t lg:grid-cols-2 lg:divide-x lg:divide-y-0">
    <section className="px-5 py-6 sm:px-7" aria-labelledby="cycle-period-heading"><h2 className="flex items-center gap-2 font-semibold" id="cycle-period-heading"><CalendarDays aria-hidden="true" className="size-5 text-primary" />Período del ciclo</h2><p className="mt-2 text-sm text-muted-foreground">Fechas disponibles para programar las clases.</p><dl className="mt-5 space-y-5"><CycleMoment label="Inicio" value={cycle.startsAt} /><CycleMoment label="Fin" value={cycle.endsAt} /></dl></section>
    <section className="bg-background/50 px-5 py-6 sm:px-7" aria-labelledby="cycle-registration-heading"><h2 className="flex items-center gap-2 font-semibold" id="cycle-registration-heading"><Ticket aria-hidden="true" className="size-5 text-primary" />Inscripciones</h2><p className="mt-2 text-sm text-muted-foreground">Período para recibir inscripciones.</p><dl className="mt-5 space-y-5"><CycleMoment label="Apertura" value={cycle.registrationOpensAt} /><CycleMoment label="Cierre" value={cycle.registrationClosesAt} /></dl></section>
  </div>;
}

function CycleMoment({ label, value }: Readonly<{ label: string; value: string }>) {
  const time = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 text-sm"><dt className="pt-0.5 text-muted-foreground">{label}</dt><dd><time dateTime={value}><span className="block font-semibold">{formatBogotaDate(value)}</span><span className="mt-1 block text-muted-foreground">{time}</span></time></dd></div>;
}

function CycleDateField({ form, id, label, name }: Readonly<{ form: UseFormReturn<WeeklyCycleValues>; id: string; label: string; name: keyof Pick<WeeklyCycleValues, "startsAt" | "endsAt" | "registrationOpensAt" | "registrationClosesAt"> }>) {
  const error = form.formState.errors[name];
  const values = useWatch({ control: form.control });
  const min = name === "endsAt" ? values.startsAt : name === "registrationClosesAt" ? values.registrationOpensAt : undefined;
  const max = name === "startsAt" || name === "registrationClosesAt" ? values.endsAt : name === "registrationOpensAt" ? values.registrationClosesAt : undefined;
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label} <span className="text-muted-foreground">(Bogotá)</span></label><Controller control={form.control} name={name} render={({ field }) => <DateTimePicker {...field} id={id} label={label} min={min} max={max} invalid={Boolean(error)} />} />{error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}</div>;
}
