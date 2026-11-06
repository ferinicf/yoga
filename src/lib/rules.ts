/**
 * Reglas de negocio puras (sin estado). Basadas en lo que hacen las apps del
 * mercado: créditos con vigencia, límites por día/semana, ventana de reserva,
 * horas mínimas para cancelar, lista de espera y selección de lugar.
 */
import { addDays, endOfDay, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import type { DB, Membership, Reservation, Session, User } from "./types";
import { roomSpots } from "./utils";

export const OCCUPYING: Reservation["status"][] = ["booked", "attended", "no_show"];

export function creditsLeft(m: Membership): number {
  return m.credits === null ? Infinity : Math.max(0, m.credits - m.creditsUsed);
}

export function isMembershipUsable(m: Membership, at: Date, disciplineId?: string): boolean {
  if (m.status !== "active") return false;
  if (new Date(m.startsAt) > endOfDay(at)) return false;
  if (new Date(m.expiresAt) < at) return false;
  if (creditsLeft(m) <= 0) return false;
  if (disciplineId && m.disciplineIds.length > 0 && !m.disciplineIds.includes(disciplineId)) return false;
  return true;
}

/** Membresía a usar: la que vence primero (para no desperdiciar créditos). */
export function pickMembership(db: DB, userId: string, session: Session): Membership | undefined {
  const at = new Date(session.startsAt);
  return db.memberships
    .filter((m) => m.userId === userId && isMembershipUsable(m, at, session.disciplineId))
    .sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt))[0];
}

export function currentMemberships(db: DB, userId: string, now = new Date()): Membership[] {
  return db.memberships
    .filter((m) => m.userId === userId && m.status !== "cancelled" && new Date(m.expiresAt) >= now)
    .sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt));
}

export function totalCredits(db: DB, userId: string, now = new Date()): number {
  return currentMemberships(db, userId, now)
    .filter((m) => m.status === "active")
    .reduce((acc, m) => acc + creditsLeft(m), 0);
}

export function sessionReservations(db: DB, sessionId: string): Reservation[] {
  return db.reservations.filter((r) => r.sessionId === sessionId);
}

export function occupied(db: DB, sessionId: string): number {
  return db.reservations.filter((r) => r.sessionId === sessionId && OCCUPYING.includes(r.status)).length;
}

export function waitlist(db: DB, sessionId: string): Reservation[] {
  return db.reservations
    .filter((r) => r.sessionId === sessionId && r.status === "waitlist")
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

export function takenSpots(db: DB, sessionId: string): string[] {
  return db.reservations
    .filter((r) => r.sessionId === sessionId && OCCUPYING.includes(r.status) && r.spot)
    .map((r) => r.spot as string);
}

export function freeSpots(db: DB, session: Session): string[] {
  const room = db.rooms.find((r) => r.id === session.roomId);
  if (!room) return [];
  const taken = new Set(takenSpots(db, session.id));
  return roomSpots(room).filter((s) => !taken.has(s));
}

export function userReservation(db: DB, sessionId: string, userId: string): Reservation | undefined {
  return db.reservations.find(
    (r) => r.sessionId === sessionId && r.userId === userId && !r.guestName && r.status !== "cancelled",
  );
}

function countOwnBookings(db: DB, userId: string, from: Date, to: Date): number {
  return db.reservations.filter((r) => {
    if (r.userId !== userId || r.guestName) return false;
    if (!OCCUPYING.includes(r.status)) return false;
    const s = db.sessions.find((x) => x.id === r.sessionId);
    if (!s) return false;
    const d = new Date(s.startsAt);
    return d >= from && d <= to;
  }).length;
}

export type BookCheck =
  | { ok: true; full: boolean; membership: Membership }
  | { ok: false; reason: string; needsPlan?: boolean };

export function checkBooking(
  db: DB,
  user: User,
  session: Session,
  opts: { guest?: boolean; now?: Date; staff?: boolean } = {},
): BookCheck {
  const now = opts.now ?? new Date();
  const start = new Date(session.startsAt);
  const s = db.settings;

  if (session.status === "cancelled") return { ok: false, reason: "Esta clase fue cancelada." };
  if (!opts.staff && start <= now) return { ok: false, reason: "La clase ya comenzó." };
  if (!opts.staff && start > addDays(endOfDay(now), s.bookingWindowDays))
    return { ok: false, reason: `Solo puedes reservar con ${s.bookingWindowDays} días de anticipación.` };
  if (!opts.guest && userReservation(db, session.id, user.id))
    return { ok: false, reason: "Ya tienes un lugar en esta clase." };

  if (!opts.guest && !opts.staff) {
    if (s.dayLimit !== null) {
      const n = countOwnBookings(db, user.id, new Date(start.toDateString()), endOfDay(start));
      if (n >= s.dayLimit) return { ok: false, reason: `Límite de ${s.dayLimit} reservación(es) por día.` };
    }
    if (s.weekLimit !== null) {
      const n = countOwnBookings(
        db,
        user.id,
        startOfWeek(start, { weekStartsOn: 1 }),
        endOfWeek(start, { weekStartsOn: 1 }),
      );
      if (n >= s.weekLimit) return { ok: false, reason: `Límite de ${s.weekLimit} reservaciones por semana.` };
    }
  }

  const membership = pickMembership(db, user.id, session);
  if (!membership)
    return {
      ok: false,
      needsPlan: true,
      reason: "No tienes créditos vigentes para esta clase. Compra un paquete para reservar.",
    };

  const full = occupied(db, session.id) >= session.capacity;
  if (full && !s.waitlistEnabled) return { ok: false, reason: "La clase está llena." };
  return { ok: true, full, membership };
}

export function canCancelWithRefund(db: DB, session: Session, now = new Date()): boolean {
  const hours = (new Date(session.startsAt).getTime() - now.getTime()) / 36e5;
  return hours >= db.settings.cancelHours;
}

export function sessionsOn(db: DB, day: Date, includeCancelled = false): Session[] {
  return db.sessions
    .filter((s) => isSameDay(new Date(s.startsAt), day) && (includeCancelled || s.status !== "cancelled"))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

export function activeStudents(db: DB, now = new Date()): User[] {
  const ids = new Set(
    db.memberships
      .filter((m) => m.status === "active" && new Date(m.expiresAt) >= now)
      .map((m) => m.userId),
  );
  return db.users.filter((u) => u.role === "student" && ids.has(u.id));
}

export function couponDiscount(
  db: DB,
  code: string | undefined,
  subtotal: number,
): { discount: number; error?: string; couponId?: string } {
  if (!code) return { discount: 0 };
  const c = db.coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
  if (!c || !c.active) return { discount: 0, error: "Cupón no válido." };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { discount: 0, error: "El cupón ya venció." };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { discount: 0, error: "El cupón ya se agotó." };
  const d = c.kind === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return { discount: Math.min(d, subtotal), couponId: c.id };
}

export function planPurchases(db: DB, userId: string, planId: string): number {
  return db.memberships.filter((m) => m.userId === userId && m.planId === planId && m.status !== "cancelled")
    .length;
}
