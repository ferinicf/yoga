"use client";

import { useState } from "react";
import { Check, CreditCard, Store } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { couponDiscount, creditsLeft, currentMemberships, planPurchases } from "@/lib/rules";
import type { Plan } from "@/lib/types";
import { cn, fmt, formatMoney } from "@/lib/utils";
import { toastResult } from "@/components/toast";
import { quoteCoupon } from "@/lib/live";
import { Badge, Button, Card, Input, Modal, PageHeader } from "@/components/ui";

export default function PlansPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const purchase = useStore((s) => s.purchase);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string>();
  const [method, setMethod] = useState<"online" | "studio">("online");
  const [busy, setBusy] = useState(false);
  // En modo real aún no hay pasarela de pago: las compras se pagan en recepción.
  const onlineAvailable = useStore((s) => s.mode) === "demo";
  const payMethod = onlineAvailable ? method : "studio";

  const mems = currentMemberships(db, user.id);
  const plans = db.plans.filter((p) => p.active);
  const disc = (ids: string[]) =>
    ids.length === 0 ? "Todas las clases" : ids.map((id) => db.disciplines.find((d) => d.id === id)?.name).join(", ");

  const [liveQuote, setLiveQuote] = useState<{ discount: number; error?: string }>({ discount: 0 });
  const c = !plan ? { discount: 0 } : onlineAvailable ? couponDiscount(db, applied, plan.price) : liveQuote;
  const applyCoupon = async () => {
    const code = coupon.trim() || undefined;
    setApplied(code);
    if (!onlineAvailable && plan) setLiveQuote(code ? await quoteCoupon(code, plan.price) : { discount: 0 });
  };
  const close = () => {
    setPlan(null);
    setCoupon("");
    setApplied(undefined);
    setLiveQuote({ discount: 0 });
    setMethod("online");
  };
  const buy = async () => {
    if (!plan) return;
    setBusy(true);
    const r = await toastResult(
      purchase(user.id, plan.id, {
        method: payMethod === "online" ? "en_linea" : "efectivo",
        couponCode: applied,
        pending: payMethod === "studio",
        byUserId: user.id,
      }),
    );
    setBusy(false);
    if (r.ok) close();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Paquetes" subtitle="Compra clases y úsalas en cualquier horario." />

      {mems.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Mis paquetes</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mems.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{m.planName}</p>
                  {m.status === "active" ? <Badge tone="green">Activo</Badge> : <Badge tone="amber">Pago pendiente</Badge>}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {m.credits === null ? "Ilimitado" : `${creditsLeft(m)} / ${m.credits}`}
                </p>
                <p className="text-sm text-muted">
                  {m.status === "active" ? `Vence el ${fmt(m.expiresAt, "d 'de' MMMM yyyy")}` : "Paga en recepción para activarlo"}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Comprar</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const soldOut = p.maxPerMember !== null && planPurchases(db, user.id, p.id) >= p.maxPerMember;
            const perClass = p.credits ? Math.round(p.price / p.credits) : null;
            return (
              <Card key={p.id} className={cn("relative flex flex-col p-5", p.featured && "border-brand ring-1 ring-brand")}>
                {p.featured && <Badge tone="brand" className="absolute right-4 top-4">Más popular</Badge>}
                <p className="pr-24 font-semibold">{p.name}</p>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-4 text-3xl font-semibold tabular-nums">{formatMoney(p.price)}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  <li className="flex gap-2">
                    <Check size={16} className="mt-0.5 text-brand" /> {p.credits === null ? "Clases ilimitadas" : `${p.credits} clase${p.credits > 1 ? "s" : ""}`}
                    {perClass && p.credits! > 1 && <span className="text-muted">({formatMoney(perClass)} c/u)</span>}
                  </li>
                  <li className="flex gap-2">
                    <Check size={16} className="mt-0.5 text-brand" /> Vigencia de {p.validityDays} días
                  </li>
                  <li className="flex gap-2">
                    <Check size={16} className="mt-0.5 text-brand" /> {disc(p.disciplineIds)}
                  </li>
                </ul>
                <Button className="mt-5 w-full" variant={p.featured ? "primary" : "secondary"} disabled={soldOut} onClick={() => setPlan(p)}>
                  {soldOut ? "Ya lo usaste" : "Comprar"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      <Modal
        open={!!plan}
        onClose={close}
        title="Confirmar compra"
        footer={
          <Button className="w-full" size="lg" onClick={buy} disabled={busy}>
            {payMethod === "online" ? `Pagar ${formatMoney((plan?.price ?? 0) - c.discount)}` : "Apartar y pagar en recepción"}
          </Button>
        }
      >
        {plan && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-bg p-4">
              <p className="font-semibold">{plan.name}</p>
              <p className="text-sm text-muted">
                {plan.credits === null ? "Ilimitado" : `${plan.credits} clase(s)`} · {plan.validityDays} días
              </p>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Cupón de descuento" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
              <Button variant="outline" onClick={applyCoupon}>
                Aplicar
              </Button>
            </div>
            {applied && "error" in c && c.error && <p className="text-sm text-red-600">{c.error}</p>}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>{formatMoney(plan.price)}</span>
              </div>
              {c.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descuento ({applied})</span>
                  <span>−{formatMoney(c.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(plan.price - c.discount)}</span>
              </div>
            </div>
            {!onlineAvailable && (
              <div className="flex items-start gap-3 rounded-2xl border border-line p-3">
                <Store size={20} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">Pago en recepción</span>
                  <span className="block text-xs text-muted">
                    Tu paquete queda apartado y se activa cuando el estudio confirme tu pago. El pago en línea llegará pronto.
                  </span>
                </span>
              </div>
            )}
            <div className={cn("grid gap-2", !onlineAvailable && "hidden")}>
              <button
                onClick={() => setMethod("online")}
                className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left", method === "online" ? "border-brand ring-1 ring-brand" : "border-line")}
              >
                <CreditCard size={20} />
                <span>
                  <span className="block text-sm font-medium">Pagar en línea</span>
                  <span className="block text-xs text-muted">Tarjeta de crédito o débito (simulado en el demo)</span>
                </span>
              </button>
              {db.settings.allowPayAtStudio && (
                <button
                  onClick={() => setMethod("studio")}
                  className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left", method === "studio" ? "border-brand ring-1 ring-brand" : "border-line")}
                >
                  <Store size={20} />
                  <span>
                    <span className="block text-sm font-medium">Pagar en recepción</span>
                    <span className="block text-xs text-muted">Se activa cuando el estudio confirme tu pago</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
