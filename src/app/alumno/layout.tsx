"use client";

import { CalendarDays, Home, Package, Ticket, UserRound } from "lucide-react";
import { AppShell, type NavItem } from "@/components/shell";

const NAV: NavItem[] = [
  { href: "/alumno", label: "Inicio", icon: Home, mobile: true },
  { href: "/alumno/horario", label: "Horario", icon: CalendarDays, mobile: true },
  { href: "/alumno/reservas", label: "Reservas", icon: Ticket, mobile: true },
  { href: "/alumno/paquetes", label: "Paquetes", icon: Package, mobile: true },
  { href: "/alumno/perfil", label: "Perfil", icon: UserRound, mobile: true },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="student" root="/alumno" nav={NAV}>
      {children}
    </AppShell>
  );
}
