import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, PRIVACY_PATH, STUDIO_NAME, SUPPORT_PATH, mailtoHref } from "@/lib/legal";
import { EmailButton, LegalSection, ProfileShortcut, PublicPage } from "@/components/public-page";

/**
 * Cómo eliminar la cuenta (Google Play pide esta dirección web en Seguridad de los datos:
 * https://marea-navy.vercel.app/eliminar-cuenta). Explica el camino dentro de la app y una vía
 * por correo para quien ya no tiene la app. Lo que se borra coincide con
 * supabase/migrations/0008_eliminar_cuenta.sql y src/components/delete-account.tsx.
 */
export const metadata: Metadata = {
  title: `Eliminar tu cuenta · ${STUDIO_NAME}`,
  description: `Cómo eliminar tu cuenta de ${STUDIO_NAME} y tus datos personales, desde la app o por correo.`,
};

const link = "font-medium text-brand-text underline underline-offset-2";
const list = "list-disc space-y-1.5 pl-5";

const MAIL_SUBJECT = `Eliminar mi cuenta de ${STUDIO_NAME}`;
const MAIL_BODY = `Hola, quiero eliminar mi cuenta de ${STUDIO_NAME} y mis datos personales.\n\nNombre:\nCorreo de mi cuenta:\n`;

export default function DeleteAccountPage() {
  return (
    <PublicPage title={`Eliminar tu cuenta de ${STUDIO_NAME}`} subtitle="Puedes borrar tu cuenta y tus datos personales cuando quieras.">
      <LegalSection id="app" title="Desde la app">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Abre la app {STUDIO_NAME} e inicia sesión.</li>
          <li>
            Entra a <strong className="font-medium">Perfil</strong>. Si administras el estudio, abre el{" "}
            <strong className="font-medium">Menú</strong> y entra a <strong className="font-medium">Mi cuenta</strong>.
          </li>
          <li>
            Al final de la pantalla, toca <strong className="font-medium">Eliminar mi cuenta</strong>.
          </li>
          <li>
            Escribe <strong className="font-medium">ELIMINAR</strong> para confirmar y toca{" "}
            <strong className="font-medium">Eliminar mi cuenta definitivamente</strong>.
          </li>
        </ol>
        <p>Tu cuenta se elimina en ese momento y ya no podrás iniciar sesión con ella. También funciona en la web.</p>
        <ProfileShortcut />
        <p className="text-muted">
          Si das clases o administras el estudio, también puedes eliminar tu cuenta así. Si eres la única persona con acceso de
          administración, primero agrega a otra en Configuración → Administradores, para que el estudio no se quede sin nadie
          que lo administre.
        </p>
      </LegalSection>

      <LegalSection id="correo" title="Sin la app: por correo">
        <p>
          Si ya no tienes la app o no puedes entrar, escríbenos desde el correo con el que te registraste, con el asunto «Eliminar
          mi cuenta», e incluye tu nombre:
        </p>
        <p>
          <a href={mailtoHref(MAIL_SUBJECT, MAIL_BODY)} className={`${link} break-words text-base`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Si escribes desde otro correo, te pediremos confirmar que la cuenta es tuya. Te avisamos por correo cuando quede
          eliminada, normalmente en pocos días y como máximo en 20 días hábiles.
        </p>
        <EmailButton subject={MAIL_SUBJECT} body={MAIL_BODY}>
          Pedir la eliminación por correo
        </EmailButton>
      </LegalSection>

      <LegalSection id="se-borra" title="Qué se borra si tomas clases">
        <ul className={list}>
          <li>Tu nombre, correo, teléfono y cumpleaños, tu código de acceso y las notas que el estudio tenga sobre ti.</li>
          <li>Tu usuario de acceso: ya no podrás iniciar sesión y se cierran tus sesiones.</li>
          <li>
            Tus reservaciones y lugares en lista de espera de clases que aún no empiezan (también las de tus invitados). Se
            cancelan sin devolver créditos y el lugar pasa a la siguiente persona en la lista de espera.
          </li>
          <li>
            Tus paquetes y los créditos que te queden. Si tienes un paquete vigente, úsalo antes o habla con el estudio. Los
            paquetes que apartaste y aún no pagas se anulan.
          </li>
          <li>Los recordatorios de clases que la app programó en el teléfono donde eliminas la cuenta.</li>
        </ul>
      </LegalSection>

      <LegalSection id="personal" title="Si das clases o administras el estudio">
        <ul className={list}>
          <li>Se borra tu usuario de acceso: ya no podrás iniciar sesión y se cierran tus sesiones en todos tus dispositivos.</li>
          <li>
            Tu ficha de personal (nombre, correo y teléfono) se queda en el registro del estudio, ligada a las clases que
            diste, las ventas y los pagos, porque el estudio la necesita para su contabilidad; ya no da acceso a la app. Si
            quieres que también se borren tus datos de contacto, escríbenos. Lo que el estudio te deba por clases ya dadas no
            se pierde.
          </li>
          <li>Si administras el estudio, tu correo sale de la lista de administradores.</li>
        </ul>
      </LegalSection>

      <LegalSection id="se-conserva" title="Qué se conserva y por cuánto tiempo">
        <p>
          El registro de tus compras y de tus asistencias pasadas se conserva a nombre de «Cuenta eliminada», ya sin tu nombre ni
          tus datos de contacto, porque las leyes fiscales nos obligan a guardar la contabilidad del estudio (por lo general,
          cinco años).
        </p>
        <p>
          Puede quedar una copia de tus datos en los respaldos automáticos de nuestro proveedor de base de datos hasta que se
          renueven. Si después vuelves a registrarte con el mismo correo, empiezas con una cuenta nueva, sin tu historial anterior.
        </p>
        <p>
          Más detalles en el{" "}
          <Link href={PRIVACY_PATH} className={link}>
            aviso de privacidad
          </Link>
          . ¿Dudas?{" "}
          <Link href={SUPPORT_PATH} className={link}>
            Escríbenos
          </Link>
          .
        </p>
      </LegalSection>
    </PublicPage>
  );
}
