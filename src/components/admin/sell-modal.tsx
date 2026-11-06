"use client";

import { useState } from "react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { couponDiscount } from "@/lib/rules";
import type { PaymentMethod } from "@/lib/types";
import { formatMoney, PAYMENT_LABEL } from "@/lib/utils";
import { toastDone } from "@/components/toast";
import { Button, Field, Input, Modal, Select, Toggle } from "@/components/ui";

/** Punto de venta: vender un paquete a un alumno (pagado o pendiente). */
export function SellModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId?: string }) {
  const db = useDB();
  const admin = useCurrentUser();
  const purchase = useStore((s) => s.purchase);
  const students = db.users.filter((u) => u.role === "student" && u.active).sort((a, b) => a.name.localeCompare(b.name));
  const plans = db.plans.filter((p) => p.active);
  const [student, setStudent] = useState(userId ?? "");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [coupon, setCoupon] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pending, setPending] = useState(false);

  const target = userId ?? student;
  const plan = plans.find((p) => p.id === planId);
  const c = plan ? couponDiscount(db, coupon || undefined, plan.price) : { discount: 0 };

  const submit = async () => {
    if (!target || !plan || !admin) return;
    const r = await toastDone(
      purchase(target, plan.id, {
        method,
        couponCode: coupon || undefined,
        pending,
        byUserId: admin.id,
      }),
      pending ? "Venta registrada como pendiente de pago." : "Venta registrada y paquete activado.",
    );
    if (r.ok) {
      setCoupon("");
      setPending(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vender paquete"
      footer={
        <Button className="w-full" size="lg" disabled={!target || !plan || !!c.error} onClick={submit}>
          {plan ? `Cobrar ${formatMoney(plan.price - c.discount)}` : "Cobrar"}
        </Button>
      }
    >
      <div className="space-y-4">
        {!userId && (
          <Field label="Alumno">
            <Select value={student} onChange={(e) => setStudent(e.target.value)}>
              <option value="">Selecciona un alumno…</option>
              {students.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.code}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Paquete">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price)}
              </option>
            ))}
          </Select>
        </Field>
        {plan && (
          <p className="text-sm text-muted">
            {plan.credits === null ? "Clases ilimitadas" : `${plan.credits} crédito(s)`} · vigencia {plan.validityDays} días
          </p>
        )}
        <Field label="Cupón (opcional)" hint={c.error ?? (c.discount ? `Descuento: ${formatMoney(c.discount)}` : undefined)}>
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="BIENVENIDA" />
        </Field>
        <Field label="Forma de pago">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(["efectivo", "tarjeta", "transferencia", "en_linea"] as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle checked={pending} onChange={setPending} label="Queda pendiente de pago" hint="El paquete se activa cuando confirmes el pago en Ventas." />
        {plan && (
          <div className="rounded-2xl bg-bg p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(plan.price)}</span>
            </div>
            {c.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Descuento</span>
                <span className="tabular-nums">−{formatMoney(c.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(plan.price - c.discount)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
