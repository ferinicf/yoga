"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Toaster, toast } from "./toast";

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
    document.documentElement.style.setProperty("--brand", brand);
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
