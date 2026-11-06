"use client";

import { useState } from "react";
import { Pencil, Plus, Star } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { cn, formatMoney, uid } from "@/lib/utils";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Textarea, Toggle } from "@/components/ui";

export default function PlansPage() {
  const db = useDB();
  const [form, setForm] = useState<{ key: number; plan?: Plan } | null>(null);
  const plans = [...db.plans].sort((a, b) => Number(b.active) - Number(a.active) || a.price - b.price);

  return (
    <div>
      <PageHeader
        title="Planes y precios"
        subtitle="Paquetes de clases y membresías que venden en la app y en recepción"
        actions={
          <Button onClick={() => setForm({ key: Date.now() })}>
            <Plus size={18} /> Nuevo plan
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => {
          const sold = db.memberships.filter((m) => m.planId === p.id && m.status !== "cancelled").length;
          const perClass = p.credits ? p.price / p.credits : null;
          const disciplines = p.disciplineIds.map((id) => db.disciplines.find((d) => d.id === id)?.name).filter(Boolean);
          return (
            <Card key={p.id} className={cn("relative flex flex-col p-5", p.featured && "ring-2 ring-brand", !p.active && "opacity-60")}>
              {p.featured && (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-brand-ink">
                  <Star size={12} /> Más popular
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                <button
                  className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"
                  onClick={() => setForm({ key: Date.now(), plan: p })}
                  aria-label={`Editar ${p.name}`}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(p.price)}</p>
              <p className="text-sm text-muted">
                {p.credits === null ? "Clases ilimitadas" : `${p.credits} clase${p.credits === 1 ? "" : "s"}`} · {p.validityDays} días
                {perClass !== null && p.credits! > 1 && ` · ${formatMoney(perClass)} por clase`}
              </p>
              <p className="mt-2 flex-1 text-sm">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {disciplines.length ? disciplines.map((n) => <Badge key={n} tone="brand">Solo {n}</Badge>) : <Badge>Todas las disciplinas</Badge>}
                {p.maxPerMember !== null && <Badge tone="amber">Máx. {p.maxPerMember} por alumno</Badge>}
                {!p.active && <Badge tone="red">No disponible</Badge>}
              </div>
              <p className="mt-3 text-xs text-muted">{sold} vendidos</p>
            </Card>
          );
        })}
      </div>
      {form && <PlanModal key={form.key} plan={form.plan} onClose={() => setForm(null)} />}
    </div>
  );
}

function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const db = useDB();
  const upsert = useStore((s) => s.upsertPlan);
  const [p, setP] = useState<Plan>(
    plan ?? {
      id: uid("p"),
      name: "",
      description: "",
      price: 0,
      credits: 4,
      validityDays: 30,
      disciplineIds: [],
      maxPerMember: null,
      featured: false,
      active: true,
    },
  );
  const unlimited = p.credits === null;
  const toggleDisc = (id: string) =>
    setP({ ...p, disciplineIds: p.disciplineIds.includes(id) ? p.disciplineIds.filter((x) => x !== id) : [...p.disciplineIds, id] });

  const save = () => {
    if (!p.name.trim()) return toast("El nombre es obligatorio.", false);
    if (p.price < 0 || p.validityDays < 1) return toast("Revisa precio y vigencia.", false);
    if (p.credits !== null && p.credits < 1) return toast("El paquete necesita al menos 1 clase.", false);
    upsert({ ...p, name: p.name.trim(), description: p.description.trim() });
    toast(plan ? "Plan actualizado. Los paquetes ya vendidos no cambian." : "Plan creado.");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? "Editar plan" : "Nuevo plan"}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ej. Paquete 8 clases" />
        </Field>
        <Field label="Descripción">
          <Textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio (MXN)">
            <Input type="number" min={0} step={50} value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} />
          </Field>
          <Field label="Vigencia (días)">
            <Input type="number" min={1} value={p.validityDays} onChange={(e) => setP({ ...p, validityDays: Number(e.target.value) })} />
          </Field>
        </div>
        <Toggle checked={unlimited} onChange={(v) => setP({ ...p, credits: v ? null : 4 })} label="Clases ilimitadas" hint="Membresía sin límite de créditos durante la vigencia." />
        {!unlimited && (
          <Field label="Número de clases (créditos)">
            <Input type="number" min={1} value={p.credits ?? 1} onChange={(e) => setP({ ...p, credits: Number(e.target.value) })} />
          </Field>
        )}
        <div>
          <span className="mb-1.5 block text-sm font-medium">Disciplinas incluidas</span>
          <p className="mb-2 text-xs text-muted">Si no eliges ninguna, el plan sirve para todas.</p>
          <div className="flex flex-wrap gap-2">
            {db.disciplines.map((d) => {
              const on = p.disciplineIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDisc(d.id)}
                  aria-pressed={on}
                  className={cn("h-11 rounded-full border px-4 text-sm transition", on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}
                >
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
        <Toggle
          checked={p.maxPerMember !== null}
          onChange={(v) => setP({ ...p, maxPerMember: v ? 1 : null })}
          label="Limitar compras por alumno"
          hint="Útil para clases de prueba o promociones de bienvenida."
        />
        {p.maxPerMember !== null && (
          <Field label="Máximo de compras por alumno">
            <Input type="number" min={1} value={p.maxPerMember} onChange={(e) => setP({ ...p, maxPerMember: Math.max(1, Number(e.target.value)) })} />
          </Field>
        )}
        <Toggle checked={p.featured} onChange={(v) => setP({ ...p, featured: v })} label="Destacar como 'Más popular'" />
        <Toggle checked={p.active} onChange={(v) => setP({ ...p, active: v })} label="Disponible para venta" />
      </div>
    </Modal>
  );
}
