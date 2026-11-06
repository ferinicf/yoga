"use client";

import { useEffect, useRef } from "react";
import { addDays, isSameDay, startOfDay } from "date-fns";
import { cn, fmt } from "@/lib/utils";

/** Tira horizontal de días (estilo app de reservas). */
export function DayStrip({
  value,
  onChange,
  from,
  days,
  marks,
}: {
  value: Date;
  onChange: (d: Date) => void;
  from: Date;
  days: number;
  /** Días con algo destacado (ej. tienes reservación). */
  marks?: (d: Date) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const list = Array.from({ length: days }, (_, i) => addDays(startOfDay(from), i));
  const today = new Date();

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [value]);

  return (
    <div ref={ref} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {list.map((d) => {
        const sel = isSameDay(d, value);
        return (
          <button
            key={d.toISOString()}
            data-selected={sel}
            onClick={() => onChange(d)}
            className={cn(
              "relative flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 transition",
              sel ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:border-stone-300",
            )}
          >
            <span className={cn("text-[11px] uppercase", sel ? "opacity-90" : "text-muted")}>
              {isSameDay(d, today) ? "Hoy" : fmt(d, "EEE")}
            </span>
            <span className="text-lg font-semibold tabular-nums">{fmt(d, "d")}</span>
            <span className={cn("text-[10px]", sel ? "opacity-80" : "text-muted")}>{fmt(d, "MMM")}</span>
            {marks?.(d) && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", sel ? "bg-white" : "bg-brand")} />}
          </button>
        );
      })}
    </div>
  );
}
