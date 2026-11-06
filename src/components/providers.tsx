"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Toaster, toast } from "./toast";

/** Texto casi negro de la app (igual que --ink). */
const INK_DARK = "#1f2421";

function channel(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa (WCAG 2.1) de un color #RRGGBB; null si el formato no es válido. */
export function luminance(hex: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Contraste WCAG entre dos colores #RRGGBB (de 1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a) ?? 0;
  const y = luminance(b) ?? 0;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Color del texto sobre el color de marca (--brand-ink): blanco, o casi negro cuando la marca
 * es clara. El corte (0.23) deja blanco en los tonos medios, donde ambos se leen parecido.
 */
export function brandInk(hex: string): string {
  const l = luminance(hex);
  return l !== null && l > 0.23 ? INK_DARK : "#ffffff";
}

function hex2(n: number) {
  return Math.round(n).toString(16).padStart(2, "0");
}

/**
 * Marca para texto sobre fondos claros (--brand-text): el mismo color si se lee bien sobre blanco
 * (contraste 4.5:1, WCAG AA); si no, se oscurece hacia el texto de la app lo justo para lograrlo.
 */
export function brandText(hex: string): string {
  if (luminance(hex) === null || contrastRatio(hex, "#ffffff") >= 4.5) return hex;
  const from = parseInt(hex.slice(1), 16);
  const to = parseInt(INK_DARK.slice(1), 16);
  const mix = (shift: number, t: number) => ((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t;
  for (let t = 0.05; t < 1; t += 0.05) {
    const c = `#${hex2(mix(16, t))}${hex2(mix(8, t))}${hex2(mix(0, t))}`;
    if (contrastRatio(c, "#ffffff") >= 4.5) return c;
  }
  return INK_DARK;
}

/**
 * Arranque de la app:
 *  - modo demo: carga los datos guardados en el navegador;
 *  - modo real: recupera la sesión de Supabase y descarga los datos visibles para el usuario.
 */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const mode = useStore((s) => s.mode);
  const brand = useStore((s) => s.db.settings.brandColor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useStore.persist.rehydrate();
      const st = useStore.getState();
      try {
        if (st.mode === "live") {
          await st.refresh();
          // Genera las clases de las próximas semanas a partir del horario recurrente.
          st.ensureSessions().then(() => useStore.getState().refresh()).catch(() => {});
        } else {
          await st.ensureSessions();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
      if (!cancelled) useStore.getState().setHydrated();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sesión de Supabase: al entrar o salir, recarga los datos.
  useEffect(() => {
    if (mode !== "live") return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        useStore
          .getState()
          .refresh()
          .catch(() => toast("No pudimos cargar tus datos. Revisa tu conexión.", false));
      }
    });
    // Mantiene el horario y la ocupación al día.
    const onFocus = () => useStore.getState().refresh().catch(() => {});
    window.addEventListener("focus", onFocus);
    const t = setInterval(() => document.visibilityState === "visible" && onFocus(), 60_000);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--brand", brand);
    // Texto sobre la marca siempre legible, aunque el estudio elija un color claro.
    root.setProperty("--brand-ink", brandInk(brand));
    // Enlaces y pestañas en color de marca sobre fondo claro: también legibles.
    root.setProperty("--brand-text", brandText(brand));
  }, [brand]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </div>
    );
  }
  return (
    <>
      {error && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm text-white">
          No pudimos conectar con el servidor ({error}). Revisa tu conexión y recarga la página.
        </div>
      )}
      {children}
      <Toaster />
    </>
  );
}
