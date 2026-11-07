/**
 * Pagos a profesores.
 *
 * Regla del estudio: cada profesor tiene su precio por alumno. Cada reservación que gastó
 * crédito en una clase suya (asistencia, falta con penalización, cancelación tardía o
 * reservación de una clase que ya pasó sin pase de lista) suma ese precio al "cobro" de la
 * clase. Del cobro, el profesor se lleva `teacherShare` % (70 por omisión) y el estudio el resto.
 * El precio y el % se congelan en cada clase (sessions.teacherRate / teacherShare), así que
 * cambiar el precio de un profesor no reescribe semanas pasadas.
 *
 * El modo real usa exactamente la misma regla en la función SQL teacher_balances()
 * (supabase/migrations/0006_pagos_profesores.sql).
 */
import { addDays, endOfDay, startOfWeek } from "date-fns";
import type { DB, Reservation, Session, Settings, TeacherPayout, User } from "./types";

export const DEFAULT_TEACHER_SHARE = 70;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** ¿Esta reservación gastó crédito en una clase que ya empezó? (= cuenta para el cobro). */
export function isChargeable(r: Reservation, session: Session, settings: Settings, now = new Date()): boolean {
  if (session.status === "cancelled") return false;
  if (new Date(session.startsAt) > now) return false;
  switch (r.status) {
    case "attended":
    case "booked":
      return true;
    case "no_show":
      return settings.noShowPenalty;
    case "cancelled":
      return !!r.lateCancel;
    default:
      return false;
  }
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

export function classEarning(db: DB, session: Session, now = new Date()): ClassEarning {
  const { rate, share } = sessionTerms(db, session);
  const students = db.reservations.filter(
    (r) => r.sessionId === session.id && isChargeable(r, session, db.settings, now),
  ).length;
  const charge = round2(students * rate);
  const teacherAmount = round2((charge * share) / 100);
  return { session, students, rate, share, charge, teacherAmount, studioAmount: round2(charge - teacherAmount) };
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

export function totals(list: ClassEarning[]): EarningTotals {
  return list.reduce<EarningTotals>(
    (t, e) => ({
      classes: t.classes + 1,
      students: t.students + e.students,
      charge: round2(t.charge + e.charge),
      teacherAmount: round2(t.teacherAmount + e.teacherAmount),
      studioAmount: round2(t.studioAmount + e.studioAmount),
    }),
    { classes: 0, students: 0, charge: 0, teacherAmount: 0, studioAmount: 0 },
  );
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
  const earned = db.teacherBalances
    ? (db.teacherBalances.find((b) => b.teacherId === teacherId)?.earned ?? 0)
    : totals(classEarnings(db, { teacherId, from: new Date(0), to: now, now })).teacherAmount;
  const paid = round2(payoutsOf(db, teacherId).reduce((a, p) => a + p.amount, 0));
  return { earned: round2(earned), paid, owed: round2(earned - paid) };
}

export function teachers(db: DB): User[] {
  return db.users.filter((u) => u.role === "teacher");
}
