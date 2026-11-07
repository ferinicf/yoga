"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Plus, Power } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import { occupied, sessionsOn } from "@/lib/rules";
import type { ClassTemplate } from "@/lib/types";
import { capitalize, cn, fmt, timeOf, WEEKDAYS, WEEKDAYS_SHORT, weekDays } from "@/lib/utils";
import { SessionCard } from "@/components/domain";
import { toastDone } from "@/components/toast";
import { Badge, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { ClassFormModal } from "@/components/admin/class-form";

export default function CalendarPage() {
  const db = useDB();
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const upsertTemplate = useStore((s) => s.upsertTemplate);
  const [tab, setTab] = useState<"week" | "recurring">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [day, setDay] = useState(new Date());
  const [form, setForm] = useState<{ open: boolean; template?: ClassTemplate; key: number }>({ open: false, key: 0 });

  const days = weekDays(anchor);
  const today = new Date();
  const openNew = (template?: ClassTemplate) => setForm({ open: true, template, key: form.key + 1 });

  const moveWeek = (n: number) => {
    const a = addDays(anchor, n * 7);
    setAnchor(a);
    setDay(weekDays(a)[0]);
  };

  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle="Clases de la semana y horario recurrente"
        actions={
          <Button onClick={() => openNew()}>
            <Plus size={18} /> Nueva clase
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "week", label: "Semana" },
            { value: "recurring", label: "Horario recurrente" },
          ]}
        />
      </div>

      {tab === "week" ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => moveWeek(-1)} aria-label="Semana anterior" className="h-11 w-11 px-0">
                <ChevronLeft size={18} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => moveWeek(1)} aria-label="Semana siguiente" className="h-11 w-11 px-0">
                <ChevronRight size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => {
                  setAnchor(new Date());
                  setDay(new Date());
                }}
              >
                Hoy
              </Button>
            </div>
            <p className="text-sm font-medium">
              {fmt(days[0], "d MMM")} – {fmt(days[6], "d MMM yyyy")}
            </p>
          </div>

          {/* Celular / iPad vertical: tira de días + lista */}
          <div className="lg:hidden">
            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
              {days.map((d) => {
                const sel = isSameDay(d, day);
                const n = sessionsOn(db, d).length;
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setDay(d)}
                    className={cn(
                      "flex min-w-14 flex-1 flex-col items-center rounded-2xl border px-1 py-2 transition",
                      sel ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface",
                    )}
                  >
                    <span className="text-xs">{WEEKDAYS_SHORT[d.getDay()]}</span>
                    <span className="text-lg font-semibold">{d.getDate()}</span>
                    <span className={cn("whitespace-nowrap text-[10px]", sel ? "opacity-80" : "text-muted")}>
                      {n} {n === 1 ? "clase" : "clases"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mb-2 text-sm font-medium text-muted">{capitalize(fmt(day, "EEEE d 'de' MMMM"))}</p>
            {sessionsOn(db, day, true).length === 0 ? (
              <Empty title="Sin clases este día" action={<Button variant="secondary" onClick={() => openNew()}>Agregar clase</Button>} />
            ) : (
              <div className="space-y-2">
                {sessionsOn(db, day, true).map((s) => (
                  <Link key={s.id} href={`/admin/clase?id=${encodeURIComponent(s.id)}`} className="block rounded-2xl transition hover:shadow-sm">
                    <SessionCard session={s} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Escritorio / iPad horizontal: rejilla de 7 columnas */}
          <div className="hidden grid-cols-7 gap-2 lg:grid">
            {days.map((d) => {
              const list = sessionsOn(db, d, true);
              const isToday = isSameDay(d, today);
              return (
                <div key={d.toISOString()} className="min-w-0">
                  <div className={cn("mb-2 rounded-xl px-2 py-1.5 text-center", isToday ? "bg-brand text-brand-ink" : "bg-surface")}>
                    <p className="text-xs">{WEEKDAYS_SHORT[d.getDay()]}</p>
                    <p className="text-lg font-semibold leading-tight">{d.getDate()}</p>
                  </div>
                  <div className="space-y-1.5">
                    {list.map((s) => {
                      const disc = db.disciplines.find((x) => x.id === s.disciplineId);
                      const t = db.users.find((x) => x.id === s.teacherId);
                      const occ = occupied(db, s.id);
                      const cancelled = s.status === "cancelled";
                      return (
                        <Link
                          key={s.id}
                          href={`/admin/clase?id=${encodeURIComponent(s.id)}`}
                          className={cn(
                            "block rounded-xl border-l-4 bg-surface p-2 text-xs shadow-sm ring-1 ring-line transition hover:ring-stone-300",
                            cancelled && "opacity-50 line-through",
                          )}
                          style={{ borderLeftColor: disc?.color }}
                        >
                          <p className="font-semibold tabular-nums">{timeOf(s.startsAt)}</p>
                          <p className="truncate font-medium">{disc?.name}</p>
                          <p className="truncate text-muted">{t?.name.split(" ")[0]}</p>
                          <p className={cn("mt-0.5 tabular-nums", occ >= s.capacity ? "font-semibold text-amber-700" : "text-muted")}>
                            {occ}/{s.capacity}
                          </p>
                        </Link>
                      );
                    })}
                    {list.length === 0 && <p className="py-4 text-center text-xs text-muted">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const list = db.templates
              .filter((t) => t.weekday === wd)
              .sort((a, b) => Number(b.active) - Number(a.active) || a.startTime.localeCompare(b.startTime));
            return (
              <Card key={wd} className="p-4">
                <h3 className="mb-2 font-semibold">{WEEKDAYS[wd]}</h3>
                {list.length === 0 && <p className="py-2 text-sm text-muted">Sin clases recurrentes.</p>}
                <ul className="divide-y divide-line">
                  {list.map((t) => {
                    const disc = db.disciplines.find((x) => x.id === t.disciplineId);
                    const teacher = db.users.find((x) => x.id === t.teacherId);
                    const room = db.rooms.find((x) => x.id === t.roomId);
                    return (
                      <li key={t.id} className={cn("flex items-center gap-3 py-2.5", !t.active && "opacity-50")}>
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: disc?.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <span className="tabular-nums">{t.startTime}</span> · {disc?.name}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {teacher?.name} · {room?.name} · {t.capacity} {t.capacity === 1 ? "lugar" : "lugares"}
                          </p>
                        </div>
                        {!t.active && <Badge>Inactiva</Badge>}
                        <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5" onClick={() => openNew(t)} aria-label="Editar">
                          <Pencil size={16} />
                        </button>
                        <button
                          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"
                          aria-label={t.active ? "Desactivar" : "Activar"}
                          onClick={() => {
                            if (t.active) {
                              if (!confirm("¿Desactivar esta clase recurrente? Se quitan las clases futuras sin reservaciones.")) return;
                              toastDone(deleteTemplate(t.id), "Clase recurrente desactivada.");
                            } else {
                              toastDone(upsertTemplate({ ...t, active: true }), "Clase recurrente activada.");
                            }
                          }}
                        >
                          <Power size={16} className={t.active ? "text-red-600" : "text-emerald-600"} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {form.open && (
        <ClassFormModal
          key={form.key}
          open
          template={form.template}
          defaultDate={tab === "week" ? day : undefined}
          onClose={() => setForm({ ...form, open: false })}
        />
      )}
    </div>
  );
}
