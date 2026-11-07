import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, DELETE_ACCOUNT_PATH, PRIVACY_PATH, PRIVACY_UPDATED, PUBLIC_SITE_URL, STUDIO_NAME, mailtoHref } from "@/lib/legal";
import { EmailButton, LegalSection, PublicPage, ResponsibleDetails } from "@/components/public-page";

/**
 * Aviso de privacidad integral (Ley Federal de Protección de Datos Personales en Posesión de los
 * Particulares, México). Página pública: App Store Connect y Play Console piden esta dirección
 * (https://marea-navy.vercel.app/privacidad) y la app la enlaza desde el acceso.
 * Los datos del responsable salen de src/lib/legal.ts y de Admin → Configuración.
 */
export const metadata: Metadata = {
  title: `Aviso de privacidad · ${STUDIO_NAME}`,
  description: `Cómo ${STUDIO_NAME} recaba, usa y protege tus datos personales, y cómo ejercer tus derechos ARCO.`,
};

const link = "font-medium text-brand-text underline underline-offset-2";
const list = "list-disc space-y-1.5 pl-5";

const INDEX = [
  { id: "responsable", label: "Quién es responsable" },
  { id: "datos", label: "Qué datos recabamos" },
  { id: "finalidades", label: "Para qué los usamos" },
  { id: "proveedores", label: "Proveedores y seguridad" },
  { id: "transferencias", label: "Transferencias" },
  { id: "derechos", label: "Tus derechos ARCO" },
  { id: "conservacion", label: "Conservación y eliminación" },
  { id: "dispositivo", label: "Almacenamiento y notificaciones" },
  { id: "menores", label: "Menores de edad" },
  { id: "cambios", label: "Cambios a este aviso" },
];

function Mail({ subject }: { subject: string }) {
  return (
    <a href={mailtoHref(subject)} className={`${link} break-words`}>
      {CONTACT_EMAIL}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <PublicPage title="Aviso de privacidad" subtitle={<>Aviso de privacidad integral · Última actualización: {PRIVACY_UPDATED}</>}>
      <div className="space-y-3 text-sm leading-6">
        <p>
          En {STUDIO_NAME} cuidamos tus datos personales. Este aviso te explica qué datos recabamos cuando usas la app y la web
          de {STUDIO_NAME} (reservas de clases, paquetes y administración del estudio), para qué los usamos, con quién los
          compartimos y cómo puedes ejercer tus derechos, conforme a la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares.
        </p>
        <p>
          Al crear tu cuenta o usar el servicio aceptas que tratemos tus datos para las finalidades necesarias que se describen
          aquí. Si en algún momento nos compartes datos sensibles, te pediremos tu consentimiento expreso.
        </p>
      </div>

      <nav aria-label="Contenido del aviso" className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm font-semibold">En este aviso</p>
        <ol className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2">
          {INDEX.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex min-h-10 items-center gap-2 text-brand-text hover:underline">
                <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span> {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <LegalSection id="responsable" title="1. ¿Quién es responsable de tus datos?">
        <p>
          Estos son los datos de quien es responsable del uso y la protección de tus datos personales (en este aviso,
          «{STUDIO_NAME}» o «nosotros»):
        </p>
        <ResponsibleDetails />
      </LegalSection>

      <LegalSection id="datos" title="2. ¿Qué datos recabamos?">
        <ul className={list}>
          <li>
            <strong className="font-medium">Identificación y contacto:</strong> tu nombre y correo electrónico y, si nos los das,
            tu teléfono y tu fecha de cumpleaños (son opcionales).
          </li>
          <li>
            <strong className="font-medium">Tu cuenta:</strong> la contraseña (se guarda cifrada; nadie del estudio puede verla) y
            tu código de acceso para hacer check-in.
          </li>
          <li>
            <strong className="font-medium">Compras:</strong> los paquetes que compras o apartas, montos, descuentos o cupones,
            forma de pago y estado del pago.
          </li>
          <li>
            <strong className="font-medium">Reservaciones y asistencias:</strong> tus reservaciones, cancelaciones, lugares en
            lista de espera, el lugar que eliges en el salón y tus asistencias e inasistencias.
          </li>
          <li>
            <strong className="font-medium">Invitados:</strong> si reservas para otra persona, el nombre que escribas. Pídele
            permiso antes de compartirlo.
          </li>
          <li>
            <strong className="font-medium">Si das clases o trabajas en el estudio:</strong> las clases que tienes asignadas, tu
            tarifa, los pagos que te hace el estudio y, si quieres, una breve presentación.
          </li>
          <li>
            <strong className="font-medium">Datos técnicos mínimos:</strong> por seguridad, nuestros proveedores registran datos
            como la dirección IP, la fecha y hora de acceso y el tipo de dispositivo o navegador.
          </li>
          <li>
            <strong className="font-medium">En la app del teléfono:</strong> si lo permites, la app programa notificaciones locales
            en tu teléfono para recordarte tus clases. No usamos tu ubicación, contactos, fotos, cámara ni micrófono.
          </li>
        </ul>
        <p>
          <strong className="font-medium">Datos sensibles.</strong> El estudio puede anotar en tu ficha información sobre tu salud
          que tú le compartas (por ejemplo, una lesión) para que tu profesor adapte la clase. Solo la registramos si tú nos la
          das y nos autorizas expresamente; la ve únicamente el personal del estudio y puedes pedir que la borremos en cualquier
          momento.
        </p>
        <p>
          No recabamos los datos de tu tarjeta: cuando el pago en línea esté disponible, los capturarás directamente en Mercado
          Pago.
        </p>
      </LegalSection>

      <LegalSection id="finalidades" title="3. ¿Para qué usamos tus datos?">
        <p className="font-medium">Finalidades necesarias para darte el servicio:</p>
        <ul className={list}>
          <li>Crear y administrar tu cuenta y permitirte iniciar sesión.</li>
          <li>Mostrarte el horario y gestionar tus reservaciones, cancelaciones y lugares en lista de espera.</li>
          <li>Llevar el control de tus paquetes, créditos y vigencias, y registrar tus asistencias (check-in).</li>
          <li>Registrar tus compras y pagos, y cumplir con las obligaciones contables y fiscales del estudio.</li>
          <li>Avisarte sobre tus clases: confirmaciones, cambios o cancelaciones y, si los activas, recordatorios.</li>
          <li>Atender tus dudas y solicitudes, incluido el ejercicio de tus derechos.</li>
          <li>Proteger la seguridad de las cuentas y prevenir usos indebidos o fraudes.</li>
          <li>Si das clases: asignarte clases y calcular y registrar tus pagos.</li>
        </ul>
        <p className="font-medium">Finalidades adicionales (no son necesarias para el servicio, pero nos ayudan a atenderte mejor):</p>
        <ul className={list}>
          <li>Enviarte novedades, promociones y felicitaciones de cumpleaños.</li>
          <li>Pedirte tu opinión sobre las clases y el servicio.</li>
          <li>Elaborar estadísticas internas para mejorar horarios y clases.</li>
        </ul>
        <p>
          Si no quieres que usemos tus datos para estas finalidades adicionales, escríbenos cuando quieras a{" "}
          <Mail subject="Finalidades adicionales" /> con el asunto «Finalidades adicionales». Decir que no, no afecta tu cuenta
          ni tus clases.
        </p>
      </LegalSection>

      <LegalSection id="proveedores" title="4. Proveedores y seguridad">
        <p>
          No vendemos ni rentamos tus datos personales, y no los usamos para publicidad. Para que la app funcione trabajamos con
          proveedores que tratan los datos solo por nuestra cuenta y siguiendo nuestras instrucciones (encargados):
        </p>
        <ul className={list}>
          <li>
            <strong className="font-medium">Supabase:</strong> base de datos, inicio de sesión y envío de los correos de tu cuenta
            (confirmación y cambio de contraseña).
          </li>
          <li>
            <strong className="font-medium">Vercel:</strong> hospedaje de la página web de {STUDIO_NAME}.
          </li>
          <li>
            <strong className="font-medium">Mercado Pago:</strong> procesa los pagos en línea cuando esta opción esté disponible.
            Tus datos de pago los capturas directamente en Mercado Pago, que los trata conforme a su propio aviso de privacidad;
            nosotros solo recibimos la confirmación del pago (monto, estado y referencia).
          </li>
        </ul>
        <p>
          Los servidores de estos proveedores pueden estar fuera de México (por ejemplo, en Estados Unidos). Apple y Google
          distribuyen la app en sus tiendas y tratan los datos de tu descarga conforme a sus propias políticas.
        </p>
        <p>
          Protegemos tu información con conexiones cifradas (HTTPS), contraseñas cifradas y permisos que limitan quién puede ver
          cada dato: por ejemplo, cada alumno ve solo su propia información y solo el personal del estudio puede ver los datos de
          los alumnos.
        </p>
      </LegalSection>

      <LegalSection id="transferencias" title="5. Transferencias">
        <p>
          Solo compartimos tus datos con terceros sin pedirte tu consentimiento en los casos que permite la ley; por ejemplo,
          cuando una autoridad competente nos lo requiera conforme a la ley (como las autoridades fiscales) o por orden judicial.
          No hacemos transferencias que necesiten tu consentimiento; si algún día fuera necesario, te lo pediremos antes.
        </p>
      </LegalSection>

      <LegalSection id="derechos" title="6. Tus derechos ARCO">
        <p>
          Tienes derecho a <strong className="font-medium">acceder</strong> a tus datos, a pedir que los{" "}
          <strong className="font-medium">rectifiquemos</strong> si son inexactos o están incompletos, a{" "}
          <strong className="font-medium">cancelarlos</strong> (que los borremos) y a{" "}
          <strong className="font-medium">oponerte</strong> a que los usemos para fines específicos. También puedes revocar tu
          consentimiento y pedirnos que limitemos el uso o la divulgación de tus datos.
        </p>
        <p>Muchos datos los puedes corregir tú mismo en la app, en Perfil.</p>
        <p>
          Para ejercer tus derechos, escríbenos a <Mail subject="Derechos ARCO" /> con el asunto «Derechos ARCO»,
          de preferencia desde el correo de tu cuenta, e incluye:
        </p>
        <ul className={list}>
          <li>Tu nombre y el correo de tu cuenta, para responderte.</li>
          <li>
            Algo que acredite tu identidad (por ejemplo, una copia de tu identificación oficial) y, si te representa otra persona,
            el documento que lo acredite.
          </li>
          <li>Qué derecho quieres ejercer y sobre qué datos, y cualquier detalle que nos ayude a encontrarlos.</li>
          <li>Si pides una rectificación, el cambio que necesitas.</li>
        </ul>
        <p>
          Te respondemos en un máximo de 20 días hábiles y, si procede, aplicamos el cambio dentro de los 15 días hábiles
          siguientes. Es gratuito. Ten en cuenta que, si revocas tu consentimiento o cancelas tus datos, quizá ya no podamos darte
          el servicio (por ejemplo, reservar clases).
        </p>
        <p>
          Si consideras que no atendimos bien tu solicitud, puedes acudir a la autoridad de protección de datos personales
          (actualmente, la Secretaría Anticorrupción y Buen Gobierno).
        </p>
        <EmailButton subject="Derechos ARCO" variant="outline">
          Escribir para ejercer mis derechos
        </EmailButton>
      </LegalSection>

      <LegalSection id="conservacion" title="7. Cuánto tiempo conservamos tus datos y cómo eliminar tu cuenta">
        <p>
          Conservamos tus datos mientras tengas tu cuenta. Puedes eliminarla cuando quieras desde la app, en{" "}
          <strong className="font-medium">Perfil → Eliminar mi cuenta</strong>, o pedirlo por correo si no tienes la app a la
          mano.
        </p>
        <p>
          Al eliminarla borramos tus datos personales. El registro de tus compras y asistencias se queda, ya sin tu nombre ni tus
          datos de contacto, porque las leyes fiscales nos obligan a conservar la contabilidad (por lo general, cinco años).
        </p>
        <p>
          <Link href={DELETE_ACCOUNT_PATH} className={link}>
            Ver cómo eliminar tu cuenta y qué se conserva
          </Link>
        </p>
      </LegalSection>

      <LegalSection id="dispositivo" title="8. Almacenamiento en tu dispositivo y notificaciones">
        <p>
          No usamos cookies de publicidad ni herramientas de rastreo o analítica de terceros. La web y la app guardan en el
          almacenamiento local de tu dispositivo solo lo necesario para funcionar:
        </p>
        <ul className={list}>
          <li>Tu sesión iniciada, para que no tengas que escribir tu contraseña cada vez.</li>
          <li>Si estás usando el modo demo y sus datos de ejemplo (no son datos reales).</li>
          <li>Cuándo te explicamos por última vez cómo activar los recordatorios, para no insistir.</li>
          <li>Datos temporales de navegación, que se borran al cerrar la app o la pestaña.</li>
        </ul>
        <p>
          Cuando cierras sesión o eliminas tu cuenta, la sesión guardada se borra. También puedes borrar estos datos desde la
          configuración de tu navegador o desinstalando la app.
        </p>
        <p>
          <strong className="font-medium">Recordatorios en la app:</strong> si lo permites, la app programa en tu teléfono un aviso
          1 hora antes de cada clase que reservas. Se programan en el propio teléfono, sin enviar tus datos a servicios de
          notificaciones, y puedes desactivarlos cuando quieras en la configuración de notificaciones de tu teléfono.
        </p>
      </LegalSection>

      <LegalSection id="menores" title="9. Menores de edad">
        <p>
          {STUDIO_NAME} está dirigida a personas mayores de edad. Si una persona menor de 18 años toma clases, su madre, padre o
          tutor debe crear y administrar la cuenta; es quien da el consentimiento y puede ejercer sus derechos.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="10. Cambios a este aviso">
        <p>
          Podemos actualizar este aviso por cambios en la ley, en nuestros servicios o en nuestros proveedores. La versión vigente
          siempre estará en esta página ({`${PUBLIC_SITE_URL.replace(/^https:\/\//, "")}${PRIVACY_PATH}`}) y en
          la app, con su fecha de actualización. Si el cambio es importante, por ejemplo una finalidad nueva
          que requiera tu consentimiento, te avisaremos en la app o por correo antes de aplicarlo.
        </p>
        <p className="text-muted">Última actualización: {PRIVACY_UPDATED}.</p>
      </LegalSection>
    </PublicPage>
  );
}
