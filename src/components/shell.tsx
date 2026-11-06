"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useCurrentUser, useSettings, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece en la barra inferior del celular. */
  mobile?: boolean;
}

const ROLE_LABEL: Record<Role, string> = { admin: "Administración", teacher: "Profesor", student: "Alumno" };

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname.startsWith(href);
}

/**
 * Layout adaptable:
 *  - Celular (<768px): barra superior + barra de pestañas inferior.
 *  - iPad vertical (768–1023px): riel lateral con íconos.
 *  - iPad horizontal / escritorio (≥1024px): barra lateral completa.
 */
export function AppShell({ role, root, nav, children }: { role: Role; root: string; nav: NavItem[]; children: ReactNode }) {
  const user = useCurrentUser();
  const settings = useSettings();
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (user.role !== role) router.replace(user.role === "admin" ? "/admin" : user.role === "teacher" ? "/profesor" : "/alumno");
  }, [user, role, router]);

  if (!user || user.role !== role) return null;

  const mobileItems = nav.filter((n) => n.mobile);
  const hasMore = mobileItems.length < nav.length;
  const doLogout = async () => {
    await logout();
    router.replace("/");
  };

  const sideLink = (n: NavItem, compact: boolean) => {
    const active = isActive(pathname, n.href, root);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setDrawer(false)}
        className={cn(
          "flex items-center rounded-xl transition",
          compact ? "flex-col gap-1 px-1 py-2 text-[11px]" : "min-h-11 gap-3 px-3 py-2.5 text-sm",
          active ? "bg-brand-soft font-semibold text-brand-strong" : "text-muted hover:bg-black/5 hover:text-ink",
        )}
      >
        <n.icon size={compact ? 22 : 18} className="shrink-0" />
        {/* En el riel angosto la etiqueta puede ocupar 2 líneas ("Clases y / salones") en vez de cortarse. */}
        <span className={cn(compact && "line-clamp-2 max-w-full break-words text-center leading-tight")}>{n.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-dvh md:flex">
      {/* Riel (iPad vertical) */}
      <aside className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col border-r border-line bg-surface px-2 py-4 md:flex lg:hidden">
        <div className="mb-4 flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-brand-ink">
            {settings.studioName.charAt(0)}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">{nav.map((n) => sideLink(n, true))}</nav>
        <button onClick={doLogout} className="mt-2 flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] text-muted hover:bg-black/5">
          <LogOut size={20} />
          Salir
        </button>
      </aside>

      {/* Barra lateral completa (iPad horizontal y escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-brand-ink">
            {settings.studioName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{settings.studioName}</p>
            <p className="text-xs text-muted">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">{nav.map((n) => sideLink(n, false))}</nav>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line p-3">
          <Avatar name={user.name} color={user.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button
            onClick={doLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-black/5"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior (celular) */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-ink">
                {settings.studioName.charAt(0)}
              </span>
              <span className="truncate font-semibold">{settings.studioName}</span>
            </div>
            {hasMore ? (
              <button
                onClick={() => setDrawer(true)}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
                aria-label="Menú"
              >
                <Menu size={22} />
              </button>
            ) : (
              <button
                onClick={doLogout}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-black/5"
                aria-label="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>

        {/* Pestañas inferiores (celular) */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
          <div className="flex">
            {mobileItems.map((n) => {
              const active = isActive(pathname, n.href, root);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", active ? "font-semibold text-brand-text" : "text-muted")}
                >
                  <n.icon size={22} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Menú lateral (celular) */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          {/* El área segura (notch y barra de inicio) se suma al margen interno de 16 px. */}
          <div className="animate-sheet absolute inset-y-0 right-0 flex w-72 flex-col bg-surface px-4 pb-safe-4 pt-safe-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} color={user.color} size={36} />
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted">{ROLE_LABEL[role]}</p>
                </div>
              </div>
              <button
                onClick={() => setDrawer(false)}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">{nav.map((n) => sideLink(n, false))}</nav>
            <button onClick={doLogout} className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-black/5">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
