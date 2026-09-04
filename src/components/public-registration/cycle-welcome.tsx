"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { activateGuardianCycleAccess } from "@/app/registro/actions";
import { Button } from "@/components/ui/button";

type RegistrationStatus = "open" | "not_started" | "ended" | "no_active_cycle";

interface CycleWelcomeProps {
  cycleName: string;
  registrationOpen: boolean;
  registrationStatus?: RegistrationStatus;
}

export function CycleWelcome({ cycleName, registrationOpen, registrationStatus = "no_active_cycle" }: Readonly<CycleWelcomeProps>) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [studentNames, setStudentNames] = useState([""]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await activateGuardianCycleAccess({ fullName, phone, studentNames });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/clases/t/${result.privateToken}`);
    });
  }

  function updateStudent(index: number, value: string) { setStudentNames((current) => current.map((name, currentIndex) => currentIndex === index ? value : name)); }
  function removeStudent(index: number) { setStudentNames((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)); }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6 sm:py-12">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-primary">Inscripción de clases</p>
        <h1 className="mt-2 text-3xl font-bold">{cycleName}</h1>
        {registrationOpen ? (
          <>
            <p className="mt-4 text-lg leading-7 text-muted-foreground">
              Regístrate con tus datos y los nombres de los niños que vas a inscribir.
            </p>
            <form className="mt-7 space-y-5" noValidate onSubmit={submit}>
              <div className="space-y-2">
                <label className="text-base font-medium" htmlFor="welcome-name">
                  Tu nombre completo
                </label>
                <input
                  autoComplete="name"
                  className="h-12 w-full rounded-lg border bg-background px-4 text-base"
                  id="welcome-name"
                  onChange={(event) => setFullName(event.target.value)}
                  value={fullName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium" htmlFor="welcome-phone">
                  Tu celular
                </label>
                <input
                  autoComplete="tel"
                  className="h-12 w-full rounded-lg border bg-background px-4 text-base"
                  id="welcome-phone"
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="300 123 4567"
                  value={phone}
                />
              </div>
              <fieldset className="space-y-3">
                <legend className="text-base font-medium">Estudiantes a tu cargo</legend>
                <p className="text-sm text-muted-foreground">Agrega al menos un estudiante.</p>
                {studentNames.map((studentName, index) => (
                  <div className="flex gap-2" key={index}>
                    <input
                      aria-label={`Nombre del estudiante ${index + 1}`}
                      className="h-12 min-w-0 flex-1 rounded-lg border bg-background px-4 text-base"
                      onChange={(event) => updateStudent(index, event.target.value)}
                      placeholder={`Nombre del estudiante ${index + 1}`}
                      value={studentName}
                    />
                    {studentNames.length > 1 ? (
                      <Button onClick={() => removeStudent(index)} type="button" variant="outline">
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                ))}
                {studentNames.length < 10 ? (
                  <Button onClick={() => setStudentNames((current) => [...current, ""])} type="button" variant="outline">
                    Agregar otro estudiante
                  </Button>
                ) : null}
              </fieldset>
              {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
              <Button className="w-full" disabled={isPending} type="submit">
                {isPending ? "Procesando…" : "Crear mi enlace privado"}
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-lg leading-7 text-muted-foreground">
            {(() => {
              switch (registrationStatus) {
                case "not_started":
                  return "Las inscripciones para esta semana aún no han comenzado. Vuelve cuando se abran.";
                case "ended":
                  return "Las inscripciones para esta semana ya finalizaron.";
                case "no_active_cycle":
                  return "No hay un ciclo con inscripciones abiertas en este momento.";
                default:
                  return "Las inscripciones están cerradas para esta semana.";
              }
            })()}
          </p>
        )}
      </section>
    </main>
  );
}
