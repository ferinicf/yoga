"use client";

import { useState } from "react";
import { create } from "zustand";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cuántos modales hay abiertos (los avisos se muestran dentro del modal mientras haya uno). */
export const useOpenModals = create<{ count: number }>(() => ({ count: 0 }));

/** true = éxito, false = error, "warn" = salió bien pero con una consecuencia (p. ej. sin reembolso). */
type Tone = boolean | "warn";

interface Toast {
  id: number;
  text: string;
  ok: Tone;
}

/** Como máximo se ven 2 avisos a la vez, para no tapar la pantalla ni los modales. */
const MAX_TOASTS = 2;

const useToasts = create<{ items: Toast[]; push: (text: string, ok?: Tone) => void }>((set) => ({
  items: [],
  push: (text, ok = true) => {
    const id = Date.now() + Math.random();
    // Un aviso repetido reemplaza al anterior (y vuelve a contar su tiempo), y cualquier aviso
    // nuevo quita los errores anteriores: eran de un intento previo que ya no aplica.
    set((s) => ({
      items: [...s.items.filter((t) => t.text !== text && t.ok !== false), { id, text, ok }].slice(-MAX_TOASTS),
    }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3800);
  },
}));

export const toast = (text: string, ok: Tone = true) => useToasts.getState().push(text, ok);
type R = { ok: boolean; message: string };
/** Cancelaciones tardías: salen bien, pero no se devuelve el crédito (mismo texto en demo y en la base). */
const NO_REFUND = /no se devolvió el crédito/i;
/** Muestra el resultado de una acción (acepta promesas) y lo devuelve. */
export async function toastResult<T extends R>(r: T | Promise<T>): Promise<T> {
  const x = await r;
  if (x.message) toast(x.message, x.ok && NO_REFUND.test(x.message) ? "warn" : x.ok);
  return x;
}

function ToastItem({ t, inline }: { t: Toast; inline?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        "animate-sheet flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
        inline ? "w-full shadow-lg" : "max-w-sm shadow-lg",
        t.ok === "warn" ? "bg-amber-400 text-stone-900" : t.ok ? "bg-stone-900 text-white" : "bg-red-600 text-white",
      )}
    >
      {t.ok === "warn" ? (
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      ) : t.ok ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
      )}
      <span>{t.text}</span>
    </div>
  );
}

/**
 * Avisos flotantes. Celular: arriba; iPad/escritorio: abajo a la derecha. No reciben toques
 * (pointer-events-none) para no bloquear botones. Con un modal abierto no flotan: se muestran
 * dentro del modal (ModalToasts) para no tapar su título ni sus botones.
 */
export function Toaster() {
  const items = useToasts((s) => s.items);
  const modalOpen = useOpenModals((s) => s.count > 0);
  if (modalOpen) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 pt-safe-4 md:bottom-0 md:top-auto md:items-end md:pb-safe-4"
    >
      {items.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}

/**
 * Avisos dentro de un modal abierto, bajo su encabezado. Van superpuestos (no empujan el contenido,
 * así el modal no salta ni se mueven sus botones) y sin recibir toques. Solo se muestran los avisos
 * generados mientras este modal está abierto: los de una acción anterior no se cuelan.
 */
export function ModalToasts() {
  const [since] = useState(() => Date.now());
  const items = useToasts((s) => s.items).filter((t) => t.id >= since);
  if (!items.length) return null;
  return (
    <div className="relative z-10 h-0 shrink-0">
      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 px-5 pt-3">
        {items.map((t) => (
          <ToastItem key={t.id} t={t} inline />
        ))}
      </div>
    </div>
  );
}

/** Espera una acción: si sale bien muestra `okMsg`; si falla, el error real. */
export async function toastDone<T extends R>(p: T | Promise<T>, okMsg: string): Promise<T> {
  const x = await p;
  toast(x.ok ? okMsg : x.message, x.ok);
  return x;
}
