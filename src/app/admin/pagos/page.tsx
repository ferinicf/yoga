"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addWeeks } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, HandCoins, Trash2 } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import {
  chargeableText,
  classEarnings,
  DEFAULT_TEACHER_SHARE,
  hasRate,
  payoutsOf,
  payWeek,
  sumMoney,
  teacherBalance,
  teachers as teachersOf,
  totals,
  weekPayStatus,
  weekRate,
  type Balance,
  type ClassEarning,
  type EarningTotals,
  type WeekPay,
} from "@/lib/payouts";
import type { DB, TeacherPayout, User } from "@/lib/types";
import { capitalize, cn, fmt, formatMoneyCents, PAYMENT_LABEL, timeOf } from "@/lib/utils";
import { toastDone } from "@/components/toast";
import { Avatar, Badge, Button, buttonClass, Card, Empty, Modal, PageHeader, textLinkClass } from "@/components/ui";
import { StatTile } from "@/components/admin/charts";
import { PayoutModal, payoutWeekLabel, weekLabel } from "@/components/admin/payout-modal";
import { OwedValue, WeekPayBadge } from "@/components/admin/payout-status";

interface Row {
  teacher: User;
  classes: ClassEarning[];
  sum: EarningTotals;
  /** % que le toca en la semana (null si cambió a media semana). */
  share: number | null;
  /** Precio por alumno con el que se calculó la semana (null si cambió a media semana). */
  rate: number | null;
  /** Estado de pago de la semana elegida (pagada, parcial, pendiente, en curso). */
  weekPay: WeekPay;
  /** Saldo de hoy (todas las semanas). */
  balance: Balance;
  /** Clases de la semana que todavía no empiezan. */
  upcoming: number;
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/** Precio de la semana: "$220 por alumno", "Precio variable" (cambió a media semana) o null (sin precio). */
function rateText(r: Row): string | null {
  if (r.rate === null) return "Precio variable";
  return r.rate > 0 || hasRate(r.teacher) ? `${formatMoneyCents(r.rate)} por alumno` : null;
}

/** "$220 por alumno · le toca 70%" con el precio y el % de ESA semana (sin precio: "Le toca 70%"). */
function termsText(r: Row): string {
  return capitalize([rateText(r), r.share !== null ? `le toca ${pct(r.share)}` : null].filter(Boolean).join(" · "));
}

/** Si el precio de hoy no es el de la semana: "Precio actual: $260". */
function currentRateNote(r: Row): string | null {
  return hasRate(r.teacher) && r.rate !== r.teacher.rate ? `Precio actual: ${formatMoneyCents(r.teacher.rate!)}` : null;
}

function buildRows(db: DB, start: Date, end: Date, now: Date): Row[] {
  const defaultShare = db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE;
  return teachersOf(db)
    .map((teacher) => {
      const classes = classEarnings(db, { teacherId: teacher.id, from: start, to: end, now });
      const shares = [...new Set(classes.map((c) => c.share))];
      const upcoming = db.sessions.filter((s) => {
        const t = new Date(s.startsAt);
        return s.teacherId === teacher.id && s.status !== "cancelled" && t > now && t >= start && t <= end;
      }).length;
      return {
        teacher,
        classes,
        sum: totals(classes),
        share: shares.length === 0 ? defaultShare : shares.length === 1 ? shares[0] : null,
        rate: weekRate(db, teacher.id, start, now),
        weekPay: weekPayStatus(db, teacher.id, start, now),
        balance: teacherBalance(db, teacher.id, now),
        upcoming,
      };
    })
    .filter((r) => r.teacher.active || r.classes.length > 0 || r.balance.owed !== 0)
    .sort((a, b) => Number(b.teacher.active) - Number(a.teacher.active) || a.teacher.name.localeCompare(b.teacher.name));
}

function NoRate() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 pt-3 pb-1 text-sm text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p>Sin precio por alumno.</p>
        <Link href="/admin/profesores" className={cn(textLinkClass, "font-medium underline underline-offset-2")}>
          Define su precio en Profesores
        </Link>
      </div>
    </div>
  );
}

export default function TeacherPayoutsPage() {
  const db = useDB();
  const [weekStart, setWeekStart] = useState(() => payWeek(new Date()).start);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const currentStart = payWeek(new Date()).start;
  const isCurrent = +weekStart === +currentStart;
  const { start, end } = payWeek(weekStart);

  const { rows, week, owedTotal, weekPending, upcomingTotal } = useMemo(() => {
    const now = new Date();
    const { start, end } = payWeek(weekStart);
    const rows = buildRows(db, start, end, now);
    return {
      rows,
      week: totals(classEarnings(db, { from: start, to: end, now })),
      owedTotal: sumMoney(rows.map((r) => Math.max(0, r.balance.owed))),
      /** Lo que falta pagar de la semana elegida (todos los profesores). */
      weekPending: sumMoney(rows.map((r) => r.weekPay.pending)),
      upcomingTotal: rows.reduce((a, r) => a + r.upcoming, 0),
    };
  }, [db, weekStart]);

  const detail = rows.find((r) => r.teacher.id === detailId);
  const paying = rows.find((r) => r.teacher.id === payingId);
  const defaultShare = db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE;

  const payButton = (r: Row, className?: string) => (
    <Button size="sm" className={cn("h-11", className)} onClick={() => setPayingId(r.teacher.id)}>
      Registrar pago
    </Button>
  );
  const detailButton = (r: Row, className?: string) => (
    <Button size="sm" variant="outline" className={cn("h-11", className)} onClick={() => setDetailId(r.teacher.id)}>
      Ver detalle
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Pagos a profesores"
        subtitle="Lo que se cobró en las clases de cada profesor y lo que le toca. Se paga cada domingo."
      />

      {/* Semana */}
      <Card className="mb-4 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5"
              onClick={() => setWeekStart(addWeeks(weekStart, -1))}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 text-center">
              <p className="font-semibold">{weekLabel(start, end)}</p>
              <p className="text-xs text-muted">
                {isCurrent ? "Esta semana · se paga el " : "Día de pago: "}
                {fmt(end, "EEEE d 'de' MMMM")}
              </p>
            </div>
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 disabled:opacity-30"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              disabled={isCurrent}
              aria-label="Semana siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {!isCurrent && (
            <Button variant="secondary" size="sm" className="h-11 w-full sm:w-auto" onClick={() => setWeekStart(currentStart)}>
              Esta semana
            </Button>
          )}
        </div>
        {isCurrent && upcomingTotal > 0 && (
          <p className="mt-2 border-t border-line pt-2 text-center text-xs text-muted">
            Faltan {upcomingTotal} {upcomingTotal === 1 ? "clase" : "clases"} por dar esta semana: se suman cuando empiezan.
          </p>
        )}
      </Card>

      {/* Totales de la semana */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Cobro total"
          value={formatMoneyCents(week.charge)}
          hint={`${week.classes} ${week.classes === 1 ? "clase" : "clases"} · ${week.students} ${week.students === 1 ? "alumno" : "alumnos"}`}
        />
        <StatTile label="A profesores" value={formatMoneyCents(week.teacherAmount)} hint="Su parte de la semana" />
        <StatTile label="Al estudio" value={formatMoneyCents(week.studioAmount)} hint="El resto del cobro" />
        <StatTile label="Les debemos hoy" value={formatMoneyCents(owedTotal)} hint="Todas las semanas, menos lo pagado" />
      </div>

      {rows.length === 0 ? (
        <Empty
          icon={<HandCoins size={28} />}
          title="Aún no hay profesores"
          text="Agrega a tu equipo y define su precio por alumno para calcular sus pagos."
          action={
            <Link href="/admin/profesores" className={buttonClass()}>
              Ir a Profesores
            </Link>
          }
        />
      ) : (
        <>
          {/* Celular y iPad: tarjetas */}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
            {rows.map((r) => (
              <li key={r.teacher.id} className="min-w-0">
                <Card className={cn("flex h-full flex-col p-4", !r.teacher.active && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={r.teacher.name} color={r.teacher.color} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold" title={r.teacher.name}>
                        {r.teacher.name}
                      </p>
                      <p className="text-sm text-muted">{termsText(r)}</p>
                      {currentRateNote(r) && <p className="text-xs text-muted">{currentRateNote(r)}</p>}
                    </div>
                    {!r.teacher.active && <Badge>Inactivo</Badge>}
                  </div>
                  {!hasRate(r.teacher) && (
                    <div className="mt-3">
                      <NoRate />
                    </div>
                  )}
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-bg p-2">
                      <dt className="text-xs text-muted">Clases dadas</dt>
                      <dd className="text-lg font-semibold tabular-nums">{r.sum.classes}</dd>
                    </div>
                    <div className="rounded-xl bg-bg p-2">
                      <dt className="text-xs text-muted">Alumnos</dt>
                      <dd className="text-lg font-semibold tabular-nums">{r.sum.students}</dd>
                    </div>
                    <div className="rounded-xl bg-bg p-2">
                      <dt className="text-xs text-muted">Cobro total</dt>
                      <dd className="truncate text-lg font-semibold tabular-nums">{formatMoneyCents(r.sum.charge)}</dd>
                    </div>
                  </dl>
                  <dl className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-brand-soft px-3 py-2 text-brand-strong">
                      <dt className="text-xs">Su parte{r.share !== null && ` (${pct(r.share)})`}</dt>
                      <dd className="truncate font-semibold tabular-nums">{formatMoneyCents(r.sum.teacherAmount)}</dd>
                    </div>
                    <div className="rounded-xl bg-bg px-3 py-2">
                      <dt className="text-xs text-muted">Estudio{r.share !== null && ` (${pct(100 - r.share)})`}</dt>
                      <dd className="truncate font-semibold tabular-nums">{formatMoneyCents(r.sum.studioAmount)}</dd>
                    </div>
                  </dl>
                  {!isCurrent && r.weekPay.status !== "sin_cobro" && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2">
                      <p className="text-sm">Pago de esta semana</p>
                      <WeekPayBadge pay={r.weekPay} />
                    </div>
                  )}
                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Le debemos hoy</p>
                        <p className="text-xs text-muted">Todas sus semanas, menos lo pagado</p>
                      </div>
                      <OwedValue owed={r.balance.owed} className="text-xl" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {detailButton(r, "w-full")}
                      {payButton(r, "w-full")}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden rounded-2xl border border-line bg-surface xl:block">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="rounded-tl-2xl px-3 py-3 font-medium">Profesor</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Clases</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Alumnos</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Cobro total</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Su parte</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Estudio</th>
                  {!isCurrent && <th className="whitespace-nowrap px-2 py-3 text-right font-medium">Pago de la semana</th>}
                  <th className="whitespace-nowrap px-2 py-3 text-right font-medium">
                    Le debemos hoy
                    <span className="block font-normal normal-case tracking-normal">todas las semanas</span>
                  </th>
                  <th className="rounded-tr-2xl px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.teacher.id} className={cn(!r.teacher.active && "opacity-70")}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.teacher.name} color={r.teacher.color} size={36} />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {r.teacher.name} {!r.teacher.active && <Badge>Inactivo</Badge>}
                          </p>
                          {rateText(r) && <p className="text-xs text-muted">{rateText(r)}</p>}
                          {currentRateNote(r) && <p className="text-xs text-muted">{currentRateNote(r)}</p>}
                          {!hasRate(r.teacher) && (
                            <Link href="/admin/profesores" className={cn(textLinkClass, "gap-1 text-xs font-medium text-amber-800 underline underline-offset-2")}>
                              <AlertTriangle size={13} /> Define su precio en Profesores
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.sum.classes}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.sum.students}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoneyCents(r.sum.charge)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatMoneyCents(r.sum.teacherAmount)}
                      {r.share !== null && <span className="block text-xs text-muted">{pct(r.share)}</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatMoneyCents(r.sum.studioAmount)}
                      {r.share !== null && <span className="block text-xs text-muted">{pct(100 - r.share)}</span>}
                    </td>
                    {!isCurrent && (
                      <td className="px-2 py-2 text-right">
                        {r.weekPay.status === "sin_cobro" ? <span className="text-muted">—</span> : <WeekPayBadge pay={r.weekPay} />}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right">
                      <OwedValue owed={r.balance.owed} className="text-base" />
                    </td>
                    <td className="whitespace-nowrap py-2 pl-3 pr-3 text-right">
                      <div className="flex justify-end gap-2">
                        {detailButton(r)}
                        {payButton(r)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line bg-bg text-sm font-semibold">
                <tr>
                  <td className="rounded-bl-2xl px-3 py-3">Total de la semana</td>
                  <td className="px-2 py-3 text-right tabular-nums">{week.classes}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{week.students}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatMoneyCents(week.charge)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatMoneyCents(week.teacherAmount)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatMoneyCents(week.studioAmount)}</td>
                  {!isCurrent && (
                    <td className="px-2 py-3 text-right tabular-nums">
                      {week.teacherAmount <= 0 ? (
                        <span className="font-normal text-muted">—</span>
                      ) : weekPending > 0 ? (
                        <>
                          Falta {formatMoneyCents(weekPending)}
                          <span className="block text-xs font-normal text-muted">de {formatMoneyCents(week.teacherAmount)}</span>
                        </>
                      ) : (
                        <Badge tone="green">Pagada</Badge>
                      )}
                    </td>
                  )}
                  {/* "Les debemos hoy" ya está arriba: no es un total de esta semana. */}
                  <td className="px-2 py-3" />
                  <td className="rounded-br-2xl px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            En las clases que ya empezaron cuenta cada alumno que {chargeableText(db.settings)}. Cada clase guarda el precio y el %
            con los que se dio; las nuevas usan el precio actual de cada profesor y le toca {pct(defaultShare)}.{" "}
            <Link href="/admin/configuracion" className={cn(textLinkClass, "-my-3 whitespace-nowrap font-medium text-brand-text underline-offset-2 hover:underline")}>
              Cambiar %
            </Link>
          </p>
        </>
      )}

      {detail && (
        <TeacherDetailModal
          key={detail.teacher.id}
          row={detail}
          payouts={payoutsOf(db, detail.teacher.id)}
          db={db}
          weekStart={weekStart}
          onClose={() => setDetailId(null)}
          onPay={() => {
            setDetailId(null);
            setPayingId(detail.teacher.id);
          }}
        />
      )}

      {paying && (
        <PayoutModal
          key={paying.teacher.id}
          teacher={paying.teacher}
          owed={paying.balance.owed}
          weekStart={weekStart}
          onClose={() => setPayingId(null)}
        />
      )}
    </div>
  );
}

/* ---------- Detalle de un profesor: clases de la semana e historial de pagos ---------- */

const HISTORY_STEP = 8;

function TeacherDetailModal({
  row,
  payouts,
  db,
  weekStart,
  onClose,
  onPay,
}: {
  row: Row;
  payouts: TeacherPayout[];
  db: DB;
  weekStart: Date;
  onClose: () => void;
  onPay: () => void;
}) {
  const deletePayout = useStore((s) => s.deletePayout);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(HISTORY_STEP);
  const confirmRef = useRef<HTMLDivElement>(null);
  const { teacher, classes, sum, balance, share, upcoming, weekPay } = row;
  const { start, end } = payWeek(weekStart);
  const past = weekPay.status !== "en_curso";
  const terms = termsText(row);
  const rateNote = currentRateNote(row);

  // En celular la confirmación aparece debajo del pago y puede quedar bajo el pie del modal.
  useEffect(() => {
    if (!confirmId) return;
    const el = confirmRef.current;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [confirmId]);

  const discipline = (id: string) => db.disciplines.find((d) => d.id === id);
  const remove = async (p: TeacherPayout) => {
    setBusy(true);
    const r = await toastDone(deletePayout(p.id), `Pago de ${formatMoneyCents(p.amount)} eliminado.`);
    setBusy(false);
    if (r.ok) setConfirmId(null);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={teacher.name}
      footer={
        <Button className="w-full" size="lg" onClick={onPay}>
          Registrar pago
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          {terms && (
            <p className="text-sm text-muted">
              {terms}
              {rateNote && <span className="block text-xs">{rateNote}</span>}
            </p>
          )}
          {!hasRate(teacher) && (
            <div className={cn(terms && "mt-2")}>
              <NoRate />
            </div>
          )}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-bg p-2">
              <dt className="text-xs text-muted">Ganado en total</dt>
              <dd className="truncate font-semibold tabular-nums md:text-lg">{formatMoneyCents(balance.earned)}</dd>
            </div>
            <div className="rounded-xl bg-bg p-2">
              <dt className="text-xs text-muted">Ya pagado</dt>
              <dd className="truncate font-semibold tabular-nums md:text-lg">{formatMoneyCents(balance.paid)}</dd>
            </div>
            <div className="rounded-xl bg-brand-soft p-2 text-brand-strong">
              <dt className="text-xs">Le debemos hoy</dt>
              <dd className="truncate md:text-lg">
                <OwedValue owed={balance.owed} align="center" />
              </dd>
            </div>
          </dl>
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="font-semibold">Clases de la semana</h3>
            <p className="text-sm text-muted">{weekLabel(start, end)}</p>
          </div>
          {past && weekPay.status !== "sin_cobro" && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2">
              <p className="text-sm">
                Pago de esta semana
                {weekPay.status === "parcial" && <span className="block text-xs text-muted">Falta {formatMoneyCents(weekPay.pending)}</span>}
              </p>
              <WeekPayBadge pay={weekPay} />
            </div>
          )}
          {classes.length === 0 ? (
            <p className="rounded-xl bg-bg p-4 text-sm text-muted">
              {past ? "No dio clases en esta semana." : "Todavía no hay clases dadas en esta semana."}
            </p>
          ) : (
            <>
              {/* Celular: renglones apilados */}
              <ul className="divide-y divide-line rounded-xl border border-line md:hidden">
                {classes.map((c) => {
                  const d = discipline(c.session.disciplineId);
                  return (
                    <li key={c.session.id} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <Link href={`/admin/clase/${c.session.id}`} className="inline-flex min-h-10 items-center font-medium hover:underline">
                          {capitalize(fmt(c.session.startsAt, "EEE d MMM"))} · {timeOf(c.session.startsAt)}
                        </Link>
                        <p className="flex items-center gap-1.5 text-sm text-muted">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d?.color }} aria-hidden />
                          <span className="truncate">{d?.name ?? "Clase"}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {c.students} {c.students === 1 ? "alumno" : "alumnos"} × {formatMoneyCents(c.rate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">{formatMoneyCents(c.charge)}</p>
                        <p className="text-xs tabular-nums text-muted">Su parte {formatMoneyCents(c.teacherAmount)}</p>
                      </div>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between gap-3 bg-bg p-3 text-sm font-semibold">
                  <span>
                    {sum.classes} {sum.classes === 1 ? "clase" : "clases"} · {sum.students} {sum.students === 1 ? "alumno" : "alumnos"}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatMoneyCents(sum.charge)}
                    <span className="block text-xs font-normal text-muted">Su parte {formatMoneyCents(sum.teacherAmount)}</span>
                  </span>
                </li>
              </ul>
              {/* iPad y escritorio: tabla */}
              <div className="hidden rounded-xl border border-line md:block">
                <table className="w-full text-sm">
                  <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="rounded-tl-xl px-3 py-2 font-medium">Día y hora</th>
                      <th className="px-3 py-2 font-medium">Disciplina</th>
                      <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                      <th className="px-3 py-2 text-right font-medium">Cobro</th>
                      <th className="rounded-tr-xl px-3 py-2 text-right font-medium">Su parte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {classes.map((c) => {
                      const d = discipline(c.session.disciplineId);
                      return (
                        <tr key={c.session.id}>
                          <td className="whitespace-nowrap px-3 py-1">
                            <Link href={`/admin/clase/${c.session.id}`} className="inline-flex min-h-10 items-center hover:underline">
                              {capitalize(fmt(c.session.startsAt, "EEE d MMM"))} · {timeOf(c.session.startsAt)}
                            </Link>
                          </td>
                          <td className="px-3 py-1">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d?.color }} aria-hidden />
                              {d?.name ?? "Clase"}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-right tabular-nums">
                            {c.students}
                            <span className="block text-xs text-muted">× {formatMoneyCents(c.rate)}</span>
                          </td>
                          <td className="px-3 py-1 text-right tabular-nums">{formatMoneyCents(c.charge)}</td>
                          <td className="px-3 py-1 text-right font-medium tabular-nums">
                            {formatMoneyCents(c.teacherAmount)}
                            {share === null && <span className="block text-xs font-normal text-muted">{pct(c.share)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line bg-bg font-semibold">
                    <tr>
                      <td className="rounded-bl-xl px-3 py-2" colSpan={2}>
                        {sum.classes} {sum.classes === 1 ? "clase" : "clases"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{sum.students}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoneyCents(sum.charge)}</td>
                      <td className="rounded-br-xl px-3 py-2 text-right tabular-nums">{formatMoneyCents(sum.teacherAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          {upcoming > 0 && (
            <p className="mt-2 text-xs text-muted">
              Le {upcoming === 1 ? "falta 1 clase" : `faltan ${upcoming} clases`} por dar esta semana: se suman cuando empiezan.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-semibold">Historial de pagos</h3>
          {payouts.length === 0 ? (
            <p className="rounded-xl bg-bg p-4 text-sm text-muted">Aún no hay pagos registrados.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {payouts.slice(0, shown).map((p) => {
                const weekText = payoutWeekLabel(p.periodEnd);
                const confirming = confirmId === p.id;
                return (
                  <li key={p.id} className={cn("p-3", confirming && "bg-red-50")}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold tabular-nums">
                          {formatMoneyCents(p.amount)} <span className="text-sm font-normal text-muted">· {PAYMENT_LABEL[p.method] ?? p.method}</span>
                        </p>
                        <p className="text-sm text-muted">
                          Pagado el {fmt(p.paidAt, "EEE d MMM yyyy")} a las {timeOf(p.paidAt)}
                        </p>
                        {weekText && <p className="text-xs text-muted">Semana {weekText}</p>}
                        {p.notes && <p className="mt-1 break-words text-sm">{p.notes}</p>}
                      </div>
                      {!confirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmId(p.id)}
                          className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50"
                          aria-label={`Eliminar pago de ${formatMoneyCents(p.amount)}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {confirming && (
                      <div
                        ref={confirmRef}
                        className="mt-3 scroll-mb-4 rounded-xl bg-surface p-3 ring-1 ring-red-200"
                        role="alertdialog"
                        aria-label="Confirmar eliminación"
                      >
                        <p className="text-sm">
                          ¿Eliminar este pago de <strong>{formatMoneyCents(p.amount)}</strong>? Úsalo solo si se registró por error: el monto vuelve a
                          sumarse a lo que le debemos.
                        </p>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-11" disabled={busy} onClick={() => setConfirmId(null)}>
                            Cancelar
                          </Button>
                          <Button variant="danger" size="sm" className="h-11" disabled={busy} onClick={() => remove(p)}>
                            <Trash2 size={16} /> Sí, eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {payouts.length > shown && (
            <Button variant="ghost" size="sm" className="mt-2 h-11 w-full" onClick={() => setShown((n) => n + HISTORY_STEP)}>
              Ver más pagos ({payouts.length - shown})
            </Button>
          )}
        </section>
      </div>
    </Modal>
  );
}
