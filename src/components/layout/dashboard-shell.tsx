"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Menu, PanelLeftClose, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { signOut } from "@/app/(dashboard)/dashboard/actions";
import { navigationForRole } from "@/config/navigation";
import type { InternalUser } from "@/lib/auth/user";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="outline">
      {pending ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}

export function DashboardShell({ children, user }: Readonly<{ children: React.ReactNode; user: InternalUser }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = navigationForRole(user.role);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Navegación principal"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Link className="flex items-center gap-2 font-bold text-primary" href="/dashboard" onClick={() => setMobileOpen(false)}>
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen aria-hidden="true" className="size-4" />
            </span>
            IPP
          </Link>
          <Button aria-label="Cerrar navegación" className="lg:hidden" onClick={() => setMobileOpen(false)} size="icon" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive && "bg-secondary text-secondary-foreground",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="border-t px-5 py-4 text-xs leading-5 text-muted-foreground">Inglés pa&apos; la Paz</p>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center border-b bg-card px-4 sm:px-6">
          <Button aria-label="Abrir navegación" className="lg:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
            <Menu aria-hidden="true" />
          </Button>
          <div className="ml-2 min-w-0 lg:ml-0">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
          <PanelLeftClose aria-hidden="true" className="ml-auto mr-3 hidden size-4 text-muted-foreground lg:block" />
          <form action={signOut}>
            <LogoutButton />
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
