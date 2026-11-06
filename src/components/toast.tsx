"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  text: string;
  ok: boolean;
}

const useToasts = create<{ items: Toast[]; push: (text: string, ok?: boolean) => void }>((set) => ({
  items: [],
  push: (text, ok = true) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, text, ok }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3800);
  },
}));

export const toast = (text: string, ok = true) => useToasts.getState().push(text, ok);
type R = { ok: boolean; message: string };
/** Muestra el resultado de una acción (acepta promesas) y lo devuelve. */
export async function toastResult<T extends R>(r: T | Promise<T>): Promise<T> {
  const x = await r;
  if (x.message) toast(x.message, x.ok);
  return x;
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 pt-safe md:bottom-0 md:top-auto md:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "animate-sheet pointer-events-auto flex max-w-sm items-start gap-2 rounded-2xl px-4 py-3 text-sm text-white shadow-lg",
            t.ok ? "bg-stone-900" : "bg-red-600",
          )}
        >
          {t.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Espera una acción: si sale bien muestra `okMsg`; si falla, el error real. */
export async function toastDone<T extends R>(p: T | Promise<T>, okMsg: string): Promise<T> {
  const x = await p;
  toast(x.ok ? okMsg : x.message, x.ok);
  return x;
}
