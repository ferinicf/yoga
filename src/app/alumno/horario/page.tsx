"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isSameDay, startOfDay } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { occupied, sessionsOn, userReservation } from "@/lib/rules";
import type { Session } from "@/lib/types";
import { cn, longDay } from "@/lib/utils";
import { BookingSheet, SessionCard } from "@/components/domain";
import { DayStrip } from "@/components/day-strip";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default function SchedulePage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [day, setDay] = useState(startOfDay(new Date()));
  const [disc, setDisc] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<string | null>(null);
  const [open, setOpen] = useState<Session | null>(null);
  const now = new Date();

  const sessions = sessionsOn(db, day).filter(
    (s) => (!disc || s.disciplineId === disc) && (!teacher || s.teacherId === teacher),
  );
  const teachers = db.users.filter((u) => u.role === "teacher" && u.active);
  const myDays = (d: Date) =>
    db.reservations.some((r) => {
      if (r.userId !== user.id || r.guestName || (r.status !== "booked" && r.status !== "waitlist")) return false;
      const s = db.sessions.find((x) => x.id === r.sessionId);
      return !!s && isSameDay(new Date(s.startsAt), d);
    });

  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 rounded-full border px-3 text-sm transition",
      active ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink",
    );

  return (
    <div>
      <PageHeader title="Horario" subtitle="Elige una clase para reservar tu lugar." />
      <DayStrip value={day} onChange={setDay} from={now} days={db.settings.bookingWindowDays + 1} marks={myDays} />

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <button className={chip(!disc)} onClick={() => setDisc(null)}>
          Todas
        </button>
        {db.disciplines
          .filter((d) => d.active)
          .map((d) => (
            <button key={d.id} className={chip(disc === d.id)} onClick={() => setDisc(disc === d.id ? null : d.id)}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </button>
          ))}
        <select
          value={teacher ?? ""}
          onChange={(e) => setTeacher(e.target.value || null)}
          className="h-9 shrink-0 rounded-full border border-line bg-surface px-3 text-sm text-muted"
          aria-label="Filtrar por profesor"
        >
          <option value="">Todos los profesores</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <h2 className="mb-3 mt-6 font-semibold">{longDay(day)}</h2>
      {sessions.length === 0 ? (
        <Empty icon={<CalendarX2 size={32} />} title="No hay clases este día" text="Prueba con otro día o quita los filtros." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const mine = userReservation(db, s.id, user.id);
            const past = new Date(s.startsAt) <= now;
            const full = occupied(db, s.id) >= s.capacity;
            let badge;
            if (mine?.status === "attended") badge = <Badge tone="green">Asististe</Badge>;
            else if (past && mine?.status === "no_show") badge = <Badge tone="red">Faltaste</Badge>;
            else if (past) badge = <Badge>Terminó</Badge>;
            else if (mine?.status === "booked") badge = <Badge tone="green">Reservado</Badge>;
            else if (mine?.status === "waitlist") badge = <Badge tone="amber">En espera</Badge>;
            else if (full) badge = <Badge tone="amber">Lleno</Badge>;
            else badge = <span className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-ink">Reservar</span>;
            return <SessionCard key={s.id} session={s} onClick={past ? undefined : () => setOpen(s)} right={badge} />;
          })}
        </div>
      )}

      <BookingSheet session={open} user={user} onClose={() => setOpen(null)} onNeedPlan={() => router.push("/alumno/paquetes")} />
    </div>
  );
}
