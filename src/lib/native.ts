"use client";

/**
 * Funciones de la app nativa (iOS / Android con Capacitor).
 *
 * Todo es seguro en la web: si la app corre en un navegador, cada función es un no-op (o usa el
 * equivalente web) y los plugins nativos ni siquiera se descargan (import dinámico).
 * Nada de window.confirm/alert: en la app salen con botones en inglés; se usa confirmar()/avisar().
 */
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { avisar, confirmar } from "@/components/confirm-dialog";

/** Esquema de los enlaces profundos de la app: marea://ruta/interna?x=1 */
export const DEEP_LINK_SCHEME = "marea";

/** Dominios web de Marea: si algún día se activan Universal/App Links, se enrutan igual. */
const WEB_HOSTS = ["marea-navy.vercel.app"];

/** ¿Corre dentro de la app nativa (iOS o Android)? */
export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function platform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : "web";
}

/* ---------------------------------------------------------------- vibración */

/** Vibración corta de "listo" (p. ej. al reservar). No hace nada en la web. */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Sin motor de vibración (iPad, simulador): no pasa nada.
  }
}

/* ---------------------------------------------------------------- recordatorios */

/** Minutos antes de la clase en que llega el recordatorio. */
export const REMINDER_MINUTES = 60;

/** Versiones anteriores guardaban aquí un "no" que bloqueaba el permiso para siempre: ya no se usa. */
const LEGACY_ASKED_KEY = "marea-recordatorios";
/** Última vez que se explicó cómo activar las notificaciones en Configuración (para no insistir). */
const SETTINGS_TIP_KEY = "marea-recordatorios-aviso";
const SETTINGS_TIP_EVERY_MS = 7 * 24 * 60 * 60_000;

/** Se emite en `window` cuando se concede el permiso: <NativeBridge/> programa los recordatorios. */
export const REMINDERS_ENABLED_EVENT = "marea:recordatorios-activados";

export type ReminderResult =
  | { ok: true; at: Date }
  | { ok: false; reason: "web" | "denied" | "too-late" | "error" };

/** Estado del permiso de notificaciones ("web" = no aplica, fuera de la app). */
export type RemindersStatus = "web" | "granted" | "prompt" | "denied";

export interface ClassReminder {
  /** Id estable de la reservación (o de la clase). Se usa también para cancelarlo. */
  id: string;
  /** Nombre de la clase, p. ej. "Vinyasa". */
  title: string;
  /** Inicio de la clase. El aviso llega REMINDER_MINUTES antes. */
  at: Date | string;
  /** Salón, se agrega al texto: "Vinyasa a las 7:00 p.m. · Salón Mar". */
  place?: string;
  /** Texto propio (reemplaza al de por omisión: "Vinyasa a las 7:00 p.m."). */
  body?: string;
  /** Ruta que se abre al tocar la notificación. */
  path?: string;
}

/**
 * Los ids de notificación deben ser enteros de 32 bits; las reservaciones usan uuid.
 * FNV-1a → entero positivo estable para el mismo id.
 */
export function reminderId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h & 0x7fffffff) || 1;
}

/**
 * Aviso propio antes de la solicitud del sistema: explica para qué son los recordatorios. Tiene un
 * solo botón ("Continuar") y, se cierre como se cierre, después SIEMPRE viene la solicitud del
 * sistema, que es donde la persona dice sí o no (App Store 5.1.1: el aviso previo no lleva salida).
 */
function defaultExplain(): Promise<unknown> {
  return avisar({
    title: "Recordatorios de tus clases",
    message:
      "Te avisamos en este dispositivo 1 hora antes de cada clase que reserves, para que llegues con calma. " +
      "Enseguida te preguntaremos si permites las notificaciones de Marea.",
    confirmText: "Continuar",
  });
}

/** Abre la página de Marea en la app Configuración (solo iOS tiene una dirección para eso). */
function openAppSettings(): void {
  // UIApplication.openSettingsURLString. Capacitor manda al sistema las direcciones que no son de la app.
  window.location.href = "app-settings:";
}

/**
 * Las notificaciones están bloqueadas: explica cómo activarlas. En iOS ofrece abrir Configuración;
 * Android no tiene una dirección para abrir esa pantalla sin un plugin, así que se explica el camino.
 */
async function explainBlocked(): Promise<void> {
  if (platform() === "ios") {
    const go = await confirmar({
      title: "Activa los recordatorios",
      message:
        "Las notificaciones de Marea están desactivadas. Para recibir un aviso 1 hora antes de tus clases, " +
        "toca «Abrir Configuración», entra a Notificaciones y activa «Permitir notificaciones».",
      confirmText: "Abrir Configuración",
      cancelText: "Ahora no",
    });
    if (go) openAppSettings();
    return;
  }
  await avisar({
    title: "Activa los recordatorios",
    message:
      "Las notificaciones de Marea están desactivadas. Para recibir un aviso 1 hora antes de tus clases, " +
      "abre la configuración de tu teléfono, entra a Aplicaciones › Marea › Notificaciones y actívalas.",
  });
}

function settingsTipDue(): boolean {
  const last = Number(localStorage.getItem(SETTINGS_TIP_KEY) ?? 0);
  return !Number.isFinite(last) || Date.now() - last > SETTINGS_TIP_EVERY_MS;
}

function settingsTipShown(): void {
  localStorage.setItem(SETTINGS_TIP_KEY, String(Date.now()));
}

/** Pausa antes de un aviso que sale solo (al reservar): primero se alcanza a leer "¡Reservación confirmada!". */
const NOTICE_DELAY_MS = 1000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function remindersEnabled(): void {
  window.dispatchEvent(new Event(REMINDERS_ENABLED_EVENT));
}

/**
 * Pide permiso de notificaciones si hace falta. Antes de la solicitud del sistema se explica para
 * qué es (y siempre se llega a la solicitud). Si ya se negó, de vez en cuando (al reservar) se
 * explica cómo activarlas en Configuración; `insist` lo explica siempre (p. ej. desde Mi perfil).
 */
async function ensureNotificationPermission(
  explain: () => Promise<unknown>,
  insist = false,
): Promise<ReminderResult | null> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  localStorage.removeItem(LEGACY_ASKED_KEY);
  let { display } = await LocalNotifications.checkPermissions();
  if (display === "granted") return null;
  if (display === "denied") {
    if (insist || settingsTipDue()) {
      settingsTipShown();
      if (!insist) await wait(NOTICE_DELAY_MS);
      await explainBlocked();
    }
    return { ok: false, reason: "denied" };
  }
  if (!insist) await wait(NOTICE_DELAY_MS);
  await explain();
  ({ display } = await LocalNotifications.requestPermissions());
  if (display === "granted") {
    remindersEnabled();
    return null;
  }
  // Acaba de decir que no: el consejo de Configuración espera unos días.
  settingsTipShown();
  return { ok: false, reason: "denied" };
}

/** Estado del permiso de notificaciones de la app ("web" fuera de la app). No pregunta nada. */
export async function remindersStatus(): Promise<RemindersStatus> {
  if (!isNative()) return "web";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { display } = await LocalNotifications.checkPermissions();
    return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
  } catch {
    return "web";
  }
}

/**
 * Para un botón "Activar recordatorios" (p. ej. en Mi perfil): pide el permiso con el aviso previo
 * o, si ya se negó, explica cómo activarlo en Configuración. Al concederse se programan solos.
 */
export async function enableReminders(): Promise<RemindersStatus> {
  if (!isNative()) return "web";
  try {
    await ensureNotificationPermission(defaultExplain, true);
  } catch {
    // Sin plugin: se informa el estado que haya.
  }
  return remindersStatus();
}

/**
 * Programa (o reprograma) el recordatorio de una clase, 1 h antes de que empiece.
 * `explain` permite mostrar una explicación propia antes del permiso del sistema (por omisión, el
 * aviso "Recordatorios de tus clases"); su resultado no importa: después siempre se pide el permiso.
 */
export async function scheduleClassReminder(
  reminder: ClassReminder,
  opts: { explain?: () => Promise<unknown> } = {},
): Promise<ReminderResult> {
  if (!isNative()) return { ok: false, reason: "web" };
  const n = toNotification(reminder);
  if (!n) return { ok: false, reason: "too-late" };
  try {
    const blocked = await ensureNotificationPermission(opts.explain ?? defaultExplain);
    if (blocked) return blocked;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({ notifications: [n] });
    return { ok: true, at: n.schedule.at };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Notificación lista para programar, o null si ya no da tiempo de avisar (falta menos de 1 h). */
function toNotification(reminder: ClassReminder) {
  const start = new Date(reminder.at);
  const at = new Date(start.getTime() - REMINDER_MINUTES * 60_000);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now() + 60_000) return null;
  const hour = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(start);
  return {
    id: reminderId(reminder.id),
    title: "Tu clase empieza en 1 hora",
    body: reminder.body ?? `${reminder.title} a las ${hour}${reminder.place ? ` · ${reminder.place}` : ""}`,
    // Un aviso con unos minutos de holgura está bien: sin alarma exacta no hay que pedir
    // el permiso especial de Android ni justificarlo en Google Play.
    isExactNotification: false,
    schedule: { at, allowWhileIdle: true },
    // startsAt permite a syncClassReminders notar si la clase cambió de hora.
    extra: { path: reminder.path ?? "/alumno/reservas", reservationId: reminder.id, startsAt: start.toISOString() },
  };
}

/**
 * Deja programados exactamente los recordatorios de `reminders` (las clases reservadas que aún no
 * empiezan): agrega los que faltan, reprograma los que cambiaron de hora y quita los demás (clase
 * cancelada por el estudio, reservación cancelada en otro dispositivo…). Así también se cubre a
 * quien pasa de la lista de espera a la clase. Nunca pide permiso: si no está concedido, no hace nada.
 */
export async function syncClassReminders(reminders: ClassReminder[]): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
    const wanted = new Map(reminders.map((r) => [reminderId(r.id), r]));
    const { notifications: pending } = await LocalNotifications.getPending();
    const startsAt = (extra: unknown) =>
      extra && typeof extra === "object" && "startsAt" in extra ? String(extra.startsAt) : null;

    const stale = pending.filter((p) => !wanted.has(p.id));
    if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((p) => ({ id: p.id })) });

    const current = new Map(pending.map((p) => [p.id, startsAt(p.extra)]));
    const toSchedule = reminders
      .map(toNotification)
      .filter((n): n is NonNullable<typeof n> => {
        if (!n) return false; // ya no da tiempo de avisar
        if (!current.has(n.id)) return true;
        // Ya programado a la misma hora (o sin dato de hora, de una versión anterior): se deja.
        const prev = current.get(n.id);
        return prev !== null && prev !== n.extra.startsAt;
      });
    if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule });
  } catch {
    // Sin permiso o sin plugin: los recordatorios se quedan como estaban.
  }
}

/** Quita el recordatorio de una clase (al cancelar la reservación). */
export async function cancelClassReminder(id: string): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: reminderId(id) }] });
  } catch {
    // Si no existía, no hay nada que quitar.
  }
}

/** Quita todos los recordatorios pendientes (p. ej. al cerrar sesión o eliminar la cuenta). */
export async function cancelAllReminders(): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch {
    // Nada que hacer.
  }
}

/* ---------------------------------------------------------------- enlaces */

/**
 * Abre un sitio externo. En la app usa el navegador del sistema dentro de la app
 * (SFSafariViewController en iOS, Custom Tabs en Android), que es lo que piden Mercado Pago
 * y las tiendas para pagos; en la web abre una pestaña nueva.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isNative()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, toolbarColor: "#F7F5F1", presentationStyle: "popover" });
}

/** Cierra el navegador abierto con openExternal (p. ej. al volver del pago). */
export async function closeExternal(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // No había navegador abierto.
  }
}

/**
 * Convierte un enlace profundo en una ruta interna de la app, o null si no es nuestro.
 *   marea://alumno/reservas            → /alumno/reservas
 *   marea:///alumno/reservas?x=1       → /alumno/reservas?x=1
 *   marea://pago?estado=aprobado       → /pago?estado=aprobado
 *   https://marea-navy.vercel.app/x    → /x
 */
export function deepLinkToPath(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  let path: string;
  if (u.protocol === `${DEEP_LINK_SCHEME}:`) {
    // En marea://alumno/reservas el primer segmento llega como "host".
    path = `/${u.host}${u.pathname}`;
  } else if ((u.protocol === "https:" || u.protocol === "http:") && WEB_HOSTS.includes(u.host)) {
    path = u.pathname;
  } else {
    return null;
  }
  // Solo rutas internas: sin "//", sin "..", sin protocolos colados.
  path = "/" + path.split("/").filter((s) => s && s !== "." && s !== "..").join("/");
  return path + u.search + u.hash;
}

/**
 * Escucha los enlaces profundos (marea://…) con los que se abre la app.
 * Devuelve una función para dejar de escuchar. En la web no hace nada.
 */
export function onDeepLink(handler: (url: string) => void): () => void {
  if (!isNative()) return () => {};
  let handle: PluginListenerHandle | undefined;
  let stopped = false;
  import("@capacitor/app")
    .then(({ App }) => App.addListener("appUrlOpen", (e) => handler(e.url)))
    .then((h) => {
      if (stopped) h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    stopped = true;
    handle?.remove();
  };
}

/**
 * Ruta de un enlace profundo que todavía no se termina de abrir. La pantalla de inicio la usa en
 * lugar del inicio del rol: al abrir la app en frío con un enlace, el reenvío al inicio (que llega
 * cuando cargan los datos) no le gana al enlace; y si hay que iniciar sesión primero, después se va ahí.
 */
let pendingLink: { path: string; until: number } | null = null;
const PENDING_LINK_MS = 5 * 60_000;

const bare = (path: string) => (path.split(/[?#]/)[0].replace(/\/+$/, "") || "/");

export function setPendingDeepLink(path: string): void {
  pendingLink = { path, until: Date.now() + PENDING_LINK_MS };
}

/** Devuelve (y olvida) la ruta pendiente, si sigue vigente. */
export function takePendingDeepLink(): string | null {
  const p = pendingLink;
  pendingLink = null;
  return p && p.until > Date.now() ? p.path : null;
}

/** Se llama en cada cambio de pantalla: si ya se llegó a la ruta del enlace, deja de estar pendiente. */
export function reachedPath(pathname: string): void {
  if (pendingLink && bare(pendingLink.path) === bare(pathname)) pendingLink = null;
}
