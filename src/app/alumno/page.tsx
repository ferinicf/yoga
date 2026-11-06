"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, CalendarPlus, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { creditsLeft, currentMemberships, sessionsOn } from "@/lib/rules";
import type { Session } from "@/lib/types";
import { fmt, longDay } from "@/lib/utils";
import { BookingSheet, SessionCard } from "@/components/domain";
import { Badge, Button, Card } from "@/components/ui";

export default function StudentHome() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [open, setOpen] = useState<Session | null>(null);
  const now = new Date();

  const mems = currentMemberships(db, user.id, now);
  const active = mems.filter((m) => m.status === "active");
  const pending = mems.filter((m) => m.status === "pending_payment");
  const unlimited = active.some((m) => m.credits === null);
  const credits = active.reduce((a, m) => a + (m.credits === null ? 0 : creditsLeft(m)), 0);

  const upcoming = db.reservations
    .filter((r) => r.userId === user.id && !r.guestName && (r.status === "booked" || r.status === "waitlist"))
    .map((r) => ({ r, s: db.sessions.find((s) => s.id === r.sessionId)! }))
    .filter(({ s }) => s && new Date(s.startsAt) > now && s.status !== "cancelled")
    .sort((a, b) => +new Date(a.s.startsAt) - +new Date(b.s.startsAt));

  const todayLeft = sessionsOn(db, now).filter((s) => new Date(s.startsAt) > now);
  const attended = db.reservations.filter((r) => r.userId === user.id && r.status === "attended" && !r.guestName).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{longDay(now)}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Hola, {user.name.split(" ")[0]} 👋</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="bg-brand p-5 text-brand-ink">
            <p className="text-sm opacity-90">Créditos disponibles</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{unlimited ? "Ilimitado" : credits}</p>
            {active[0] && <p className="mt-2 text-sm opacity-90">Vence el {fmt(active[0].expiresAt, "d 'de' MMMM")}</p>}
          </div>
          <div className="space-y-2 p-4">
            {active.length === 0 && pending.length === 0 && (
              <p className="text-sm text-muted">No tienes un paquete vigente.</p>
            )}
            {active.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.planName}</span>
                <span className="text-muted">
                  {m.credits === null ? "Ilimitado" : `${creditsLeft(m)} de ${m.credits}`}
                </span>
              </div>
            ))}
            {pending.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.planName}</span>
                <Badge tone="amber">Pago pendiente en recepción</Badge>
              </div>
            ))}
            <Link href="/alumno/paquetes" className="flex items-center gap-1 pt-1 text-sm font-medium text-brand">
              {active.length ? "Comprar más clases" : "Ver paquetes"} <ArrowRight size={16} />
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Tus próximas clases</p>
            <Link href="/alumno/reservas" className="text-sm text-brand">
              Ver todas
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted">No tienes clases reservadas.</p>
              <Button className="mt-3" onClick={() => router.push("/alumno/horario")}>
                <CalendarPlus size={18} /> Reservar clase
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 3).map(({ r, s }) => {
                const d = db.disciplines.find((x) => x.id === s.disciplineId);
                return (
                  <li key={r.id}>
                    <button onClick={() => setOpen(s)} className="flex w-full items-center gap-3 rounded-xl bg-bg p-3 text-left">
                      <span className="h-10 w-1 rounded-full" style={{ background: d?.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d?.name}</span>
                        <span className="block text-xs text-muted">
                          {fmt(s.startsAt, "EEE d MMM · HH:mm")}
                          {r.spot && ` · lugar ${r.spot}`}
                        </span>
                      </span>
                      {r.status === "waitlist" ? <Badge tone="amber">En espera</Badge> : <Badge tone="green">Reservado</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Hoy en el estudio</h2>
          <Link href="/alumno/horario" className="text-sm text-brand">
            Horario completo
          </Link>
        </div>
        {todayLeft.length === 0 ? (
          <p className="text-sm text-muted">Ya no hay más clases hoy. ¡Nos vemos mañana!</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {todayLeft.slice(0, 6).map((s) => (
              <SessionCard key={s.id} session={s} onClick={() => setOpen(s)} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
            <Sparkles size={22} />
          </span>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{attended}</p>
            <p className="text-sm text-muted">clases completadas</p>
          </div>
        </Card>
        <Card className="space-y-2 p-5 text-sm">
          <p className="font-semibold">{db.settings.studioName}</p>
          <p className="flex items-center gap-2 text-muted">
            <MapPin size={16} /> {db.settings.address}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={`https://wa.me/52${db.settings.whatsapp}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <MessageCircle size={16} /> WhatsApp
              </Button>
            </a>
            <a href={`https://instagram.com/${db.settings.instagram}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <AtSign size={16} /> Instagram
              </Button>
            </a>
          </div>
        </Card>
      </div>

      <BookingSheet session={open} user={user} onClose={() => setOpen(null)} onNeedPlan={() => router.push("/alumno/paquetes")} />
    </div>
  );
}
