"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { signOut } from "@/app/(dashboard)/dashboard/actions";
import { navigationForRole } from "@/config/navigation";
import type { InternalUser } from "@/lib/auth/user";
import type { PlatformActivity } from "@/lib/platform-activity/service";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationCenter } from "@/components/layout/notification-center";

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="outline">
      {pending ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}

export function DashboardShell({ activity, children, user }: Readonly<{ activity: PlatformActivity[]; children: React.ReactNode; user: InternalUser }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = navigationForRole(user.role);

  return (
    <div className="min-h-screen p-0 lg:p-5 xl:p-7">
      <div className="min-h-screen overflow-hidden bg-background lg:min-h-[calc(100vh-2.5rem)] lg:rounded-[1.75rem] lg:border lg:border-white/80 lg:shadow-[0_24px_70px_rgba(50,74,116,0.16)] xl:min-h-[calc(100vh-3.5rem)] lg:grid lg:grid-cols-[16rem_1fr]">
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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-cyan-400 via-sky-500 to-indigo-500 text-white shadow-2xl transition-transform lg:static lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/20 px-5">
          <Link className="flex items-center gap-3 font-extrabold tracking-tight text-white" href="/dashboard" onClick={() => setMobileOpen(false)}>
            <span className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/35 bg-white/95 p-0.5 shadow-sm">
              <Image alt="Inglés pa' la Paz" className="size-full object-contain" height={600} priority src="/images/logo-ipp.png" width={800} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-lg">IPP agenda</span>
              <span className="text-xs font-medium text-white/90">{user.role === "manager" ? "Gestor" : "Administrador"}</span>
            </div>
          </Link>
          <Button aria-label="Cerrar navegación" className="text-white hover:bg-white/15 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} size="icon" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1.5 px-3 py-5">
          {navigation.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/14 hover:text-white",
                  isActive && "bg-white/95 text-indigo-600 shadow-[0_10px_24px_rgba(27,79,169,0.18)] hover:bg-white hover:text-indigo-600",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setMobileOpen(false)}
                prefetch={false}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div aria-label="Mascota animada" className="relative h-28 overflow-hidden bg-white/8" role="img">
          <Image alt="" className="sidebar-dolphin" height={330} priority src="/images/sidebar-dolphin.gif" unoptimized width={748} />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="dashboard-topbar flex h-20 items-center border-b border-border/80 px-4 backdrop-blur sm:px-7">
          <Button aria-label="Abrir navegación" className="lg:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
            <Menu aria-hidden="true" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            <NotificationCenter initialActivity={activity} canManage={user.role === "admin" || user.role === "manager"} />
          </div>
          <div className="mx-1 sm:mx-3" />
          <form action={signOut}>
            <LogoutButton />
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 lg:px-9 lg:py-10">{children}</main>
      </div>
      </div>
    </div>
  );
}
