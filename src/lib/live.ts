"use client";

/**
 * Backend real (Supabase). Lee las tablas visibles para el usuario (RLS) y
 * ejecuta las acciones con funciones RPC que aplican las reglas en la base.
 */
import { addDays, subDays } from "date-fns";
import { supabase } from "./supabase";
import type {
  ClassTemplate,
  Coupon,
  DB,
  Discipline,
  Membership,
  PaymentMethod,
  Plan,
  Reservation,
  Room,
  Sale,
  Session,
  Settings,
  User,
} from "./types";

export type Result = { ok: true; message: string; id?: string } | { ok: false; message: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/* ---------------- mapeo filas → tipos de la app ---------------- */

const toSettings = (r: Row): Settings => ({
  studioName: r.studio_name,
  tagline: r.tagline,
  brandColor: r.brand_color,
  address: r.address,
  phone: r.phone,
  whatsapp: r.whatsapp,
  instagram: r.instagram,
  cancelHours: r.cancel_hours,
  bookingWindowDays: r.booking_window_days,
  dayLimit: r.day_limit,
  weekLimit: r.week_limit,
  waitlistEnabled: r.waitlist_enabled,
  spotSelection: r.spot_selection,
  allowGuests: r.allow_guests,
  allowPayAtStudio: r.allow_pay_at_studio,
  noShowPenalty: r.no_show_penalty,
  currency: "MXN",
  adminEmails: r.admin_emails ?? [],
});

const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone ?? "",
  role: r.role,
  code: r.code,
  color: r.color,
  bio: r.bio ?? undefined,
  notes: r.notes ?? undefined,
  birthday: r.birthday ?? undefined,
  active: r.active,
  createdAt: r.created_at,
});

const toDiscipline = (r: Row): Discipline => ({
  id: r.id,
  name: r.name,
  description: r.description,
  color: r.color,
  durationMin: r.duration_min,
  level: r.level,
  active: r.active,
});

const toRoom = (r: Row): Room => ({ id: r.id, name: r.name, rows: r.rows, cols: r.cols, blockedSpots: r.blocked_spots ?? [] });

const toTemplate = (r: Row): ClassTemplate => ({
  id: r.id,
  disciplineId: r.discipline_id,
  teacherId: r.teacher_id,
  roomId: r.room_id,
  weekday: r.weekday,
  startTime: String(r.start_time).slice(0, 5),
  durationMin: r.duration_min,
  capacity: r.capacity,
  active: r.active,
});

const toSession = (r: Row): Session => ({
  id: r.id,
  templateId: r.template_id ?? undefined,
  detached: r.detached,
  disciplineId: r.discipline_id,
  teacherId: r.teacher_id,
  roomId: r.room_id,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  capacity: r.capacity,
  status: r.status,
  notes: r.notes ?? undefined,
});

const toPlan = (r: Row): Plan => ({
  id: r.id,
  name: r.name,
  description: r.description,
  price: Number(r.price),
  credits: r.credits,
  validityDays: r.validity_days,
  disciplineIds: r.discipline_ids ?? [],
  maxPerMember: r.max_per_member,
  featured: r.featured,
  active: r.active,
});

const toMembership = (r: Row): Membership => ({
  id: r.id,
  userId: r.user_id,
  planId: r.plan_id,
  planName: r.plan_name,
  credits: r.credits,
  creditsUsed: r.credits_used,
  disciplineIds: r.discipline_ids ?? [],
  startsAt: r.starts_at,
  expiresAt: r.expires_at,
  status: r.status,
  saleId: r.sale_id,
  createdAt: r.created_at,
});

const toSale = (r: Row, memberships: Membership[]): Sale => ({
  id: r.id,
  userId: r.user_id,
  membershipId: memberships.find((m) => m.saleId === r.id)?.id,
  concept: r.concept,
  subtotal: Number(r.subtotal),
  discount: Number(r.discount),
  total: Number(r.total),
  couponCode: r.coupon_code ?? undefined,
  method: r.method,
  status: r.status,
  createdAt: r.created_at,
  createdBy: r.created_by ?? r.user_id,
});

const toReservation = (r: Row): Reservation => ({
  id: r.id,
  sessionId: r.session_id,
  userId: r.user_id,
  spot: r.spot ?? undefined,
  status: r.status,
  membershipId: r.membership_id ?? undefined,
  guestName: r.guest_name ?? undefined,
  lateCancel: r.late_cancel,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toCoupon = (r: Row): Coupon => ({
  id: r.id,
  code: r.code,
  kind: r.kind,
  value: Number(r.value),
  active: r.active,
  maxUses: r.max_uses,
  uses: r.uses,
  expiresAt: r.expires_at ?? undefined,
});

/** Lee todas las filas paginando de 1000 en 1000 (límite de la API). */
async function all(build: () => any): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export const OTHER = "__otro";

/** Carga todo lo que el usuario puede ver. Devuelve null si no hay sesión. */
export async function loadAll(): Promise<{ db: DB; currentUserId: string | null }> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  const from = subDays(new Date(), 120).toISOString();
  const to = addDays(new Date(), 60).toISOString();

  const [settings, profiles, disciplines, rooms, templates, sessions, plans, coupons, memberships, sales, reservations, stats] =
    await Promise.all([
      sb.from("settings").select("*").eq("id", 1).single(),
      all(() => sb.from("profiles").select("*").order("name")),
      all(() => sb.from("disciplines").select("*").order("name")),
      all(() => sb.from("rooms").select("*").order("name")),
      all(() => sb.from("class_templates").select("*")),
      all(() => sb.from("sessions").select("*").gte("starts_at", from).lte("starts_at", to).order("starts_at")),
      all(() => sb.from("plans").select("*").order("price")),
      all(() => sb.from("coupons").select("*").order("code")),
      all(() => sb.from("memberships").select("*").order("created_at")),
      all(() => sb.from("sales").select("*").order("created_at")),
      all(() =>
        sb.from("reservations").select("*, sessions!inner(starts_at)").gte("sessions.starts_at", from).order("created_at"),
      ),
      sb.rpc("session_stats", { p_from: from, p_to: to }),
    ]);
  if (settings.error) throw settings.error;

  const users = profiles.map(toUser);
  const me = auth.user ? profiles.find((p) => p.auth_id === auth.user!.id) : undefined;
  const staff = me && (me.role === "admin" || me.role === "teacher");
  const mems = memberships.map(toMembership);
  const res = reservations.map(toReservation);

  // Los alumnos no ven las reservaciones de los demás; agregamos marcadores anónimos
  // para que la ocupación, la lista de espera y los lugares tomados se vean bien.
  if (!staff && stats.data) {
    for (const st of stats.data as Row[]) {
      const own = res.filter((r) => r.sessionId === st.session_id);
      const ownOcc = own.filter((r) => ["booked", "attended", "no_show"].includes(r.status));
      const ownSpots = new Set(ownOcc.map((r) => r.spot).filter(Boolean));
      const otherSpots = (st.taken_spots as string[]).filter((s) => !ownSpots.has(s));
      let missing = st.occupied - ownOcc.length;
      for (const spot of otherSpots) {
        res.push(pseudo(st.session_id, "booked", spot));
        missing--;
      }
      for (; missing > 0; missing--) res.push(pseudo(st.session_id, "booked"));
      const ownWait = own.filter((r) => r.status === "waitlist").length;
      for (let i = 0; i < st.waitlist - ownWait; i++) res.push(pseudo(st.session_id, "waitlist"));
    }
  }

  return {
    currentUserId: me?.id ?? null,
    db: {
      version: 1,
      settings: toSettings(settings.data),
      users,
      disciplines: disciplines.map(toDiscipline),
      rooms: rooms.map(toRoom),
      templates: templates.map(toTemplate),
      sessions: sessions.map(toSession),
      plans: plans.map(toPlan),
      memberships: mems,
      sales: sales.map((s) => toSale(s, mems)),
      reservations: res,
      coupons: coupons.map(toCoupon),
    },
  };
}

let n = 0;
function pseudo(sessionId: string, status: Reservation["status"], spot?: string): Reservation {
  const t = new Date(0).toISOString();
  return { id: `${OTHER}-${sessionId}-${n++}`, sessionId, userId: OTHER, spot, status, createdAt: t, updatedAt: t };
}

/* ---------------- acciones ---------------- */

async function rpc(fn: string, args: Row): Promise<Result> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) return { ok: false, message: humanError(error.message) };
  const d = data as Row;
  return d?.ok ? { ok: true, message: d.message, id: d.id } : { ok: false, message: d?.message ?? "No se pudo completar." };
}

async function write(p: PromiseLike<{ error: { message: string; code?: string } | null }>, okMsg: string): Promise<Result> {
  const { error } = await p;
  if (error) return { ok: false, message: humanError(error.message, error.code) };
  return { ok: true, message: okMsg };
}

function humanError(msg: string, code?: string): string {
  if (code === "23503" || /foreign key/i.test(msg)) return "No se puede borrar: tiene clases u otros registros asociados.";
  if (/row-level security|permission denied/i.test(msg)) return "No tienes permiso para hacer esto.";
  if (/fetch/i.test(msg)) return "Sin conexión con el servidor. Revisa tu internet.";
  return msg;
}

export async function quoteCoupon(code: string, subtotal: number): Promise<{ discount: number; error?: string }> {
  const { data, error } = await supabase().rpc("quote_coupon", { p_code: code, p_subtotal: subtotal });
  if (error) return { discount: 0, error: humanError(error.message) };
  return { discount: Number((data as Row).discount ?? 0), error: (data as Row).error ?? undefined };
}

export const live = {
  book: (sessionId: string, userId: string, opts: { spot?: string; guestName?: string } = {}) =>
    rpc("book_session", { p_session: sessionId, p_user: userId, p_spot: opts.spot ?? null, p_guest: opts.guestName ?? null }),

  cancelReservation: (id: string, opts: { refund?: boolean } = {}) =>
    rpc("cancel_reservation", { p_id: id, p_refund: opts.refund ?? null }),

  setAttendance: (id: string, status: string) => rpc("set_attendance", { p_id: id, p_status: status }),

  checkInByCode: (sessionId: string, code: string) => rpc("check_in_by_code", { p_session: sessionId, p_code: code }),

  purchase: (
    userId: string,
    planId: string,
    opts: { method: PaymentMethod; couponCode?: string; pending?: boolean; startsAt?: string },
  ) =>
    rpc("purchase_plan", {
      p_plan: planId,
      p_user: userId,
      p_method: opts.method,
      p_coupon: opts.couponCode ?? null,
      p_pending: opts.pending ?? false,
      p_starts_at: opts.startsAt ?? null,
    }),

  confirmSale: (id: string, method?: PaymentMethod) => rpc("confirm_sale", { p_sale: id, p_method: method ?? null }),
  refundSale: (id: string) => rpc("refund_sale", { p_sale: id }),
  adjustCredits: (id: string, delta: number) => rpc("adjust_credits", { p_membership: id, p_delta: delta }),
  extendMembership: (id: string, days: number) => rpc("extend_membership", { p_membership: id, p_days: days }),

  upsertDiscipline: (d: Discipline) =>
    write(
      supabase().from("disciplines").upsert({
        id: d.id,
        name: d.name,
        description: d.description,
        color: d.color,
        duration_min: d.durationMin,
        level: d.level,
        active: d.active,
      }),
      "Disciplina guardada.",
    ),

  upsertRoom: (r: Room) =>
    write(
      supabase().from("rooms").upsert({ id: r.id, name: r.name, rows: r.rows, cols: r.cols, blocked_spots: r.blockedSpots }),
      "Salón guardado.",
    ),

  deleteRoom: (id: string) => write(supabase().from("rooms").delete().eq("id", id), "Salón eliminado."),

  upsertPlan: (p: Plan) =>
    write(
      supabase().from("plans").upsert({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        credits: p.credits,
        validity_days: p.validityDays,
        discipline_ids: p.disciplineIds,
        max_per_member: p.maxPerMember,
        featured: p.featured,
        active: p.active,
      }),
      "Plan guardado.",
    ),

  upsertCoupon: (c: Coupon) =>
    write(
      supabase().from("coupons").upsert({
        id: c.id,
        code: c.code.toUpperCase(),
        kind: c.kind,
        value: c.value,
        active: c.active,
        max_uses: c.maxUses,
        uses: c.uses,
        expires_at: c.expiresAt ?? null,
      }),
      "Cupón guardado.",
    ),

  updateSettings: (s: Partial<Settings>) => {
    const map: Record<string, string> = {
      studioName: "studio_name",
      tagline: "tagline",
      brandColor: "brand_color",
      address: "address",
      phone: "phone",
      whatsapp: "whatsapp",
      instagram: "instagram",
      cancelHours: "cancel_hours",
      bookingWindowDays: "booking_window_days",
      dayLimit: "day_limit",
      weekLimit: "week_limit",
      waitlistEnabled: "waitlist_enabled",
      spotSelection: "spot_selection",
      allowGuests: "allow_guests",
      allowPayAtStudio: "allow_pay_at_studio",
      noShowPenalty: "no_show_penalty",
      adminEmails: "admin_emails",
    };
    const row: Row = {};
    for (const [k, v] of Object.entries(s)) if (map[k]) row[map[k]] = v;
    return write(supabase().from("settings").update(row).eq("id", 1), "Configuración guardada.");
  },

  upsertUser: (u: User, self: boolean) =>
    self
      ? rpc("update_my_profile", { p: { name: u.name, phone: u.phone, birthday: u.birthday ?? "", bio: u.bio ?? "" } })
      : rpc("admin_save_profile", {
          p: {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            color: u.color,
            bio: u.bio ?? null,
            notes: u.notes ?? null,
            birthday: u.birthday ?? "",
            active: u.active,
            code: u.code,
          },
        }),

  upsertTemplate: (t: ClassTemplate) => rpc("save_template", { p: t }),
  deleteTemplate: (id: string) => rpc("delete_template", { p_id: id }),
  upsertSession: (s: Session) => rpc("save_session", { p: s }),
  cancelSession: (id: string) => rpc("cancel_session", { p_id: id }),
  restoreSession: (id: string) => rpc("restore_session", { p_id: id }),
  ensureSessions: () => supabase().rpc("ensure_sessions", { p_days: 42 }),
};
