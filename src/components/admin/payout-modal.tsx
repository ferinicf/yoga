"use client";

import { useMemo, useState } from "react";
import { addDays, parseISO, subWeeks } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import { payWeek, sumMoney, toCents, weekPayStatus } from "@/lib/payouts";
import type { PaymentMethod, User } from "@/lib/types";
import { fmt, formatMoneyCents, PAYMENT_LABEL } from "@/lib/utils";
import { toastDone } from "@/components/toast";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { NumberInput } from "@/components/admin/number-input";
import { OwedValue } from "@/components/admin/payout-status";

/** Formas en que el estudio le paga a un profesor. */
export const PAYOUT_METHODS: PaymentMethod[] = ["transferencia", "efectivo"];

/** "lun 2 – dom 8 nov" · "lun 27 oct – dom 2 nov" · con año si no es el año en curso. */
export function weekLabel(start: Date, end: Date): string {
  const thisYear = new Date().getFullYear();
  if (start.getFullYear() !== end.getFullYear()) return `${fmt(start, "EEE d MMM yyyy")} – ${fmt(end, "EEE d MMM yyyy")}`;
  const year = end.getFullYear() !== thisYear ? ` ${end.getFullYear()}` : "";
  if (start.getMonth() !== end.getMonth()) return `${fmt(start, "EEE d MMM")} – ${fmt(end, "EEE d MMM")}${year}`;
  return `${fmt(start, "EEE d")} – ${fmt(end, "EEE d MMM")}${year}`;
}

/** Semana (lun–dom) que cubre un pago, a partir de su domingo guardado como 'yyyy-MM-dd'. */
export function payoutWeekLabel(periodEnd?: string): string | null {
  if (!periodEnd) return null;
  const d = parseISO(periodEnd);
  if (Number.isNaN(+d)) return null;
  const { start, end } = payWeek(d);
  return weekLabel(start, end);
}

/** Lo que un pago abona a una semana (o a semanas anteriores a las de la lista). */
interface Applied {
  /** Valor 'yyyy-MM-dd' del domingo; null = semanas más viejas que la lista. */
  value: string | null;
  label: string;
  current: boolean;
  /** Lo que se abona a esa semana y lo que faltaba de ella. */
  applied: number;
  pending: number;
}

/**
 * Registrar lo que la administración le paga a un profesor (normalmente cada domingo).
 * El pago se abona primero a las semanas más antiguas sin pagar (igual que weekPayStatus);
 * "Cubre hasta la semana" se ajusta solo al monto, salvo que el admin elija otra.
 */
export function PayoutModal({
  teacher,
  owed,
  weekStart,
  onClose,
}: {
  teacher: User;
  /** Lo que se le debe hoy (saldo histórico). */
  owed: number;
  /** Lunes de la semana elegida en la pantalla (se ofrece en la lista aunque sea más vieja). */
  weekStart: Date;
  onClose: () => void;
}) {
  const db = useDB();
  const recordPayout = useStore((s) => s.recordPayout);
  // Al corriente: el campo empieza vacío y el error solo sale después de tocarlo.
  const [amount, setAmount] = useState(owed > 0 ? owed : NaN);
  const [touched, setTouched] = useState(owed > 0);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [chosenEnd, setChosenEnd] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Semanas a elegir: de la actual hacia atrás (y la elegida en la pantalla, aunque sea más vieja),
  // con lo que falta pagar de cada una.
  const { weeks, unpaid, current } = useMemo(() => {
    const now = new Date();
    const currentStart = payWeek(now).start;
    const starts = Array.from({ length: 12 }, (_, i) => subWeeks(currentStart, i));
    if (!starts.some((s) => +s === +weekStart)) starts.push(weekStart);
    const weeks = starts
      .sort((a, b) => +b - +a)
      .map((start) => {
        const end = addDays(start, 6);
        return {
          value: fmt(end, "yyyy-MM-dd"),
          label: weekLabel(start, end),
          current: +start === +currentStart,
          pending: weekPayStatus(db, teacher.id, start, now).pending,
        };
      });
    // De la más antigua a la más reciente; lo que no alcanza a explicar la lista es de semanas anteriores.
    const unpaid: Omit<Applied, "applied">[] = weeks.filter((w) => w.pending > 0).reverse();
    const older = sumMoney([Math.max(owed, 0), ...unpaid.map((w) => -w.pending)]);
    if (older > 0) unpaid.unshift({ value: null, label: "Semanas anteriores", current: false, pending: older });
    return { weeks, unpaid, current: weeks.find((w) => w.current)! };
  }, [db, teacher.id, weekStart, owed]);

  const cents = Number.isFinite(amount) ? toCents(amount) : 0;
  const rounded = cents / 100;
  const invalid = !(cents > 0);
  const extra = sumMoney([rounded, -Math.max(owed, 0)]);
  const first = teacher.name.split(" ")[0];

  // A qué semanas se abona este monto (lo más antiguo primero).
  const applied: Applied[] = [];
  let left = cents;
  for (const w of unpaid) {
    if (left <= 0) break;
    const take = Math.min(left, toCents(w.pending));
    applied.push({ ...w, applied: take / 100 });
    left -= take;
  }
  const lastWeek = [...applied].reverse().find((a) => a.value !== null);
  const autoEnd = lastWeek?.value ?? (applied.length > 0 ? weeks[weeks.length - 1].value : current.value);
  const periodEnd = chosenEnd ?? autoEnd;

  const submit = async () => {
    if (invalid || busy) return;
    setBusy(true);
    const r = await toastDone(
      recordPayout({ teacherId: teacher.id, amount: rounded, method, periodEnd, notes: notes.trim() || undefined }),
      `Pago de ${formatMoneyCents(rounded)} a ${teacher.name} registrado.`,
    );
    setBusy(false);
    if (r.ok) onClose();
  };

  const showError = touched && invalid;
  const shownApplied = applied.length > 5 ? [...applied.slice(0, 2), null, ...applied.slice(-2)] : applied;

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar pago"
      footer={
        <Button className="w-full" size="lg" disabled={invalid || busy} onClick={submit}>
          {invalid ? "Registrar pago" : `Registrar pago de ${formatMoneyCents(rounded)}`}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{teacher.name}</p>
            <p className="text-xs text-muted">Le debemos hoy</p>
          </div>
          <span className="shrink-0">
            <OwedValue owed={owed} className="text-xl" />
          </span>
        </div>

        <Field label="Monto (MXN)" hint={owed > 0 ? "Por omisión es todo lo que le debemos; puedes cambiarlo si le pagas una parte." : undefined}>
          <NumberInput
            decimals
            allowEmpty
            min={0}
            step="0.01"
            placeholder="Ej. 500"
            value={amount}
            onChange={(v) => {
              setTouched(true);
              setAmount(v);
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={showError}
            aria-describedby={showError ? "payout-amount-error" : undefined}
          />
        </Field>
        {showError && (
          <p id="payout-amount-error" className="-mt-2 text-sm text-red-700" role="alert">
            Escribe un monto mayor a cero.
          </p>
        )}
        {!invalid && applied.length > 0 && (applied.length > 1 || toCents(applied[0].applied) < toCents(applied[0].pending)) && (
          <div className="rounded-xl bg-bg p-3 text-sm" role="status">
            <p className="font-medium">{applied.length > 1 ? "Este pago cubre, de lo más antiguo a lo más nuevo:" : "Este pago cubre:"}</p>
            <ul className="mt-1 space-y-0.5">
              {shownApplied.map((a, i) =>
                a === null ? (
                  <li key="gap" className="text-muted">
                    …
                  </li>
                ) : (
                  <li key={a.value ?? `older-${i}`} className="flex flex-wrap justify-between gap-x-3">
                    <span>
                      {a.label}
                      {a.current && <span className="text-muted"> (en curso)</span>}
                    </span>
                    <span className="tabular-nums">
                      {toCents(a.applied) < toCents(a.pending) ? (
                        <>
                          {formatMoneyCents(a.applied)} <span className="text-muted">de {formatMoneyCents(a.pending)}</span>
                        </>
                      ) : (
                        <>
                          {formatMoneyCents(a.applied)} <span className="text-muted">· completa</span>
                        </>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        {!invalid && extra > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {owed > 0 ? `Es ${formatMoneyCents(extra)} más de lo que le debemos (${formatMoneyCents(owed)}).` : `Hoy no le debemos nada a ${first}.`} Lo de más
              queda como adelanto y se descuenta de sus próximas clases.
            </span>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Forma de pago">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYOUT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cubre hasta la semana" hint={chosenEnd ? "Para el historial." : "Para el historial. Se ajusta al monto; puedes cambiarla."}>
            <Select value={periodEnd} onChange={(e) => setChosenEnd(e.target.value)}>
              {weeks.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                  {w.current ? " (esta semana)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Nota (opcional)">
          <Input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. referencia de la transferencia" />
        </Field>
      </div>
    </Modal>
  );
}
