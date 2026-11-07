"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, endOfDay, startOfMonth, subMonths } from "date-fns";
import { AlertCircle, CalendarCheck, CalendarDays, ChevronRight, Clock, Gauge, HandCoins, Plus, Users, Wallet } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { activeStudents, occupied, sessionsOn } from "@/lib/rules";
import { classEarnings, payWeek, sumMoney, teacherBalance, teachers, totals, weekPayStatus } from "@/lib/payouts";
import type { Sale } from "@/lib/types";
import { capitalize, fmt, formatMoney, formatMoneyCents, longDay } from "@/lib/utils";
import { SessionCard } from "@/components/domain";
import { Avatar, Button, Card, Empty, PageHeader } from "@/components/ui";
import { RevenueChart, StatTile } from "@/components/admin/charts";
import { ConfirmSaleModal, saleMethodLabel } from "@/components/admin/confirm-sale-modal";
import { weekLabel } from "@/components/admin/payout-modal";

export default function AdminDashboard() {
  const db = useDB();
  const me = useCurrentUser();
  const [confirming, setConfirming] = useState<Sale | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const paid = db.sales.filter((s) => s.status === "paid");
    const revenueIn = (from: Date, to: Date) =>
      paid.filter((s) => new Date(s.createdAt) >= from && new Date(s.createdAt) < to).reduce((a, s) => a + s.total, 0);
    const month = revenueIn(monthStart, addDays(now, 1));
    // Comparación justa: mismo número de días del mes anterior.
    const prevSameDays = revenueIn(prevStart, addDays(prevStart, now.getDate()));
    const delta = prevSameDays > 0 ? ((month - prevSameDays) / prevSameDays) * 100 : undefined;

    const today = sessionsOn(db, now);
    const reservasHoy = today.reduce((a, s) => a + occupied(db, s.id), 0);

    const next7 = db.sessions.filter(
      (s) => s.status === "scheduled" && new Date(s.startsAt) >= now && new Date(s.startsAt) <= endOfDay(addDays(now, 7)),
    );
    const cap = next7.reduce((a, s) => a + s.capacity, 0);
    const occ = next7.reduce((a, s) => a + occupied(db, s.id), 0);

    const pending = db.sales.filter((s) => s.status === "pending");
    const expiring = db.memberships.filter(
      (m) => m.status === "active" && new Date(m.expiresAt) >= now && new Date(m.expiresAt) <= addDays(now, 7),
    );

    const months = Array.from({ length: 6 }, (_, i) => {
      const start = startOfMonth(subMonths(now, 5 - i));
      const end = startOfMonth(subMonths(now, 4 - i));
      return { label: capitalize(fmt(start, "MMM")), value: revenueIn(start, end), current: i === 5 };
    });

    // Pagos a profesores: lo que se les debe hoy (saldo de todas las semanas) y, aparte, lo que
    // va de la semana de pago actual. "De semanas anteriores" = lo que se debe y no es de esta semana.
    const payweek = payWeek(now);
    const weekPay = totals(classEarnings(db, { from: payweek.start, to: payweek.end, now }));
    const debts = teachers(db)
      .map((t) => ({ owed: teacherBalance(db, t.id, now).owed, thisWeek: weekPayStatus(db, t.id, payweek.start, now).pending }))
      .filter((x) => x.owed > 0);
    const owed = debts.map((x) => x.owed);

    return {
      month,
      delta,
      teachersOwed: sumMoney(owed),
      teachersOwedCount: owed.length,
      teachersOwedBefore: sumMoney(debts.map((x) => x.owed - x.thisWeek)),
      weekPay,
      payWeek: payweek,
      today,
      reservasHoy,
      occPct: cap ? Math.round((occ / cap) * 100) : 0,
      active: activeStudents(db, now).length,
      pending,
      expiring,
      months,
    };
  }, [db]);

  return (
    <div>
      <PageHeader
        title={`Hola, ${me?.name.split(" ")[0] ?? ""}`}
        subtitle={longDay(new Date())}
        actions={
          <Link href="/admin/calendario">
            <Button variant="outline">
              <CalendarDays size={18} /> Ver calendario
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Ingresos del mes" value={formatMoney(stats.month)} delta={stats.delta} deltaLabel="vs. mismos días del mes pasado" icon={<Wallet size={16} />} />
        <StatTile label="Reservas hoy" value={String(stats.reservasHoy)} hint={`${stats.today.length} ${stats.today.length === 1 ? "clase" : "clases"}`} icon={<CalendarCheck size={16} />} />
        <StatTile label="Ocupación 7 días" value={`${stats.occPct}%`} hint="Próximas clases" icon={<Gauge size={16} />} />
        <StatTile label="Alumnos activos" value={String(stats.active)} hint="Con paquete vigente" icon={<Users size={16} />} />
        <StatTile
          label="Pagos pendientes"
          value={String(stats.pending.length)}
          hint={formatMoney(stats.pending.reduce((a, s) => a + s.total, 0))}
          icon={<AlertCircle size={16} />}
        />
        <StatTile label="Vencen en 7 días" value={String(stats.expiring.length)} hint="Membresías" icon={<Clock size={16} />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="min-w-0 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Clases de hoy</h2>
            <Link href="/admin/calendario" className="-my-2 inline-flex min-h-11 items-center pl-3 text-sm font-medium text-brand-text">
              Ver semana
            </Link>
          </div>
          {stats.today.length === 0 ? (
            <Empty title="Hoy no hay clases" text="Agrega clases desde el calendario." />
          ) : (
            <div className="space-y-2">
              {stats.today.map((s) => (
                <Link key={s.id} href={`/admin/clase?id=${encodeURIComponent(s.id)}`} className="block rounded-2xl transition hover:shadow-sm">
                  <SessionCard session={s} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Link href="/admin/pagos" className="block rounded-2xl transition hover:shadow-sm">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Pagos a profesores</h2>
                <HandCoins size={16} className="shrink-0 text-muted" />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted">Les debemos hoy</p>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">{formatMoneyCents(stats.teachersOwed)}</p>
                  <p className="text-xs text-muted">
                    {stats.teachersOwedCount === 0
                      ? "Estás al corriente con todos"
                      : `A ${stats.teachersOwedCount} ${stats.teachersOwedCount === 1 ? "profesor" : "profesores"}${
                          stats.teachersOwedBefore > 0 ? `, ${formatMoneyCents(stats.teachersOwedBefore)} de semanas anteriores` : ""
                        }`}{" "}
                    · se paga el {fmt(stats.payWeek.end, "EEEE d MMM")}
                  </p>
                </div>
                <span className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-medium text-brand-text">
                  Ver pagos <ChevronRight size={16} />
                </span>
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs text-muted">
                  Esta semana, hasta hoy <span className="whitespace-nowrap">({weekLabel(stats.payWeek.start, stats.payWeek.end)})</span>
                </p>
                <dl className="mt-1.5 grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Cobro</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums">{formatMoneyCents(stats.weekPay.charge)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Profesores</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums">{formatMoneyCents(stats.weekPay.teacherAmount)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Estudio</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums">{formatMoneyCents(stats.weekPay.studioAmount)}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          </Link>

          <Card className="p-4">
            <h2 className="font-semibold">Ingresos por mes</h2>
            <p className="mb-4 text-xs text-muted">Ventas pagadas, últimos 6 meses</p>
            <RevenueChart data={stats.months} />
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Pagos pendientes</h2>
              <Link href="/admin/ventas" className="-my-2 inline-flex min-h-11 items-center pl-3 text-sm font-medium text-brand-text">
                Ventas
              </Link>
            </div>
            {stats.pending.length === 0 ? (
              <p className="py-4 text-sm text-muted">No hay pagos pendientes.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.pending.map((s) => {
                  const u = db.users.find((x) => x.id === s.userId);
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-3">
                      {u && <Avatar name={u.name} color={u.color} size={36} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u?.name}</p>
                        <p className="truncate text-xs text-muted">
                          {s.concept} · {formatMoney(s.total)} · {saleMethodLabel(s)}
                        </p>
                      </div>
                      <Button size="sm" className="h-11" onClick={() => setConfirming(s)}>
                        Confirmar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Membresías por vencer</h2>
            {stats.expiring.length === 0 ? (
              <p className="py-4 text-sm text-muted">Ninguna vence en los próximos 7 días.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.expiring.map((m) => {
                  const u = db.users.find((x) => x.id === m.userId);
                  return (
                    <li key={m.id}>
                      <Link href={`/admin/alumnos/ficha?id=${encodeURIComponent(m.userId)}`} className="flex items-center gap-3 py-3">
                        {u && <Avatar name={u.name} color={u.color} size={32} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u?.name}</p>
                          <p className="text-xs text-muted">
                            {m.planName} · vence {fmt(m.expiresAt, "d MMM")}
                          </p>
                        </div>
                        <Plus size={16} className="text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {confirming && <ConfirmSaleModal key={confirming.id} sale={confirming} onClose={() => setConfirming(null)} />}
    </div>
  );
}
