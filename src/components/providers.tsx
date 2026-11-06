"use client";

import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Toaster } from "./toast";

/** Carga los datos guardados en el navegador y aplica el color de marca. */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const brand = useStore((s) => s.db.settings.brandColor);

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      useStore.getState().ensureSessions();
      useStore.getState().setHydrated();
    });
  }, []);

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
      {children}
      <Toaster />
    </>
  );
}
