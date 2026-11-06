"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import type { PaymentMethod, Sale } from "@/lib/types";
import { capitalize, fmt, formatMoney, PAYMENT_LABEL } from "@/lib/utils";
import { toastDone } from "@/components/toast";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { SellModal } from "@/components/admin/sell-modal";
import { ConfirmSaleModal, saleMethodLabel } from "@/components/admin/confirm-sale-modal";

type Filter = "all" | "paid" | "pending" | "refunded";
const STATUS: Record<Sale["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  paid: { label: "Pagado", tone: "green" },
  pending: { label: "Pendiente", tone: "amber" },
  refunded: { label: "Reembolsado", tone: "gray" },
};

export default function SalesPage() {
  const db = useDB();
  const refundSale = useStore((s) => s.refundSale);
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selling, setSelling] = useState(0);
  const [confirming, setConfirming] = useState<Sale | null>(null);

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
    toastDone(refundSale(s.id), "Venta reembolsada y paquete cancelado.");
  };

  const actions = (s: Sale) => (
    <div className="flex shrink-0 justify-end gap-1">
      {s.status === "pending" && (
        <Button size="sm" className="h-11" onClick={() => setConfirming(s)}>
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
            <strong>{pendingAll.length}</strong> {pendingAll.length === 1 ? "pago pendiente" : "pagos pendientes"} por confirmar ·{" "}
            {formatMoney(pendingAll.reduce((a, s) => a + s.total, 0))}
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between">
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
              <ChevronLeft size={18} />
            </button>
            <p className="min-w-0 text-center font-medium">{capitalize(fmt(month, "MMMM yyyy"))}</p>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
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

      {/* En celular la tira llega al borde de la pantalla: si no cabe, se desliza. */}
      <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
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
          {/* Celular y iPad vertical: tarjetas (la tabla de 7 columnas no cabe) */}
          <ul className="space-y-2 lg:hidden">
            {list.map((s) => {
              const u = db.users.find((x) => x.id === s.userId);
              return (
                <li key={s.id} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <Link href={`/admin/alumnos/${s.userId}`} className="-m-1 flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-xl p-1 hover:bg-bg">
                      {u && <Avatar name={u.name} color={u.color} size={36} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u?.name}</p>
                        <p className="truncate text-xs text-muted">
                          {s.concept} · {fmt(s.createdAt, "d MMM HH:mm")}
                        </p>
                        {s.couponCode && (
                          <p className="truncate text-xs text-muted">
                            Cupón {s.couponCode} (−{formatMoney(s.discount)})
                          </p>
                        )}
                        <p className="text-xs text-muted">{saleMethodLabel(s)}</p>
                      </div>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{formatMoney(s.total)}</p>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                    </div>
                  </div>
                  {s.status !== "refunded" && <div className="mt-2 flex justify-end">{actions(s)}</div>}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface lg:block">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Alumno</th>
                  <th className="px-3 py-3 font-medium">Concepto</th>
                  <th className="px-3 py-3 font-medium">Pago</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => {
                  const u = db.users.find((x) => x.id === s.userId);
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{fmt(s.createdAt, "d MMM HH:mm")}</td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/alumnos/${s.userId}`} className="inline-flex min-h-11 items-center font-medium hover:underline">
                          {u?.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {s.concept}
                        {s.couponCode && <span className="block text-xs text-muted">Cupón {s.couponCode} (−{formatMoney(s.discount)})</span>}
                      </td>
                      <td className="px-3 py-2 text-muted">{saleMethodLabel(s)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{s.status !== "refunded" && actions(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirming && <ConfirmSaleModal key={confirming.id} sale={confirming} onClose={() => setConfirming(null)} />}

      {selling > 0 && <SellModal key={selling} open onClose={() => setSelling(0)} />}
    </div>
  );
}
