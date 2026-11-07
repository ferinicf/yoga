import type { Settings } from "./types";

/**
 * Datos del responsable y direcciones de las páginas públicas (aviso de privacidad, eliminar la
 * cuenta y soporte). Las tiendas piden estas URLs:
 *   https://marea-navy.vercel.app/privacidad · /eliminar-cuenta · /soporte
 * No depende del store ni de React: se puede importar desde componentes del servidor y del cliente.
 */

export const STUDIO_NAME = "Marea";
export const CONTACT_EMAIL = "desarrolladorfero@gmail.com";
/**
 * Nombre completo (persona física) o razón social del responsable de los datos personales.
 * Pendiente: lo completa el dueño. Mientras esté vacío, las páginas muestran el nombre del estudio.
 */
export const RESPONSIBLE_NAME = "";

/** Dirección pública de la web (la que se registra en App Store Connect y Play Console). */
export const PUBLIC_SITE_URL = "https://marea-navy.vercel.app";
export const PRIVACY_PATH = "/privacidad";
export const DELETE_ACCOUNT_PATH = "/eliminar-cuenta";
export const SUPPORT_PATH = "/soporte";

/** Última actualización del aviso de privacidad. Cámbiala cada vez que se modifique el aviso. */
export const PRIVACY_UPDATED = "7 de noviembre de 2026";

/** Enlace mailto: al correo de contacto con asunto (y, opcional, el cuerpo del mensaje). */
export function mailtoHref(subject: string, body?: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`];
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${CONTACT_EMAIL}?${q.join("&")}`;
}

/** Datos públicos del estudio para las páginas legales y de soporte (vacío = no configurado). */
export interface StudioContact {
  /** Responsable: RESPONSIBLE_NAME o, si está vacío, el nombre del estudio. */
  responsible: string;
  studioName: string;
  address: string;
  /** Teléfono tal como lo escribió el estudio, y su enlace tel:. */
  phone: string;
  phoneHref: string;
  /** Enlace de WhatsApp (wa.me) y el número para mostrarlo. */
  whatsapp: string;
  whatsappHref: string;
  instagram: string;
  instagramHref: string;
}

/** Valores de ejemplo de los datos semilla (modo demo o sin conexión): no se muestran como reales. */
function isPlaceholderPhone(digits: string) {
  return /^(52)?(55)?0+$/.test(digits);
}

/**
 * Contacto del estudio a partir de la configuración (Admin → Configuración). Pásale los ajustes
 * SOLO si vienen del servidor (modo real); con null usa las constantes de este archivo.
 * Descarta los datos de ejemplo del modo demo ("Av. Ejemplo…", "55 0000 0000").
 */
export function studioContact(settings: Pick<Settings, "studioName" | "address" | "phone" | "whatsapp" | "instagram"> | null): StudioContact {
  const studioName = settings?.studioName?.trim() || STUDIO_NAME;
  const rawAddress = (settings?.address ?? "").trim();
  const address = /ejemplo/i.test(rawAddress) ? "" : rawAddress;

  const rawPhone = (settings?.phone ?? "").trim();
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length >= 8 && !isPlaceholderPhone(phoneDigits);

  const wa = (settings?.whatsapp ?? "").replace(/\D/g, "");
  const waOk = wa.length >= 10 && !isPlaceholderPhone(wa);

  const instagram = (settings?.instagram ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");

  return {
    responsible: RESPONSIBLE_NAME.trim() || studioName,
    studioName,
    address,
    phone: phoneOk ? rawPhone : "",
    phoneHref: phoneOk ? `tel:${rawPhone.replace(/[^\d+]/g, "")}` : "",
    whatsapp: waOk ? wa : "",
    whatsappHref: waOk ? `https://wa.me/${wa.length === 10 ? `52${wa}` : wa}` : "",
    instagram,
    instagramHref: instagram ? `https://instagram.com/${encodeURIComponent(instagram)}` : "",
  };
}
