"use client";

import { useState } from "react";
import { useDB, useStore } from "@/lib/store";
import type { ClassTemplate } from "@/lib/types";
import { fmt, roomSpots, uid, WEEKDAYS } from "@/lib/utils";
import { toast } from "@/components/toast";
import { Button, Field, Input, Modal, Segmented, Select } from "@/components/ui";

/** Crear clase recurrente (plantilla semanal) o una clase única; también edita plantillas. */
export function ClassFormModal({
  open,
  onClose,
  template,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  template?: ClassTemplate;
  defaultDate?: Date;
}) {
  const db = useDB();
  const upsertTemplate = useStore((s) => s.upsertTemplate);
  const upsertSession = useStore((s) => s.upsertSession);
  const disciplines = db.disciplines.filter((d) => d.active);
  const teachers = db.users.filter((u) => u.role === "teacher" && u.active);
  const base = defaultDate ?? new Date();

  const [mode, setMode] = useState<"recurring" | "single">("recurring");
  const [weekday, setWeekday] = useState(template?.weekday ?? base.getDay());
  const [date, setDate] = useState(fmt(base, "yyyy-MM-dd"));
  const [time, setTime] = useState(template?.startTime ?? "08:00");
  const [disciplineId, setDisciplineId] = useState(template?.disciplineId ?? disciplines[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(template?.teacherId ?? teachers[0]?.id ?? "");
  const [roomId, setRoomId] = useState(template?.roomId ?? db.rooms[0]?.id ?? "");
  const [duration, setDuration] = useState(template?.durationMin ?? disciplines[0]?.durationMin ?? 60);
  const [capacity, setCapacity] = useState(
    template?.capacity ?? (db.rooms[0] ? roomSpots(db.rooms[0]).length : 10),
  );

  const room = db.rooms.find((r) => r.id === roomId);
  const maxSpots = room ? roomSpots(room).length : 999;

  const save = () => {
    if (!disciplineId || !teacherId || !roomId) return toast("Completa disciplina, profesor y salón.", false);
    const cap = Math.max(1, Math.min(capacity, db.settings.spotSelection ? maxSpots : 999));
    if (template || mode === "recurring") {
      upsertTemplate({
        id: template?.id ?? uid("t"),
        disciplineId,
        teacherId,
        roomId,
        weekday,
        startTime: time,
        durationMin: duration,
        capacity: cap,
        active: true,
      });
      toast(template ? "Horario recurrente actualizado." : `Clase agregada todos los ${WEEKDAYS[weekday].toLowerCase()} a las ${time}.`);
    } else {
      const [h, m] = time.split(":").map(Number);
      const [y, mo, d] = date.split("-").map(Number);
      const start = new Date(y, mo - 1, d, h, m);
      upsertSession({
        id: uid("ses"),
        disciplineId,
        teacherId,
        roomId,
        startsAt: start.toISOString(),
        durationMin: duration,
        capacity: cap,
        status: "scheduled",
      });
      toast("Clase única creada.");
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Editar horario recurrente" : "Nueva clase"}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        {!template && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "recurring", label: "Cada semana" },
              { value: "single", label: "Una sola vez" },
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          {template || mode === "recurring" ? (
            <Field label="Día">
              <Select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          )}
          <Field label="Hora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Disciplina">
          <Select
            value={disciplineId}
            onChange={(e) => {
              setDisciplineId(e.target.value);
              const d = db.disciplines.find((x) => x.id === e.target.value);
              if (d) setDuration(d.durationMin);
            }}
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Profesor">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Salón" className="col-span-3 sm:col-span-1">
            <Select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                const r = db.rooms.find((x) => x.id === e.target.value);
                if (r) setCapacity(roomSpots(r).length);
              }}
            >
              {db.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duración (min)" className="col-span-3 sm:col-span-1">
            <Input type="number" min={15} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Cupo" hint={db.settings.spotSelection ? `Máx. ${maxSpots} lugares` : undefined} className="col-span-3 sm:col-span-1">
            <Input type="number" min={1} max={maxSpots} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </Field>
        </div>
        {(template || mode === "recurring") && (
          <p className="text-xs text-muted">
            Se generan automáticamente las clases de las próximas 6 semanas. Las clases que ya tienen reservaciones no se mueven.
          </p>
        )}
      </div>
    </Modal>
  );
}
