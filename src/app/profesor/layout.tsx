"use client";

import { CalendarCheck, UserRound } from "lucide-react";
import { AppShell, type NavItem } from "@/components/shell";

const NAV: NavItem[] = [
  { href: "/profesor", label: "Mis clases", icon: CalendarCheck, mobile: true },
  { href: "/profesor/perfil", label: "Perfil", icon: UserRound, mobile: true },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="teacher" root="/profesor" nav={NAV}>
      {children}
    </AppShell>
  );
}
