"use client";

import { useMemo, useState } from "react";
import { Check, Clock, MapPin, UserPlus, X } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import { checkBooking, freeSpots, occupied, OCCUPYING, takenSpots, userReservation, waitlist } from "@/lib/rules";
import type { Reservation, Session, User } from "@/lib/types";
import { cn, endTime, longDay, spotLabel, timeOf } from "@/lib/utils";
import { toast, toastResult } from "./toast";
import { Avatar, Badge, Button, Input, Modal, Occupancy } from "./ui";

/* ---------- Tarjeta de clase ---------- */
export function SessionCard({
  session,
  onClick,
  right,
  showDate,
}: {
  session: Session;
  onClick?: () => void;
  right?: React.ReactNode;
  showDate?: boolean;
}) {
  const db = useDB();
  const d = db.disciplines.find((x) => x.id === session.disciplineId);
  const t = db.users.find((x) => x.id === session.teacherId);
  const room = db.rooms.find((x) => x.id === session.roomId);
  const occ = occupied(db, session.id);
  const cancelled = session.status === "cancelled";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-stretch gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3 text-left transition md:p-4",
        onClick && "hover:border-stone-300 hover:shadow-sm active:scale-[0.995]",
        cancelled && "opacity-60",
      )}
    >
      <div className="w-14 shrink-0 text-center">
        <p className="text-lg font-semibold tabular-nums leading-tight">{timeOf(session.startsAt)}</p>
        <p className="text-xs text-muted">{session.durationMin} min</p>
      </div>
      <div className="w-1 shrink-0 rounded-full" style={{ background: d?.color }} />
      <div className="min-w-0 flex-1">
        {showDate && <p className="text-xs font-medium text-muted">{longDay(session.startsAt)}</p>}
        <p className="truncate font-semibold">{d?.name}</p>
        <p className="truncate text-sm text-muted">
          {t?.name} · {room?.name}
        </p>
        <div className="mt-2 max-w-48">
          {cancelled ? <Badge tone="red">Cancelada</Badge> : <Occupancy value={occ} max={session.capacity} />}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center">{right}</div>}
    </Comp>
  );
}

/* ---------- Mapa de lugares ---------- */
export function SpotPicker({
  session,
  value,
  onChange,
  mine,
}: {
  session: Session;
  value?: string;
  onChange?: (s: string) => void;
  mine?: string;
}) {
  const db = useDB();
  const room = db.rooms.find((r) => r.id === session.roomId);
  if (!room) return null;
  const taken = new Set(takenSpots(db, session.id));
  return (
    <div>
      <div className="mb-3 rounded-xl bg-stone-100 py-1.5 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Frente · Profesor
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: room.rows }).flatMap((_, r) =>
          Array.from({ length: room.cols }).map((__, c) => {
            const s = spotLabel(r, c);
            const blocked = room.blockedSpots.includes(s);
            const isTaken = taken.has(s) && s !== mine;
            const selected = value === s || mine === s;
            return (
              <button
                key={s}
                type="button"
                disabled={blocked || isTaken || !onChange}
                onClick={() => onChange?.(s)}
                className={cn(
                  "flex aspect-[3/4] items-center justify-center rounded-xl border text-sm font-medium transition",
                  blocked && "invisible",
                  isTaken && "border-stone-200 bg-stone-200 text-stone-400",
                  !isTaken && !selected && "border-line bg-surface hover:border-brand",
                  selected && "border-brand bg-brand text-brand-ink",
                )}
                aria-label={`Lugar ${s}${isTaken ? " ocupado" : ""}`}
              >
                {s}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-line bg-surface" /> Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-stone-200" /> Ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-brand" /> Tu lugar
        </span>
      </div>
    </div>
  );
}

/* ---------- Hoja de reserva (alumno) ---------- */
export function BookingSheet({
  session,
  user,
  onClose,
  onNeedPlan,
}: {
  session: Session | null;
  user: User;
  onClose: () => void;
  onNeedPlan?: () => void;
}) {
  const db = useDB();
  const book = useStore((s) => s.book);
  const cancel = useStore((s) => s.cancelReservation);
  const [spot, setSpot] = useState<string>();
  const [guest, setGuest] = useState("");
  const [withGuest, setWithGuest] = useState(false);
  const [busy, setBusy] = useState(false);

  const info = useMemo(() => {
    if (!session) return null;
    const res = userReservation(db, session.id, user.id);
    const guests = db.reservations.filter(
      (r) => r.sessionId === session.id && r.userId === user.id && r.guestName && r.status !== "cancelled",
    );
    const check = checkBooking(db, user, session);
    return { res, guests, check, free: freeSpots(db, session), wl: waitlist(db, session.id) };
  }, [db, session, user]);

  if (!session || !info) return null;
  const d = db.disciplines.find((x) => x.id === session.disciplineId)!;
  const t = db.users.find((x) => x.id === session.teacherId)!;
  const room = db.rooms.find((x) => x.id === session.roomId);
  const { res, check, free, wl, guests } = info;
  const full = free.length === 0 || occupied(db, session.id) >= session.capacity;
  const pos = res?.status === "waitlist" ? wl.findIndex((r) => r.id === res.id) + 1 : 0;

  const close = () => {
    setSpot(undefined);
    setGuest("");
    setWithGuest(false);
    onClose();
  };

  const doBook = async () => {
    setBusy(true);
    const r = await toastResult(book(session.id, user.id, { spot }));
    setBusy(false);
    if (r.ok) close();
  };
  const doGuest = async () => {
    if (!guest.trim()) return toast("Escribe el nombre de tu invitado/a.", false);
    setBusy(true);
    const r = await toastResult(book(session.id, user.id, { guestName: guest.trim() }));
    setBusy(false);
    if (r.ok) close();
  };

  let footer: React.ReactNode;
  if (res) {
    footer = (
      <Button variant="outline" className="w-full text-red-600" disabled={busy} onClick={async () => { setBusy(true); await toastResult(cancel(res.id)); setBusy(false); close(); }}>
        {res.status === "waitlist" ? "Salir de la lista de espera" : "Cancelar mi reservación"}
      </Button>
    );
  } else if (!check.ok) {
    footer = check.needsPlan ? (
      <Button className="w-full" size="lg" onClick={() => { close(); onNeedPlan?.(); }}>
        Comprar paquete
      </Button>
    ) : (
      <Button className="w-full" size="lg" disabled>
        No disponible
      </Button>
    );
  } else {
    footer = (
      <Button className="w-full" size="lg" onClick={doBook} disabled={busy || (!full && db.settings.spotSelection && !spot)}>
        {full ? "Unirme a la lista de espera" : db.settings.spotSelection ? (spot ? `Reservar lugar ${spot}` : "Elige tu lugar") : "Reservar"}
      </Button>
    );
  }

  return (
    <Modal open onClose={close} title={d.name} footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Clock size={15} /> {longDay(session.startsAt)} · {timeOf(session.startsAt)}–{endTime(session.startsAt, session.durationMin)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={15} /> {room?.name}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
          <Avatar name={t.name} color={t.color} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t.name}</p>
            <p className="truncate text-xs text-muted">{t.bio}</p>
          </div>
        </div>
        <p className="text-sm text-muted">{d.description} <Badge tone="brand">{d.level}</Badge></p>

        {res?.status === "booked" && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <Check size={18} /> Tienes lugar reservado{res.spot ? ` (lugar ${res.spot})` : ""}.
          </div>
        )}
        {res?.status === "waitlist" && (
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            Estás en lista de espera (posición {pos}). Si se libera un lugar te lo asignamos automáticamente y se descuenta un crédito.
          </div>
        )}
        {!res && !check.ok && <div className="rounded-2xl bg-stone-100 p-3 text-sm">{check.reason}</div>}

        {db.settings.spotSelection && (res?.status === "booked" || (!res && check.ok && !full)) && (
          <SpotPicker session={session} value={spot} onChange={res ? undefined : setSpot} mine={res?.spot} />
        )}
        {!res && check.ok && full && (
          <p className="text-sm text-muted">La clase está llena. Hay {wl.length} persona(s) en lista de espera.</p>
        )}

        {db.settings.allowGuests && check.ok && !full && (
          <div className="rounded-2xl border border-line p-3">
            {!withGuest ? (
              <button className="flex items-center gap-2 text-sm font-medium text-brand" onClick={() => setWithGuest(true)}>
                <UserPlus size={16} /> Reservar para un amigo (usa 1 crédito tuyo)
              </button>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Nombre de tu invitado/a" value={guest} onChange={(e) => setGuest(e.target.value)} />
                <Button variant="secondary" onClick={doGuest} disabled={busy}>
                  Agregar
                </Button>
              </div>
            )}
          </div>
        )}
        {guests.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 font-medium">Tus invitados</p>
            {guests.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1">
                <span>
                  {g.guestName} {g.spot && <span className="text-muted">· lugar {g.spot}</span>}
                </span>
                <button className="text-red-600" onClick={() => toastResult(cancel(g.id))} aria-label="Cancelar invitado">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          Puedes cancelar sin perder tu crédito hasta {db.settings.cancelHours} h antes de la clase.
        </p>
      </div>
    </Modal>
  );
}

function toastIfError(p: Promise<{ ok: boolean; message: string }>) {
  p.then((r) => {
    if (!r.ok) toast(r.message, false);
  });
}

/* ---------- Lista de asistencia (profesor y admin) ---------- */
const STATUS: Record<Reservation["status"], { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }> = {
  booked: { label: "Reservado", tone: "blue" },
  attended: { label: "Asistió", tone: "green" },
  no_show: { label: "No asistió", tone: "red" },
  waitlist: { label: "Lista de espera", tone: "amber" },
  cancelled: { label: "Cancelado", tone: "gray" },
};

export function ReservationStatusBadge({ status, late }: { status: Reservation["status"]; late?: boolean }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{late && status === "cancelled" ? "Cancelación tardía" : s.label}</Badge>;
}

export function AttendanceList({ session, staffId }: { session: Session; staffId: string }) {
  const db = useDB();
  const setAttendance = useStore((s) => s.setAttendance);
  const checkIn = useStore((s) => s.checkInByCode);
  const cancel = useStore((s) => s.cancelReservation);
  const book = useStore((s) => s.book);
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");

  const list = db.reservations
    .filter((r) => r.sessionId === session.id && r.status !== "cancelled")
    .sort((a, b) => (a.status === "waitlist" ? 1 : 0) - (b.status === "waitlist" ? 1 : 0) || (a.spot ?? "").localeCompare(b.spot ?? ""));
  const present = list.filter((r) => r.status === "attended").length;
  const enrolled = list.filter((r) => OCCUPYING.includes(r.status)).length;

  const candidates = db.users.filter(
    (u) => u.role === "student" && u.active && !list.some((r) => r.userId === u.id && !r.guestName) && u.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-semibold tabular-nums">{enrolled}</p>
          <p className="text-xs text-muted">Inscritos</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-semibold tabular-nums">{present}</p>
          <p className="text-xs text-muted">Check-in</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-2xl font-semibold tabular-nums">{session.capacity - enrolled}</p>
          <p className="text-xs text-muted">Libres</p>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          toastResult(checkIn(session.id, code));
          setCode("");
        }}
      >
        <Input inputMode="numeric" placeholder="Código del alumno (check-in)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit">Check-in</Button>
        <Button type="button" variant="outline" onClick={() => setAdding(true)} aria-label="Agregar alumno">
          <UserPlus size={18} />
        </Button>
      </form>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aún no hay reservaciones.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((r) => {
            const u = db.users.find((x) => x.id === r.userId)!;
            const name = r.guestName ? `${r.guestName}` : u.name;
            return (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.spot ?? "–"}</span>
                <Avatar name={name} color={r.guestName ? "#a8a29e" : u.color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted">
                    {r.guestName ? `Invitado/a de ${u.name}` : `Código ${u.code}`}
                  </p>
                </div>
                {r.status === "waitlist" ? (
                  <ReservationStatusBadge status="waitlist" />
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => toastIfError(setAttendance(r.id, r.status === "attended" ? "booked" : "attended"))}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                        r.status === "attended" ? "border-emerald-600 bg-emerald-600 text-white" : "border-line hover:bg-emerald-50",
                      )}
                      aria-label="Marcar asistencia"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => toastIfError(setAttendance(r.id, r.status === "no_show" ? "booked" : "no_show"))}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                        r.status === "no_show" ? "border-red-600 bg-red-600 text-white" : "border-line hover:bg-red-50",
                      )}
                      aria-label="Marcar falta"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                {new Date(session.startsAt) > new Date() && (
                  <button
                    className="hidden text-xs text-muted underline md:block"
                    onClick={() => toastResult(cancel(r.id, { staff: true, refund: true }))}
                  >
                    Quitar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Agregar alumno a la clase">
        <Input placeholder="Buscar alumno" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 divide-y divide-line">
          {candidates.map((u) => (
            <li key={u.id}>
              <button
                className="flex w-full items-center gap-3 py-2.5 text-left"
                onClick={async () => {
                  const r = await toastResult(book(session.id, u.id, { staff: true }));
                  if (r.ok) setAdding(false);
                }}
              >
                <Avatar name={u.name} color={u.color} size={32} />
                <span className="flex-1 text-sm">{u.name}</span>
                <span className="text-xs text-muted">{u.code}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Se descuenta un crédito de su paquete vigente. Agregado por: {db.users.find((u) => u.id === staffId)?.name}</p>
      </Modal>
    </div>
  );
}
