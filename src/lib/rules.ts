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

/**
 * Membresía a usar: la que vence primero (para no desperdiciar créditos).
 * Para un invitado solo sirven paquetes con créditos (el ilimitado es personal).
 */
export function pickMembership(
  db: DB,
  userId: string,
  session: Session,
  opts: { guest?: boolean } = {},
): Membership | undefined {
  const at = new Date(session.startsAt);
  return db.memberships
    .filter(
      (m) =>
        m.userId === userId && isMembershipUsable(m, at, session.disciplineId) && (!opts.guest || m.credits !== null),
    )
    .sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt))[0];
}

/** Paquete apartado que espera su pago en recepción y que cubriría esta clase. */
export function pendingMembership(db: DB, userId: string, session: Session): Membership | undefined {
  return db.memberships
    .filter(
      (m) =>
        m.userId === userId &&
        m.status === "pending_payment" &&
        (m.disciplineIds.length === 0 || m.disciplineIds.includes(session.disciplineId)),
    )
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
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

/** Invitados (no cancelados) que un alumno trae a una clase. */
export function userGuests(db: DB, sessionId: string, userId: string): Reservation[] {
  return db.reservations.filter(
    (r) => r.sessionId === sessionId && r.userId === userId && !!r.guestName && r.status !== "cancelled",
  );
}

/** Máximo de invitados por alumno en una misma clase. */
export const MAX_GUESTS_PER_CLASS = 1;
/** El check-in y el pase de lista se abren estos minutos antes de la clase. */
export const ATTENDANCE_OPENS_MIN = 60;

/** "Laura  gómez " → "laura gómez" (para comparar nombres de invitados). */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  | {
      ok: false;
      reason: string;
      /** No tiene paquete: se le puede ofrecer comprar uno. */
      needsPlan?: boolean;
      /** Tiene un paquete apartado esperando su pago en recepción. */
      pending?: boolean;
      /** Regla propia de invitados (ilimitado, tope por clase, nombre repetido). */
      guestRule?: boolean;
    };

/**
 * Valida una reservación. Debe coincidir con `book_session` en la base (modo real).
 *  - guest / guestName: reservación para un invitado (guestName undefined = solo consultar).
 *  - staff: el personal reserva por un alumno (sin límites; mensajes en tercera persona).
 */
export function checkBooking(
  db: DB,
  user: User,
  session: Session,
  opts: { guest?: boolean; guestName?: string; now?: Date; staff?: boolean } = {},
): BookCheck {
  const now = opts.now ?? new Date();
  const start = new Date(session.startsAt);
  const s = db.settings;
  const guest = !!opts.guest || opts.guestName !== undefined;

  if (session.status === "cancelled") return { ok: false, reason: "Esta clase fue cancelada." };
  if (!opts.staff && start <= now) return { ok: false, reason: "La clase ya comenzó." };
  if (!opts.staff && start > addDays(endOfDay(now), s.bookingWindowDays))
    return { ok: false, reason: `Solo puedes reservar con ${s.bookingWindowDays} días de anticipación.` };

  if (guest) {
    // Los límites por día/semana y "ya tienes lugar" son solo para el alumno, no para su invitado.
    if (!s.allowGuests) return { ok: false, reason: "El estudio no permite invitados." };
    const name = opts.guestName !== undefined ? normalizeName(opts.guestName) : undefined;
    if (name !== undefined && !name) return { ok: false, reason: "Escribe el nombre de tu invitado/a." };
    if (name !== undefined && name.length > 60)
      return { ok: false, reason: "El nombre de tu invitado/a es demasiado largo." };
    if (userGuests(db, session.id, user.id).length >= MAX_GUESTS_PER_CLASS)
      return {
        ok: false,
        guestRule: true,
        reason: `Ya tienes un invitado/a en esta clase. Solo puedes traer a ${plural(MAX_GUESTS_PER_CLASS, "persona", "personas")} por clase.`,
      };
    if (
      name &&
      db.reservations.some(
        (r) =>
          r.sessionId === session.id && r.guestName && r.status !== "cancelled" && normalizeName(r.guestName) === name,
      )
    )
      return { ok: false, guestRule: true, reason: "Ya hay un invitado/a con ese nombre en esta clase." };
  } else {
    if (userReservation(db, session.id, user.id))
      return {
        ok: false,
        reason: opts.staff ? `${user.name} ya tiene lugar en esta clase.` : "Ya tienes un lugar en esta clase.",
      };
    if (!opts.staff) {
      if (s.dayLimit !== null) {
        const n = countOwnBookings(db, user.id, new Date(start.toDateString()), endOfDay(start));
        if (n >= s.dayLimit)
          return {
            ok: false,
            reason: `Llegaste al límite de ${plural(s.dayLimit, "reservación", "reservaciones")} por día.`,
          };
      }
      if (s.weekLimit !== null) {
        const n = countOwnBookings(
          db,
          user.id,
          startOfWeek(start, { weekStartsOn: 1 }),
          endOfWeek(start, { weekStartsOn: 1 }),
        );
        if (n >= s.weekLimit)
          return {
            ok: false,
            reason: `Llegaste al límite de ${plural(s.weekLimit, "reservación", "reservaciones")} por semana.`,
          };
      }
    }
  }

  const membership = pickMembership(db, user.id, session, { guest });
  if (!membership) {
    if (guest && pickMembership(db, user.id, session))
      return {
        ok: false,
        guestRule: true,
        reason: "Tu paquete ilimitado no incluye invitados. Para traer a alguien necesitas un paquete con créditos.",
      };
    const pending = pendingMembership(db, user.id, session);
    if (pending)
      return {
        ok: false,
        pending: true,
        reason: opts.staff
          ? `${user.name} no tiene créditos activos: su ${pending.planName} está pendiente de pago.`
          : `Tu ${pending.planName} está pendiente de pago en recepción. Podrás reservar en cuanto el estudio confirme tu pago.`,
      };
    return opts.staff
      ? { ok: false, reason: `${user.name} no tiene créditos vigentes para esta clase.` }
      : {
          ok: false,
          needsPlan: true,
          reason: "No tienes créditos vigentes para esta clase. Compra un paquete para reservar.",
        };
  }

  const full = occupied(db, session.id) >= session.capacity;
  if (full && !s.waitlistEnabled) return { ok: false, reason: "La clase está llena." };
  return { ok: true, full, membership };
}

export function canCancelWithRefund(db: DB, session: Session, now = new Date()): boolean {
  const hours = (new Date(session.startsAt).getTime() - now.getTime()) / 36e5;
  return hours >= db.settings.cancelHours;
}

/** Mensaje al cancelar. Debe coincidir con `cancel_reservation` en la base (modo real). */
export function cancelMessage(p: {
  /** Lo cancela el personal: se habla del alumno en tercera persona. */
  staff?: boolean;
  waitlist: boolean;
  refund: boolean;
  /** La reservación descontó un crédito (no ilimitado). */
  usesCredit: boolean;
  guestName?: string;
  ownerName: string;
  cancelHours: number;
}): string {
  const who = p.guestName ?? p.ownerName;
  const third = p.staff || !!p.guestName;
  if (p.waitlist) return third ? `${who} salió de la lista de espera.` : "Saliste de la lista de espera.";
  if (!p.usesCredit) return third ? `Se canceló la reservación de ${who}.` : "Reservación cancelada.";
  if (p.staff) {
    const head = p.guestName ? `Se canceló la reservación de ${p.guestName}.` : "Se canceló la reservación.";
    return p.refund
      ? `${head} Se devolvió el crédito a ${p.ownerName}.`
      : `${head} No se devolvió el crédito a ${p.ownerName} (cancelación tardía).`;
  }
  const head = p.guestName ? `Cancelamos la reservación de ${p.guestName}.` : "Reservación cancelada.";
  return p.refund
    ? `${head} Te devolvimos tu crédito.`
    : `${head} Como faltaban menos de ${p.cancelHours} h, no se devolvió el crédito.`;
}

/** Desde cuándo se puede hacer check-in y pasar lista. */
export function attendanceOpensAt(session: Session): Date {
  return new Date(new Date(session.startsAt).getTime() - ATTENDANCE_OPENS_MIN * 60_000);
}

/** ¿Se puede hacer check-in o marcar asistencia/falta? Debe coincidir con `set_attendance` en la base. */
export function checkAttendance(session: Session, now = new Date()): { ok: true } | { ok: false; reason: string } {
  if (session.status === "cancelled") return { ok: false, reason: "Esta clase fue cancelada." };
  if (now < attendanceOpensAt(session))
    return {
      ok: false,
      reason: `El check-in y el pase de lista se habilitan ${ATTENDANCE_OPENS_MIN} minutos antes de que empiece la clase.`,
    };
  return { ok: true };
}

/** Teléfono opcional: vacío o de 10 a 15 dígitos (con espacios, guiones, paréntesis o +). Igual que `_profile_error`. */
export function phoneError(phone: string): string | null {
  const v = phone.trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "").length;
  if (!/^[0-9 +()-]+$/.test(v) || digits < 10 || digits > 15)
    return "Escribe un teléfono válido: 10 dígitos (puedes usar espacios, guiones o +52).";
  return null;
}

/**
 * Datos de una persona antes de guardarlos (nombre, correo, teléfono y cumpleaños).
 * Debe coincidir con `_profile_error` en la base (update_my_profile y admin_save_profile).
 * `today` es la fecha local en formato yyyy-MM-dd.
 */
export function profileError(
  db: DB,
  u: Pick<User, "id" | "name" | "email" | "phone" | "birthday">,
  today: string,
): string | null {
  if (!u.name.trim()) return "El nombre no puede quedar vacío.";
  const mail = u.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(mail)) return "Escribe un correo válido.";
  if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === mail)) return "Ya existe una persona con ese correo.";
  const phone = phoneError(u.phone);
  if (phone) return phone;
  if (u.birthday && u.birthday > today) return "La fecha de cumpleaños no puede ser futura.";
  return null;
}

/** Paquete del mismo plan que el alumno ya apartó y aún no paga (no se aparta dos veces). */
export function pendingPurchase(db: DB, userId: string, planId: string): Membership | undefined {
  return db.memberships.find((m) => m.userId === userId && m.planId === planId && m.status === "pending_payment");
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
