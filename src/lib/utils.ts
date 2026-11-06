import { format, isSameDay, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMoney(n: number): string {
  return money.format(n);
}

export function fmt(date: string | Date, pattern: string): string {
  return format(typeof date === "string" ? new Date(date) : date, pattern, { locale: es });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "lunes 3 de noviembre" */
export function longDay(date: string | Date): string {
  return capitalize(fmt(date, "EEEE d 'de' MMMM"));
}

export function timeOf(date: string | Date): string {
  return fmt(date, "HH:mm");
}

export function endTime(startsAt: string, durationMin: number): string {
  return timeOf(new Date(new Date(startsAt).getTime() + durationMin * 60000));
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export { isSameDay };

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Etiqueta de lugar: fila (A, B, C…) + columna (1, 2, 3…). */
export function spotLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export function roomSpots(room: { rows: number; cols: number; blockedSpots: string[] }): string[] {
  const out: string[] = [];
  for (let r = 0; r < room.rows; r++)
    for (let c = 0; c < room.cols; c++) {
      const s = spotLabel(r, c);
      if (!room.blockedSpots.includes(s)) out.push(s);
    }
  return out;
}

export const PAYMENT_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta (terminal)",
  transferencia: "Transferencia",
  en_linea: "Pago en línea",
};
