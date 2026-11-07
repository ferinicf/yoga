import type { ClassReminder } from "./native";
import type { DB, Session } from "./types";

/**
 * Recordatorio de una clase (app nativa). Se identifica con el id de la clase: cada alumno tiene
 * una sola reservación propia por clase, así que no hace falta conocer el id de la reservación.
 */
export function classReminder(db: DB, session: Session): ClassReminder {
  return {
    id: session.id,
    title: db.disciplines.find((d) => d.id === session.disciplineId)?.name ?? "Tu clase",
    at: session.startsAt,
    place: db.rooms.find((r) => r.id === session.roomId)?.name,
  };
}

/**
 * Recordatorios que debe tener este teléfono: las clases que el alumno tiene reservadas
 * (lugar confirmado, no lista de espera ni invitados) y que aún no empiezan.
 */
export function upcomingReminders(db: DB, userId: string, now = Date.now()): ClassReminder[] {
  if (db.users.find((u) => u.id === userId)?.role !== "student") return [];
  const sessions = new Map(db.sessions.map((s) => [s.id, s]));
  const out: ClassReminder[] = [];
  for (const r of db.reservations) {
    if (r.userId !== userId || r.guestName || r.status !== "booked") continue;
    const s = sessions.get(r.sessionId);
    if (s && s.status !== "cancelled" && new Date(s.startsAt).getTime() > now) out.push(classReminder(db, s));
  }
  return out;
}
