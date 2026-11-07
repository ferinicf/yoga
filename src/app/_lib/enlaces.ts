import { isNative } from "@/lib/native";

/** Dirección pública de la web (Vercel). Se puede cambiar con NEXT_PUBLIC_SITE_URL. */
const WEB_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://marea-navy.vercel.app").replace(/\/+$/, "");

/**
 * Origen de los enlaces que Supabase manda por correo (confirmar cuenta, nueva contraseña).
 * En el navegador es el sitio actual (Vercel o localhost). Dentro de la app la página vive en
 * capacitor://localhost o https://localhost, que no se pueden abrir desde un correo: ahí se usa la web.
 */
export function emailLinkOrigin(): string {
  return isNative() ? WEB_URL : window.location.origin;
}

const FORWARD_KEY = "marea:reenvio";

/**
 * El WebView de la app (Capacitor) responde con el index.html de la raíz a cualquier dirección
 * sin extensión, así que al recargar /admin/clase/?id=… se abre la pantalla de inicio con esa URL.
 * Devuelve la dirección a la que hay que ir (navegación del lado del cliente) o null si no aplica.
 * Si ya se intentó y volvió aquí (la ruta no existe y Next recargó la página), devuelve null
 * para no entrar en un ciclo.
 */
export function takeForwardTarget(): string | null {
  const { pathname, search, hash } = window.location;
  if (pathname === "/" || pathname === "/index.html") return null;
  const target = pathname + search + hash;
  if (sessionStorage.getItem(FORWARD_KEY) === target) {
    sessionStorage.removeItem(FORWARD_KEY);
    return null;
  }
  sessionStorage.setItem(FORWARD_KEY, target);
  return target;
}

/** Se llama al salir de la pantalla de inicio: el reenvío funcionó. */
export function forwardDone() {
  sessionStorage.removeItem(FORWARD_KEY);
}
