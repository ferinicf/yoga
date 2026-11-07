/**
 * Pagos a profesores.
 *
 * Regla del estudio: cada profesor tiene su precio por alumno. Cada reservación que gastó
 * crédito en una clase suya (asistencia, falta con penalización, cancelación tardía o
 * reservación de una clase que ya pasó sin pase de lista) suma ese precio al "cobro" de la
 * clase. Del cobro, el profesor se lleva `teacherShare` % (70 por omisión) y el estudio el resto.
 * El precio y el % se congelan en cada clase (sessions.teacherRate / teacherShare), y cada falta
 * guarda si gastó el crédito al marcarla (Reservation.creditCharged), así que cambiar el precio,
 * el % o "Penalizar inasistencia" no reescribe semanas pasadas.
 *
 * Los montos se calculan en centavos enteros, con el mismo redondeo que `numeric` en Postgres
 * (medio centavo hacia arriba). El modo real usa exactamente la misma regla en la función SQL
 * teacher_balances() (supabase/migrations/0007_pagos_ajustes.sql), así que la suma de "Su parte"
 * de cada clase cuadra al centavo con el saldo que calcula la base.
 */
import { addDays, addMilliseconds, endOfDay, startOfWeek } from "date-fns";
import type { DB, Reservation, Session, Settings, TeacherPayout, User } from "./types";

export const DEFAULT_TEACHER_SHARE = 70;

/** Pesos → centavos enteros (los montos de la app tienen a lo más 2 decimales). */
export function toCents(n: number): number {
  return Math.round(n * 100);
}

/**
 * n / d redondeado al entero, con el medio lejos de cero, igual que round() de numeric en
 * Postgres. n y d enteros, d > 0. Sin pasar por decimales binarios (70.945 no se vuelve 70.94).
 */
function divRound(n: number, d: number): number {
  const q = Math.floor((Math.abs(n) * 2 + d) / (2 * d));
  return n < 0 ? -q : q;
}

/** Suma montos en pesos sin errores de centavos (0.1 + 0.2 = 0.3). */
export function sumMoney(values: number[]): number {
  return values.reduce((a, v) => a + toCents(v), 0) / 100;
}

/** ¿Esta reservación gastó crédito en una clase que ya empezó? (= cuenta para el cobro). */
export function isChargeable(r: Reservation, session: Session, settings: Settings, now = new Date()): boolean {
  if (session.status === "cancelled") return false;
  if (new Date(session.startsAt) > now) return false;
  switch (r.status) {
    case "attended":
    case "booked":
      return true;
    case "no_show":
      // Lo que se decidió al marcar la falta; la configuración actual solo para datos viejos.
      return r.creditCharged ?? settings.noShowPenalty;
    case "cancelled":
      return !!r.lateCancel;
    default:
      return false;
  }
}

/**
 * Qué reservaciones cuentan para el cobro (mismo criterio que isChargeable), para las notas
 * al pie de las pantallas de pagos. Ej.: "Cuenta cada alumno que {chargeableText(settings)}."
 */
export function chargeableText(settings: Settings): string {
  return settings.noShowPenalty
    ? "asistió, reservó sin pase de lista, faltó o canceló tarde"
    : "asistió, reservó sin pase de lista o canceló tarde (las faltas solo si se marcaron cuando se penalizaban)";
}

/** Precio por alumno y % del profesor que aplican a una clase. */
export function sessionTerms(db: DB, session: Session): { rate: number; share: number } {
  const teacher = db.users.find((u) => u.id === session.teacherId);
  return {
    rate: session.teacherRate ?? teacher?.rate ?? 0,
    share: session.teacherShare ?? db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE,
  };
}

export interface ClassEarning {
  session: Session;
  /** Reservaciones que gastaron crédito (incluye invitados). */
  students: number;
  rate: number;
  share: number;
  /** students × rate */
  charge: number;
  teacherAmount: number;
  studioAmount: number;
}

/**
 * Cobro de una clase en centavos: cobro = alumnos × precio; parte del profesor =
 * round(cobro × % / 100) con el medio centavo hacia arriba (igual que teacher_balances).
 */
export function classEarning(db: DB, session: Session, now = new Date()): ClassEarning {
  const { rate, share } = sessionTerms(db, session);
  const students = db.reservations.filter(
    (r) => r.sessionId === session.id && isChargeable(r, session, db.settings, now),
  ).length;
  const chargeCents = students * toCents(rate);
  // El % tiene a lo más 2 decimales (numeric(5,2)): se trabaja en centésimas de punto.
  const teacherCents = divRound(chargeCents * Math.round(share * 100), 10000);
  return {
    session,
    students,
    rate,
    share,
    charge: chargeCents / 100,
    teacherAmount: teacherCents / 100,
    studioAmount: (chargeCents - teacherCents) / 100,
  };
}

/** Clases ya empezadas de un profesor (o de todos) entre dos fechas, con su cobro. */
export function classEarnings(
  db: DB,
  opts: { teacherId?: string; from: Date; to: Date; now?: Date },
): ClassEarning[] {
  const now = opts.now ?? new Date();
  return db.sessions
    .filter((s) => {
      const t = new Date(s.startsAt);
      return (
        (!opts.teacherId || s.teacherId === opts.teacherId) &&
        s.status !== "cancelled" &&
        t >= opts.from &&
        t <= opts.to &&
        t <= now
      );
    })
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map((s) => classEarning(db, s, now));
}

export interface EarningTotals {
  classes: number;
  students: number;
  charge: number;
  teacherAmount: number;
  studioAmount: number;
}

/** Suma de varias clases (en centavos enteros: la suma cuadra con cada "Su parte"). */
export function totals(list: ClassEarning[]): EarningTotals {
  let students = 0;
  let charge = 0;
  let teacher = 0;
  for (const e of list) {
    students += e.students;
    charge += toCents(e.charge);
    teacher += toCents(e.teacherAmount);
  }
  return {
    classes: list.length,
    students,
    charge: charge / 100,
    teacherAmount: teacher / 100,
    studioAmount: (charge - teacher) / 100,
  };
}

/** Semana de pago: lunes 00:00 a domingo 23:59 (se paga el domingo). */
export function payWeek(d: Date): { start: Date; end: Date } {
  const start = startOfWeek(d, { weekStartsOn: 1 });
  return { start, end: endOfDay(addDays(start, 6)) };
}

export function payoutsOf(db: DB, teacherId: string): TeacherPayout[] {
  return db.payouts
    .filter((p) => p.teacherId === teacherId)
    .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
}

export interface Balance {
  /** Lo que le toca al profesor por todas sus clases ya dadas. */
  earned: number;
  /** Lo que la administración ya le pagó. */
  paid: number;
  /** Lo que la administración le debe (earned − paid). */
  owed: number;
}

/**
 * Saldo histórico de un profesor. En modo real lo calcula la base (teacher_balances) porque
 * la app solo descarga los últimos meses de clases; en demo se calcula con todos los datos.
 */
export function teacherBalance(db: DB, teacherId: string, now = new Date()): Balance {
  const earned = toCents(
    db.teacherBalances
      ? (db.teacherBalances.find((b) => b.teacherId === teacherId)?.earned ?? 0)
      : totals(classEarnings(db, { teacherId, from: new Date(0), to: now, now })).teacherAmount,
  );
  const paid = payoutsOf(db, teacherId).reduce((a, p) => a + toCents(p.amount), 0);
  return { earned: earned / 100, paid: paid / 100, owed: (earned - paid) / 100 };
}

/* ---------- Estado de pago de una semana ---------- */

/**
 * - pagada: lo que se le ha pagado ya cubre esta semana.
 * - parcial: se cubrió una parte; falta `pending`.
 * - pendiente: no se ha cubierto nada de esta semana.
 * - en_curso: es la semana actual (aún se suman clases hasta el domingo).
 * - sin_cobro: semana ya terminada (o futura) en la que no le tocó nada.
 */
export type WeekPayStatus = "pagada" | "parcial" | "pendiente" | "en_curso" | "sin_cobro";

export interface WeekPay {
  /** Parte del profesor en esa semana (clases ya empezadas). */
  earned: number;
  status: WeekPayStatus;
  /** Lo que falta pagarle de esa semana (0 si ya está cubierta). */
  pending: number;
}

/**
 * Estado de pago de una semana sin depender de `periodEnd` (un pago puede cubrir varias
 * semanas). Los pagos cubren primero las semanas más antiguas: lo que se debe hoy menos lo
 * ganado en las semanas POSTERIORES es lo que queda sin pagar hasta esta semana (owedAfter).
 *  - owedAfter ≤ 0 → pagada · owedAfter < ganado → parcial (falta owedAfter) · si no, pendiente.
 * En modo real la semana debe estar entre las clases descargadas (últimos 120 días).
 */
export function weekPayStatus(db: DB, teacherId: string, weekStart: Date, now = new Date()): WeekPay {
  const week = payWeek(weekStart);
  if (week.start > now) return { earned: 0, status: "sin_cobro", pending: 0 };
  const earned = toCents(totals(classEarnings(db, { teacherId, from: week.start, to: week.end, now })).teacherAmount);
  const later =
    week.end < now
      ? toCents(totals(classEarnings(db, { teacherId, from: addMilliseconds(week.end, 1), to: now, now })).teacherAmount)
      : 0;
  const owedAfter = toCents(teacherBalance(db, teacherId, now).owed) - later;
  const pending = Math.max(0, Math.min(earned, owedAfter));
  const status: WeekPayStatus =
    +week.start === +payWeek(now).start
      ? "en_curso"
      : earned <= 0
        ? "sin_cobro"
        : owedAfter <= 0
          ? "pagada"
          : owedAfter < earned
            ? "parcial"
            : "pendiente";
  return { earned: earned / 100, status, pending: pending / 100 };
}

/**
 * Precio por alumno con el que se calculó una semana: el congelado en sus clases ya
 * empezadas; null si en la semana hubo más de un precio (cambió a media semana); el precio
 * actual del profesor si no dio clases (0 si no tiene precio).
 */
export function weekRate(db: DB, teacherId: string, weekStart: Date, now = new Date()): number | null {
  const { start, end } = payWeek(weekStart);
  const rates = [...new Set(classEarnings(db, { teacherId, from: start, to: end, now }).map((c) => c.rate))];
  if (rates.length === 0) return db.users.find((u) => u.id === teacherId)?.rate ?? 0;
  return rates.length === 1 ? rates[0] : null;
}

/**
 * ¿El profesor ya tiene precio por alumno? Vacío o 0 = sin definir (en modo real todo profesor
 * tiene fila en teacher_rates, con 0 hasta que el admin define su precio).
 */
export function hasRate(u: Pick<User, "rate">): boolean {
  return (u.rate ?? 0) > 0;
}

export function teachers(db: DB): User[] {
  return db.users.filter((u) => u.role === "teacher");
}
