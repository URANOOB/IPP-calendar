"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { ArrowLeft, Pencil } from "lucide-react";

import { updateDraftCycle } from "@/app/(dashboard)/dashboard/cycles/actions";
import { Button } from "@/components/ui/button";
import { WEEKLY_CYCLE_STATUS_LABELS, type WeeklyCycleStatus } from "@/lib/cycles/constants";
import { formatBogotaDateTime, getCycleEffectiveStatus, utcToBogotaInput } from "@/lib/cycles/dates";
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

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/dashboard/cycles"><ArrowLeft aria-hidden="true" />Volver a ciclos</Link></Button>{mode === "view" ? <Button asChild><Link href={`/dashboard/cycles/${cycle.id}/edit`}><Pencil aria-hidden="true" />Editar ciclo</Link></Button> : <Button asChild variant="outline"><Link href={`/dashboard/cycles/${cycle.id}`}>Cancelar edición</Link></Button>}</div>
    {error ? <p className="rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive" role="alert">{error}</p> : null}
    <section className="rounded-xl border bg-card p-5"><p className="text-sm font-semibold text-primary">{WEEKLY_CYCLE_STATUS_LABELS[cycle.status]}</p><h1 className="mt-1 text-2xl font-bold">{cycle.name}</h1><p className="mt-2 text-sm text-muted-foreground">{getCycleEffectiveStatus({ status: cycle.status, starts_at: cycle.startsAt, ends_at: cycle.endsAt, registration_opens_at: cycle.registrationOpensAt, registration_closes_at: cycle.registrationClosesAt })}</p></section>
    {mode === "edit" ? <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium" htmlFor="detail-cycle-name">Nombre</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id="detail-cycle-name" {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-destructive" role="alert">{form.formState.errors.name.message}</p> : null}</div>
      <CycleDateField form={form} id="detail-cycle-start" label="Inicio del ciclo" name="startsAt" />
      <CycleDateField form={form} id="detail-cycle-end" label="Fin del ciclo" name="endsAt" />
      <CycleDateField form={form} id="detail-cycle-registration-open" label="Apertura de inscripción" name="registrationOpensAt" />
      <CycleDateField form={form} id="detail-cycle-registration-close" label="Cierre de inscripción" name="registrationClosesAt" />
      <div className="sm:col-span-2"><Button disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar cambios"}</Button></div>
    </form> : <CycleInformation cycle={cycle} />}
  </div>;
}

function CycleInformation({ cycle }: Readonly<{ cycle: CycleDetailData }>) {
  return <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground"><h2 className="text-xl font-bold text-foreground">Información del ciclo</h2><p className="mt-4"><strong className="text-foreground">Inicio:</strong> {formatBogotaDateTime(cycle.startsAt)}</p><p className="mt-2"><strong className="text-foreground">Fin:</strong> {formatBogotaDateTime(cycle.endsAt)}</p><p className="mt-2"><strong className="text-foreground">Apertura de inscripción:</strong> {formatBogotaDateTime(cycle.registrationOpensAt)}</p><p className="mt-2"><strong className="text-foreground">Cierre de inscripción:</strong> {formatBogotaDateTime(cycle.registrationClosesAt)}</p></section>;
}

function CycleDateField({ form, id, label, name }: Readonly<{ form: UseFormReturn<WeeklyCycleValues>; id: string; label: string; name: keyof Pick<WeeklyCycleValues, "startsAt" | "endsAt" | "registrationOpensAt" | "registrationClosesAt"> }>) {
  const error = form.formState.errors[name];
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label} <span className="text-muted-foreground">(Bogotá)</span></label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={id} type="datetime-local" {...form.register(name)} />{error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}</div>;
}
