"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import type { Discipline, Room } from "@/lib/types";
import { cn, roomSpots, spotLabel, uid } from "@/lib/utils";
import { toast, toastResult, toastDone } from "@/components/toast";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Textarea, Toggle } from "@/components/ui";

const DISC_COLORS = ["#C98B6B", "#7C9A92", "#8E7CC3", "#D4A373", "#B5838D", "#6B9AC4", "#6D8B74", "#E09F7D"];
const LEVELS: Discipline["level"][] = ["Todos los niveles", "Principiante", "Intermedio", "Avanzado"];

export default function ClassesPage() {
  const db = useDB();
  const [disc, setDisc] = useState<{ key: number; d?: Discipline } | null>(null);
  const [room, setRoom] = useState<{ key: number; r?: Room } | null>(null);

  return (
    <div>
      <PageHeader title="Clases y salones" subtitle="Disciplinas que ofreces y los espacios donde se imparten" />

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Disciplinas</h2>
          <Button variant="secondary" onClick={() => setDisc({ key: Date.now() })}>
            <Plus size={16} /> Nueva disciplina
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.disciplines.map((d) => {
            const weekly = db.templates.filter((t) => t.disciplineId === d.id && t.active).length;
            return (
              <Card key={d.id} className={cn("flex gap-3 p-4", !d.active && "opacity-60")}>
                <span className="w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{d.name}</p>
                    <button
                      className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"
                      onClick={() => setDisc({ key: Date.now(), d })}
                      aria-label={`Editar ${d.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{d.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge>{d.durationMin} min</Badge>
                    <Badge tone="brand">{d.level}</Badge>
                    <Badge>{weekly} por semana</Badge>
                    {!d.active && <Badge tone="red">Inactiva</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Salones</h2>
          <Button variant="secondary" onClick={() => setRoom({ key: Date.now() })}>
            <Plus size={16} /> Nuevo salón
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.rooms.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted">
                    {roomSpots(r).length} lugares · {r.rows} filas × {r.cols} columnas
                  </p>
                </div>
                <button
                  className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"
                  onClick={() => setRoom({ key: Date.now(), r })}
                  aria-label={`Editar ${r.name}`}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${r.cols}, minmax(0, 1fr))` }}>
                {Array.from({ length: r.rows * r.cols }).map((_, i) => {
                  const s = spotLabel(Math.floor(i / r.cols), i % r.cols);
                  return <span key={s} className={cn("h-3 rounded", r.blockedSpots.includes(s) ? "bg-transparent" : "bg-brand-soft")} />;
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {disc && <DisciplineModal key={disc.key} discipline={disc.d} onClose={() => setDisc(null)} />}
      {room && <RoomModal key={room.key} room={room.r} onClose={() => setRoom(null)} />}
    </div>
  );
}

function DisciplineModal({ discipline, onClose }: { discipline?: Discipline; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertDiscipline);
  const [d, setD] = useState<Discipline>(
    discipline ?? {
      id: uid("d"),
      name: "",
      description: "",
      color: DISC_COLORS[0],
      durationMin: 60,
      level: "Todos los niveles",
      active: true,
    },
  );
  const save = async () => {
    if (!d.name.trim()) return toast("El nombre es obligatorio.", false);
    const r = await toastDone(
      upsert({ ...d, name: d.name.trim(), description: d.description.trim() }),
      discipline ? "Disciplina actualizada." : "Disciplina creada.",
    );
    if (r.ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={discipline ? "Editar disciplina" : "Nueva disciplina"}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Ej. Hatha" />
        </Field>
        <Field label="Descripción" hint="La ven los alumnos al reservar.">
          <Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duración (min)">
            <Input type="number" min={15} step={5} value={d.durationMin} onChange={(e) => setD({ ...d, durationMin: Number(e.target.value) })} />
          </Field>
          <Field label="Nivel">
            <Select value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as Discipline["level"] })}>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Color en el calendario</span>
          <div className="flex flex-wrap gap-2">
            {DISC_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setD({ ...d, color: c })}
                className="h-11 w-11 rounded-full"
                style={{ background: c, boxShadow: d.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <Toggle checked={d.active} onChange={(v) => setD({ ...d, active: v })} label="Activa" hint="Las inactivas no aparecen al crear clases." />
      </div>
    </Modal>
  );
}

function RoomModal({ room, onClose }: { room?: Room; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertRoom);
  const del = useStore((s) => s.deleteRoom);
  const [r, setR] = useState<Room>(room ?? { id: uid("r"), name: "", rows: 3, cols: 4, blockedSpots: [] });
  const resize = (rows: number, cols: number) => {
    const rr = Math.max(1, Math.min(10, rows || 1));
    const cc = Math.max(1, Math.min(10, cols || 1));
    const valid = new Set(roomSpots({ rows: rr, cols: cc, blockedSpots: [] }));
    setR({ ...r, rows: rr, cols: cc, blockedSpots: r.blockedSpots.filter((s) => valid.has(s)) });
  };
  const toggleSpot = (s: string) =>
    setR({ ...r, blockedSpots: r.blockedSpots.includes(s) ? r.blockedSpots.filter((x) => x !== s) : [...r.blockedSpots, s] });
  const save = async () => {
    if (!r.name.trim()) return toast("El nombre es obligatorio.", false);
    if (roomSpots(r).length === 0) return toast("El salón necesita al menos un lugar.", false);
    const res = await toastDone(
      upsert({ ...r, name: r.name.trim() }),
      room ? "Salón actualizado. El cupo de clases existentes no cambia." : "Salón creado.",
    );
    if (res.ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={room ? "Editar salón" : "Nuevo salón"}
      footer={
        <div className="flex gap-2">
          {room && (
            <Button
              variant="outline"
              className="text-red-600"
              aria-label="Eliminar salón"
              onClick={async () => {
                if (!confirm(`¿Eliminar ${room.name}?`)) return;
                const res = await toastResult(del(room.id));
                if (res.ok) onClose();
              }}
            >
              <Trash2 size={16} />
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={save}>
            Guardar · {roomSpots(r).length} lugares
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Ej. Salón Sol" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Filas">
            <Input type="number" min={1} max={10} value={r.rows} onChange={(e) => resize(Number(e.target.value), r.cols)} />
          </Field>
          <Field label="Columnas">
            <Input type="number" min={1} max={10} value={r.cols} onChange={(e) => resize(r.rows, Number(e.target.value))} />
          </Field>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Distribución de tapetes</p>
          <p className="mb-3 text-xs text-muted">Toca un lugar para bloquearlo (columna, puerta, bocina…).</p>
          <div className="mb-2 rounded-xl bg-stone-100 py-1.5 text-center text-xs font-medium uppercase tracking-wider text-muted">Frente</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${r.cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: r.rows * r.cols }).map((_, i) => {
              const s = spotLabel(Math.floor(i / r.cols), i % r.cols);
              const blocked = r.blockedSpots.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpot(s)}
                  className={cn(
                    "flex aspect-[3/4] min-h-11 items-center justify-center rounded-xl border text-sm font-medium transition",
                    blocked ? "border-dashed border-stone-300 bg-transparent text-stone-400 line-through" : "border-brand bg-brand-soft text-brand-strong",
                  )}
                  aria-pressed={!blocked}
                  aria-label={`Lugar ${s}${blocked ? " bloqueado" : ""}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
