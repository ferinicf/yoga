export type Role = "admin" | "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Código corto para hacer check-in en recepción o con el profesor. */
  code: string;
  color: string;
  bio?: string;
  notes?: string;
  birthday?: string;
  active: boolean;
  createdAt: string;
  /** Solo profesores: precio por alumno en cada clase (lo que se cobra por cada crédito gastado). */
  rate?: number;
}

export interface Discipline {
  id: string;
  name: string;
  description: string;
  color: string;
  durationMin: number;
  level: "Todos los niveles" | "Principiante" | "Intermedio" | "Avanzado";
  active: boolean;
}

export interface Room {
  id: string;
  name: string;
  rows: number;
  cols: number;
  /** Lugares que no se pueden reservar (ej. columna, puerta). Formato "A1". */
  blockedSpots: string[];
}

/** Clase recurrente semanal (ej. Vinyasa los lunes 7:00). */
export interface ClassTemplate {
  id: string;
  disciplineId: string;
  teacherId: string;
  roomId: string;
  weekday: number; // 0 = domingo
  startTime: string; // "07:00"
  durationMin: number;
  capacity: number;
  active: boolean;
}

export type SessionStatus = "scheduled" | "cancelled";

/** Una clase concreta en una fecha y hora. */
export interface Session {
  id: string;
  templateId?: string;
  /** Si se editó individualmente ya no la actualiza su plantilla. */
  detached?: boolean;
  disciplineId: string;
  teacherId: string;
  roomId: string;
  startsAt: string; // ISO
  durationMin: number;
  capacity: number;
  status: SessionStatus;
  notes?: string;
  /** Precio por alumno del profesor y % que le toca, congelados al crear o asignar la clase. */
  teacherRate?: number;
  teacherShare?: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  /** null = ilimitado */
  credits: number | null;
  validityDays: number;
  /** vacío = todas las disciplinas */
  disciplineIds: string[];
  /** Máximo de compras por alumno (ej. clase muestra = 1). null = sin límite */
  maxPerMember: number | null;
  featured: boolean;
  active: boolean;
}

export type MembershipStatus = "active" | "pending_payment" | "cancelled";

export interface Membership {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  credits: number | null;
  creditsUsed: number;
  disciplineIds: string[];
  startsAt: string;
  expiresAt: string;
  status: MembershipStatus;
  saleId: string;
  createdAt: string;
}

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "en_linea";
export type SaleStatus = "paid" | "pending" | "refunded";

export interface Sale {
  id: string;
  userId: string;
  membershipId?: string;
  concept: string;
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  method: PaymentMethod;
  status: SaleStatus;
  createdAt: string;
  createdBy: string;
}

export type ReservationStatus =
  | "booked"
  | "waitlist"
  | "cancelled"
  | "attended"
  | "no_show";

export interface Reservation {
  id: string;
  sessionId: string;
  userId: string;
  spot?: string;
  status: ReservationStatus;
  membershipId?: string;
  /** Invitado/a de un alumno (reservar para un amigo). */
  guestName?: string;
  lateCancel?: boolean;
  /**
   * Solo faltas (no_show): ¿la falta gastó el crédito? Se decide al marcarla, con la
   * penalización vigente en ESE momento (columna reservations.no_show_charged). Así, cambiar
   * "Penalizar inasistencia" después no reescribe semanas pasadas. Vacío en datos viejos:
   * entonces se usa la configuración actual.
   */
  creditCharged?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  kind: "percent" | "amount";
  value: number;
  active: boolean;
  maxUses: number | null;
  uses: number;
  expiresAt?: string;
}

export interface Settings {
  studioName: string;
  tagline: string;
  brandColor: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  /** Horas antes de la clase para cancelar con reembolso de crédito. */
  cancelHours: number;
  /** Días hacia adelante en los que se puede reservar. */
  bookingWindowDays: number;
  dayLimit: number | null;
  weekLimit: number | null;
  waitlistEnabled: boolean;
  spotSelection: boolean;
  allowGuests: boolean;
  allowPayAtStudio: boolean;
  /**
   * Si no asiste, el crédito se pierde (siempre se descuenta al reservar). Aplica a las faltas
   * que se marquen de aquí en adelante: cada falta guarda su decisión (Reservation.creditCharged).
   */
  noShowPenalty: boolean;
  currency: "MXN";
  /** Correos que entran como administrador al registrarse (solo modo real). */
  adminEmails?: string[];
  /** % del cobro de cada clase que se lleva el profesor (el resto es del estudio). */
  teacherShare: number;
}

/** Pago que la administración le hace a un profesor (normalmente cada domingo). */
export interface TeacherPayout {
  id: string;
  teacherId: string;
  amount: number;
  paidAt: string;
  /** Último día (domingo) de la semana que cubre el pago. */
  periodEnd?: string;
  method: PaymentMethod;
  notes?: string;
  createdBy: string;
}

export interface DB {
  version: number;
  settings: Settings;
  users: User[];
  disciplines: Discipline[];
  rooms: Room[];
  templates: ClassTemplate[];
  sessions: Session[];
  plans: Plan[];
  memberships: Membership[];
  sales: Sale[];
  reservations: Reservation[];
  coupons: Coupon[];
  payouts: TeacherPayout[];
  /** Solo modo real: saldo histórico por profesor calculado en la base (teacher_balances). */
  teacherBalances?: { teacherId: string; earned: number }[];
}
