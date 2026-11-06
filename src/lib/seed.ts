import { addDays, startOfDay, subDays } from "date-fns";
import type {
  ClassTemplate,
  DB,
  Discipline,
  Membership,
  Plan,
  Reservation,
  Room,
  Sale,
  Session,
  User,
} from "./types";
import { roomSpots } from "./utils";

export const DB_VERSION = 1;

/** PRNG determinista para que el demo sea estable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const COLORS = ["#7C9A92", "#C98B6B", "#8E7CC3", "#D4A373", "#6B9AC4", "#B5838D", "#6D8B74", "#E09F7D"];

export function generateSessionsForTemplates(
  templates: ClassTemplate[],
  existing: Session[],
  from: Date,
  to: Date,
): Session[] {
  const out: Session[] = [];
  const keys = new Set(existing.map((s) => `${s.templateId}|${new Date(s.startsAt).toDateString()}`));
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    for (const t of templates) {
      if (!t.active || t.weekday !== d.getDay()) continue;
      const key = `${t.id}|${d.toDateString()}`;
      if (keys.has(key)) continue;
      const [h, m] = t.startTime.split(":").map(Number);
      const start = new Date(d);
      start.setHours(h, m, 0, 0);
      out.push({
        id: `ses_${t.id}_${start.getFullYear()}${start.getMonth() + 1}${start.getDate()}`,
        templateId: t.id,
        disciplineId: t.disciplineId,
        teacherId: t.teacherId,
        roomId: t.roomId,
        startsAt: start.toISOString(),
        durationMin: t.durationMin,
        capacity: t.capacity,
        status: "scheduled",
      });
      keys.add(key);
    }
  }
  return out;
}

export function createSeed(now = new Date()): DB {
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const iso = (d: Date) => d.toISOString();
  const created = iso(subDays(now, 120));

  const users: User[] = [
    { id: "u_admin", name: "Admin Demo", email: "admin@demo.mx", phone: "55 1000 0000", role: "admin", code: "1000", color: COLORS[0], active: true, createdAt: created },
    { id: "u_t1", name: "Ana Ramírez", email: "ana@demo.mx", phone: "55 2000 0001", role: "teacher", code: "2001", color: COLORS[1], bio: "Vinyasa y Power Yoga. Certificación RYT-500.", active: true, createdAt: created },
    { id: "u_t2", name: "Luis Herrera", email: "luis@demo.mx", phone: "55 2000 0002", role: "teacher", code: "2002", color: COLORS[2], bio: "Hatha y alineación. 10 años enseñando.", active: true, createdAt: created },
    { id: "u_t3", name: "Sofía Medina", email: "sofia@demo.mx", phone: "55 2000 0003", role: "teacher", code: "2003", color: COLORS[3], bio: "Yin, prenatal y meditación.", active: true, createdAt: created },
    { id: "u_t4", name: "Diego Castro", email: "diego@demo.mx", phone: "55 2000 0004", role: "teacher", code: "2004", color: COLORS[4], bio: "Ashtanga tradicional.", active: true, createdAt: created },
  ];
  const studentNames = [
    "Mariana López", "Carlos Méndez", "Valeria Torres", "Jorge Navarro", "Daniela Ruiz", "Andrea Flores",
    "Ricardo Vega", "Paula Jiménez", "Fernanda Silva", "Emilio Rojas", "Camila Ortiz", "Natalia Cruz",
    "Pablo Aguilar", "Lucía Morales", "Sebastián Ramos", "Regina Castillo", "Iván Domínguez", "Ximena Paredes",
    "Héctor Salinas", "Renata Ibarra", "Tomás Fuentes", "Alejandra Peña",
  ];
  studentNames.forEach((name, i) => {
    const first = name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    users.push({
      id: `u_s${i + 1}`,
      name,
      email: `${first}@demo.mx`,
      phone: `55 3000 ${String(i + 1).padStart(4, "0")}`,
      role: "student",
      code: String(3001 + i),
      color: COLORS[i % COLORS.length],
      active: true,
      createdAt: iso(subDays(now, 100 - i * 5)),
    });
  });
  const students = users.filter((u) => u.role === "student");

  const disciplines: Discipline[] = [
    { id: "d_vin", name: "Vinyasa Flow", description: "Secuencias fluidas sincronizadas con la respiración.", color: "#C98B6B", durationMin: 60, level: "Todos los niveles", active: true },
    { id: "d_hat", name: "Hatha", description: "Posturas sostenidas con énfasis en alineación.", color: "#7C9A92", durationMin: 60, level: "Principiante", active: true },
    { id: "d_yin", name: "Yin Yoga", description: "Posturas pasivas y largas para tejido conectivo.", color: "#8E7CC3", durationMin: 75, level: "Todos los niveles", active: true },
    { id: "d_ash", name: "Ashtanga", description: "Serie primaria, práctica dinámica y exigente.", color: "#D4A373", durationMin: 90, level: "Avanzado", active: true },
    { id: "d_pre", name: "Prenatal", description: "Práctica segura para el embarazo.", color: "#B5838D", durationMin: 60, level: "Todos los niveles", active: true },
    { id: "d_med", name: "Meditación", description: "Respiración (pranayama) y meditación guiada.", color: "#6B9AC4", durationMin: 45, level: "Todos los niveles", active: true },
  ];

  const rooms: Room[] = [
    { id: "r_main", name: "Salón Sol", rows: 3, cols: 5, blockedSpots: [] },
    { id: "r_small", name: "Salón Luna", rows: 2, cols: 4, blockedSpots: [] },
  ];

  const T = (id: string, d: string, t: string, room: string, weekday: number, time: string, cap?: number): ClassTemplate => {
    const disc = disciplines.find((x) => x.id === d)!;
    const r = rooms.find((x) => x.id === room)!;
    return { id, disciplineId: d, teacherId: t, roomId: room, weekday, startTime: time, durationMin: disc.durationMin, capacity: cap ?? roomSpots(r).length, active: true };
  };
  const templates: ClassTemplate[] = [];
  for (const wd of [1, 2, 3, 4, 5]) {
    templates.push(T(`t_${wd}_07`, "d_vin", "u_t1", "r_main", wd, "07:00"));
    templates.push(T(`t_${wd}_09`, "d_hat", "u_t2", "r_main", wd, "09:00"));
    templates.push(T(`t_${wd}_18`, wd % 2 ? "d_yin" : "d_med", "u_t3", wd % 2 ? "r_main" : "r_small", wd, "18:00"));
    templates.push(T(`t_${wd}_1930`, wd % 2 ? "d_vin" : "d_ash", wd % 2 ? "u_t1" : "u_t4", "r_main", wd, "19:30"));
  }
  templates.push(T("t_2_11", "d_pre", "u_t3", "r_small", 2, "11:00"));
  templates.push(T("t_4_11", "d_pre", "u_t3", "r_small", 4, "11:00"));
  templates.push(T("t_6_09", "d_vin", "u_t1", "r_main", 6, "09:00"));
  templates.push(T("t_6_11", "d_ash", "u_t4", "r_main", 6, "11:00"));
  templates.push(T("t_0_10", "d_yin", "u_t3", "r_main", 0, "10:00"));

  const sessions = generateSessionsForTemplates(templates, [], subDays(now, 21), addDays(now, 42));

  const plans: Plan[] = [
    { id: "p_trial", name: "Clase de prueba", description: "Tu primera clase para conocernos.", price: 150, credits: 1, validityDays: 7, disciplineIds: [], maxPerMember: 1, featured: false, active: true },
    { id: "p_1", name: "Clase suelta", description: "Una clase, cualquier disciplina.", price: 250, credits: 1, validityDays: 30, disciplineIds: [], maxPerMember: null, featured: false, active: true },
    { id: "p_4", name: "Paquete 4 clases", description: "Ideal para practicar una vez por semana.", price: 850, credits: 4, validityDays: 30, disciplineIds: [], maxPerMember: null, featured: false, active: true },
    { id: "p_8", name: "Paquete 8 clases", description: "Dos clases por semana.", price: 1500, credits: 8, validityDays: 35, disciplineIds: [], maxPerMember: null, featured: true, active: true },
    { id: "p_12", name: "Paquete 12 clases", description: "Tres clases por semana.", price: 2000, credits: 12, validityDays: 45, disciplineIds: [], maxPerMember: null, featured: false, active: true },
    { id: "p_unl", name: "Ilimitado mensual", description: "Todas las clases que quieras durante 30 días.", price: 2400, credits: null, validityDays: 30, disciplineIds: [], maxPerMember: null, featured: false, active: true },
    { id: "p_pre", name: "Prenatal 8 clases", description: "Solo clases prenatales.", price: 1200, credits: 8, validityDays: 45, disciplineIds: ["d_pre"], maxPerMember: null, featured: false, active: true },
  ];

  const memberships: Membership[] = [];
  const sales: Sale[] = [];
  const reservations: Reservation[] = [];

  const sell = (u: User, p: Plan, start: Date, method: Sale["method"], status: Sale["status"] = "paid") => {
    const saleId = `sale_${sales.length + 1}`;
    const mId = `mem_${memberships.length + 1}`;
    sales.push({ id: saleId, userId: u.id, membershipId: mId, concept: p.name, subtotal: p.price, discount: 0, total: p.price, method, status, createdAt: iso(start), createdBy: status === "paid" && method !== "en_linea" ? "u_admin" : u.id });
    memberships.push({ id: mId, userId: u.id, planId: p.id, planName: p.name, credits: p.credits, creditsUsed: 0, disciplineIds: p.disciplineIds, startsAt: iso(start), expiresAt: iso(addDays(start, p.validityDays)), status: status === "paid" ? "active" : "pending_payment", saleId, createdAt: iso(start) });
    return memberships[memberships.length - 1];
  };

  // Historial de ventas de meses anteriores (membresías ya vencidas).
  const methods: Sale["method"][] = ["efectivo", "tarjeta", "transferencia", "en_linea"];
  for (let i = 0; i < 46; i++) {
    const u = pick(students);
    const p = pick(plans.slice(1, 6));
    sell(u, p, subDays(now, 35 + Math.floor(rand() * 85)), pick(methods));
  }
  memberships.forEach((m) => {
    m.creditsUsed = m.credits ?? 0;
  });

  // Membresías vigentes (20 de 22 alumnos; 2 sin paquete para probar la compra).
  students.slice(0, 20).forEach((u, i) => {
    const p = i === 3 ? plans.find((x) => x.id === "p_pre")! : i % 4 === 0 ? plans[5] : pick([plans[2], plans[3], plans[3], plans[4]]);
    sell(u, p, subDays(now, 3 + Math.floor(rand() * 18)), pick(methods));
  });
  // Un pago pendiente en recepción.
  sell(students[20], plans[2], subDays(now, 1), "efectivo", "pending");

  const spotsFor = (s: Session) => roomSpots(rooms.find((r) => r.id === s.roomId)!);
  // Cada alumno practica como máximo una vez al día.
  const busy = new Set<string>();

  for (const s of sessions) {
    const start = new Date(s.startsAt);
    const past = start < now;
    const daysAhead = (start.getTime() - now.getTime()) / 864e5;
    if (daysAhead > 6) continue;
    const fill = past ? 0.45 + rand() * 0.5 : Math.max(0, 0.95 - daysAhead * 0.12 + (rand() - 0.5) * 0.3);
    const target = Math.min(s.capacity, Math.round(s.capacity * fill));
    const spots = [...spotsFor(s)].sort(() => rand() - 0.5);
    const pool = [...students].sort(() => rand() - 0.5);
    let placed = 0;
    for (const u of pool) {
      if (placed >= target) break;
      const dayKey = `${u.id}|${start.toDateString()}`;
      if (busy.has(dayKey) || rand() < 0.35) continue;
      const m = memberships.find(
        (x) =>
          x.userId === u.id &&
          x.status === "active" &&
          new Date(x.startsAt) <= start &&
          new Date(x.expiresAt) >= start &&
          // En el pasado dejamos créditos de reserva para que el demo tenga clases por reservar.
          (x.credits === null || x.creditsUsed < x.credits - (past ? 4 : 2)) &&
          (x.disciplineIds.length === 0 || x.disciplineIds.includes(s.disciplineId)),
      );
      if (!m) continue;
      m.creditsUsed += 1;
      busy.add(dayKey);
      reservations.push({
        id: `res_${reservations.length + 1}`,
        sessionId: s.id,
        userId: u.id,
        spot: spots[placed],
        status: past ? (rand() < 0.9 ? "attended" : "no_show") : "booked",
        membershipId: m.id,
        createdAt: iso(subDays(start, 1 + Math.floor(rand() * 4))),
        updatedAt: iso(subDays(start, 1)),
      });
      placed++;
    }
    // Lista de espera en clases llenas próximas.
    if (!past && placed >= s.capacity) {
      const extra = pool.filter((u) => !reservations.some((r) => r.sessionId === s.id && r.userId === u.id)).slice(0, 2);
      extra.forEach((u) =>
        reservations.push({ id: `res_${reservations.length + 1}`, sessionId: s.id, userId: u.id, status: "waitlist", createdAt: iso(subDays(now, 1)), updatedAt: iso(subDays(now, 1)) }),
      );
    }
  }

  return {
    version: DB_VERSION,
    settings: {
      studioName: "Mi Estudio de Yoga",
      tagline: "Respira, muévete, conecta.",
      brandColor: "#5B7F6E",
      address: "Av. Ejemplo 123, Col. Centro, CDMX",
      phone: "55 0000 0000",
      whatsapp: "5500000000",
      instagram: "miestudio",
      cancelHours: 8,
      bookingWindowDays: 14,
      dayLimit: 2,
      weekLimit: null,
      waitlistEnabled: true,
      spotSelection: true,
      allowGuests: true,
      allowPayAtStudio: true,
      noShowPenalty: true,
      currency: "MXN",
    },
    users,
    disciplines,
    rooms,
    templates,
    sessions,
    plans,
    memberships,
    sales,
    reservations,
    coupons: [
      { id: "c_1", code: "BIENVENIDA", kind: "percent", value: 15, active: true, maxUses: null, uses: 4 },
      { id: "c_2", code: "AMIGA100", kind: "amount", value: 100, active: true, maxUses: 20, uses: 7 },
    ],
  };
}
