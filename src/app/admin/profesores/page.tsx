"use client";

import Link from "next/link";
import { useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import { AlertTriangle, ChevronRight, Mail, Pencil, Phone, Plus } from "lucide-react";
import { useDB } from "@/lib/store";
import { occupied } from "@/lib/rules";
import { DEFAULT_TEACHER_SHARE, hasRate, teacherBalance, toCents } from "@/lib/payouts";
import type { User } from "@/lib/types";
import { cn, formatMoneyCents, WEEKDAYS_SHORT } from "@/lib/utils";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import { PersonFormModal } from "@/components/admin/person-form";
import { OwedValue } from "@/components/admin/payout-status";

/** Parte del profesor por cada alumno, redondeada igual que el cobro de una clase. */
function perStudent(rate: number, share: number): number {
  return Math.round((toCents(rate) * Math.round(share * 100)) / 10000) / 100;
}

export default function TeachersPage() {
  const db = useDB();
  const [form, setForm] = useState<{ key: number; user?: User } | null>(null);
  const now = new Date();
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const share = db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE;

  const teachers = db.users
    .filter((u) => u.role === "teacher")
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Profesores"
        subtitle="Equipo de instructores, su precio por alumno y su carga semanal"
        actions={
          <Button onClick={() => setForm({ key: Date.now() })}>
            <Plus size={18} /> Nuevo profesor
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teachers.map((t) => {
          const templates = db.templates.filter((x) => x.teacherId === t.id && x.active);
          const week = db.sessions.filter(
            (s) => s.teacherId === t.id && s.status === "scheduled" && new Date(s.startsAt) >= ws && new Date(s.startsAt) <= we,
          );
          const cap = week.reduce((a, s) => a + s.capacity, 0);
          const occ = week.reduce((a, s) => a + occupied(db, s.id), 0);
          const rated = hasRate(t);
          const owed = teacherBalance(db, t.id, now).owed;
          const days = [...new Set(templates.map((x) => x.weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
          const disciplines = [...new Set(templates.map((x) => x.disciplineId))]
            .map((id) => db.disciplines.find((d) => d.id === id))
            .filter(Boolean);
          return (
            <Card key={t.id} className={cn("min-w-0 p-4", !t.active && "opacity-60")}>
              <div className="flex items-start gap-3">
                <Avatar name={t.name} color={t.color} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" title={t.name}>
                    {t.name}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted">{t.bio || "Sin biografía"}</p>
                </div>
                <button
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5"
                  onClick={() => setForm({ key: Date.now(), user: t })}
                  aria-label={`Editar ${t.name}`}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {!t.active && <Badge>Inactivo</Badge>}
                {disciplines.map((d) => (
                  <Badge key={d!.id} tone="brand">
                    {d!.name}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-1 text-sm">
                {rated ? (
                  <p className="min-w-0 py-2">
                    <span className="font-semibold tabular-nums">{formatMoneyCents(t.rate!)}</span> por alumno
                    <span className="block text-xs text-muted">
                      Le toca {Math.round(share * 100) / 100}% ({formatMoneyCents(perStudent(t.rate!, share))})
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    className="-ml-1 flex min-h-11 min-w-0 items-start gap-1.5 rounded-lg px-1 py-2 text-left hover:bg-black/5"
                    onClick={() => setForm({ key: Date.now(), user: t })}
                  >
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                    <span>
                      <span className="block font-medium text-amber-800">Sin precio por alumno</span>
                      <span className="block text-xs font-medium text-brand-text underline underline-offset-2">Definir precio</span>
                    </span>
                  </button>
                )}
                {(rated || owed !== 0) && (
                  <Link href="/admin/pagos" className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 py-1 text-right hover:bg-black/5">
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">Le debemos</span>
                      <OwedValue owed={owed} />
                    </span>
                    <ChevronRight size={16} className="text-muted" />
                  </Link>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-bg p-2">
                  <p className="text-lg font-semibold tabular-nums">{week.length}</p>
                  <p className="text-xs text-muted">Clases esta semana</p>
                </div>
                <div className="rounded-xl bg-bg p-2">
                  <p className="text-lg font-semibold tabular-nums">{templates.length}</p>
                  <p className="text-xs text-muted">Recurrentes</p>
                </div>
                <div className="rounded-xl bg-bg p-2">
                  <p className="text-lg font-semibold tabular-nums">{cap ? Math.round((occ / cap) * 100) : 0}%</p>
                  <p className="text-xs text-muted">Ocupación</p>
                </div>
              </div>
              {days.length > 0 && <p className="mt-3 text-xs text-muted">Da clase: {days.map((d) => WEEKDAYS_SHORT[d]).join(", ")}</p>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`mailto:${t.email}`} className="flex min-h-11 min-w-0 max-w-full items-center gap-1 text-muted hover:text-ink">
                  <Mail size={14} className="shrink-0" /> <span className="truncate">{t.email}</span>
                </a>
                {t.phone && (
                  <a href={`tel:${t.phone.replace(/\s/g, "")}`} className="flex min-h-11 items-center gap-1 text-muted hover:text-ink">
                    <Phone size={14} /> {t.phone}
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {form && <PersonFormModal key={form.key} open role="teacher" user={form.user} onClose={() => setForm(null)} />}
    </div>
  );
}
