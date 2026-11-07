"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSameDay, startOfDay } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { occupied, sessionsOn, userReservation } from "@/lib/rules";
import type { DB, Session } from "@/lib/types";
import { cn, longDay } from "@/lib/utils";
import { BookingSheet, ReservationStatusBadge, SessionCard } from "@/components/domain";
import { DayStrip } from "@/components/day-strip";
import { Badge, Button, Empty, PageHeader } from "@/components/ui";

export default function SchedulePage() {
  // useSearchParams necesita un límite de Suspense en las páginas prerenderizadas.
  return (
    <Suspense>
      <Schedule />
    </Suspense>
  );
}

/** Clase que se abre al llegar, p. ej. al volver de comprar un paquete: /alumno/horario?clase=<id>. */
function sessionById(db: DB, id: string | null): Session | null {
  return (id && db.sessions.find((s) => s.id === id)) || null;
}

function Schedule() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const params = useSearchParams();
  const linked = params.get("clase");
  const [open, setOpen] = useState<Session | null>(() => sessionById(db, linked));
  const [day, setDay] = useState(() => startOfDay(open ? new Date(open.startsAt) : new Date()));
  const [disc, setDisc] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<string | null>(null);
  const now = new Date();

  // Ya abierta la clase, se limpia la dirección (para que recargar no la vuelva a abrir).
  useEffect(() => {
    if (linked) router.replace("/alumno/horario", { scroll: false });
  }, [linked, router]);

  const sessions = sessionsOn(db, day).filter(
    (s) => (!disc || s.disciplineId === disc) && (!teacher || s.teacherId === teacher),
  );
  const teachers = db.users.filter((u) => u.role === "teacher" && u.active);
  const filtered = !!disc || !!teacher;
  const clearFilters = () => {
    setDisc(null);
    setTeacher(null);
  };
  // Días marcados: tienes reservación (tuya o de un invitado tuyo).
  const myDays = (d: Date) =>
    db.reservations.some((r) => {
      if (r.userId !== user.id || r.status === "cancelled") return false;
      const s = db.sessions.find((x) => x.id === r.sessionId);
      return !!s && isSameDay(new Date(s.startsAt), d);
    });
  const guestsIn = (sessionId: string) =>
    db.reservations.filter((r) => r.sessionId === sessionId && r.userId === user.id && !!r.guestName && r.status !== "cancelled").length;

  const chip = (active: boolean) =>
    cn(
      "h-10 shrink-0 rounded-full border px-4 text-sm transition",
      active ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink",
    );

  return (
    <div>
      <PageHeader title="Horario" subtitle="Elige una clase para reservar tu lugar." />
      <DayStrip value={day} onChange={setDay} from={now} days={db.settings.bookingWindowDays + 1} marks={myDays} />

      {/*
        Celular: el filtro de profesor va en su propia fila (siempre visible) y los chips de disciplina
        se deslizan abajo. iPad/escritorio: todo en una fila que se acomoda (el select al final).
      */}
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <select
          value={teacher ?? ""}
          onChange={(e) => setTeacher(e.target.value || null)}
          className={cn(
            "h-11 w-full rounded-full border bg-surface px-4 text-[16px] md:order-last md:h-10 md:w-auto md:text-sm",
            teacher ? "border-ink font-medium text-ink" : "border-line text-muted",
          )}
          aria-label="Filtrar por profesor"
        >
          <option value="">Todos los profesores</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:contents">
          <button className={chip(!disc)} onClick={() => setDisc(null)} aria-pressed={!disc}>
            Todas
          </button>
          {db.disciplines
            .filter((d) => d.active)
            .map((d) => (
              <button
                key={d.id}
                className={chip(disc === d.id)}
                onClick={() => setDisc(disc === d.id ? null : d.id)}
                aria-pressed={disc === d.id}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </button>
            ))}
        </div>
      </div>

      <h2 className="mb-3 mt-6 font-semibold">{longDay(day)}</h2>
      {sessions.length === 0 ? (
        <Empty
          icon={<CalendarX2 size={32} />}
          title={filtered ? "No hay clases con estos filtros" : "No hay clases este día"}
          text={filtered ? "Prueba con otro día o quita los filtros." : "Prueba con otro día."}
          action={
            filtered && (
              <Button variant="outline" onClick={clearFilters}>
                Quitar filtros
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const mine = userReservation(db, s.id, user.id);
            // "past" = ya empezó (ya no se reserva); "ended" = ya terminó.
            const past = new Date(s.startsAt) <= now;
            const ended = new Date(s.startsAt).getTime() + s.durationMin * 60000 <= now.getTime();
            const full = occupied(db, s.id) >= s.capacity;
            const guests = guestsIn(s.id);
            let badge;
            if (past && mine?.status === "attended") badge = <Badge tone="green">Asististe</Badge>;
            else if (past && mine?.status === "no_show") badge = <Badge tone="red">Faltaste</Badge>;
            else if (ended) badge = <Badge>Terminó</Badge>;
            else if (past) badge = <Badge tone="amber">En curso</Badge>;
            // Mismo badge (y color) que en Inicio y Mis reservaciones; un check-in anticipado no es "Asististe".
            else if (mine) badge = <ReservationStatusBadge status={mine.status} upcoming />;
            else if (full) badge = <Badge tone="amber">Lleno</Badge>;
            else badge = <span className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-ink">Reservar</span>;
            const right =
              !past && guests > 0 ? (
                <div className="flex flex-col items-end gap-1.5">
                  {badge}
                  <Badge tone="brand">{guests === 1 ? "+1 invitado/a" : `+${guests} invitados`}</Badge>
                </div>
              ) : (
                badge
              );
            return <SessionCard key={s.id} session={s} onClick={past ? undefined : () => setOpen(s)} right={right} />;
          })}
        </div>
      )}

      <BookingSheet
        session={open}
        user={user}
        onClose={() => setOpen(null)}
        onNeedPlan={(s) => router.push(`/alumno/paquetes?volver=${encodeURIComponent(s.id)}`)}
      />
    </div>
  );
}
