import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DELETE_ACCOUNT_PATH, PRIVACY_PATH, STUDIO_NAME } from "@/lib/legal";
import { ContactOptions, EmailButton, LegalSection, PublicPage } from "@/components/public-page";

/**
 * Soporte: contacto del estudio y preguntas frecuentes. Es la "URL de soporte" que pide App Store
 * Connect (https://marea-navy.vercel.app/soporte). El correo siempre aparece; WhatsApp, teléfono,
 * Instagram y dirección salen de Admin → Configuración cuando están llenos.
 */
export const metadata: Metadata = {
  title: `Ayuda y soporte · ${STUDIO_NAME}`,
  description: `Contacto y preguntas frecuentes de la app de ${STUDIO_NAME}: reservas, paquetes, recordatorios y tu cuenta.`,
};

const link = "font-medium text-brand-text underline underline-offset-2";

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "¿Cómo reservo una clase?",
    a: (
      <>
        En <strong className="font-medium">Horario</strong> elige el día y la clase y toca{" "}
        <strong className="font-medium">Reservar</strong> (si el estudio usa lugares, primero elige el tuyo). Necesitas un
        paquete vigente con créditos; si no tienes, la app te lleva a Paquetes.
      </>
    ),
  },
  {
    q: "¿Cómo cancelo una reservación?",
    a: (
      <>
        En <strong className="font-medium">Reservas</strong> abre la clase y toca{" "}
        <strong className="font-medium">Cancelar mi reservación</strong>. Si cancelas con la anticipación que pide el estudio,
        te devolvemos el crédito; si ya es tarde, la app te avisa antes de confirmar.
      </>
    ),
  },
  {
    q: "¿Qué pasa si la clase está llena?",
    a: "Si el estudio tiene lista de espera, puedes unirte. Si se libera un lugar, te lo asignamos automáticamente y la clase aparece en Reservas.",
  },
  {
    q: "¿Cómo compro un paquete?",
    a: (
      <>
        En <strong className="font-medium">Paquetes</strong> elige el que quieras y sigue los pasos. Si lo pagas en recepción,
        se activa en cuanto el estudio registra tu pago.
      </>
    ),
  },
  {
    q: "¿Cómo hago check-in al llegar?",
    a: (
      <>
        En <strong className="font-medium">Perfil</strong> está tu código de acceso (QR). Muéstralo en recepción o a tu
        profesor.
      </>
    ),
  },
  {
    q: "¿Cómo activo o quito los recordatorios?",
    a: (
      <>
        En la app para iPhone y Android, la primera vez que reservas te preguntamos si quieres un aviso 1 hora antes de cada
        clase. Si dijiste que no, en <strong className="font-medium">Perfil → Recordatorios de clases</strong> toca{" "}
        <strong className="font-medium">Activar recordatorios</strong>. Para quitarlos, entra a la configuración de tu
        teléfono → Marea → Notificaciones.
      </>
    ),
  },
  {
    q: "Olvidé mi contraseña",
    a: (
      <>
        En la pantalla de acceso toca <strong className="font-medium">¿Olvidaste tu contraseña?</strong>, escribe tu correo y
        abre el enlace que te enviamos.
      </>
    ),
  },
  {
    q: "¿Cómo cambio mis datos?",
    a: (
      <>
        En <strong className="font-medium">Perfil</strong> puedes cambiar tu nombre, correo, teléfono y cumpleaños.
      </>
    ),
  },
  {
    q: "¿Cómo elimino mi cuenta?",
    a: (
      <>
        En <strong className="font-medium">Perfil → Eliminar mi cuenta</strong> (si administras el estudio, en{" "}
        <strong className="font-medium">Menú → Mi cuenta</strong>), o por correo si ya no tienes la app.{" "}
        <Link href={DELETE_ACCOUNT_PATH} className={link}>
          Ver los pasos
        </Link>
        .
      </>
    ),
  },
  {
    q: "¿Qué hacen con mis datos?",
    a: (
      <>
        Los usamos solo para darte el servicio del estudio; no los vendemos ni los usamos para publicidad. Todo está en el{" "}
        <Link href={PRIVACY_PATH} className={link}>
          aviso de privacidad
        </Link>
        .
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <PublicPage title="Ayuda y soporte" subtitle="¿Tienes una duda o algo no funciona? Escríbenos.">
      <LegalSection id="contacto" title="Contacto">
        <ContactOptions />
        <p className="text-muted">
          Te respondemos lo antes posible, normalmente en uno o dos días hábiles. Si algo falla en la app, cuéntanos qué estabas
          haciendo y, si puedes, manda una captura de pantalla.
        </p>
        <EmailButton subject={`Ayuda con la app ${STUDIO_NAME}`}>Escribir a soporte</EmailButton>
      </LegalSection>

      <LegalSection id="preguntas" title="Preguntas frecuentes">
        <div className="-mx-1 divide-y divide-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown size={18} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-3 text-ink/90">{f.a}</p>
            </details>
          ))}
        </div>
      </LegalSection>
    </PublicPage>
  );
}
