"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { AtSign, ChevronLeft, Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { useCurrentUser, useSettings, useStore } from "@/lib/store";
import { CONTACT_EMAIL, DELETE_ACCOUNT_PATH, PRIVACY_PATH, STUDIO_NAME, SUPPORT_PATH, mailtoHref, studioContact, type StudioContact } from "@/lib/legal";
import { buttonClass, textLinkClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Piezas de las páginas públicas (aviso de privacidad, eliminar cuenta, soporte y 404): se ven
 * sin sesión, en la web y dentro de la app (export estático), y respetan el diseño de la app.
 */

const FOOTER_LINKS = [
  { href: PRIVACY_PATH, label: "Aviso de privacidad" },
  { href: DELETE_ACCOUNT_PATH, label: "Eliminar cuenta" },
  { href: SUPPORT_PATH, label: "Ayuda" },
];

/**
 * Contacto del estudio: solo con datos del servidor (en el demo los datos son de ejemplo). Antes
 * del arranque (HTML del servidor o del export) usa los datos fijos: así el texto ya viene en el
 * HTML, coincide al hidratar y nunca muestra los datos de ejemplo de la semilla.
 */
export function useStudioContact(): StudioContact {
  const settings = useSettings();
  const live = useStore((s) => s.mode === "live" && s.hydrated);
  return studioContact(live ? settings : null);
}

const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/**
 * ¿Se llegó aquí navegando dentro de la app? Si la página se abrió directo (enlace de la tienda,
 * pestaña nueva), la primera página que cargó el navegador es esta misma y no hay a dónde regresar.
 */
function cameFromInsideApp(pathname: string): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.name) return trimSlash(new URL(nav.name).pathname) !== trimSlash(pathname);
  } catch {
    // Sin esa información: se usa el historial.
  }
  return window.history.length > 1;
}

/** Regresa a la pantalla anterior; si la página se abrió directo (p. ej. desde la tienda), al inicio. */
function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      onClick={() => (cameFromInsideApp(pathname) ? router.back() : router.push("/"))}
      className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-1 gap-1 px-2" })}
    >
      <ChevronLeft size={20} aria-hidden /> Volver
    </button>
  );
}

/** Marco de una página pública: barra superior con "Volver", título y pie con las otras páginas. */
export function PublicPage({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const studio = useStudioContact().studioName;
  const current = trimSlash(pathname);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 pt-safe backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-3">
          <BackButton />
          <Link href="/" className="flex min-h-10 items-center gap-2 rounded-xl px-1 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-ink" aria-hidden>
              {studio.charAt(0)}
            </span>
            {studio}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-safe-10 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        <div className="mt-6 space-y-4">{children}</div>
        <nav aria-label="Información" className="mt-10 flex flex-wrap justify-center gap-x-4 border-t border-line pt-4 text-sm text-muted">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className={cn(textLinkClass, "px-1 underline-offset-2 hover:underline", current === l.href && "font-medium text-ink")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

/** Bloque de contenido con título (una sección del aviso, una pregunta de soporte…). */
export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  const auto = useId();
  const headingId = `${id ?? auto}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      // Al saltar desde el índice, que el título no quede debajo de la barra fija (ni del notch).
      className="scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] rounded-2xl border border-line bg-surface p-5"
    >
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-6">{children}</div>
    </section>
  );
}

/** Responsable del tratamiento: nombre, domicilio y correo (lo que esté configurado). */
export function ResponsibleDetails() {
  const c = useStudioContact();
  return (
    <ul className="mt-3 space-y-2 text-sm">
      <li>
        <span className="text-muted">Responsable: </span>
        <span className="font-medium">{c.responsible}</span>
        {c.responsible !== c.studioName && <span className="text-muted"> (estudio {c.studioName})</span>}
      </li>
      {c.address && (
        <li>
          <span className="text-muted">Domicilio: </span>
          {c.address}
        </li>
      )}
      <li>
        <span className="text-muted">Correo para temas de privacidad: </span>
        <a href={mailtoHref("Privacidad")} className="break-words font-medium text-brand-text underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
      </li>
      {c.phone && (
        <li>
          <span className="text-muted">Teléfono: </span>
          <a href={c.phoneHref} className="underline underline-offset-2">
            {c.phone}
          </a>
        </li>
      )}
    </ul>
  );
}

/** Formas de contacto del estudio para la página de soporte: siempre el correo; lo demás si existe. */
export function ContactOptions() {
  const c = useStudioContact();
  const row = "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 hover:bg-black/5";
  return (
    <ul className="-mx-2 divide-y divide-line">
      <li>
        <a href={mailtoHref(`Ayuda con la app ${STUDIO_NAME}`)} className={row}>
          <Mail size={20} className="shrink-0 text-brand-text" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Correo</span>
            <span className="block break-words text-sm text-muted">{CONTACT_EMAIL}</span>
          </span>
        </a>
      </li>
      {c.whatsappHref && (
        <li>
          <a href={c.whatsappHref} target="_blank" rel="noreferrer" className={row}>
            <MessageCircle size={20} className="shrink-0 text-brand-text" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">WhatsApp</span>
              <span className="block text-sm text-muted">Escríbenos al estudio</span>
            </span>
          </a>
        </li>
      )}
      {c.phone && (
        <li>
          <a href={c.phoneHref} className={row}>
            <Phone size={20} className="shrink-0 text-brand-text" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Teléfono</span>
              <span className="block text-sm text-muted">{c.phone}</span>
            </span>
          </a>
        </li>
      )}
      {c.instagramHref && (
        <li>
          <a href={c.instagramHref} target="_blank" rel="noreferrer" className={row}>
            <AtSign size={20} className="shrink-0 text-brand-text" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Instagram</span>
              <span className="block break-words text-sm text-muted">@{c.instagram}</span>
            </span>
          </a>
        </li>
      )}
      {c.address && (
        <li className={cn(row, "hover:bg-transparent")}>
          <MapPin size={20} className="shrink-0 text-brand-text" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Estudio</span>
            <span className="block text-sm text-muted">{c.address}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

/** Botón que abre el correo con asunto y texto listos (en la app abre la app de correo del teléfono). */
export function EmailButton({ subject, body, children, variant = "primary" }: { subject: string; body?: string; children: ReactNode; variant?: "primary" | "outline" }) {
  return (
    <a href={mailtoHref(subject, body)} className={buttonClass({ variant, size: "lg", className: "w-full sm:w-auto" })}>
      <Mail size={18} aria-hidden /> {children}
    </a>
  );
}

/** Dónde está "Eliminar mi cuenta" para cada rol (alumno y profesor: Perfil; administración: Mi cuenta). */
const ACCOUNT_PAGE = {
  student: { href: "/alumno/perfil", label: "Ir a mi perfil" },
  teacher: { href: "/profesor/perfil", label: "Ir a mi perfil" },
  admin: { href: "/admin/cuenta", label: "Ir a Mi cuenta" },
} as const;

/** Con sesión iniciada en la app: atajo a la pantalla donde está "Eliminar mi cuenta". */
export function ProfileShortcut() {
  const user = useCurrentUser();
  const target = user ? ACCOUNT_PAGE[user.role] : null;
  if (!target) return null;
  return (
    <Link href={target.href} className={buttonClass({ size: "lg", className: "w-full sm:w-auto" })}>
      <UserRound size={18} aria-hidden /> {target.label}
    </Link>
  );
}

/** Botón principal para regresar al inicio (o a la pantalla de inicio del rol, si hay sesión). */
export function HomeButton() {
  return (
    <Link href="/" className={buttonClass({ size: "lg", className: "w-full" })}>
      Volver al inicio
    </Link>
  );
}
