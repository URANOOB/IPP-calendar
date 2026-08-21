"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { updateClass } from "@/app/(dashboard)/dashboard/classes/actions";
import { Button } from "@/components/ui/button";
import { classSchema, type ClassValues } from "@/lib/validations/classes";
import type { UserRole } from "@/types/user";

export function ClassDetailPanel({ classItem, role, message }: { classItem: ClassValues & { id: string; status: string }; role: UserRole; message: string }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [error, setError] = useState<string>(); const [pending, start] = useTransition(); const form = useForm<ClassValues>({ resolver: zodResolver(classSchema), defaultValues: classItem });
  function submit(values: ClassValues) { setError(undefined); start(async () => { const result = await updateClass(classItem.id, values); if (!result.success) setError(result.error); else { setEditing(false); router.refresh(); } }); }
  async function copy() { try { await navigator.clipboard.writeText(message); } catch { setError("No fue posible copiar el mensaje. Selecciónalo manualmente."); } }
  if (role === "contact_manager") return <><textarea aria-label="Mensaje de WhatsApp" className="min-h-40 w-full rounded-lg border bg-background p-3 text-sm" readOnly value={message} /><Button onClick={copy} type="button" variant="outline">Copiar mensaje</Button></>;
  return <div className="space-y-4"><Button onClick={() => setEditing((value) => !value)} type="button" variant="outline">{editing ? "Cancelar edición" : "Editar clase"}</Button>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{editing ? <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(submit)}><Input form={form} id="detail-title" label="Título" name="title" /><Input form={form} id="detail-description" label="Descripción" name="description" /><Input form={form} id="detail-meeting" label="Enlace HTTPS" name="meetingUrl" type="url" />{classItem.status === "draft" ? <><Input form={form} id="detail-start" label="Inicio (Bogotá)" name="startsAt" type="datetime-local" /><Input form={form} id="detail-end" label="Fin (Bogotá)" name="endsAt" type="datetime-local" /><Input form={form} id="detail-capacity" label="Cupo" name="capacity" type="number" /></> : <p className="text-sm text-muted-foreground sm:col-span-2">En una clase publicada se preservan ciclo, horario, profesor y cupo.</p>}<div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar cambios"}</Button></div></form> : null}<textarea aria-label="Mensaje de WhatsApp" className="min-h-40 w-full rounded-lg border bg-background p-3 text-sm" readOnly value={message} /><Button onClick={copy} type="button" variant="outline">Copiar mensaje</Button></div>;
}
function Input({ form, id, label, name, type = "text" }: { form: UseFormReturn<ClassValues>; id: string; label: string; name: keyof ClassValues; type?: string }) { const error = form.formState.errors[name]; return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label}</label><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm" id={id} type={type} {...form.register(name, type === "number" ? { valueAsNumber: true } : undefined)} />{error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}</div>; }
