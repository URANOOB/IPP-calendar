import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header className="flex items-center gap-3 text-sm font-semibold text-primary">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <BookOpen aria-hidden="true" className="size-5" />
        </span>
        Inglés pa&apos; la Paz
      </header>

      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-4 text-sm font-semibold tracking-wide text-primary uppercase">Plataforma interna</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Una base clara para acompañar cada proceso de aprendizaje.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Este espacio prepara la gestión académica y de contactos de Inglés pa&apos; la Paz.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/auth/sign-in">
              Ingresar al equipo <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
