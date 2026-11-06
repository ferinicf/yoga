"use client";

import { useState } from "react";
import { Pencil, Plus, Ticket } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import type { Coupon } from "@/lib/types";
import { fmt, formatMoney, uid } from "@/lib/utils";
import { toast, toastDone } from "@/components/toast";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Toggle } from "@/components/ui";
import { NumberInput } from "@/components/admin/number-input";

function couponState(c: Coupon): { label: string; tone: "green" | "gray" | "red" | "amber" } {
  if (!c.active) return { label: "Inactivo", tone: "gray" };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: "Vencido", tone: "red" };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { label: "Agotado", tone: "amber" };
  return { label: "Activo", tone: "green" };
}

export default function CouponsPage() {
  const db = useDB();
  const [form, setForm] = useState<{ key: number; c?: Coupon } | null>(null);

  return (
    <div>
      <PageHeader
        title="Cupones"
        subtitle="Descuentos que los alumnos aplican al comprar un paquete"
        actions={
          <Button onClick={() => setForm({ key: Date.now() })}>
            <Plus size={18} /> Nuevo cupón
          </Button>
        }
      />
      {db.coupons.length === 0 ? (
        <Empty icon={<Ticket size={28} />} title="Aún no hay cupones" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {db.coupons.map((c) => {
            const st = couponState(c);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-lg font-semibold tracking-wider">{c.code}</p>
                  <button
                    className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"
                    onClick={() => setForm({ key: Date.now(), c })}
                    aria-label={`Editar ${c.code}`}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <p className="text-2xl font-semibold">{c.kind === "percent" ? `${c.value}% de descuento` : `${formatMoney(c.value)} de descuento`}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span>
                    {c.uses} uso{c.uses === 1 ? "" : "s"}
                    {c.maxUses !== null && ` de ${c.maxUses}`}
                  </span>
                  {c.expiresAt && <span>· vence {fmt(c.expiresAt, "d MMM yyyy")}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {form && <CouponModal key={form.key} coupon={form.c} onClose={() => setForm(null)} />}
    </div>
  );
}

function CouponModal({ coupon, onClose }: { coupon?: Coupon; onClose: () => void }) {
  const db = useDB();
  const upsert = useStore((s) => s.upsertCoupon);
  const [c, setC] = useState<Coupon>(coupon ?? { id: uid("c"), code: "", kind: "percent", value: 10, active: true, maxUses: null, uses: 0 });

  const save = async () => {
    const code = c.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return toast("Escribe el código.", false);
    if (db.coupons.some((x) => x.code.toUpperCase() === code && x.id !== c.id)) return toast("Ese código ya existe.", false);
    if (c.value <= 0) return toast("El descuento debe ser mayor que 0.", false);
    if (c.kind === "percent" && c.value > 100) return toast("El descuento no puede pasar del 100%.", false);
    const r = await toastDone(upsert({ ...c, code }), coupon ? "Cupón actualizado." : "Cupón creado.");
    if (r.ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={coupon ? "Editar cupón" : "Nuevo cupón"}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Código" hint="Sin espacios. Los alumnos lo escriben al pagar.">
          <Input className="font-mono uppercase" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="VERANO20" />
        </Field>
        <Segmented
          value={c.kind}
          onChange={(kind) => setC({ ...c, kind })}
          options={[
            { value: "percent", label: "Porcentaje" },
            { value: "amount", label: "Monto fijo" },
          ]}
        />
        <Field label={c.kind === "percent" ? "Descuento (%)" : "Descuento (MXN)"}>
          <NumberInput min={1} max={c.kind === "percent" ? 100 : undefined} value={c.value} onChange={(v) => setC({ ...c, value: v })} />
        </Field>
        <Toggle checked={c.maxUses !== null} onChange={(v) => setC({ ...c, maxUses: v ? 10 : null })} label="Limitar número de usos" />
        {c.maxUses !== null && (
          <Field label="Usos máximos" hint={`Se ha usado ${c.uses} ${c.uses === 1 ? "vez" : "veces"} hasta ahora.`}>
            <NumberInput min={1} clamp value={c.maxUses} onChange={(v) => setC({ ...c, maxUses: v })} />
          </Field>
        )}
        <Field label="Fecha de vencimiento (opcional)">
          <Input
            type="date"
            value={c.expiresAt ? fmt(c.expiresAt, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              if (!e.target.value) return setC({ ...c, expiresAt: undefined });
              const [y, m, d] = e.target.value.split("-").map(Number);
              setC({ ...c, expiresAt: new Date(y, m - 1, d, 23, 59, 59).toISOString() });
            }}
          />
        </Field>
        <Toggle checked={c.active} onChange={(v) => setC({ ...c, active: v })} label="Activo" />
      </div>
    </Modal>
  );
}
