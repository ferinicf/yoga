"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

/** Tile de KPI: etiqueta · valor · variación opcional (con signo, contra un periodo nombrado). */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  upIsGood = true,
  icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  icon?: ReactNode;
  hint?: string;
}) {
  const hasDelta = delta !== undefined && Number.isFinite(delta);
  const good = hasDelta && (delta! >= 0 ? upIsGood : !upIsGood);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">{value}</p>
      {hasDelta ? (
        <p className="mt-1 text-xs leading-snug">
          <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-emerald-700" : "text-red-700")}>
            {delta! >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {delta! >= 0 ? "+" : ""}
            {Math.round(delta!)}%
          </span>{" "}
          <span className="text-muted">{deltaLabel}</span>
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/**
 * Columnas de ingresos por mes (una sola serie, sin leyenda: el título la nombra).
 * Barras delgadas con extremos redondeados de 4px anclados a la base, 2px de separación,
 * mes actual en el color de marca y meses previos en un tono atenuado de la misma marca.
 * Tooltip por barra al pasar el cursor/tocar y tabla accesible equivalente.
 */
export function RevenueChart({ data }: { data: { label: string; value: number; current?: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const H = 160;
  return (
    <figure>
      <div className="relative flex items-end gap-[2px] border-b border-line" style={{ height: H }}>
        {/* línea de guía recesiva al 50% */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: H / 2 }} />
        {data.map((d) => {
          const h = Math.max(d.value > 0 ? 4 : 0, Math.round((d.value / max) * (H - 24)));
          return (
            <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${d.label}: ${formatMoney(d.value)}`}>
              <div
                className="w-full max-w-12 rounded-t-[4px] transition"
                style={{
                  height: h,
                  background: d.current ? "var(--brand)" : "color-mix(in srgb, var(--brand) 45%, white)",
                }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-stone-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                {d.label}: <span className="font-semibold tabular-nums">{formatMoney(d.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {data.map((d) => (
          <span key={d.label} className={cn("flex-1 text-center text-xs", d.current ? "font-semibold text-ink" : "text-muted")}>
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Ingresos por mes</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
