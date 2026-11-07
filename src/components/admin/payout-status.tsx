"use client";

import { sumMoney, type WeekPay } from "@/lib/payouts";
import { cn, formatMoneyCents } from "@/lib/utils";
import { Badge } from "@/components/ui";

const ALIGN = { start: "items-start", center: "items-center", end: "items-end" } as const;

/**
 * Valor de "Le debemos": el monto, "Al corriente" si el saldo es 0, o "Adelanto · $X de más"
 * si se le pagó de más. Mismo texto en Pagos, en su detalle y en Profesores.
 */
export function OwedValue({ owed, className, align = "end" }: { owed: number; className?: string; align?: keyof typeof ALIGN }) {
  if (owed > 0) return <span className={cn("font-semibold tabular-nums", className)}>{formatMoneyCents(owed)}</span>;
  if (owed < 0)
    return (
      <span className={cn("inline-flex flex-col", ALIGN[align])}>
        <Badge tone="blue">Adelanto</Badge>
        <span className="mt-0.5 text-xs tabular-nums text-muted">{formatMoneyCents(-owed)} de más</span>
      </span>
    );
  return <Badge tone="green">Al corriente</Badge>;
}

/**
 * Estado de pago de UNA semana (de weekPayStatus): Pagada · Pago parcial (pagado $X de $Y) ·
 * Pendiente · En curso · Sin cobro.
 */
export function WeekPayBadge({ pay, align = "end" }: { pay: WeekPay; align?: keyof typeof ALIGN }) {
  switch (pay.status) {
    case "pagada":
      return <Badge tone="green">Pagada</Badge>;
    case "parcial":
      return (
        <span className={cn("inline-flex flex-col", ALIGN[align])}>
          <Badge tone="amber">Pago parcial</Badge>
          <span className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-muted">
            Pagado {formatMoneyCents(sumMoney([pay.earned, -pay.pending]))} de {formatMoneyCents(pay.earned)}
          </span>
        </span>
      );
    case "pendiente":
      return <Badge tone="amber">Pendiente</Badge>;
    case "en_curso":
      return <Badge tone="brand">En curso</Badge>;
    default:
      return <Badge>Sin cobro</Badge>;
  }
}
