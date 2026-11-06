"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, CalendarPlus, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { creditsLeft, currentMemberships, sessionsOn } from "@/lib/rules";
import type { Reservation, Session } from "@/lib/types";
import { cn, fmt, longDay } from "@/lib/utils";
import { BookingSheet, ReservationStatusBadge, SessionCard } from "@/components/domain";
import { Badge, Button, Card, buttonClass, textLinkClass } from "@/components/ui";

export default function StudentHome() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [open, setOpen] = useState<Session | null>(null);
  const now = new Date();
  const firstName = user.name.trim().split(/\s+/)[0];

  const mems = currentMemberships(db, user.id, now);
  const active = mems.filter((m) => m.status === "active");
  const pending = mems.filter((m) => m.status === "pending_payment");
  const unlimited = active.some((m) => m.credits === null);
  const credits = active.reduce((a, m) => a + (m.credits === null ? 0 : creditsLeft(m)), 0);

  // Vencimiento: con varios paquetes, se aclara cuántos créditos vencen primero (y cada fila trae su fecha).
  const usable = active.filter((m) => creditsLeft(m) > 0);
  const soonest = usable[0];
  let expiry: string | null = null;
  if (soonest) {
    const date = fmt(soonest.expiresAt, "d 'de' MMMM");
    const n = creditsLeft(soonest);
    if (usable.length === 1) expiry = `Vence el ${date}`;
    else if (soonest.credits === null) expiry = `Tu ${soonest.planName} vence el ${date}`;
    else expiry = `${n} ${n === 1 ? "crédito vence" : "créditos vencen"} el ${date}`;
  }

  // Próximas clases: las tuyas y las de tus invitados, agrupadas por clase.
  const bySession = new Map<string, { own?: Reservation; guests: Reservation[] }>();
  for (const r of db.reservations) {
    // Toda reservación vigente cuenta (también con check-in anticipado); la fecha se filtra abajo.
    if (r.userId !== user.id || r.status === "cancelled") continue;
    const e = bySession.get(r.sessionId) ?? { guests: [] };
    if (r.guestName) e.guests.push(r);
    else e.own = r;
    bySession.set(r.sessionId, e);
  }
  const upcoming = [...bySession.entries()]
    .map(([id, e]) => ({ ...e, s: db.sessions.find((s) => s.id === id)! }))
    .filter(({ s }) => s && new Date(s.startsAt) > now && s.status !== "cancelled")
    .sort((a, b) => +new Date(a.s.startsAt) - +new Date(b.s.startsAt));

  const todayLeft = sessionsOn(db, now).filter((s) => new Date(s.startsAt) > now);
  // Completadas: con asistencia y que ya empezaron (un check-in anticipado aún no cuenta).
  const attended = db.reservations.filter((r) => {
    if (r.userId !== user.id || r.status !== "attended" || r.guestName) return false;
    const s = db.sessions.find((x) => x.id === r.sessionId);
    return !!s && new Date(s.startsAt) <= now;
  }).length;

  // Datos del estudio: solo se muestra lo que esté configurado.
  const address = (db.settings.address ?? "").trim();
  const wa = (db.settings.whatsapp ?? "").replace(/\D/g, "");
  const waLink = wa ? `https://wa.me/${wa.length === 10 ? `52${wa}` : wa}` : null;
  const ig = (db.settings.instagram ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  const hasContact = !!address || !!waLink || !!ig;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{longDay(now)}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Hola{firstName ? `, ${firstName}` : ""} 👋</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="bg-brand p-5 text-brand-ink">
            <p className="text-sm opacity-90">Créditos disponibles</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{unlimited ? "Ilimitado" : credits}</p>
            {expiry && <p className="mt-2 text-sm opacity-90">{expiry}</p>}
          </div>
          <div className="space-y-2 p-4">
            {active.length === 0 && pending.length === 0 && (
              <p className="text-sm text-muted">No tienes un paquete vigente.</p>
            )}
            {active.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{m.planName}</span>
                  <span className="block text-xs text-muted">Vence el {fmt(m.expiresAt, "d 'de' MMMM")}</span>
                </span>
                <span className="shrink-0 text-muted">
                  {m.credits === null ? "Ilimitado" : `${creditsLeft(m)} de ${m.credits}`}
                </span>
              </div>
            ))}
            {pending.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{m.planName}</span>
                <Badge tone="amber">Pago pendiente en recepción</Badge>
              </div>
            ))}
            <Link href="/alumno/paquetes" className="flex min-h-10 w-fit items-center gap-1 text-sm font-medium text-brand-text">
              {active.length ? "Comprar más clases" : "Ver paquetes"} <ArrowRight size={16} />
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Tus próximas clases</p>
            <Link href="/alumno/reservas" className={cn(textLinkClass, "-mr-2 px-2 text-sm text-brand-text")}>
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
              {upcoming.slice(0, 3).map(({ own, guests, s }) => {
                const d = db.disciplines.find((x) => x.id === s.disciplineId);
                const names = guests.map((g) => g.guestName).join(", ");
                const detail = [
                  fmt(s.startsAt, "EEE d MMM · HH:mm"),
                  own?.spot && `lugar ${own.spot}`,
                  guests.length > 0 && (own ? `con ${names}` : `invitado/a: ${names}`),
                ]
                  .filter(Boolean)
                  .join(" · ");
                const shown = own ?? guests[0];
                return (
                  <li key={s.id}>
                    <button onClick={() => setOpen(s)} className="flex w-full items-center gap-3 rounded-xl bg-bg p-3 text-left">
                      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: d?.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d?.name}</span>
                        <span className="block text-xs text-muted">{detail}</span>
                      </span>
                      <ReservationStatusBadge status={shown.status} upcoming />
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
          <Link href="/alumno/horario" className={cn(textLinkClass, "-mr-2 px-2 text-sm text-brand-text")}>
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
            <p className="text-sm text-muted">{attended === 1 ? "clase completada" : "clases completadas"}</p>
          </div>
        </Card>
        {hasContact && (
          <Card className="space-y-2 p-5 text-sm">
            <p className="font-semibold">{db.settings.studioName}</p>
            {address && (
              <p className="flex items-start gap-2 text-muted">
                <MapPin size={16} className="mt-0.5 shrink-0" /> {address}
              </p>
            )}
            {(waLink || ig) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {waLink && (
                  <a href={waLink} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline", size: "sm" })}>
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
                {ig && (
                  <a
                    href={`https://instagram.com/${encodeURIComponent(ig)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    <AtSign size={16} /> Instagram
                  </a>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <BookingSheet
        session={open}
        user={user}
        onClose={() => setOpen(null)}
        onNeedPlan={(s) => router.push(`/alumno/paquetes?volver=${encodeURIComponent(s.id)}`)}
      />
    </div>
  );
}
