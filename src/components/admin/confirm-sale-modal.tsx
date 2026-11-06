"use client";

import { useState } from "react";
import { useDB, useStore } from "@/lib/store";
import type { PaymentMethod, Sale } from "@/lib/types";
import { formatMoney, PAYMENT_LABEL } from "@/lib/utils";
import { toastDone } from "@/components/toast";
import { Button, Field, Modal, Select } from "@/components/ui";

const METHODS: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

/** Una venta que el alumno apartó en la app todavía no tiene forma de pago real. */
function methodPending(s: Sale): boolean {
  return s.status === "pending" && s.createdBy === s.userId;
}

/** Forma de pago para mostrar en listas: "Por definir" mientras un apartado no se cobra. */
export function saleMethodLabel(s: Sale): string {
  return methodPending(s) ? "Por definir" : PAYMENT_LABEL[s.method];
}

/** Confirmar un pago pendiente preguntando cómo pagó (se usa en Ventas y en el Inicio). */
export function ConfirmSaleModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const db = useDB();
  const confirmSale = useStore((s) => s.confirmSale);
  const known = !methodPending(sale) && METHODS.includes(sale.method);
  const [method, setMethod] = useState<PaymentMethod | "">(known ? sale.method : "");
  const [busy, setBusy] = useState(false);
  const student = db.users.find((u) => u.id === sale.userId);

  const submit = async () => {
    if (!method) return;
    setBusy(true);
    const r = await toastDone(confirmSale(sale.id, method), "Pago confirmado. El paquete ya está activo.");
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirmar pago"
      footer={
        <Button className="w-full" size="lg" disabled={!method || busy} onClick={submit}>
          Confirmar {formatMoney(sale.total)}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">
          {student?.name} · {sale.concept}
          {sale.couponCode && <span className="block text-xs text-muted">Cupón {sale.couponCode} (−{formatMoney(sale.discount)})</span>}
        </p>
        <Field label="¿Cómo pagó?">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {!known && (
              <option value="" disabled>
                Elige la forma de pago…
              </option>
            )}
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">La vigencia del paquete empieza a contar desde hoy.</p>
      </div>
    </Modal>
  );
}
