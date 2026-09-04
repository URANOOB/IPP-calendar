"use client";

import { DayPicker } from "@daypicker/react";
import { es } from "@daypicker/react/locale";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, Check, ChevronDown, Clock3, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { utcToBogotaInput } from "@/lib/cycles/dates";
import { cn } from "@/lib/utils";

type PickerMode = "datetime" | "date" | "time";

interface DateTimePickerProps {
  id?: string;
  name?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  mode?: PickerMode;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

// Calendar dates are wall-clock values, not instants. Never parse YYYY-MM-DD
// as UTC: doing so shifts the selected day in browsers west of Greenwich.
function calendarDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : undefined;
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeParts(value: string) {
  const [hour, minute] = /^\d{2}:\d{2}$/.test(value) ? value.split(":").map(Number) : [9, 0];
  return { hour: String(hour % 12 || 12).padStart(2, "0"), minute: String(minute).padStart(2, "0"), period: hour >= 12 ? "pm" : "am" };
}

function timeLabel(value: string) {
  const { hour, minute, period } = timeParts(value);
  return `${Number(hour)}:${minute} ${period === "am" ? "a. m." : "p. m."}`;
}

function dateLabel(value: string) {
  const date = calendarDate(value);
  return date ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";
}

export function DateTimePicker({ id, name, label, value = "", onChange, onBlur, ref, mode = "datetime", min, max, disabled, invalid, describedBy, className }: DateTimePickerProps) {
  const uniqueId = useId();
  const hourInput = useRef<HTMLInputElement>(null);
  const inputId = id ?? uniqueId;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState<Date>();
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("am");
  const [today, setToday] = useState("");
  const [step, setStep] = useState<"date" | "time">("date");
  useEffect(() => {
    if (open && (mode === "time" || step === "time")) {
      hourInput.current?.focus();
      hourInput.current?.select();
    }
  }, [open, mode, step]);
  const hasDate = mode !== "time";
  const hasTime = mode !== "date";
  const validTime = /^(0?[1-9]|1[0-2])$/.test(hour) && /^[0-5]?\d$/.test(minute);
  const time = validTime ? `${String(Number(hour) % 12 + (period === "pm" ? 12 : 0)).padStart(2, "0")}:${minute.padStart(2, "0")}` : "";
  const draft = mode === "time" ? time : mode === "date" ? day : day && time ? `${day}T${time}` : "";
  const inRange = (candidate: string) => Boolean(candidate && (!min || candidate >= min) && (!max || candidate <= max));
  const validDraft = Boolean(draft && (!hasDate || calendarDate(day)) && (!hasTime || validTime) && inRange(draft));
  const minDay = hasDate ? calendarDate(min?.slice(0, 10) ?? "") : undefined;
  const maxDay = hasDate ? calendarDate(max?.slice(0, 10) ?? "") : undefined;
  const Icon = mode === "time" ? Clock3 : CalendarDays;

  function setTime(value: string) {
    const parts = timeParts(value);
    setHour(parts.hour); setMinute(parts.minute); setPeriod(parts.period);
  }

  function changeOpen(next: boolean) {
    if (next) {
      const now = utcToBogotaInput(new Date());
      setToday(now.slice(0, 10));
      setStep("date");
      setDay(hasDate ? value.slice(0, 10) : "");
      setTime(mode === "time" ? value || min || "09:00" : value.slice(11) || "09:00");
      const initial = value || (min && now < min ? min : max && now > max ? max : now);
      setMonth(calendarDate(initial.slice(0, 10)));
    } else onBlur?.();
    setOpen(next);
  }

  function commit(next: string) {
    onChange(next);
    changeOpen(false);
  }

  function selectDay(date: Date | undefined) {
    if (!date) return;
    const nextDay = dateValue(date);
    if (mode === "date") { commit(nextDay); return; }
    setDay(nextDay);
    setStep("time");
    // When selecting a boundary day, suggest an allowed hour immediately.
    const nextTime = time || "09:00";
    if (min?.slice(0, 10) === nextDay && `${nextDay}T${nextTime}` < min) setTime(min.slice(11));
    else if (max?.slice(0, 10) === nextDay && `${nextDay}T${nextTime}` > max) setTime(max.slice(11));
  }

  const placeholder = mode === "time" ? "Elegir hora" : mode === "date" ? "Elegir fecha" : "Elegir fecha y hora";
  const display = !value ? placeholder : mode === "time" ? timeLabel(value) : `${dateLabel(value.slice(0, 10))}${mode === "datetime" ? ` · ${timeLabel(value.slice(11))}` : ""}`;
  const rangeLabel = (bound: string) => mode === "time" ? timeLabel(bound) : `${dateLabel(bound.slice(0, 10))}${mode === "datetime" ? `, ${timeLabel(bound.slice(11))}` : ""}`;

  return <Popover.Root open={open} onOpenChange={changeOpen}>
    {name ? <input disabled={disabled} name={name} type="hidden" value={value} /> : null}
    <Popover.Trigger asChild>
      <button aria-describedby={describedBy} aria-label={invalid ? `${label}: revisa el valor ingresado` : label} className={cn("flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-50", invalid && "border-rose-500", className)} disabled={disabled} id={inputId} ref={ref} type="button">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className={cn("flex-1", !value && "text-muted-foreground")}>{display}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" aria-label={`${label}: selector`} className="ipp-date-picker z-50 w-[352px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border bg-card p-4 text-foreground shadow-[0_16px_50px_rgba(36,50,82,0.18)] outline-none" collisionPadding={12} sideOffset={8} style={{ maxHeight: "var(--radix-popover-content-available-height)" }}>
        <div className="mb-3 flex items-center gap-3 border-b pb-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold">{label.replace(/\s*\(Bogotá\)/, "")}</p><p className="mt-0.5 text-xs text-muted-foreground">{hasTime ? "Hora de Bogotá · formato de 12 horas" : "Selecciona un día del calendario"}</p></div>
          <Popover.Close asChild><button aria-label="Cerrar selector" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-muted" type="button"><X aria-hidden="true" className="size-4" /></button></Popover.Close>
        </div>
        {hasDate && (mode === "date" || step === "date") ? <>
          <DayPicker autoFocus captionLayout="dropdown" className="ipp-calendar" disabled={[...(minDay ? [{ before: minDay }] : []), ...(maxDay ? [{ after: maxDay }] : [])]} endMonth={maxDay ?? new Date(Math.max(2100, month?.getFullYear() ?? 2100), 11)} fixedWeeks locale={es} mode="single" required month={month} navLayout="around" onMonthChange={setMonth} onSelect={selectDay} selected={calendarDate(day)} showOutsideDays startMonth={minDay ?? new Date(Math.min(1900, month?.getFullYear() ?? 1900), 0)} today={calendarDate(today)} weekStartsOn={1} />
          <div className="mb-3 mt-2 flex items-center justify-between gap-2"><button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-40" disabled={!today || Boolean(min && today < min.slice(0, 10)) || Boolean(max && today > max.slice(0, 10))} onClick={() => { const date = calendarDate(today); if (date) { setMonth(date); selectDay(date); } }} type="button">Hoy</button><span className="text-xs text-muted-foreground">{day ? dateLabel(day) : "Elige una fecha"}</span></div>
        </> : null}
        {hasDate && step === "time" ? <button className="mb-4 flex w-full items-center gap-2 rounded-xl border bg-secondary/40 p-3 text-left text-sm" onClick={() => setStep("date")} type="button"><CalendarDays aria-hidden="true" className="size-4 text-primary" /><span className="flex-1 font-semibold">{dateLabel(day)}</span><span className="text-xs font-semibold text-primary">Cambiar fecha</span></button> : null}
        {hasTime && (mode === "time" || step === "time") ? <fieldset className="space-y-3">
          <legend className="sr-only">Hora para {label}</legend>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{hasDate ? "Elige la hora" : "Escribe la hora o ajusta los minutos"}</p>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs text-muted-foreground">Hora<input ref={hourInput} aria-label="Hora" className="mt-1 h-12 w-full rounded-xl border bg-background text-center text-xl font-semibold text-foreground" inputMode="numeric" maxLength={2} onBlur={() => { if (/^(0?[1-9]|1[0-2])$/.test(hour)) setHour(hour.padStart(2, "0")); }} onChange={(event) => setHour(event.target.value.replace(/\D/g, ""))} value={hour} /></label>
            <span aria-hidden="true" className="pb-3 text-xl text-muted-foreground">:</span>
            <label className="min-w-0 flex-1 text-xs text-muted-foreground">Minutos<input aria-label="Minutos" className="mt-1 h-12 w-full rounded-xl border bg-background text-center text-xl font-semibold text-foreground" inputMode="numeric" maxLength={2} onBlur={() => { if (/^[0-5]?\d$/.test(minute)) setMinute(minute.padStart(2, "0")); }} onChange={(event) => setMinute(event.target.value.replace(/\D/g, ""))} value={minute} /></label>
            <div aria-label="Periodo del día" className="flex h-12 shrink-0 gap-1 rounded-xl bg-muted p-1" role="group">{["am", "pm"].map((item) => <button aria-label={item === "am" ? "AM (antes del mediodía)" : "PM (desde el mediodía)"} aria-pressed={period === item} className={cn("rounded-lg px-2.5 text-xs font-bold transition-colors", period === item ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-white")} key={item} onClick={() => setPeriod(item)} type="button">{item.toUpperCase()}</button>)}</div>
          </div>
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Minutos</span>{["00", "15", "30", "45"].map((item) => <button aria-label={`Usar ${item} minutos`} aria-pressed={minute.padStart(2, "0") === item} className={cn("min-h-8 flex-1 rounded-lg border text-xs font-semibold", minute.padStart(2, "0") === item ? "border-primary/30 bg-secondary text-primary" : "hover:bg-muted")} key={item} onClick={() => setMinute(item)} type="button">:{item}</button>)}</div>
          <p aria-live="polite" className="text-xs text-muted-foreground">{validTime ? `Hora seleccionada: ${timeLabel(time)}${time.startsWith("00:") ? " · medianoche" : time.startsWith("12:") ? " · mediodía" : ""}` : "Escribe una hora del 1 al 12 y minutos del 00 al 59."}</p>
        </fieldset> : null}
        {min || max ? <p className={cn("mt-3 text-xs", draft && !inRange(draft) ? "text-rose-600" : "text-muted-foreground")} role={draft && !inRange(draft) ? "alert" : undefined}>{min ? `Desde ${rangeLabel(min)}` : ""}{min && max ? " · " : ""}{max ? `Hasta ${rangeLabel(max)}` : ""}</p> : null}
        <div className="sticky -bottom-4 -mx-4 -mb-4 mt-4 flex items-center justify-between gap-2 border-t bg-card px-4 py-3">
          <Button className="px-2 text-muted-foreground" disabled={!value && !day} onClick={() => commit("")} type="button" variant="ghost">Limpiar</Button>
          {mode === "datetime" && step === "date" ? <Button disabled={!day} onClick={() => setStep("time")} type="button">Elegir hora<Clock3 aria-hidden="true" /></Button> : hasTime ? <Button disabled={!validDraft} onClick={() => commit(draft)} type="button"><Check aria-hidden="true" />Aplicar</Button> : <Popover.Close asChild><Button type="button" variant="outline">Cerrar</Button></Popover.Close>}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
