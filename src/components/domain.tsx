"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, MapPin, UserMinus, UserPlus, X } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import {
  ATTENDANCE_OPENS_MIN,
  attendanceOpensAt,
  canCancelWithRefund,
  checkAttendance,
  checkBooking,
  creditsLeft,
  freeSpots,
  occupied,
  OCCUPYING,
  pendingMembership,
  pickMembership,
  takenSpots,
  userGuests,
  userReservation,
  waitlist,
} from "@/lib/rules";
import type { Reservation, Session, User } from "@/lib/types";
import { cn, endTime, fmt, isSameDay, longDay, roomSpots, spotLabel, timeOf } from "@/lib/utils";
import { toast, toastResult } from "./toast";
import { Avatar, Badge, Button, Field, Input, Modal, Occupancy } from "./ui";

/** Hora actual que se actualiza sola (para habilitar acciones que dependen de la hora). */
function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
        {/* Si no cabe en una línea, el salón baja a la siguiente en vez de desaparecer. */}
        <p className="flex min-w-0 flex-wrap gap-x-1 text-sm text-muted">
          {t && <span className="max-w-full truncate">{t.name}</span>}
          {room && <span className="max-w-full truncate">{t ? "· " : ""}{room.name}</span>}
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
  selectedLabel = "Tu lugar",
}: {
  session: Session;
  /** Lugar elegido (se pinta lleno). */
  value?: string;
  onChange?: (s: string) => void;
  /** Lugar que ya tiene el alumno. */
  mine?: string;
  /** Leyenda del lugar elegido (p. ej. "Lugar de tu invitado/a"). */
  selectedLabel?: string;
}) {
  const db = useDB();
  const room = db.rooms.find((r) => r.id === session.roomId);
  if (!room) return null;
  const taken = new Set(takenSpots(db, session.id));
  // Con el cupo lleno, los lugares que quedan libres en el salón ya no se pueden usar.
  const full = occupied(db, session.id) >= session.capacity;
  const spots = roomSpots(room);
  const anyUnavailable = full && spots.some((s) => !taken.has(s) && s !== mine && s !== value);
  return (
    <div>
      <div className="mb-3 rounded-xl bg-stone-100 py-1.5 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Frente · Profesor
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(2.5rem, 1fr))` }}>
          {Array.from({ length: room.rows }).flatMap((_, r) =>
            Array.from({ length: room.cols }).map((__, c) => {
              const s = spotLabel(r, c);
              const blocked = room.blockedSpots.includes(s);
              const isMine = !!mine && s === mine;
              const isTaken = taken.has(s) && !isMine;
              const isPicked = !isTaken && !isMine && value === s;
              const unavailable = full && !blocked && !isTaken && !isMine && !isPicked;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={blocked || isTaken || isMine || unavailable || !onChange}
                  onClick={() => onChange?.(s)}
                  className={cn(
                    "flex aspect-[3/4] items-center justify-center rounded-xl border text-sm font-medium transition",
                    blocked && "invisible",
                    isTaken && "border-stone-200 bg-stone-200 text-stone-400",
                    unavailable && "border-dashed border-stone-300 bg-surface text-stone-300",
                    isMine && (onChange ? "border-brand bg-brand-soft text-brand-strong" : "border-brand bg-brand text-brand-ink"),
                    isPicked && "border-brand bg-brand text-brand-ink",
                    !isTaken && !isMine && !isPicked && !unavailable && "border-line bg-surface hover:border-brand",
                  )}
                  aria-label={`Lugar ${s}${isTaken ? " ocupado" : isMine ? " (tu lugar)" : unavailable ? " no disponible" : ""}`}
                  aria-pressed={onChange ? isPicked : undefined}
                >
                  {s}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-line bg-surface" /> Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-stone-200" /> Ocupado
        </span>
        {anyUnavailable && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-dashed border-stone-300" /> Sin cupo
          </span>
        )}
        {mine && (
          <span className="flex items-center gap-1">
            <span className={cn("h-3 w-3 rounded", onChange ? "border border-brand bg-brand-soft" : "bg-brand")} /> Tu lugar
          </span>
        )}
        {onChange && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-brand" /> {selectedLabel}
          </span>
        )}
      </div>
      {session.capacity < spots.length && (
        <p className="mt-2 text-center text-xs text-muted">
          Cupo de la clase: {plural(session.capacity, "lugar", "lugares")} (el salón tiene {spots.length}).
        </p>
      )}
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
  /** Sin créditos: la página lleva a comprar un paquete (y luego de vuelta a esta clase). */
  onNeedPlan?: (session: Session) => void;
}) {
  const db = useDB();
  const book = useStore((s) => s.book);
  const cancel = useStore((s) => s.cancelReservation);
  const now = useNow();
  const [spot, setSpot] = useState<string>();
  const [guest, setGuest] = useState("");
  /** Reservando para un invitado/a (el mapa y el botón principal son para él/ella). */
  const [guestMode, setGuestMode] = useState(false);
  /** Reservación (propia o de un invitado) que espera confirmar su cancelación. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const info = useMemo(() => {
    if (!session) return null;
    return {
      res: userReservation(db, session.id, user.id),
      guests: userGuests(db, session.id, user.id),
      check: checkBooking(db, user, session, { now }),
      // El invitado no depende de que ya tengas lugar ni de tus límites por día/semana.
      guestCheck: checkBooking(db, user, session, { guest: true, now }),
      free: freeSpots(db, session),
      wl: waitlist(db, session.id),
    };
  }, [db, session, user, now]);

  if (!session || !info) return null;
  const st = db.settings;
  const d = db.disciplines.find((x) => x.id === session.disciplineId);
  const t = db.users.find((x) => x.id === session.teacherId);
  const room = db.rooms.find((x) => x.id === session.roomId);
  const { res, check, guestCheck, free, wl, guests } = info;
  const full = free.length === 0 || occupied(db, session.id) >= session.capacity;
  const pos = res?.status === "waitlist" ? wl.findIndex((r) => r.id === res.id) + 1 : 0;
  // Con paquete ilimitado no se descuenta nada al pasar de la lista de espera a la clase.
  const waitMem = res?.status === "waitlist" ? pickMembership(db, user.id, session) : undefined;
  const waitlistCharge = waitMem && waitMem.credits === null ? "" : " y se descuenta un crédito";
  const late = !canCancelWithRefund(db, session, now);
  /** ¿Cancelar esta reservación costaría un crédito? (el ilimitado no usa créditos) */
  const costsCredit = (r: Reservation) =>
    r.status === "booked" && db.memberships.find((m) => m.id === r.membershipId)?.credits !== null;
  // Si alguien ganó el lugar elegido, la selección deja de contar.
  const pickedSpot = spot && free.includes(spot) ? spot : undefined;
  const canGuest = st.allowGuests && !full && guestCheck.ok;
  const creditAtStake =
    guestMode ||
    (res ? costsCredit(res) : check.ok && !check.full && check.membership.credits !== null) ||
    guests.some(costsCredit);
  const confirming = confirmId ? [res, ...guests].find((r) => r?.id === confirmId) : undefined;
  const guestFirst = guest.trim().split(/\s+/)[0];

  const close = () => {
    setSpot(undefined);
    setGuest("");
    setGuestMode(false);
    setConfirmId(null);
    onClose();
  };

  const doBook = async () => {
    setBusy(true);
    const r = await toastResult(book(session.id, user.id, { spot: pickedSpot }));
    setBusy(false);
    if (r.ok) close();
    else setSpot(undefined);
  };
  const doGuest = async () => {
    if (!guest.trim()) return toast("Escribe el nombre de tu invitado/a.", false);
    setBusy(true);
    const r = await toastResult(book(session.id, user.id, { guestName: guest.trim(), spot: pickedSpot }));
    setBusy(false);
    if (r.ok) {
      // Regresa a la hoja de la clase: puede que también quieras reservar tu lugar.
      setGuestMode(false);
      setGuest("");
      setSpot(undefined);
    }
  };
  const doCancel = async (r: Reservation) => {
    setBusy(true);
    const out = await toastResult(cancel(r.id));
    setBusy(false);
    setConfirmId(null);
    if (out.ok && r.id === res?.id) close();
  };
  /** Dentro de la ventana de cancelación tardía se confirma antes; los invitados, siempre. */
  const askCancel = (r: Reservation) => {
    if (r.guestName || (late && costsCredit(r))) setConfirmId(r.id);
    else doCancel(r);
  };

  let footer: React.ReactNode;
  if (confirming) {
    const own = confirming.id === res?.id;
    const lost = late && costsCredit(confirming);
    const text = own
      ? `Faltan menos de ${st.cancelHours} h para la clase. Si cancelas ahora, no se devuelve tu crédito.`
      : confirming.status === "waitlist"
        ? `¿Sacar a ${confirming.guestName} de la lista de espera?`
        : lost
          ? `¿Cancelar la reservación de ${confirming.guestName}? Faltan menos de ${st.cancelHours} h, así que no se devuelve el crédito.`
          : `¿Cancelar la reservación de ${confirming.guestName}? Te devolvemos tu crédito.`;
    footer = (
      <div className="space-y-2">
        <p className={cn("text-sm", lost && "text-red-700")}>{text}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="sm:flex-1" disabled={busy} onClick={() => setConfirmId(null)}>
            {own ? "Conservar mi lugar" : "No, conservar"}
          </Button>
          <Button variant="danger" className="sm:flex-1" disabled={busy} onClick={() => doCancel(confirming)}>
            {lost ? "Cancelar sin reembolso" : "Sí, cancelar"}
          </Button>
        </div>
      </div>
    );
  } else if (guestMode) {
    footer = (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => {
            setGuestMode(false);
            setSpot(undefined);
          }}
        >
          Volver
        </Button>
        <Button
          size="lg"
          className="min-w-0 flex-1"
          onClick={doGuest}
          disabled={busy || !guestFirst || (st.spotSelection && !pickedSpot)}
        >
          <span className="truncate">
            {!guestFirst
              ? "Escribe su nombre"
              : st.spotSelection && !pickedSpot
                ? "Elige su lugar"
                : `Reservar para ${guestFirst}${pickedSpot ? ` · ${pickedSpot}` : ""}`}
          </span>
        </Button>
      </div>
    );
  } else if (res && (res.status === "attended" || res.status === "no_show")) {
    // Con la asistencia ya registrada no se cancela desde aquí (si hace falta, lo ajusta recepción).
    footer = undefined;
  } else if (res) {
    footer = (
      <Button variant="outline" className="w-full text-red-600" disabled={busy} onClick={() => askCancel(res)}>
        {res.status === "waitlist" ? "Salir de la lista de espera" : "Cancelar mi reservación"}
      </Button>
    );
  } else if (!check.ok) {
    footer = check.needsPlan ? (
      <Button className="w-full" size="lg" onClick={() => { close(); onNeedPlan?.(session); }}>
        Comprar paquete
      </Button>
    ) : (
      <Button className="w-full" size="lg" disabled>
        {check.pending ? "Pago pendiente en recepción" : "No disponible"}
      </Button>
    );
  } else {
    footer = (
      <Button className="w-full" size="lg" onClick={doBook} disabled={busy || (!full && st.spotSelection && !pickedSpot)}>
        {full ? "Unirme a la lista de espera" : st.spotSelection ? (pickedSpot ? `Reservar lugar ${pickedSpot}` : "Elige tu lugar") : "Reservar"}
      </Button>
    );
  }

  const lateNotice = late && creditAtStake && (
    <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <span>Faltan menos de {st.cancelHours} h para la clase: si cancelas, no se devuelve el crédito.</span>
    </div>
  );

  return (
    <Modal open onClose={close} title={d?.name ?? "Clase"} footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Clock size={15} /> {longDay(session.startsAt)} · {timeOf(session.startsAt)}–{endTime(session.startsAt, session.durationMin)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={15} /> {room?.name}
          </span>
        </div>

        {guestMode ? (
          <>
            <p className="font-medium">Reservar para un amigo</p>
            <Field label="Nombre de tu invitado/a">
              <Input placeholder="Nombre y apellido" maxLength={60} value={guest} onChange={(e) => setGuest(e.target.value)} />
            </Field>
            {st.spotSelection && (
              <div>
                <p className="mb-2 text-sm font-medium">Elige su lugar</p>
                <SpotPicker
                  session={session}
                  value={pickedSpot}
                  onChange={setSpot}
                  mine={res && OCCUPYING.includes(res.status) ? res.spot : undefined}
                  selectedLabel="Lugar de tu invitado/a"
                />
              </div>
            )}
            {guestCheck.ok && (
              <p className="text-sm text-muted">Se usa 1 crédito de tu {guestCheck.membership.planName}.</p>
            )}
            {lateNotice}
          </>
        ) : (
          <>
            {t && (
              <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
                <Avatar name={t.name} color={t.color} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.bio && <p className="truncate text-xs text-muted">{t.bio}</p>}
                </div>
              </div>
            )}
            {d && (
              <p className="text-sm text-muted">
                {d.description} <Badge tone="brand">{d.level}</Badge>
              </p>
            )}

            {res?.status === "booked" && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                <Check size={18} /> Tienes lugar reservado{res.spot ? ` (lugar ${res.spot})` : ""}.
              </div>
            )}
            {res?.status === "attended" && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                <Check size={18} /> Ya tienes check-in en esta clase{res.spot ? ` (lugar ${res.spot})` : ""}.
              </div>
            )}
            {res?.status === "no_show" && (
              <div className="rounded-2xl bg-stone-100 p-3 text-sm">
                El estudio registró esta reservación como falta. Si es un error, avísale a recepción.
              </div>
            )}
            {res?.status === "waitlist" && (
              <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                Estás en lista de espera (posición {pos}). Si se libera un lugar te lo asignamos automáticamente{waitlistCharge}.
              </div>
            )}
            {!res && !check.ok && <div className="rounded-2xl bg-stone-100 p-3 text-sm">{check.reason}</div>}
            {lateNotice}

            {st.spotSelection && (res ? OCCUPYING.includes(res.status) : check.ok && !full) && (
              <SpotPicker
                session={session}
                value={res ? undefined : pickedSpot}
                onChange={res ? undefined : setSpot}
                mine={res?.spot}
              />
            )}
            {!res && check.ok && full && (
              <p className="text-sm text-muted">
                {wl.length === 0
                  ? "La clase está llena, pero puedes ser la primera persona en la lista de espera."
                  : `La clase está llena. Hay ${plural(wl.length, "persona", "personas")} en la lista de espera.`}
              </p>
            )}

            {st.allowGuests && !full && (canGuest || (!guestCheck.ok && guestCheck.guestRule)) && (
              <div className="rounded-2xl border border-line px-3 py-1">
                {guestCheck.ok ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 py-1 text-left text-sm font-medium text-brand-text"
                    onClick={() => {
                      setGuestMode(true);
                      setSpot(undefined);
                      setConfirmId(null);
                    }}
                  >
                    <UserPlus size={18} className="shrink-0" />
                    <span>
                      Reservar para un amigo{" "}
                      <span className="font-normal text-muted">· usa 1 crédito de tu {guestCheck.membership.planName}</span>
                    </span>
                  </button>
                ) : (
                  <p className="flex items-start gap-2 py-2 text-sm text-muted">
                    <UserPlus size={18} className="mt-0.5 shrink-0" /> {guestCheck.reason}
                  </p>
                )}
              </div>
            )}
            {guests.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 font-medium">{guests.length === 1 ? "Tu invitado/a" : "Tus invitados"}</p>
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {guests.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                      <span className="min-w-0 truncate">
                        {g.guestName}
                        {g.status === "waitlist" ? (
                          <span className="text-muted"> · lista de espera</span>
                        ) : (
                          g.spot && <span className="text-muted"> · lugar {g.spot}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => askCancel(g)}
                        aria-label={`Cancelar la reservación de ${g.guestName}`}
                      >
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!late && creditAtStake && (
              <p className="text-xs text-muted">
                Puedes cancelar sin perder tu crédito hasta {st.cancelHours} h antes de la clase.
              </p>
            )}
          </>
        )}
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

export function ReservationStatusBadge({
  status,
  late,
  upcoming,
}: {
  status: Reservation["status"];
  late?: boolean;
  /** La clase aún no empieza (vista del alumno): un check-in anticipado no es "Asistió". */
  upcoming?: boolean;
}) {
  if (upcoming && status === "attended") return <Badge tone="green">Check-in hecho</Badge>;
  if (upcoming && status === "no_show") return <Badge tone="red">Falta registrada</Badge>;
  const s = STATUS[status];
  return <Badge tone={s.tone}>{late && status === "cancelled" ? "Cancelación tardía" : s.label}</Badge>;
}

export function AttendanceList({ session, staffId }: { session: Session; staffId: string }) {
  const db = useDB();
  const setAttendance = useStore((s) => s.setAttendance);
  const checkIn = useStore((s) => s.checkInByCode);
  const cancel = useStore((s) => s.cancelReservation);
  const book = useStore((s) => s.book);
  const now = useNow();
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  /** Reservación que espera confirmar "Quitar de la clase". */
  const [removeId, setRemoveId] = useState<string | null>(null);

  const cancelled = session.status === "cancelled";
  // Check-in y pase de lista: desde 60 min antes de la clase.
  const attendance = checkAttendance(session, now);
  const opensAt = attendanceOpensAt(session);
  const opensText = isSameDay(opensAt, now)
    ? `a las ${timeOf(opensAt)}`
    : `el ${fmt(opensAt, "EEEE d 'de' MMMM")} a las ${timeOf(opensAt)}`;
  const canRemove = !cancelled && new Date(session.startsAt) > now;

  const list = db.reservations
    .filter((r) => r.sessionId === session.id && r.status !== "cancelled")
    .sort((a, b) => (a.status === "waitlist" ? 1 : 0) - (b.status === "waitlist" ? 1 : 0) || (a.spot ?? "").localeCompare(b.spot ?? ""));
  const present = list.filter((r) => r.status === "attended").length;
  const enrolled = list.filter((r) => OCCUPYING.includes(r.status)).length;

  // Candidatos para agregar, con sus créditos para esta clase (primero quienes sí pueden).
  const candidates = adding
    ? db.users
        .filter(
          (u) =>
            u.role === "student" &&
            u.active &&
            !list.some((r) => r.userId === u.id && !r.guestName) &&
            u.name.toLowerCase().includes(q.toLowerCase()),
        )
        .map((u) => ({ u, m: pickMembership(db, u.id, session), pending: pendingMembership(db, u.id, session) }))
        .sort((a, b) => Number(!a.m) - Number(!b.m) || a.u.name.localeCompare(b.u.name, "es"))
    : [];

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
          <p className="text-2xl font-semibold tabular-nums">{cancelled ? "—" : Math.max(0, session.capacity - enrolled)}</p>
          <p className="text-xs text-muted">Libres</p>
        </div>
      </div>

      {cancelled ? (
        <div className="rounded-2xl bg-stone-100 p-3 text-sm">
          Esta clase está cancelada: no hay check-in ni se pueden agregar o quitar alumnos. Si se reactiva, podrás volver a usar la lista.
        </div>
      ) : (
        <div className="space-y-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              toastResult(checkIn(session.id, code));
              setCode("");
            }}
          >
            <Input
              className="min-w-0 flex-1"
              inputMode="numeric"
              placeholder="Código del alumno"
              aria-label="Código del alumno para hacer check-in"
              value={code}
              disabled={!attendance.ok}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" disabled={!attendance.ok}>
              Check-in
            </Button>
            <Button type="button" variant="outline" className="w-11 px-0" onClick={() => setAdding(true)} aria-label="Agregar alumno">
              <UserPlus size={18} />
            </Button>
          </form>
          {!attendance.ok && (
            <p className="text-xs text-muted">
              El check-in y el pase de lista se abren {opensText}, {ATTENDANCE_OPENS_MIN} min antes de la clase.
            </p>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{cancelled ? "No quedan reservaciones." : "Aún no hay reservaciones."}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((r) => {
            const u = db.users.find((x) => x.id === r.userId);
            const owner = u?.name ?? "Alumno";
            const name = r.guestName ?? owner;
            const m = r.membershipId ? db.memberships.find((x) => x.id === r.membershipId) : undefined;
            const refundText =
              r.status === "waitlist"
                ? "Saldrá de la lista de espera."
                : m && m.credits !== null
                  ? `Se devolverá el crédito a ${owner}.`
                  : "";
            return (
              <li key={r.id} className="p-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.spot ?? "–"}</span>
                  <span className="hidden sm:inline-flex">
                    <Avatar name={name} color={r.guestName ? "#a8a29e" : (u?.color ?? "#a8a29e")} size={36} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted">
                      {r.guestName ? `Invitado/a de ${owner}` : u?.code ? `Código ${u.code}` : ""}
                    </p>
                  </div>
                  {r.status === "waitlist" ? (
                    <ReservationStatusBadge status="waitlist" />
                  ) : (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => toastIfError(setAttendance(r.id, r.status === "attended" ? "booked" : "attended"))}
                        disabled={!attendance.ok && r.status !== "attended"}
                        title={attendance.ok ? undefined : attendance.reason}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:pointer-events-none disabled:opacity-40",
                          r.status === "attended" ? "border-emerald-600 bg-emerald-600 text-white" : "border-line hover:bg-emerald-50",
                        )}
                        aria-label="Marcar asistencia"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => toastIfError(setAttendance(r.id, r.status === "no_show" ? "booked" : "no_show"))}
                        disabled={!attendance.ok && r.status !== "no_show"}
                        title={attendance.ok ? undefined : attendance.reason}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:pointer-events-none disabled:opacity-40",
                          r.status === "no_show" ? "border-red-600 bg-red-600 text-white" : "border-line hover:bg-red-50",
                        )}
                        aria-label="Marcar falta"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                  {canRemove && (
                    <button
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => setRemoveId(removeId === r.id ? null : r.id)}
                      aria-label={`Quitar a ${name} de la clase`}
                      aria-expanded={removeId === r.id}
                    >
                      <UserMinus size={18} />
                    </button>
                  )}
                </div>
                {removeId === r.id && (
                  <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                    <p>
                      ¿Quitar a {name} de la clase? {refundText}
                    </p>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setRemoveId(null)}>
                        No
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          setRemoveId(null);
                          await toastResult(cancel(r.id, { staff: true, refund: true }));
                        }}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={adding && !cancelled} onClose={() => setAdding(false)} title="Agregar alumno a la clase">
        <Input placeholder="Buscar alumno" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 divide-y divide-line">
          {candidates.map(({ u, m, pending }) => {
            const left = m ? creditsLeft(m) : 0;
            const label = m
              ? m.credits === null
                ? "Ilimitado"
                : plural(left, "crédito", "créditos")
              : pending
                ? "Pago pendiente"
                : "Sin créditos vigentes";
            return (
              <li key={u.id}>
                <button
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-not-allowed"
                  disabled={!m}
                  onClick={async () => {
                    const r = await toastResult(book(session.id, u.id, { staff: true }));
                    if (r.ok) setAdding(false);
                  }}
                >
                  <span className={cn(!m && "opacity-50")}>
                    <Avatar name={u.name} color={u.color} size={32} />
                  </span>
                  <span className={cn("min-w-0 flex-1", !m && "opacity-60")}>
                    <span className="block truncate text-sm">{u.name}</span>
                    <span className="block text-xs text-muted">Código {u.code}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs", m ? "text-muted" : pending ? "text-amber-700" : "text-red-600")}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Se descuenta un crédito de su paquete vigente. Agregado por: {db.users.find((u) => u.id === staffId)?.name}
        </p>
      </Modal>
    </div>
  );
}
