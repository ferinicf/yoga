"use client";

/**
 * Store del modo demo: todos los datos viven en el navegador (localStorage).
 * Cada acción equivale a un endpoint del backend futuro (ver supabase/schema.sql),
 * así que para conectar una base de datos real basta con reemplazar estas acciones.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addDays, subDays } from "date-fns";
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
  canCancelWithRefund,
  checkBooking,
  couponDiscount,
  freeSpots,
  occupied,
  OCCUPYING,
  pickMembership,
  planPurchases,
  waitlist,
} from "./rules";
import { uid } from "./utils";

export type Result = { ok: true; message: string; id?: string } | { ok: false; message: string };

interface State {
  db: DB;
  currentUserId: string | null;
  hydrated: boolean;
  setHydrated: () => void;
  login: (userId: string) => void;
  logout: () => void;

  // Reservas
  book: (sessionId: string, userId: string, opts?: { spot?: string; guestName?: string; staff?: boolean }) => Result;
  cancelReservation: (reservationId: string, opts?: { staff?: boolean; refund?: boolean }) => Result;
  setAttendance: (reservationId: string, status: "attended" | "no_show" | "booked") => void;
  checkInByCode: (sessionId: string, code: string) => Result;

  // Ventas
  purchase: (
    userId: string,
    planId: string,
    opts: { method: PaymentMethod; couponCode?: string; pending?: boolean; byUserId: string; startsAt?: string },
  ) => Result;
  confirmSale: (saleId: string, method?: PaymentMethod) => void;
  refundSale: (saleId: string) => void;
  adjustCredits: (membershipId: string, delta: number) => void;
  extendMembership: (membershipId: string, days: number) => void;

  // Catálogo / configuración
  upsertDiscipline: (d: Discipline) => void;
  upsertRoom: (r: Room) => void;
  deleteRoom: (id: string) => Result;
  upsertTemplate: (t: ClassTemplate) => void;
  deleteTemplate: (id: string) => void;
  upsertSession: (s: Session) => void;
  cancelSession: (id: string) => void;
  restoreSession: (id: string) => void;
  upsertPlan: (p: Plan) => void;
  upsertUser: (u: User) => void;
  upsertCoupon: (c: Coupon) => void;
  updateSettings: (s: Partial<Settings>) => void;
  ensureSessions: () => void;
  resetDemo: () => void;
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
          const next = waitlist(db, sessionId).find((r) => pickMembership(db, r.userId, session));
          if (!next) return;
          const m = pickMembership(db, next.userId, session)!;
          m.creditsUsed += 1;
          next.status = "booked";
          next.membershipId = m.id;
          next.spot = db.settings.spotSelection ? freeSpots(db, session)[0] : undefined;
          next.updatedAt = now();
        }
      };

      return {
        db: createSeed(),
        currentUserId: null,
        hydrated: false,
        setHydrated: () => set({ hydrated: true }),
        login: (userId) => set({ currentUserId: userId }),
        logout: () => set({ currentUserId: null }),

        book: (sessionId, userId, opts = {}) => {
          const db = get().db;
          const session = db.sessions.find((s) => s.id === sessionId);
          const user = db.users.find((u) => u.id === userId);
          if (!session || !user) return { ok: false, message: "Clase no encontrada." };
          const check = checkBooking(db, user, session, { guest: !!opts.guestName, staff: opts.staff });
          if (!check.ok) return { ok: false, message: check.reason };
          if (!check.full && db.settings.spotSelection && opts.spot) {
            if (!freeSpots(db, session).includes(opts.spot))
              return { ok: false, message: "Ese lugar ya fue tomado, elige otro." };
          }
          const id = uid("res");
          mutate((d) => {
            const s = d.sessions.find((x) => x.id === sessionId)!;
            const r: Reservation = {
              id,
              sessionId,
              userId,
              status: check.full ? "waitlist" : "booked",
              guestName: opts.guestName,
              createdAt: now(),
              updatedAt: now(),
            };
            if (!check.full) {
              const m = d.memberships.find((x) => x.id === check.membership.id)!;
              m.creditsUsed += 1;
              r.membershipId = m.id;
              r.spot = d.settings.spotSelection ? opts.spot ?? freeSpots(d, s)[0] : undefined;
            }
            d.reservations.push(r);
          });
          return check.full
            ? { ok: true, id, message: "La clase está llena. Te agregamos a la lista de espera." }
            : { ok: true, id, message: "¡Reservación confirmada!" };
        },

        cancelReservation: (reservationId, opts = {}) => {
          const db = get().db;
          const r = db.reservations.find((x) => x.id === reservationId);
          if (!r) return { ok: false, message: "Reservación no encontrada." };
          const session = db.sessions.find((s) => s.id === r.sessionId)!;
          if (!opts.staff && new Date(session.startsAt) <= new Date())
            return { ok: false, message: "La clase ya comenzó; no se puede cancelar." };
          const wasWaitlist = r.status === "waitlist";
          const refund = wasWaitlist ? false : opts.refund ?? canCancelWithRefund(db, session);
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
          if (wasWaitlist) return { ok: true, message: "Saliste de la lista de espera." };
          return refund
            ? { ok: true, message: "Reservación cancelada. Te devolvimos tu crédito." }
            : { ok: true, message: `Cancelación tardía (menos de ${db.settings.cancelHours} h): el crédito no se reembolsa.` };
        },

        setAttendance: (reservationId, status) =>
          mutate((d) => {
            const r = d.reservations.find((x) => x.id === reservationId);
            if (r && OCCUPYING.includes(r.status)) {
              r.status = status;
              r.updatedAt = now();
            }
          }),

        checkInByCode: (sessionId, code) => {
          const db = get().db;
          const user = db.users.find((u) => u.code === code.trim() && u.role === "student");
          if (!user) return { ok: false, message: "No encontramos un alumno con ese código." };
          const r = db.reservations.find(
            (x) => x.sessionId === sessionId && x.userId === user.id && !x.guestName && x.status !== "cancelled",
          );
          if (r && r.status === "waitlist") {
            return { ok: false, message: `${user.name} está en lista de espera, no tiene lugar confirmado.` };
          }
          if (r) {
            get().setAttendance(r.id, "attended");
            return { ok: true, message: `Check-in de ${user.name}${r.spot ? ` · lugar ${r.spot}` : ""}.` };
          }
          const res = get().book(sessionId, user.id, { staff: true });
          if (!res.ok) return { ok: false, message: `${user.name}: ${res.message}` };
          const created = get().db.reservations.find((x) => x.id === res.id);
          if (created?.status === "waitlist") {
            get().cancelReservation(created.id, { staff: true });
            return { ok: false, message: "La clase está llena." };
          }
          if (res.id) get().setAttendance(res.id, "attended");
          return { ok: true, message: `${user.name} agregado/a a la clase y con check-in.` };
        },

        purchase: (userId, planId, opts) => {
          const db = get().db;
          const plan = db.plans.find((p) => p.id === planId);
          if (!plan || !plan.active) return { ok: false, message: "Paquete no disponible." };
          if (plan.maxPerMember !== null && planPurchases(db, userId, planId) >= plan.maxPerMember)
            return { ok: false, message: `Este paquete solo se puede comprar ${plan.maxPerMember} vez.` };
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

        adjustCredits: (membershipId, delta) =>
          mutate((d) => {
            const m = d.memberships.find((x) => x.id === membershipId);
            if (m && m.credits !== null) m.credits = Math.max(m.creditsUsed, m.credits + delta);
          }),

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
            if (i >= 0) d.sessions[i] = { ...s, detached: s.templateId ? true : s.detached };
            else d.sessions.push(s);
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

        upsertUser: (x) =>
          mutate((d) => {
            const i = d.users.findIndex((y) => y.id === x.id);
            if (i >= 0) d.users[i] = x;
            else d.users.push(x);
          }),

        upsertCoupon: (x) =>
          mutate((d) => {
            const i = d.coupons.findIndex((y) => y.id === x.id);
            if (i >= 0) d.coupons[i] = x;
            else d.coupons.push(x);
          }),

        updateSettings: (s) =>
          mutate((d) => {
            d.settings = { ...d.settings, ...s };
          }),

        ensureSessions: () => {
          const db = get().db;
          const add = generateSessionsForTemplates(db.templates, db.sessions, subDays(new Date(), 1), addDays(new Date(), 42));
          if (add.length) mutate((d) => d.sessions.push(...add));
        },

        resetDemo: () => set({ db: createSeed(), currentUserId: get().currentUserId }),
      };
    },
    {
      name: "yoga-demo-db",
      version: DB_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ db: s.db, currentUserId: s.currentUserId }),
      skipHydration: true,
      migrate: () => ({ db: createSeed(), currentUserId: null }) as unknown as State,
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
