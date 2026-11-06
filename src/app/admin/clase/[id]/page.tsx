"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Ban, Clock, MapPin, Pencil, RotateCcw } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { occupied } from "@/lib/rules";
import type { Session } from "@/lib/types";
import { endTime, fmt, longDay, roomSpots, timeOf } from "@/lib/utils";
import { AttendanceList, SpotPicker } from "@/components/domain";
import { toast } from "@/components/toast";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, Select, Textarea } from "@/components/ui";

export default function AdminSessionPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const me = useCurrentUser();
  const cancelSession = useStore((s) => s.cancelSession);
  const restoreSession = useStore((s) => s.restoreSession);
  const [editing, setEditing] = useState(false);

  const session = db.sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <Empty
        title="Clase no encontrada"
        action={
          <Link href="/admin/calendario">
            <Button variant="secondary">Volver al calendario</Button>
          </Link>
        }
      />
    );
  }
  const disc = db.disciplines.find((x) => x.id === session.disciplineId);
  const teacher = db.users.find((x) => x.id === session.teacherId);
  const room = db.rooms.find((x) => x.id === session.roomId);
  const cancelled = session.status === "cancelled";
  const occ = occupied(db, session.id);

  return (
    <div>
      <Link href="/admin/calendario" className="mb-4 inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Calendario
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-12 w-1.5 rounded-full" style={{ background: disc?.color }} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{disc?.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Clock size={15} /> {longDay(session.startsAt)} · {timeOf(session.startsAt)}–{endTime(session.startsAt, session.durationMin)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={15} /> {room?.name}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {cancelled ? <Badge tone="red">Cancelada</Badge> : <Badge tone="brand">{occ}/{session.capacity} lugares ocupados</Badge>}
              {session.templateId && !session.detached && <Badge>Recurrente</Badge>}
              {session.detached && !cancelled && <Badge tone="amber">Editada individualmente</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cancelled && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Editar
            </Button>
          )}
          {cancelled ? (
            <Button
              variant="secondary"
              onClick={() => {
                restoreSession(session.id);
                toast("Clase restablecida. Las reservaciones canceladas no se recuperan.");
              }}
            >
              <RotateCcw size={16} /> Restablecer
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm(`¿Cancelar esta clase? Se cancelarán ${occ} reservación(es) y se devolverán los créditos.`)) return;
                cancelSession(session.id);
                toast("Clase cancelada y créditos devueltos.");
              }}
            >
              <Ban size={16} /> Cancelar clase
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Asistencia</h2>
          {me && <AttendanceList session={session} staffId={me.id} />}
        </section>
        <div className="space-y-6 lg:col-span-2">
          {teacher && (
            <Card className="flex items-center gap-3 p-4">
              <Avatar name={teacher.name} color={teacher.color} size={44} />
              <div className="min-w-0">
                <p className="text-xs text-muted">Profesor</p>
                <p className="font-medium">{teacher.name}</p>
                <p className="truncate text-xs text-muted">{teacher.bio}</p>
              </div>
            </Card>
          )}
          {db.settings.spotSelection && room && (
            <Card className="p-4">
              <h3 className="mb-3 font-semibold">Mapa de lugares · {room.name}</h3>
              <div className="mx-auto max-w-sm">
                <SpotPicker session={session} />
              </div>
            </Card>
          )}
          {session.notes && (
            <Card className="p-4">
              <h3 className="mb-1 font-semibold">Notas</h3>
              <p className="text-sm text-muted">{session.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {editing && <EditSessionModal session={session} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditSessionModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const db = useDB();
  const upsertSession = useStore((s) => s.upsertSession);
  const [date, setDate] = useState(fmt(session.startsAt, "yyyy-MM-dd"));
  const [time, setTime] = useState(fmt(session.startsAt, "HH:mm"));
  const [teacherId, setTeacherId] = useState(session.teacherId);
  const [roomId, setRoomId] = useState(session.roomId);
  const [capacity, setCapacity] = useState(session.capacity);
  const [duration, setDuration] = useState(session.durationMin);
  const [notes, setNotes] = useState(session.notes ?? "");
  const occ = occupied(db, session.id);
  const room = db.rooms.find((r) => r.id === roomId);
  const max = room ? roomSpots(room).length : 999;

  const save = () => {
    if (capacity < occ) return toast(`Ya hay ${occ} personas inscritas; el cupo no puede ser menor.`, false);
    if (roomId !== session.roomId && db.settings.spotSelection && occ > max)
      return toast(`El salón ${room?.name} solo tiene ${max} lugares y hay ${occ} inscritos.`, false);
    const [y, mo, d] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    upsertSession({
      ...session,
      startsAt: new Date(y, mo - 1, d, h, m).toISOString(),
      teacherId,
      roomId,
      capacity: db.settings.spotSelection ? Math.min(capacity, max) : capacity,
      durationMin: duration,
      notes: notes.trim() || undefined,
    });
    toast("Clase actualizada.");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar esta clase"
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar cambios
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Los cambios solo aplican a esta fecha. Para cambiar todas las semanas edita el horario recurrente.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Profesor (suplente)">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {db.users
              .filter((u) => u.role === "teacher" && (u.active || u.id === session.teacherId))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Salón" className="col-span-3 sm:col-span-1">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {db.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duración" className="col-span-3 sm:col-span-1">
            <Input type="number" min={15} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Cupo" hint={`Inscritos: ${occ}`} className="col-span-3 sm:col-span-1">
            <Input type="number" min={occ || 1} max={max} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. traer bloque y cinta" />
        </Field>
      </div>
    </Modal>
  );
}
