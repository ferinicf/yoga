"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  CircleUserRound,
  Cog,
  Dumbbell,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, mobile: true },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays, mobile: true },
  { href: "/admin/alumnos", label: "Alumnos", icon: Users, mobile: true },
  { href: "/admin/ventas", label: "Ventas", icon: Receipt, mobile: true },
  { href: "/admin/pagos", label: "Pagos a profesores", icon: HandCoins },
  { href: "/admin/profesores", label: "Profesores", icon: GraduationCap },
  { href: "/admin/clases", label: "Clases y salones", icon: Dumbbell },
  { href: "/admin/planes", label: "Planes y precios", icon: Tag },
  { href: "/admin/cupones", label: "Cupones", icon: Ticket },
  { href: "/admin/configuracion", label: "Configuración", icon: Cog },
  // Solo en el menú (no en la barra inferior del celular): datos propios, privacidad y eliminar la cuenta.
  { href: "/admin/cuenta", label: "Mi cuenta", icon: CircleUserRound },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="admin" root="/admin" nav={NAV}>
      {children}
    </AppShell>
  );
}
