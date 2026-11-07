"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PluginListenerHandle } from "@capacitor/core";
import { useStore } from "@/lib/store";
import {
  cancelAllReminders,
  closeExternal,
  deepLinkToPath,
  isNative,
  onDeepLink,
  reachedPath,
  REMINDERS_ENABLED_EVENT,
  setPendingDeepLink,
  syncClassReminders,
  takePendingDeepLink,
} from "@/lib/native";
import { upcomingReminders } from "@/lib/reminders";

/** Tope de seguridad: si algo tarda de más, la pantalla de inicio se quita igual. */
const SPLASH_MAX_MS = 8000;
const LAUNCH_KEY = "marea-enlaces-atendidos";

function handledLinks(): string[] {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(LAUNCH_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Cierra la ventana superpuesta de hasta arriba (Modal o menú lateral) con su botón "Cerrar".
 * Devuelve false si no había ninguna abierta.
 */
function closeTopOverlay(): boolean {
  const overlays = document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], .fixed.inset-0');
  for (let i = overlays.length - 1; i >= 0; i--) {
    const close = overlays[i].querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]');
    if (close) {
      close.click();
      return true;
    }
  }
  return false;
}

/**
 * Integración con la app nativa (Capacitor). En la web no hace nada y no carga ningún plugin.
 *  - barra de estado con texto oscuro (la app es de fondo claro);
 *  - quita la pantalla de inicio cuando la app terminó de cargar;
 *  - botón "atrás" de Android: cierra la ventana abierta, regresa en el historial o sale;
 *  - enlaces marea://… y toques en notificaciones → rutas internas;
 *  - recordatorios al día con las reservaciones (también si el estudio cancela o mueve una clase,
 *    o si pasas de la lista de espera a la clase, o si activas las notificaciones en Configuración y
 *    vuelves a la app); al cerrar sesión se borran;
 *  - al volver a la app recarga los datos.
 */
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const userId = useStore((s) => s.currentUserId);
  const splashHidden = useRef(false);

  // El enlace profundo deja de estar pendiente cuando ya se ve su pantalla con la sesión iniciada.
  useEffect(() => {
    if (userId) reachedPath(pathname);
  }, [pathname, userId]);

  // Pantalla de inicio: se quita al hidratar (o al llegar al tope de tiempo).
  useEffect(() => {
    if (!isNative() || splashHidden.current) return;
    const hide = () => {
      if (splashHidden.current) return;
      splashHidden.current = true;
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 250 }))
        .catch(() => {});
    };
    if (hydrated) {
      // Un cuadro después, para que ya esté pintada la primera pantalla.
      const raf = requestAnimationFrame(hide);
      return () => cancelAnimationFrame(raf);
    }
    const t = setTimeout(hide, SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, [hydrated]);

  useEffect(() => {
    if (!isNative()) return;
    const handles: PluginListenerHandle[] = [];
    let stopped = false;
    const keep = (h: PluginListenerHandle) => (stopped ? h.remove() : handles.push(h));

    let lastLink = { url: "", at: 0 };
    const openLink = (url: string) => {
      // iOS entrega el enlace de arranque por dos vías (evento y getLaunchUrl): se atiende una vez.
      if (url === lastLink.url && Date.now() - lastLink.at < 3000) return;
      lastLink = { url, at: Date.now() };
      // Enlaces ya atendidos en esta sesión del WebView (ver getLaunchUrl más abajo).
      sessionStorage.setItem(LAUNCH_KEY, JSON.stringify([...handledLinks(), url].slice(-20)));
      const path = deepLinkToPath(url);
      if (!path) return;
      // Si venimos del navegador del sistema abierto desde la app (p. ej. el pago), lo cerramos.
      closeExternal();
      // Pendiente hasta llegar: si la pantalla de inicio está por mandar al inicio del rol, va aquí.
      setPendingDeepLink(path);
      router.push(path);
    };
    const stopLinks = onDeepLink(openLink);

    // Recordatorios = clases reservadas que aún no empiezan. Se revisa (con una pausa, para juntar
    // cambios seguidos) cada vez que cambian los datos; solo con sesión y si ya hay permiso.
    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleSync = () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        const st = useStore.getState();
        if (st.hydrated && st.currentUserId) syncClassReminders(upcomingReminders(st.db, st.currentUserId));
      }, 1500);
    };
    scheduleSync();
    // Se acaba de conceder el permiso (al reservar o desde un botón "Activar recordatorios").
    window.addEventListener(REMINDERS_ENABLED_EVENT, scheduleSync);

    (async () => {
      const [{ App }, { StatusBar, Style }, { LocalNotifications }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
        import("@capacitor/local-notifications"),
      ]);
      if (stopped) return;

      // Texto oscuro sobre el fondo claro (Style.Light = contenido oscuro).
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});

      // Android: botón / gesto de "atrás".
      keep(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (closeTopOverlay()) return;
          if (canGoBack) window.history.back();
          // Como en Android 12+: la app pasa al fondo sin perder su estado.
          else App.minimizeApp().catch(() => App.exitApp());
        }),
      );

      // Enlace con el que se abrió la app en frío (Android no lo manda como evento). Si ya se
      // atendió (p. ej. el WebView se recargó), no vuelve a llevar a esa ruta.
      const launch = await App.getLaunchUrl().catch(() => undefined);
      if (launch?.url && !handledLinks().includes(launch.url)) openLink(launch.url);

      // Tocar un recordatorio abre la ruta que trae (por omisión, Mis reservas).
      keep(
        await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
          const path = typeof notification.extra?.path === "string" ? notification.extra.path : null;
          if (path?.startsWith("/") && !path.startsWith("//")) router.push(path);
        }),
      );

      // Al volver a la app, datos al día (en la web lo hace el evento "focus"). También se revisan los
      // recordatorios: quizá se activaron las notificaciones en Configuración.
      keep(
        await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          const st = useStore.getState();
          if (st.hydrated && st.mode === "live") st.refresh().catch(() => {});
          scheduleSync();
        }),
      );
    })().catch(() => {});

    const unsub = useStore.subscribe((s, prev) => {
      // Al cerrar sesión (o cambiar de modo) se borran los recordatorios de este teléfono.
      if (prev.currentUserId && !s.currentUserId) {
        clearTimeout(syncTimer);
        takePendingDeepLink();
        cancelAllReminders();
      } else if (s.db !== prev.db || s.currentUserId !== prev.currentUserId || s.hydrated !== prev.hydrated) {
        scheduleSync();
      }
    });

    return () => {
      stopped = true;
      clearTimeout(syncTimer);
      window.removeEventListener(REMINDERS_ENABLED_EVENT, scheduleSync);
      stopLinks();
      unsub();
      handles.forEach((h) => h.remove());
    };
  }, [router]);

  return null;
}
