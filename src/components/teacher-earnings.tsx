"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, addWeeks, isSameMonth, isSameYear, parseISO, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { useDB } from "@/lib/store";
import {
  chargeableText,
  classEarnings,
  DEFAULT_TEACHER_SHARE,
  hasRate,
  isChargeable,
  payoutsOf,
  payWeek,
  sumMoney,
  teacherBalance,
  toCents,
  totals,
  weekPayStatus,
  weekRate,
  type ClassEarning,
  type WeekPay,
} from "@/lib/payouts";
import type { DB, TeacherPayout, User } from "@/lib/types";
import { capitalize, cn, fmt, formatMoneyCents, PAYMENT_LABEL, timeOf } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";

/* ---------- Formato ---------- */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Del 2 al 8 de noviembre" · "Del 27 de octubre al 2 de noviembre" (+ año si no es el actual). */
function weekLabel(start: Date, end: Date, now: Date): string {
  const year = isSameYear(end, now) ? "" : ` de ${fmt(end, "yyyy")}`;
  return isSameMonth(start, end)
    ? `Del ${fmt(start, "d")} al ${fmt(end, "d 'de' MMMM")}${year}`
    : `Del ${fmt(start, "d 'de' MMMM")} al ${fmt(end, "d 'de' MMMM")}${year}`;
}

/** "27 oct – 2 nov" (versión corta para listas). */
function weekShort(start: Date, end: Date, now: Date): string {
  const pattern = isSameYear(end, now) ? "d MMM" : "d MMM yyyy";
  return `${fmt(start, "d MMM")} – ${fmt(end, pattern)}`;
}

function shortDate(d: string | Date, now: Date): string {
  return capitalize(fmt(d, isSameYear(new Date(d), now) ? "EEE d 'de' MMM" : "d 'de' MMM yyyy"));
}

/** Lo que le toca al profesor por alumno, con el mismo redondeo al centavo que cada clase. */
function sharePerStudent(rate: number, share: number): number {
  return Math.round((toCents(rate) * Math.round(share * 100)) / 10000) / 100;
}

/** Semana de pago (lunes a domingo) que cubre un pago, según su `periodEnd` ('yyyy-MM-dd'). */
function coveredWeek(p: TeacherPayout): { start: Date; end: Date } | null {
  return p.periodEnd ? payWeek(parseISO(p.periodEnd)) : null;
}

/** Por qué cuentan los alumnos que no aparecen como "asistió" (faltas, cancelaciones tardías…). */
function breakdown(db: DB, e: ClassEarning, now: Date): string {
  const rs = db.reservations.filter((r) => r.sessionId === e.session.id && isChargeable(r, e.session, db.settings, now));
  const count = (status: string) => rs.filter((r) => r.status === status).length;
  const parts: string[] = [];
  const noShow = count("no_show");
  const late = count("cancelled");
  const pending = count("booked");
  if (noShow) parts.push(plural(noShow, "faltó", "faltaron"));
  if (late) parts.push(`${late} ${late === 1 ? "canceló" : "cancelaron"} tarde`);
  if (pending) parts.push(`${pending} sin pase de lista`);
  return parts.join(" · ");
}

/**
 * Estado de pago de la semana elegida (weekPayStatus: el mismo que ve el admin en Pagos).
 * Los pagos cubren primero las semanas más viejas, así que un pago de varias semanas las
 * marca todas y uno parcial dice cuánto falta.
 */
function WeekPayLine({ pay }: { pay: WeekPay }) {
  const paid = sumMoney([pay.earned, -pay.pending]);
  let badge: React.ReactNode;
  let text: string | null = null;
  switch (pay.status) {
    case "pagada":
      badge = <Badge tone="green">Pagada</Badge>;
      break;
    case "parcial":
      badge = <Badge tone="amber">Pago parcial · falta {formatMoneyCents(pay.pending)}</Badge>;
      text = `Te pagaron ${formatMoneyCents(paid)} de ${formatMoneyCents(pay.earned)}.`;
      break;
    case "pendiente":
      badge = <Badge tone="amber">Pendiente</Badge>;
      text = "Aún no te pagan esta semana.";
      break;
    case "en_curso":
      badge = <Badge tone="blue">En curso</Badge>;
      if (pay.earned > 0 && paid > 0)
        text =
          pay.pending > 0
            ? `Ya te pagaron ${formatMoneyCents(paid)} de lo que llevas; falta ${formatMoneyCents(pay.pending)}.`
            : "Ya te pagaron lo que llevas esta semana.";
      break;
    default:
      return null;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      {badge}
      {text && <span className="text-xs text-muted">{text}</span>}
    </div>
  );
}

/**
 * Aviso cuando la semana se calculó con un precio distinto al de hoy (el precio se congela en
 * cada clase al empezar; uno nuevo solo aplica a las clases que aún no empiezan).
 */
function weekPriceNote(weekPrice: number | null, teacher: User, isCurrent: boolean): string | null {
  const current = teacher.rate ?? 0;
  if (weekPrice === null)
    return isCurrent
      ? "Tu precio cambió esta semana: cada clase muestra el precio con el que se calculó."
      : "Tu precio cambió a media semana: cada clase muestra el precio con el que se calculó.";
  if (toCents(weekPrice) === toCents(current)) return null;
  const today = hasRate(teacher) ? formatMoneyCents(current) : null;
  if (isCurrent)
    return today
      ? `Tus clases que ya empezaron van a ${formatMoneyCents(weekPrice)} por alumno; las que siguen, a tu precio nuevo de ${today}.`
      : `Tus clases que ya empezaron van a ${formatMoneyCents(weekPrice)} por alumno.`;
  return `Esta semana se calculó con ${formatMoneyCents(weekPrice)} por alumno${today ? ` (tu precio hoy es ${today})` : ""}.`;
}

/**
 * Días de clases que baja la app en modo real (src/lib/live.ts). La semana más vieja que se
 * puede ver es la primera que quedó completa: con una semana a medias, lo ganado y su estado
 * de pago saldrían mal.
 */
const LIVE_HISTORY_DAYS = 120;

/* ---------- Datos del profesor ---------- */

function useEarnings(teacher: User) {
  const db = useDB();
  return useMemo(() => {
    const now = new Date();
    const week = payWeek(now);
    const balance = teacherBalance(db, teacher.id, now);
    const thisWeek = totals(classEarnings(db, { teacherId: teacher.id, from: week.start, to: week.end, now }));
    // Lo que falta de esta semana; el resto de lo que se le debe es de semanas anteriores.
    const thisWeekPay = weekPayStatus(db, teacher.id, week.start, now);
    const owedBefore = sumMoney([balance.owed, -thisWeekPay.pending]);
    const payouts = payoutsOf(db, teacher.id);
    const share = db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE;
    // Primera semana con clases descargadas (en modo real la app baja solo los últimos meses).
    const first = db.sessions
      .filter((s) => s.teacherId === teacher.id && s.status !== "cancelled")
      .reduce<string | null>((min, s) => (min === null || s.startsAt < min ? s.startsAt : min), null);
    let minWeek = first && new Date(first) < week.start ? payWeek(new Date(first)).start : week.start;
    if (db.teacherBalances) {
      const firstFull = payWeek(addDays(subDays(now, LIVE_HISTORY_DAYS), 7)).start;
      if (minWeek < firstFull) minWeek = firstFull < week.start ? firstFull : week.start;
    }
    return { db, now, week, balance, thisWeek, owedBefore, payouts, share, minWeek };
  }, [db, teacher.id]);
}

/* ---------- Tarjeta pequeña para el inicio del profesor ---------- */

export function TeacherOwedCard({ teacher }: { teacher: User }) {
  const { balance, thisWeek } = useEarnings(teacher);
  const owes = balance.owed > 0;
  return (
    <Link href="/profesor/perfil#ganancias" className="block rounded-2xl">
      <Card className="flex items-center gap-3 p-4 transition hover:border-stone-300 hover:shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
          <Wallet size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{owes ? "Te debe la administración" : "Tus pagos"}</p>
          <p className="text-lg font-semibold tabular-nums">{owes ? formatMoneyCents(balance.owed) : "Estás al corriente"}</p>
          {thisWeek.teacherAmount > 0 && <p className="text-xs text-muted">Esta semana llevas {formatMoneyCents(thisWeek.teacherAmount)}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-text">
          <span className="hidden sm:inline">Mis ganancias</span>
          <ChevronRight size={18} />
        </span>
      </Card>
    </Link>
  );
}

/* ---------- Sección "Mis ganancias" del perfil ---------- */

function Stat({
  label,
  value,
  hint,
  highlight,
  small,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  /** Texto en lugar de una cifra (p. ej. "Estás al corriente"). */
  small?: boolean;
}) {
  return (
    <Card className={cn("min-w-0 p-4", highlight && "border-brand bg-brand-soft")}>
      <p className={cn("text-sm", highlight ? "font-medium text-brand-strong" : "text-muted")}>{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums", small ? "text-lg leading-snug" : "text-2xl")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Pagos que se ven antes de "Ver todos". */
const PAYOUTS_SHOWN = 6;

const navBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30";

export function TeacherEarnings({ teacher }: { teacher: User }) {
  const { db, now, week, balance, thisWeek, owedBefore, payouts, share, minWeek } = useEarnings(teacher);
  const [weekStart, setWeekStart] = useState(week.start);
  const [allPayouts, setAllPayouts] = useState(false);

  const sel = useMemo(() => payWeek(weekStart), [weekStart]);
  const isCurrent = +sel.start === +week.start;
  const weeksAgo = Math.round((+week.start - +sel.start) / (7 * 864e5));
  const { list, pay, weekPrice } = useMemo(
    () => ({
      list: classEarnings(db, { teacherId: teacher.id, from: sel.start, to: sel.end, now }),
      // Si ya se pagó se calcula con el saldo (un pago puede cubrir varias semanas), no con periodEnd.
      pay: weekPayStatus(db, teacher.id, sel.start, now),
      // Precio congelado en las clases de esa semana (null: cambió a media semana).
      weekPrice: weekRate(db, teacher.id, sel.start, now),
    }),
    [db, teacher.id, sel, now],
  );
  const t = totals(list);
  // Clases de la semana que aún no empiezan (se suman cuando empiezan).
  const upcoming = db.sessions.filter(
    (s) => s.teacherId === teacher.id && s.status !== "cancelled" && new Date(s.startsAt) > now && new Date(s.startsAt) <= sel.end && new Date(s.startsAt) >= sel.start,
  ).length;
  const disciplineOf = (id: string) => db.disciplines.find((d) => d.id === id);
  const rate = hasRate(teacher) ? teacher.rate! : null;
  const shown = allPayouts ? payouts : payouts.slice(0, PAYOUTS_SHOWN);
  const priceNote = list.length > 0 ? weekPriceNote(weekPrice, teacher, isCurrent) : null;

  return (
    <section id="ganancias" className="scroll-mt-20 space-y-4" aria-labelledby="ganancias-titulo">
      <div>
        <h2 id="ganancias-titulo" className="text-lg font-semibold">
          Mis ganancias
        </h2>
        <p className="text-sm text-muted">
          De lo que se cobra en tus clases te toca el {share}%. La administración te paga cada domingo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Esta semana"
          value={formatMoneyCents(thisWeek.teacherAmount)}
          hint={
            thisWeek.classes
              ? `${plural(thisWeek.classes, "clase", "clases")} · ${plural(thisWeek.students, "alumno", "alumnos")}`
              : "Aún no das clases esta semana"
          }
        />
        <Stat
          label="Te debe la administración"
          highlight
          small={balance.owed <= 0}
          value={balance.owed > 0 ? formatMoneyCents(balance.owed) : "Estás al corriente"}
          hint={
            balance.owed > 0
              ? owedBefore > 0
                ? `Incluye ${formatMoneyCents(owedBefore)} de semanas anteriores`
                : `Se paga el domingo ${fmt(week.end, "d 'de' MMMM")}`
              : balance.owed < 0
                ? `Tienes ${formatMoneyCents(-balance.owed)} de adelanto`
                : "No tienes pagos pendientes"
          }
        />
        <Stat
          label="Pagado"
          value={formatMoneyCents(balance.paid)}
          hint={payouts[0] ? `Último pago: ${shortDate(payouts[0].paidAt, now)}` : "Aún no recibes pagos"}
        />
        {rate ? (
          <Stat
            label="Tu precio"
            value={
              <>
                {formatMoneyCents(rate)} <span className="text-sm font-normal text-muted">por alumno</span>
              </>
            }
            hint={`Te toca ${share}%: ${formatMoneyCents(sharePerStudent(rate, share))} por alumno`}
          />
        ) : (
          <Stat label="Tu precio" small value="Sin definir" hint="La administración aún no define tu precio por alumno" />
        )}
      </div>

      {/* Detalle por semana */}
      <Card className="p-4 md:p-5">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Detalle por clase</h3>
          {!isCurrent && (
            <Button size="sm" variant="outline" onClick={() => setWeekStart(week.start)}>
              Esta semana
            </Button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-bg p-1">
          <button
            type="button"
            className={navBtn}
            onClick={() => setWeekStart(addWeeks(sel.start, -1))}
            disabled={+sel.start <= +minWeek}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 py-1 text-center">
            <p className="font-medium">{weekLabel(sel.start, sel.end, now)}</p>
            <p className="text-xs text-muted">
              {isCurrent
                ? `Esta semana · se paga el domingo ${fmt(sel.end, "d")}`
                : weeksAgo === 1
                  ? "Semana pasada"
                  : `Hace ${weeksAgo} semanas`}
            </p>
          </div>
          <button
            type="button"
            className={navBtn}
            onClick={() => setWeekStart(addWeeks(sel.start, 1))}
            disabled={isCurrent}
            aria-label="Semana siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <WeekPayLine pay={pay} />

        <p className="mt-3 text-sm text-muted">
          Cuenta cada alumno que {chargeableText(db.settings)}. Cada clase se suma cuando empieza.
        </p>
        {priceNote && <p className="mt-1 text-sm text-muted">{priceNote}</p>}

        {list.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            {isCurrent
              ? upcoming
                ? "Aún no empieza ninguna de tus clases de esta semana."
                : "No tienes clases esta semana."
              : "No diste clases esta semana."}
          </p>
        ) : (
          <>
            {/* Celular: tarjetas */}
            <ul className="mt-4 space-y-2 md:hidden">
              {list.map((e) => {
                const d = disciplineOf(e.session.disciplineId);
                const bd = breakdown(db, e, now);
                return (
                  <li key={e.session.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {capitalize(fmt(e.session.startsAt, "EEE d MMM"))} · {timeOf(e.session.startsAt)}
                        </p>
                        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d?.color }} />
                          <span className="truncate">{d?.name}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">{formatMoneyCents(e.teacherAmount)}</p>
                        <p className="text-xs text-muted">tu parte ({e.share}%)</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {plural(e.students, "alumno", "alumnos")} × {formatMoneyCents(e.rate)} = cobro de {formatMoneyCents(e.charge)}
                    </p>
                    {bd && <p className="text-xs text-muted">{bd}</p>}
                  </li>
                );
              })}
            </ul>

            {/* iPad y escritorio: tabla */}
            <table className="mt-4 hidden w-full text-sm md:table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Clase</th>
                  <th className="px-3 py-2 font-medium">Alumnos que cuentan</th>
                  <th className="px-3 py-2 text-right font-medium">Cobro de la clase</th>
                  <th className="py-2 pl-3 text-right font-medium">Tu parte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((e) => {
                  const d = disciplineOf(e.session.disciplineId);
                  const bd = breakdown(db, e, now);
                  return (
                    <tr key={e.session.id} className="align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">
                          {capitalize(fmt(e.session.startsAt, "EEE d MMM"))} · <span className="tabular-nums">{timeOf(e.session.startsAt)}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-muted">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d?.color }} />
                          {d?.name}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="tabular-nums">{e.students}</p>
                        {bd && <p className="text-xs text-muted">{bd}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <p>{formatMoneyCents(e.charge)}</p>
                        <p className="text-xs text-muted">
                          {e.students} × {formatMoneyCents(e.rate)}
                        </p>
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">
                        <p className="font-semibold">{formatMoneyCents(e.teacherAmount)}</p>
                        <p className="text-xs text-muted">{e.share}%</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-3 pr-3">
                    Total de la semana
                    <span className="block text-xs font-normal text-muted">{plural(t.classes, "clase", "clases")}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {t.students}
                    {t.classes > 1 && t.students > 0 && (
                      <span className="block text-xs font-normal text-muted">{(t.students / t.classes).toFixed(1)} por clase</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoneyCents(t.charge)}</td>
                  <td className="py-3 pl-3 text-right text-base tabular-nums">{formatMoneyCents(t.teacherAmount)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Total (celular) */}
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-bg p-3 md:hidden">
              <div className="min-w-0">
                <p className="font-semibold">Total de la semana</p>
                <p className="text-xs text-muted">
                  {plural(t.classes, "clase", "clases")} · {plural(t.students, "alumno", "alumnos")} · cobro de {formatMoneyCents(t.charge)}
                </p>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums">{formatMoneyCents(t.teacherAmount)}</p>
            </div>
          </>
        )}

        {isCurrent && upcoming > 0 && list.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Te {upcoming === 1 ? "falta 1 clase" : `faltan ${upcoming} clases`} esta semana; se suman cuando empiecen.
          </p>
        )}
      </Card>

      {/* Historial de pagos */}
      <Card className="p-4 md:p-5">
        <h3 className="font-semibold">Pagos recibidos</h3>
        {payouts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Aún no recibes pagos. Aquí verás cada pago que te registre la administración.
          </p>
        ) : (
          <>
            {/* Celular: tarjetas */}
            <ul className="mt-3 divide-y divide-line md:hidden">
              {shown.map((p) => {
                const w = coveredWeek(p);
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{shortDate(p.paidAt, now)}</p>
                      <p className="text-xs text-muted">
                        {w ? `Semana ${weekShort(w.start, w.end, now)}` : "Sin semana indicada"} · {PAYMENT_LABEL[p.method] ?? p.method}
                      </p>
                      {p.notes && <p className="text-xs text-muted">{p.notes}</p>}
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatMoneyCents(p.amount)}</p>
                  </li>
                );
              })}
            </ul>

            {/* iPad y escritorio: tabla */}
            <table className="mt-3 hidden w-full text-sm md:table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  {/* Semana que indicó la administración; un pago puede cubrir también semanas anteriores. */}
                  <th className="px-3 py-2 font-medium">Semana</th>
                  <th className="px-3 py-2 font-medium">Forma de pago</th>
                  <th className="py-2 pl-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((p) => {
                  const w = coveredWeek(p);
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-medium">{shortDate(p.paidAt, now)}</td>
                      <td className="px-3 py-2.5">
                        {w ? weekShort(w.start, w.end, now) : <span className="text-muted">Sin indicar</span>}
                        {p.notes && <p className="text-xs text-muted">{p.notes}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{PAYMENT_LABEL[p.method] ?? p.method}</td>
                      <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{formatMoneyCents(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {payouts.length > PAYOUTS_SHOWN && (
              <div className="mt-2 flex justify-center">
                <Button size="sm" variant="ghost" onClick={() => setAllPayouts((v) => !v)}>
                  {allPayouts ? "Ver menos" : `Ver todos (${payouts.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
