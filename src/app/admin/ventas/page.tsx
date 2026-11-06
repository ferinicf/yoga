"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import type { PaymentMethod, Sale } from "@/lib/types";
import { capitalize, fmt, formatMoney, PAYMENT_LABEL } from "@/lib/utils";
import { toast } from "@/components/toast";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Segmented, Select } from "@/components/ui";
import { SellModal } from "@/components/admin/sell-modal";

type Filter = "all" | "paid" | "pending" | "refunded";
const STATUS: Record<Sale["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  paid: { label: "Pagado", tone: "green" },
  pending: { label: "Pendiente", tone: "amber" },
  refunded: { label: "Reembolsado", tone: "gray" },
};

export default function SalesPage() {
  const db = useDB();
  const confirmSale = useStore((s) => s.confirmSale);
  const refundSale = useStore((s) => s.refundSale);
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selling, setSelling] = useState(0);
  const [confirming, setConfirming] = useState<Sale | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");

  const { list, total, pendingAll, byMethod } = useMemo(() => {
    const end = addMonths(month, 1);
    const inMonth = db.sales.filter((s) => new Date(s.createdAt) >= month && new Date(s.createdAt) < end);
    const paid = inMonth.filter((s) => s.status === "paid");
    const byMethod = (["efectivo", "tarjeta", "transferencia", "en_linea"] as PaymentMethod[]).map((m) => ({
      m,
      v: paid.filter((s) => s.method === m).reduce((a, s) => a + s.total, 0),
    }));
    return {
      list: inMonth
        .filter((s) => filter === "all" || s.status === filter)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      total: paid.reduce((a, s) => a + s.total, 0),
      pendingAll: db.sales.filter((s) => s.status === "pending"),
      byMethod,
    };
  }, [db, month, filter]);

  const doRefund = (s: Sale) => {
    if (!confirm(`¿Reembolsar ${formatMoney(s.total)} de "${s.concept}"? El paquete del alumno se cancela.`)) return;
    refundSale(s.id);
    toast("Venta reembolsada y paquete cancelado.");
  };

  const actions = (s: Sale) => (
    <div className="flex shrink-0 gap-1">
      {s.status === "pending" && (
        <Button
          size="sm"
          className="h-11"
          onClick={() => {
            setMethod(s.method === "en_linea" ? "efectivo" : s.method);
            setConfirming(s);
          }}
        >
          Confirmar
        </Button>
      )}
      {s.status === "paid" && (
        <Button size="sm" variant="ghost" className="h-11 text-red-600" onClick={() => doRefund(s)}>
          Reembolsar
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Pagos de paquetes y membresías"
        actions={
          <Button onClick={() => setSelling((n) => n + 1)}>
            <Plus size={18} /> Nueva venta
          </Button>
        }
      />

      {pendingAll.length > 0 && (
        <button
          onClick={() => setFilter("pending")}
          className="mb-4 flex w-full items-center justify-between rounded-2xl bg-amber-50 p-4 text-left text-sm text-amber-900 ring-1 ring-amber-200"
        >
          <span>
            <strong>{pendingAll.length}</strong> pago(s) pendiente(s) por confirmar ·{" "}
            {formatMoney(pendingAll.reduce((a, s) => a + s.total, 0))}
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between">
            <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
              <ChevronLeft size={18} />
            </button>
            <p className="font-medium">{capitalize(fmt(month, "MMMM yyyy"))}</p>
            <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-3xl font-semibold tabular-nums">{formatMoney(total)}</p>
          <p className="text-center text-xs text-muted">Cobrado en el mes</p>
        </Card>
        <Card className="p-4 md:col-span-2">
          <p className="mb-2 text-sm text-muted">Por forma de pago</p>
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {byMethod.map(({ m, v }) => (
              <li key={m} className="rounded-xl bg-bg p-3">
                <p className="text-xs text-muted">{PAYMENT_LABEL[m]}</p>
                <p className="font-semibold tabular-nums">{formatMoney(v)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="no-scrollbar mb-4 overflow-x-auto">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todas" },
            { value: "paid", label: "Pagadas" },
            { value: "pending", label: "Pendientes" },
            { value: "refunded", label: "Reembolsadas" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty icon={<Receipt size={28} />} title="Sin ventas" text="No hay ventas con este filtro en el mes seleccionado." />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {list.map((s) => {
              const u = db.users.find((x) => x.id === s.userId);
              return (
                <li key={s.id} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    {u && <Avatar name={u.name} color={u.color} size={36} />}
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/alumnos/${s.userId}`} className="block truncate font-medium">
                        {u?.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {s.concept} · {fmt(s.createdAt, "d MMM HH:mm")}
                      </p>
                      <p className="text-xs text-muted">{PAYMENT_LABEL[s.method]}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatMoney(s.total)}</p>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                    </div>
                  </div>
                  {s.status !== "refunded" && <div className="mt-2 flex justify-end">{actions(s)}</div>}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => {
                  const u = db.users.find((x) => x.id === s.userId);
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted">{fmt(s.createdAt, "d MMM HH:mm")}</td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/alumnos/${s.userId}`} className="font-medium hover:underline">
                          {u?.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {s.concept}
                        {s.couponCode && <span className="block text-xs text-muted">Cupón {s.couponCode} (−{formatMoney(s.discount)})</span>}
                      </td>
                      <td className="px-4 py-2 text-muted">{PAYMENT_LABEL[s.method]}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{s.status !== "refunded" && actions(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirmar pago"
        footer={
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              if (!confirming) return;
              confirmSale(confirming.id, method);
              toast("Pago confirmado. El paquete ya está activo.");
              setConfirming(null);
            }}
          >
            Confirmar {confirming && formatMoney(confirming.total)}
          </Button>
        }
      >
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm">
              {db.users.find((u) => u.id === confirming.userId)?.name} · {confirming.concept}
            </p>
            <Field label="¿Cómo pagó?">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(["efectivo", "tarjeta", "transferencia"] as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">La vigencia del paquete empieza a contar desde hoy.</p>
          </div>
        )}
      </Modal>

      {selling > 0 && <SellModal key={selling} open onClose={() => setSelling(0)} />}
    </div>
  );
}
