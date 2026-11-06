"use client";

import { useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import { Mail, Pencil, Phone, Plus } from "lucide-react";
import { useDB } from "@/lib/store";
import { occupied } from "@/lib/rules";
import type { User } from "@/lib/types";
import { WEEKDAYS_SHORT } from "@/lib/utils";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import { PersonFormModal } from "@/components/admin/person-form";

export default function TeachersPage() {
  const db = useDB();
  const [form, setForm] = useState<{ key: number; user?: User } | null>(null);
  const now = new Date();
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });

  const teachers = db.users
    .filter((u) => u.role === "teacher")
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Profesores"
        subtitle="Equipo de instructores y su carga semanal"
        actions={
          <Button onClick={() => setForm({ key: Date.now() })}>
            <Plus size={18} /> Nuevo profesor
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teachers.map((t) => {
          const templates = db.templates.filter((x) => x.teacherId === t.id && x.active);
          const week = db.sessions.filter(
            (s) => s.teacherId === t.id && s.status === "scheduled" && new Date(s.startsAt) >= ws && new Date(s.startsAt) <= we,
          );
          const cap = week.reduce((a, s) => a + s.capacity, 0);
          const occ = week.reduce((a, s) => a + occupied(db, s.id), 0);
          const days = [...new Set(templates.map((x) => x.weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
          const disciplines = [...new Set(templates.map((x) => x.disciplineId))]
            .map((id) => db.disciplines.find((d) => d.id === id))
            .filter(Boolean);
          return (
            <Card key={t.id} className={t.active ? "p-4" : "p-4 opacity-60"}>
              <div className="flex items-start gap-3">
                <Avatar name={t.name} color={t.color} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
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
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
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
                <a href={`mailto:${t.email}`} className="flex min-h-11 items-center gap-1 text-muted hover:text-ink">
                  <Mail size={14} /> {t.email}
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
