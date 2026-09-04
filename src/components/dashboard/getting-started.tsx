import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const steps = [
  { title: "Crea el ciclo", href: "/dashboard/cycles", text: "Define el inicio y fin de la semana y la apertura y cierre de inscripciones. Se guarda activo; sus fechas no deben cruzarse con otro ciclo." },
  { title: "Prepara los profesores", href: "/dashboard/teachers", text: "Registra el nombre del profesor, su correo de recordatorios, foto y disponibilidad. Tu usuario queda asociado automáticamente como responsable del registro." },
  { title: "Programa las clases", href: "/dashboard/classes", text: "Selecciona un ciclo activo y un profesor activo. Indica horario dentro del ciclo, cupo de 1 a 4 niños y enlace HTTPS de videollamada." },
  { title: "Agrega los contactos", href: "/dashboard/contacts", text: "Guarda el celular del acudiente y comparte el enlace general de inscripción. El registro estará disponible durante la ventana del ciclo activo." },
  { title: "Registra los estudiantes", href: "/dashboard/students", text: "El acudiente completa sus datos, agrega sus niños y elige una clase por niño y ciclo. También puedes agregar o editar estudiantes desde su contacto; esto no reserva una clase." },
  { title: "Haz el seguimiento", href: "/dashboard/tracking", text: "Registra el contacto por WhatsApp, la respuesta y las notas. Revisa las clases agendadas y marca asistencia desde Estudiantes o el detalle de la clase." },
];

export function GettingStarted() {
  return <details className="my-5 rounded-2xl border bg-card p-5" open>
    <summary className="cursor-pointer text-lg font-bold">Cómo empezar · guía paso a paso</summary>
    <p className="mt-2 text-sm text-muted-foreground">Sigue este orden para preparar cada semana. Puedes plegar esta guía cuando ya conozcas el proceso.</p>
    <ol className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, index) => <li className="flex gap-3" key={step.href}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
        <div><Link className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={step.href}>{step.title}<ArrowUpRight aria-hidden="true" className="size-4" /></Link><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p></div>
      </li>)}
    </ol>
    <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">El gestor puede crear, consultar y editar los registros operativos. La eliminación permanente y la administración de cuentas corresponden al administrador. Todos los horarios se muestran en hora de Bogotá.</p>
  </details>;
}
