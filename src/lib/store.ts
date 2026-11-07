"use client";

/**
 * Estado de la app. Dos modos:
 *  - "live": datos reales en Supabase (ver src/lib/live.ts y supabase/migrations).
 *  - "demo": datos de ejemplo guardados solo en este navegador.
 * Las pantallas llaman a las mismas acciones en ambos modos.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addDays, format, subDays } from "date-fns";
import type {
  ClassTemplate,
  Coupon,
  DB,
  Discipline,
  PaymentMethod,
  Plan,
  Reservation,
  Room,
  Session,
  Settings,
  User,
} from "./types";
import { createSeed, DB_VERSION, generateSessionsForTemplates } from "./seed";
import {
  cancelMessage,
  canCancelWithRefund,
  checkAttendance,
  checkBooking,
  couponDiscount,
  freeSpots,
  isClassStaff,
  occupied,
  OCCUPYING,
  pendingPurchase,
  pickMembership,
  planPurchases,
  profileError,
  waitlist,
} from "./rules";
import { roomSpots, uid } from "./utils";
import { live, loadAll } from "./live";
import { supabase } from "./supabase";

export type { Result } from "./live";
import type { Result } from "./live";

type Res = Result;

/** Acciones del modo demo (síncronas, sobre los datos locales). */
interface DemoActions {
  /**
   * `staff` se ignora (se conserva por compatibilidad): igual que book_session, quién es
   * personal de la clase se deduce de la persona en sesión (admin, o el profesor de ESA clase).
   */
  book: (sessionId: string, userId: string, opts?: { spot?: string; guestName?: string; staff?: boolean }) => Res;
  /** `refund` solo lo decide el personal de la clase; `staff` se ignora (se deduce de la sesión). */
  cancelReservation: (reservationId: string, opts?: { staff?: boolean; refund?: boolean }) => Res;
  setAttendance: (reservationId: string, status: "attended" | "no_show" | "booked") => Res;
  checkInByCode: (sessionId: string, code: string) => Res;
  purchase: (
    userId: string,
    planId: string,
    opts: { method: PaymentMethod; couponCode?: string; pending?: boolean; byUserId: string; startsAt?: string },
  ) => Res;
  confirmSale: (saleId: string, method?: PaymentMethod) => void;
  refundSale: (saleId: string) => void;
  adjustCredits: (membershipId: string, delta: number) => Res;
  extendMembership: (membershipId: string, days: number) => void;
  upsertDiscipline: (d: Discipline) => void;
  upsertRoom: (r: Room) => void;
  deleteRoom: (id: string) => Res;
  upsertTemplate: (t: ClassTemplate) => void;
  deleteTemplate: (id: string) => void;
  upsertSession: (s: Session) => void;
  cancelSession: (id: string) => void;
  restoreSession: (id: string) => void;
  upsertPlan: (p: Plan) => void;
  upsertUser: (u: User) => Res;
  upsertCoupon: (c: Coupon) => void;
  updateSettings: (s: Partial<Settings>) => void;
  ensureSessions: () => void;
  resetDemo: () => void;
  recordPayout: (p: { teacherId: string; amount: number; method: PaymentMethod; periodEnd?: string; notes?: string }) => Res;
  deletePayout: (id: string) => Res;
}

type Async<T> = { [K in keyof T]: T[K] extends (...a: infer A) => unknown ? (...a: A) => Promise<Result> : never };

export type Mode = "live" | "demo";

interface State extends Async<DemoActions> {
  db: DB;
  currentUserId: string | null;
  hydrated: boolean;
  /** "live" = Supabase; "demo" = datos de ejemplo en el navegador. */
  mode: Mode;
  loading: boolean;
  setHydrated: () => void;
  setMode: (m: Mode) => void;
  /** Recarga los datos desde Supabase (modo live). */
  refresh: () => Promise<void>;
  login: (userId: string) => void;
  logout: () => Promise<void>;
}

const now = () => new Date().toISOString();

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Aplica cambios sobre una copia del DB. */
      const mutate = (fn: (db: DB) => void) => {
        const db = structuredClone(get().db);
        fn(db);
        set({ db });
      };

      const promoteWaitlist = (db: DB, sessionId: string) => {
        const session = db.sessions.find((s) => s.id === sessionId);
        if (!session || !db.settings.waitlistEnabled) return;
        while (occupied(db, sessionId) < session.capacity) {
          const next = waitlist(db, sessionId).find((r) =>
            pickMembership(db, r.userId, session, { guest: !!r.guestName }),
          );
          if (!next) return;
          const m = pickMembership(db, next.userId, session, { guest: !!next.guestName })!;
          m.creditsUsed += 1;
          next.status = "booked";
          next.membershipId = m.id;
          next.spot = db.settings.spotSelection ? freeSpots(db, session)[0] : undefined;
          next.updatedAt = now();
        }
      };

      /** Quién está en sesión (en demo, la persona elegida al entrar). */
      const actorOf = (db: DB) => db.users.find((u) => u.id === get().currentUserId);
      /** Admin o profesor activo (= is_staff() en la base). */
      const isStaffUser = (u: User | undefined): u is User =>
        !!u && u.active && (u.role === "admin" || u.role === "teacher");

      const demo: DemoActions = {

        book: (sessionId, userId, opts = {}) => {
          const db = get().db;
          const actor = actorOf(db);
          if (!actor) return { ok: false, message: "Inicia sesión para reservar." };
          const session = db.sessions.find((s) => s.id === sessionId);
          const user = db.users.find((u) => u.id === userId);
          if (!session || !user) return { ok: false, message: "Clase no encontrada." };
          // Personal de ESTA clase: el admin en todas; un profesor solo en las suyas (igual que book_session).
          const staff = isClassStaff(actor, session);
          if (userId !== actor.id && !staff) return { ok: false, message: "No autorizado." };
          const other = staff && userId !== actor.id;
          const isGuest = opts.guestName !== undefined;
          const guestName = opts.guestName?.trim().replace(/\s+/g, " ");
          const check = checkBooking(db, user, session, { guestName: opts.guestName, staff, other });
          if (!check.ok) return { ok: false, message: check.reason };
          if (!check.full && db.settings.spotSelection && opts.spot) {
            if (!freeSpots(db, session).includes(opts.spot))
              return { ok: false, message: "Ese lugar ya fue tomado, elige otro." };
          }
          const id = uid("res");
          let spot: string | undefined;
          mutate((d) => {
            const s = d.sessions.find((x) => x.id === sessionId)!;
            const r: Reservation = {
              id,
              sessionId,
              userId,
              status: check.full ? "waitlist" : "booked",
              guestName: isGuest ? guestName : undefined,
              createdAt: now(),
              updatedAt: now(),
            };
            if (!check.full) {
              const m = d.memberships.find((x) => x.id === check.membership.id)!;
              m.creditsUsed += 1;
              r.membershipId = m.id;
              r.spot = d.settings.spotSelection ? opts.spot ?? freeSpots(d, s)[0] : undefined;
              spot = r.spot;
            }
            d.reservations.push(r);
          });
          // Mismos textos que book_session (modo real).
          if (check.full) {
            const who = isGuest ? guestName : other ? user.name : undefined;
            return {
              ok: true,
              id,
              message: who
                ? `La clase está llena. ${who} quedó en lista de espera.`
                : "La clase está llena. Te agregamos a la lista de espera.",
            };
          }
          if (isGuest)
            return { ok: true, id, message: `¡Listo! Reservamos un lugar para ${guestName}${spot ? ` (lugar ${spot})` : ""}.` };
          return { ok: true, id, message: other ? `${user.name} quedó inscrito/a en la clase.` : "¡Reservación confirmada!" };
        },

        cancelReservation: (reservationId, opts = {}) => {
          const db = get().db;
          const actor = actorOf(db);
          const r = db.reservations.find((x) => x.id === reservationId);
          const session = r && db.sessions.find((s) => s.id === r.sessionId);
          // Personal de ESTA clase (igual que cancel_reservation); en clases ajenas, "no encontrada".
          const staff = !!session && isClassStaff(actor, session);
          if (!r || !session || !actor || (r.userId !== actor.id && !staff))
            return { ok: false, message: "Reservación no encontrada." };
          if (r.status === "cancelled") return { ok: false, message: "Ya estaba cancelada." };
          if (!staff && new Date(session.startsAt) <= new Date())
            return { ok: false, message: "La clase ya comenzó; no se puede cancelar." };
          const wasWaitlist = r.status === "waitlist";
          // Solo el personal puede decidir el reembolso; para el alumno depende de las horas que faltan.
          const refund = wasWaitlist
            ? false
            : staff && opts.refund !== undefined
              ? opts.refund
              : canCancelWithRefund(db, session);
          const membership = r.membershipId ? db.memberships.find((m) => m.id === r.membershipId) : undefined;
          mutate((d) => {
            const x = d.reservations.find((y) => y.id === reservationId)!;
            if (refund && x.membershipId) {
              const m = d.memberships.find((mm) => mm.id === x.membershipId);
              if (m) m.creditsUsed = Math.max(0, m.creditsUsed - 1);
            }
            x.status = "cancelled";
            x.lateCancel = !wasWaitlist && !refund;
            x.updatedAt = now();
            promoteWaitlist(d, x.sessionId);
          });
          return {
            ok: true,
            message: cancelMessage({
              staff: staff && r.userId !== actor.id,
              waitlist: wasWaitlist,
              refund,
              usesCredit: !!membership && membership.credits !== null,
              guestName: r.guestName,
              ownerName: db.users.find((u) => u.id === r.userId)?.name ?? "el alumno",
              cancelHours: db.settings.cancelHours,
            }),
          };
        },

        setAttendance: (reservationId, status) => {
          const db = get().db;
          const actor = actorOf(db);
          if (!isStaffUser(actor)) return { ok: false, message: "No autorizado." };
          const r = db.reservations.find((x) => x.id === reservationId);
          if (!r) return { ok: true, message: "Sin cambios." };
          const session = db.sessions.find((s) => s.id === r.sessionId);
          // Solo el admin o el profesor de ESTA clase pasan lista (igual que set_attendance).
          if (!isClassStaff(actor, session ?? { teacherId: "" })) return { ok: false, message: "No autorizado." };
          if (!OCCUPYING.includes(r.status) || r.status === status) return { ok: true, message: "Sin cambios." };
          // Marcar asistencia o falta solo desde 60 min antes de la clase (quitar la marca, siempre).
          if (status !== "booked" && session) {
            const can = checkAttendance(session);
            if (!can.ok) return { ok: false, message: can.reason };
          }
          mutate((d) => {
            const x = d.reservations.find((y) => y.id === reservationId)!;
            const m = x.membershipId ? d.memberships.find((mm) => mm.id === x.membershipId) : undefined;
            if (m) {
              // Sin penalización por inasistencia, marcar falta devuelve el crédito. Quitar una falta
              // lo vuelve a cobrar solo si esa falta lo devolvió (lo que se decidió al marcarla).
              if (status === "no_show" && !d.settings.noShowPenalty) m.creditsUsed = Math.max(0, m.creditsUsed - 1);
              else if (x.status === "no_show" && !(x.creditCharged ?? d.settings.noShowPenalty)) m.creditsUsed += 1;
            }
            // Cada falta guarda si gastó el crédito con la regla de ESTE momento (no_show_charged).
            if (status === "no_show") x.creditCharged = d.settings.noShowPenalty || !x.membershipId;
            else delete x.creditCharged;
            x.status = status;
            x.updatedAt = now();
          });
          return { ok: true, message: "Asistencia actualizada." };
        },

        checkInByCode: (sessionId, code) => {
          const db = get().db;
          const actor = actorOf(db);
          if (!isStaffUser(actor)) return { ok: false, message: "No autorizado." };
          const session = db.sessions.find((s) => s.id === sessionId);
          if (!session) return { ok: false, message: "Clase no encontrada." };
          // Solo el admin o el profesor de ESTA clase (igual que check_in_by_code).
          if (!isClassStaff(actor, session)) return { ok: false, message: "No autorizado." };
          const can = checkAttendance(session);
          if (!can.ok) return { ok: false, message: can.reason };
          const user = db.users.find((u) => u.code === code.trim() && u.role === "student");
          if (!user) return { ok: false, message: "No encontramos un alumno con ese código." };
          const r = db.reservations.find(
            (x) => x.sessionId === sessionId && x.userId === user.id && !x.guestName && x.status !== "cancelled",
          );
          if (r && r.status === "waitlist") {
            return { ok: false, message: `${user.name} está en lista de espera, no tiene lugar confirmado.` };
          }
          if (r) {
            const a = demo.setAttendance(r.id, "attended");
            if (!a.ok) return a;
            return { ok: true, message: `Check-in de ${user.name}${r.spot ? ` · lugar ${r.spot}` : ""}.` };
          }
          // Sin reservación: se le agrega a la clase (los mensajes de book ya traen su nombre).
          const res = demo.book(sessionId, user.id, { staff: true });
          if (!res.ok) return res;
          const created = get().db.reservations.find((x) => x.id === res.id);
          if (created?.status === "waitlist") {
            mutate((d) => {
              d.reservations = d.reservations.filter((x) => x.id !== created.id);
            });
            return { ok: false, message: `La clase está llena; no se pudo agregar a ${user.name}.` };
          }
          if (res.id) demo.setAttendance(res.id, "attended");
          return { ok: true, message: `${user.name} quedó agregado/a a la clase con check-in.` };
        },

        purchase: (userId, planId, opts) => {
          const db = get().db;
          const plan = db.plans.find((p) => p.id === planId);
          if (!plan || !plan.active) return { ok: false, message: "Paquete no disponible." };
          if (plan.maxPerMember !== null && planPurchases(db, userId, planId) >= plan.maxPerMember)
            return { ok: false, message: `Este paquete solo se puede comprar ${plan.maxPerMember} vez.` };
          // Mismo texto que purchase_plan: el alumno no aparta dos veces el mismo paquete sin pagarlo.
          if (opts.byUserId === userId && pendingPurchase(db, userId, planId))
            return { ok: false, message: "Ya tienes este paquete apartado. Págalo en recepción para activarlo." };
          const c = couponDiscount(db, opts.couponCode, plan.price);
          if (c.error) return { ok: false, message: c.error };
          const saleId = uid("sale");
          const memId = uid("mem");
          const start = opts.startsAt ? new Date(opts.startsAt) : new Date();
          mutate((d) => {
            d.sales.push({
              id: saleId,
              userId,
              membershipId: memId,
              concept: plan.name,
              subtotal: plan.price,
              discount: c.discount,
              total: plan.price - c.discount,
              couponCode: c.couponId ? opts.couponCode?.toUpperCase() : undefined,
              method: opts.method,
              status: opts.pending ? "pending" : "paid",
              createdAt: now(),
              createdBy: opts.byUserId,
            });
            d.memberships.push({
              id: memId,
              userId,
              planId,
              planName: plan.name,
              credits: plan.credits,
              creditsUsed: 0,
              disciplineIds: plan.disciplineIds,
              startsAt: start.toISOString(),
              expiresAt: addDays(start, plan.validityDays).toISOString(),
              status: opts.pending ? "pending_payment" : "active",
              saleId,
              createdAt: now(),
            });
            if (c.couponId) {
              const cp = d.coupons.find((x) => x.id === c.couponId);
              if (cp) cp.uses += 1;
            }
          });
          return {
            ok: true,
            id: memId,
            message: opts.pending
              ? "Tu paquete quedó apartado. Paga en recepción para activarlo."
              : "¡Compra exitosa! Tus créditos ya están disponibles.",
          };
        },

        confirmSale: (saleId, method) =>
          mutate((d) => {
            const s = d.sales.find((x) => x.id === saleId);
            if (!s) return;
            s.status = "paid";
            if (method) s.method = method;
            const m = d.memberships.find((x) => x.id === s.membershipId);
            if (m && m.status === "pending_payment") {
              const plan = d.plans.find((p) => p.id === m.planId);
              m.status = "active";
              // La vigencia corre desde que se paga.
              m.startsAt = now();
              m.expiresAt = addDays(new Date(), plan?.validityDays ?? 30).toISOString();
            }
          }),

        refundSale: (saleId) =>
          mutate((d) => {
            const s = d.sales.find((x) => x.id === saleId);
            if (!s) return;
            s.status = "refunded";
            const m = d.memberships.find((x) => x.id === s.membershipId);
            if (m) m.status = "cancelled";
          }),

        adjustCredits: (membershipId, delta) => {
          // Mismas reglas y textos que adjust_credits (modo real).
          const m = get().db.memberships.find((x) => x.id === membershipId);
          if (!m) return { ok: false, message: "Paquete no encontrado." };
          if (m.credits === null) return { ok: false, message: "Este paquete es ilimitado; no tiene créditos que ajustar." };
          if (m.credits + delta < m.creditsUsed)
            return { ok: false, message: "Este paquete ya no tiene créditos disponibles que quitar." };
          mutate((d) => {
            const x = d.memberships.find((y) => y.id === membershipId);
            if (x && x.credits !== null) x.credits += delta;
          });
          return { ok: true, message: delta > 0 ? "Crédito agregado." : delta < 0 ? "Crédito retirado." : "Sin cambios." };
        },

        extendMembership: (membershipId, days) =>
          mutate((d) => {
            const m = d.memberships.find((x) => x.id === membershipId);
            if (m) m.expiresAt = addDays(new Date(m.expiresAt), days).toISOString();
          }),

        upsertDiscipline: (x) =>
          mutate((d) => {
            const i = d.disciplines.findIndex((y) => y.id === x.id);
            if (i >= 0) d.disciplines[i] = x;
            else d.disciplines.push(x);
          }),

        upsertRoom: (x) =>
          mutate((d) => {
            const i = d.rooms.findIndex((y) => y.id === x.id);
            if (i >= 0) d.rooms[i] = x;
            else d.rooms.push(x);
          }),

        deleteRoom: (id) => {
          const db = get().db;
          if (db.templates.some((t) => t.roomId === id && t.active))
            return { ok: false, message: "Hay clases recurrentes en este salón. Muévelas antes de borrarlo." };
          mutate((d) => {
            d.rooms = d.rooms.filter((r) => r.id !== id);
          });
          return { ok: true, message: "Salón eliminado." };
        },

        upsertTemplate: (t) =>
          mutate((d) => {
            const i = d.templates.findIndex((y) => y.id === t.id);
            const prev = i >= 0 ? d.templates[i] : undefined;
            if (i >= 0) d.templates[i] = t;
            else d.templates.push(t);
            const today = new Date();
            // Si cambió el día o la hora, las clases futuras sin reservas se regeneran.
            const future = d.sessions.filter(
              (s) => s.templateId === t.id && !s.detached && new Date(s.startsAt) > today,
            );
            const moved = prev && (prev.weekday !== t.weekday || prev.startTime !== t.startTime || !t.active);
            if (moved) {
              const hasRes = (sid: string) => d.reservations.some((r) => r.sessionId === sid && r.status !== "cancelled");
              const removable = new Set(future.filter((s) => !hasRes(s.id)).map((s) => s.id));
              d.sessions = d.sessions.filter((s) => !removable.has(s.id));
            } else {
              for (const s of future) {
                s.disciplineId = t.disciplineId;
                s.teacherId = t.teacherId;
                s.roomId = t.roomId;
                s.durationMin = t.durationMin;
                s.capacity = t.capacity;
              }
            }
            d.sessions.push(
              ...generateSessionsForTemplates(
                d.templates.filter((x) => x.id === t.id),
                d.sessions,
                today,
                addDays(today, 42),
              ).filter((s) => new Date(s.startsAt) > today),
            );
          }),

        deleteTemplate: (id) =>
          mutate((d) => {
            const t = d.templates.find((x) => x.id === id);
            if (t) t.active = false;
            const today = new Date();
            const hasRes = (sid: string) => d.reservations.some((r) => r.sessionId === sid && r.status !== "cancelled");
            d.sessions = d.sessions.filter(
              (s) => !(s.templateId === id && !s.detached && new Date(s.startsAt) > today && !hasRes(s.id)),
            );
          }),

        upsertSession: (s) =>
          mutate((d) => {
            const i = d.sessions.findIndex((y) => y.id === s.id);
            const prevRoom = i >= 0 ? d.sessions[i].roomId : s.roomId;
            if (i >= 0) d.sessions[i] = { ...s, detached: s.templateId ? true : s.detached };
            else d.sessions.push(s);
            // Si cambió el salón, conserva los lugares que existan en el nuevo y reasigna el resto.
            if (prevRoom !== s.roomId) {
              const room = d.rooms.find((r) => r.id === s.roomId);
              const valid = room ? roomSpots(room) : [];
              const res = d.reservations.filter((r) => r.sessionId === s.id && OCCUPYING.includes(r.status) && r.spot);
              const used = new Set<string>();
              const keep = res.filter((r) => valid.includes(r.spot!) && !used.has(r.spot!) && used.add(r.spot!));
              for (const r of res) {
                if (keep.includes(r)) continue;
                r.spot = valid.find((x) => !used.has(x));
                if (r.spot) used.add(r.spot);
                r.updatedAt = now();
              }
            }
          }),

        cancelSession: (id) =>
          mutate((d) => {
            const s = d.sessions.find((x) => x.id === id);
            if (!s) return;
            s.status = "cancelled";
            s.detached = true;
            for (const r of d.reservations.filter((x) => x.sessionId === id && x.status !== "cancelled")) {
              if (r.membershipId && OCCUPYING.includes(r.status)) {
                const m = d.memberships.find((mm) => mm.id === r.membershipId);
                if (m) m.creditsUsed = Math.max(0, m.creditsUsed - 1);
              }
              r.status = "cancelled";
              r.updatedAt = now();
            }
          }),

        restoreSession: (id) =>
          mutate((d) => {
            const s = d.sessions.find((x) => x.id === id);
            if (s) s.status = "scheduled";
          }),

        upsertPlan: (x) =>
          mutate((d) => {
            const i = d.plans.findIndex((y) => y.id === x.id);
            if (i >= 0) d.plans[i] = x;
            else d.plans.push(x);
          }),

        upsertUser: (x) => {
          // Mismas validaciones que update_my_profile / admin_save_profile (modo real).
          const err = profileError(get().db, x, format(new Date(), "yyyy-MM-dd"));
          if (err) return { ok: false, message: err };
          mutate((d) => {
            const i = d.users.findIndex((y) => y.id === x.id);
            const prev = i >= 0 ? d.users[i] : undefined;
            // Cambiar el precio no reescribe clases ya dadas: congelamos el precio anterior en ellas.
            if (prev && (prev.rate ?? 0) !== (x.rate ?? 0)) {
              const nowIso = new Date().toISOString();
              for (const ses of d.sessions)
                if (ses.teacherId === x.id && ses.startsAt <= nowIso && ses.teacherRate === undefined) ses.teacherRate = prev.rate ?? 0;
            }
            if (i >= 0) d.users[i] = x;
            else d.users.push(x);
          });
          return { ok: true, message: "Guardado." };
        },

        upsertCoupon: (x) =>
          mutate((d) => {
            const i = d.coupons.findIndex((y) => y.id === x.id);
            if (i >= 0) d.coupons[i] = x;
            else d.coupons.push(x);
          }),

        updateSettings: (s) =>
          mutate((d) => {
            // Igual que con el precio: un nuevo % del profesor no cambia las clases ya dadas.
            if (s.teacherShare !== undefined && s.teacherShare !== d.settings.teacherShare) {
              const nowIso = new Date().toISOString();
              for (const ses of d.sessions)
                if (ses.startsAt <= nowIso && ses.teacherShare === undefined) ses.teacherShare = d.settings.teacherShare;
            }
            d.settings = { ...d.settings, ...s };
          }),

        recordPayout: (p) => {
          if (!(p.amount > 0)) return { ok: false, message: "El monto debe ser mayor a cero." };
          const teacher = get().db.users.find((u) => u.id === p.teacherId && u.role === "teacher");
          if (!teacher) return { ok: false, message: "Profesor no encontrado." };
          const id = uid("pay");
          mutate((d) => {
            d.payouts.push({
              id,
              teacherId: p.teacherId,
              amount: Math.round(p.amount * 100) / 100,
              paidAt: new Date().toISOString(),
              periodEnd: p.periodEnd,
              method: p.method,
              notes: p.notes,
              createdBy: get().currentUserId ?? "",
            });
          });
          return { ok: true, id, message: `Pago a ${teacher.name} registrado.` };
        },

        deletePayout: (id) => {
          if (!get().db.payouts.some((x) => x.id === id)) return { ok: false, message: "Pago no encontrado." };
          mutate((d) => {
            d.payouts = d.payouts.filter((x) => x.id !== id);
          });
          return { ok: true, message: "Pago eliminado." };
        },

        ensureSessions: () => {
          const db = get().db;
          const add = generateSessionsForTemplates(db.templates, db.sessions, subDays(new Date(), 1), addDays(new Date(), 42));
          if (add.length) mutate((d) => d.sessions.push(...add));
        },

        resetDemo: () => set({ db: createSeed(), currentUserId: get().currentUserId }),
      };

      const isLive = () => get().mode === "live";
      /** En modo live ejecuta la acción en Supabase y recarga; en demo, la acción local. */
      const run = async (liveCall: () => Promise<Result>, demoCall: () => Result | void, okMsg = "Listo."): Promise<Result> => {
        if (!isLive()) {
          const r = demoCall();
          return r ?? { ok: true, message: okMsg };
        }
        const r = await liveCall();
        await get().refresh();
        return r;
      };
      const me = () => get().currentUserId ?? "";

      return {
        db: createSeed(),
        currentUserId: null,
        hydrated: false,
        mode: "live",
        loading: false,
        setHydrated: () => set({ hydrated: true }),
        setMode: (mode) => set({ mode, currentUserId: null, db: createSeed() }),
        refresh: async () => {
          if (!isLive()) return;
          set({ loading: true });
          try {
            const { db, currentUserId } = await loadAll();
            // Si mientras cargaba se cambió al modo demo, descarta esta respuesta.
            if (!isLive()) {
              set({ loading: false });
              return;
            }
            set({ db, currentUserId, loading: false });
          } catch (e) {
            set({ loading: false });
            throw e;
          }
        },
        login: (userId) => set({ currentUserId: userId }),
        logout: async () => {
          if (isLive()) await supabase().auth.signOut();
          set({ currentUserId: null });
        },

        book: (sessionId, userId, opts = {}) =>
          run(() => live.book(sessionId, userId, opts), () => demo.book(sessionId, userId, opts)),
        cancelReservation: (id, opts = {}) =>
          run(() => live.cancelReservation(id, opts), () => demo.cancelReservation(id, opts)),
        setAttendance: (id, status) =>
          run(() => live.setAttendance(id, status), () => demo.setAttendance(id, status), "Asistencia actualizada."),
        checkInByCode: (sessionId, code) =>
          run(() => live.checkInByCode(sessionId, code), () => demo.checkInByCode(sessionId, code)),
        purchase: (userId, planId, opts) =>
          run(() => live.purchase(userId, planId, opts), () => demo.purchase(userId, planId, opts)),
        confirmSale: (id, method) => run(() => live.confirmSale(id, method), () => demo.confirmSale(id, method), "Pago confirmado."),
        refundSale: (id) => run(() => live.refundSale(id), () => demo.refundSale(id), "Venta reembolsada."),
        adjustCredits: (id, delta) =>
          run(() => live.adjustCredits(id, delta), () => demo.adjustCredits(id, delta), "Créditos actualizados."),
        extendMembership: (id, days) =>
          run(() => live.extendMembership(id, days), () => demo.extendMembership(id, days), "Vigencia extendida."),
        upsertDiscipline: (x) => run(() => live.upsertDiscipline(x), () => demo.upsertDiscipline(x), "Disciplina guardada."),
        upsertRoom: (x) => run(() => live.upsertRoom(x), () => demo.upsertRoom(x), "Salón guardado."),
        deleteRoom: (id) => run(() => live.deleteRoom(id), () => demo.deleteRoom(id)),
        upsertTemplate: (t) => run(() => live.upsertTemplate(t), () => demo.upsertTemplate(t), "Horario guardado."),
        deleteTemplate: (id) => run(() => live.deleteTemplate(id), () => demo.deleteTemplate(id), "Clase recurrente desactivada."),
        upsertSession: (x) => run(() => live.upsertSession(x), () => demo.upsertSession(x), "Clase guardada."),
        cancelSession: (id) => run(() => live.cancelSession(id), () => demo.cancelSession(id), "Clase cancelada."),
        restoreSession: (id) => run(() => live.restoreSession(id), () => demo.restoreSession(id), "Clase reactivada."),
        upsertPlan: (x) => run(() => live.upsertPlan(x), () => demo.upsertPlan(x), "Plan guardado."),
        upsertUser: (x) =>
          run(
            () => live.upsertUser(x, x.id === me() && get().db.users.find((u) => u.id === me())?.role !== "admin"),
            () => demo.upsertUser(x),
            "Guardado.",
          ),
        upsertCoupon: (x) => run(() => live.upsertCoupon(x), () => demo.upsertCoupon(x), "Cupón guardado."),
        updateSettings: (x) => run(() => live.updateSettings(x), () => demo.updateSettings(x), "Configuración guardada."),
        ensureSessions: async () => {
          if (isLive()) {
            await live.ensureSessions();
            return { ok: true, message: "" };
          }
          demo.ensureSessions();
          return { ok: true, message: "" };
        },
        resetDemo: async () => {
          demo.resetDemo();
          return { ok: true, message: "Datos de ejemplo restablecidos." };
        },
        recordPayout: (p) => run(() => live.recordPayout(p), () => demo.recordPayout(p)),
        deletePayout: (id) => run(() => live.deletePayout(id), () => demo.deletePayout(id)),
      };
    },
    {
      name: "yoga-demo-db",
      version: DB_VERSION + 1,
      storage: createJSONStorage(() => localStorage),
      // En modo real no guardamos datos personales en el navegador.
      partialize: (s) => (s.mode === "demo" ? { db: s.db, currentUserId: s.currentUserId, mode: s.mode } : { mode: s.mode }),
      skipHydration: true,
      migrate: () => ({ mode: "live" }) as unknown as State,
    },
  ),
);

/* ---------- Selectores ---------- */

export function useDB(): DB {
  return useStore((s) => s.db);
}

export function useCurrentUser(): User | undefined {
  return useStore((s) => s.db.users.find((u) => u.id === s.currentUserId));
}

export function useSettings(): Settings {
  return useStore((s) => s.db.settings);
}
