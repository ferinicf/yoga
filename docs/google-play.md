# Google Play: de la cuenta nueva a la primera versión de Marea

Guía paso a paso. Resumen general y lista de secretos: [publicar-app.md](publicar-app.md).
Los nombres de los menús de Play Console cambian de vez en cuando; si algo no aparece igual, busca la palabra
clave (p. ej. "Integridad de la app") en el buscador de arriba de Play Console.

**Qué necesitas a la mano**

- Una cuenta de Google (Gmail) que vayas a conservar **siempre**. Puede ser una nueva solo para el estudio.
- Tarjeta de crédito o débito para la cuota única de **US$25**.
- Tu identificación oficial (INE o pasaporte), con el mismo nombre que vas a registrar.
- Un teléfono Android (Android 10 o más reciente) para una verificación de un minuto. Puede ser prestado.
- 12 o más personas con Android y cuenta de Google para la prueba cerrada (ver paso 2).

---

## 1. Crear la cuenta de desarrollador (hoy)

### ¿Cuenta personal o de organización?

| | **Personal** | **Organización** |
|---|---|---|
| Para quién | Una persona (como tu cuenta de Apple, que es personal) | Una empresa constituida (persona moral, p. ej. S.A. de C.V.) |
| Documentos | Identificación oficial y tarjeta | **Número D-U-N-S**, sitio web, correo y teléfono de la empresa, documentos oficiales |
| Antes de publicar | **Prueba cerrada con al menos 12 probadores durante 14 días seguidos** (cuentas personales creadas después del 13 de noviembre de 2023) | No se exige esa prueba |
| Teléfono Android | Hay que verificar que tienes acceso a uno (app Play Console) | — |
| Cuota | US$25, un solo pago | US$25, un solo pago |

**El D-U-N-S** es un número de 9 dígitos que da la empresa Dun & Bradstreet para identificar a una empresa.
Es gratuito, pero el trámite puede tardar **hasta 30 días**, y el nombre y la dirección deben coincidir
exactamente con los de la empresa. Solo sirve si el estudio es persona moral.

**Recomendación:** cuenta **personal**, igual que tu cuenta de Apple. Es lo más rápido; el único costo extra
es la prueba cerrada de 14 días, que de todos modos conviene hacer. Si más adelante el estudio se constituye
como empresa, las dos tiendas permiten transferir la app a otra cuenta de desarrollador (es un trámite).

### Pasos

1. Entra a **https://play.google.com/console/signup** con la cuenta de Google del estudio. Activa antes la
   verificación en dos pasos de esa cuenta (myaccount.google.com → Seguridad).
2. Elige la opción para **ti mismo / cuenta personal**.
3. Llena los datos:
   - **Nombre de desarrollador**: es lo que aparece debajo del nombre de la app en la tienda (p. ej.
     "Marea Estudio de Yoga"). Se puede cambiar después.
   - **Nombre legal y dirección**: como en tu identificación.
   - **Correo y teléfono de contacto**: el correo de contacto se muestra en la tienda.
4. Responde las preguntas sobre tu experiencia y tus planes (son informativas).
5. Paga la cuota única de **US$25**. Escribe tus datos exactamente como en tu identificación: si la
   verificación no pasa, la cuota puede no ser reembolsable.
6. **Verifica tu identidad** con foto de tu INE o pasaporte. Google avisa por correo; puede tardar unos días.
7. **Verifica el correo y el teléfono** con los códigos que te mandan.
8. **Verifica que tienes un teléfono Android**: en la página de inicio de Play Console aparece la tarea.
   Escanea el código QR con el teléfono, instala la app **Google Play Console**, entra con la misma cuenta,
   elige tu cuenta de desarrollador y toca **Verificar**. Requisitos: Android 10 o más reciente, sin root.
   No se guarda el número del teléfono y puede ser el de otra persona.

---

## 2. Mientras te verifican: junta a tus probadores

1. Consigue **15 a 20 personas** con Android (alumnos, profesores, familia). Se piden 12, pero conviene tener
   de sobra por si alguien se sale.
2. Crea un **Grupo de Google** (groups.google.com → Crear grupo, p. ej. `marea-probadores`) y agrégalas con
   su correo de Gmail. Así en Play Console invitas al grupo completo de una vez. (También sirve una lista de
   correos dentro de Play Console.)
3. Explícales lo que tendrán que hacer: abrir un enlace, tocar **"Convertirse en verificador"**, instalar Marea
   desde Google Play, **quedarse inscritos 14 días seguidos** y usarla de vez en cuando (reservar, cancelar,
   revisar el horario). Al final Google te pregunta qué comentarios recibiste.

---

## 3. Crear la app en Play Console

1. Play Console → **Inicio** → **Crear app**.
2. **Nombre**: Marea. **Idioma predeterminado**: Español (Latinoamérica) – es-419.
3. **App o juego**: App. **Gratis o pagada**: Gratis (las clases se cobran aparte, no en Google Play).
4. Acepta las declaraciones → **Crear app**.

---

## 4. Configurar la app (tareas del Panel)

En **Panel → Configura tu app** aparece la lista de tareas. Lo que va en cada una:

1. **Política de privacidad** → la dirección pública, p. ej. `https://marea-navy.vercel.app/privacidad`.
   *(Pendiente: hay que publicar esa página antes de enviar.)*
2. **Acceso a la app** → "Todas o algunas funciones están restringidas" → agrega la **cuenta de prueba**:
   correo, contraseña y una nota: *"Inicia sesión con este correo y contraseña. Es una cuenta de alumno con un
   paquete activo para reservar clases."*
3. **Anuncios** → La app no contiene anuncios.
4. **Clasificación de contenido** → cuestionario: categoría que mejor la describa (utilidades/otras apps),
   responde **No** a violencia, sexo, lenguaje, drogas y apuestas; **No** a que los usuarios se comuniquen
   entre sí o compartan contenido; **No** a compartir ubicación; **No** a compras digitales. El resultado
   esperado es "para todo público".
5. **Público objetivo** → **18 años o más**. (Si eliges menores de 13, aplica la política de Familias, con más
   requisitos.)
6. **Seguridad de los datos** → responde así (ajústalo si cambia la app):

   | Pregunta | Respuesta |
   |---|---|
   | ¿Recopila o comparte datos? | Sí, recopila |
   | ¿Se cifran en tránsito? | Sí (HTTPS) |
   | ¿Los usuarios pueden pedir que se borren? | Sí: en la app (**Mi perfil → Eliminar cuenta**) y en la página web de eliminación |
   | Información personal | **Nombre**, **correo**, **teléfono**; "otra información": cumpleaños, si lo capturan |
   | Información financiera | **Historial de compras** (paquetes) |
   | Actividad en la app | **Otras acciones** (reservas y asistencias) |
   | Salud | Solo si el estudio anota lesiones o condiciones en las notas del alumno: entonces marca **Información de salud** |
   | ¿Se comparten con terceros? | No (Supabase y Vercel son proveedores que procesan por cuenta del estudio) |
   | Para qué | Funcionalidad de la app y administración de la cuenta |

   En la sección de eliminación de cuenta pide una **dirección web** donde la persona pueda pedir que se borre
   su cuenta **sin tener que reinstalar la app**: debe mencionar a Marea, explicar los pasos y puede ofrecer un
   correo de contacto o formulario. *(Pendiente: publicar `https://marea-navy.vercel.app/eliminar-cuenta`.)*
7. **Apps gubernamentales**: No. **Funciones financieras**: ninguna. Si pregunta por **apps de salud**,
   indica que Marea no es una app de salud (es de reservas de clases).
8. **Ficha principal de Play Store** (menú **Crecer → Presencia en Play Store → Ficha principal**):
   - **Nombre** (hasta 30 caracteres): `Marea`
   - **Descripción breve** (hasta 80): `Reserva tus clases de yoga, revisa tu paquete y haz check-in con tu código.`
   - **Descripción completa** (hasta 4000): qué es el estudio, qué puede hacer el alumno (horario, reservar y
     cancelar, lista de espera, reservar para un amigo, paquetes, código QR de check-in, recordatorio 1 hora
     antes de cada clase) y que los paquetes se pagan en el estudio.
   - **Ícono**: PNG de **512 × 512**, hasta 1 MB (se genera con `npm run assets` a partir de la carpeta `assets/`).
   - **Gráfico de funciones** (obligatorio): **1024 × 500**, JPG o PNG sin transparencia.
   - **Capturas de teléfono**: mínimo **2** (mejor 4 a 8), JPG o PNG sin transparencia. Usa **1080 × 1920**:
     el lado largo **no puede medir más del doble** del corto, así que una captura de 1080 × 2400 se rechaza.
     Si no tienes Android a la mano: en Chrome abre la web, **Ver → Herramientas para desarrolladores →
     modo dispositivo**, pon 360 × 640 con "DPR" 3 y usa **Capturar pantalla** (sale de 1080 × 1920). Para la
     tienda es mejor que sean de la app instalada (la interfaz es la misma).
   - **Capturas de tablet** (7" y 10"): recomendadas, la app funciona en tablet.
   - **Categoría**: Salud y bienestar. **Correo de contacto** (obligatorio), sitio web y teléfono.

---

## 5. Llave de subida (una sola vez)

**Qué es.** Con *Play App Signing* (obligatorio en apps nuevas), Google guarda la llave con la que se firma la
app que descargan tus alumnos. Tú solo guardas la **llave de subida**: sirve para demostrarle a Google que cada
versión viene de ti. **Si la pierdes no pierdes la app**: se pide un restablecimiento (ver abajo).

> **Una sola llave.** Si ya generaste la llave con Codemagic (flujo `android-generar-llave`), **no** corras
> este workflow. Usa esa misma llave en GitHub: en la Mac abre Terminal en la carpeta del archivo y escribe
> `base64 -i marea-upload.jks | pbcopy` (queda copiado) → pégalo en el secreto `ANDROID_KEYSTORE_BASE64`;
> en `ANDROID_KEYSTORE_PASSWORD` y `ANDROID_KEY_PASSWORD` va la contraseña de `LEEME-llave.txt` y en
> `ANDROID_KEY_ALIAS`, `marea_upload`.

### Generarla con GitHub

1. **Inventa una frase de respaldo** larga (12 caracteres o más, p. ej. cuatro palabras al azar) y guárdala
   en tu gestor de contraseñas (1Password, Bitwarden, el llavero de iCloud…).
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret** →
   Name: `ANDROID_KEYSTORE_BACKUP_PASSWORD`, Secret: la frase → **Add secret**.
3. **Actions** → **Android: generar llave de subida** → **Run workflow**. Deja el alias `marea_upload`; en
   "nombre" pon tu nombre o el del estudio → **Run workflow**. Tarda 1 minuto.
4. Abre la ejecución. Abajo, en **Artifacts**, descarga **`marea-llave-android-CIFRADA.zip`**. Luego
   **bórralo de GitHub** (ícono de basura junto al archivo). De todos modos se borra solo en 3 días.
5. Ábrelo con la frase: en Mac con **The Unarchiver** (gratis en la Mac App Store) o **Keka**; en Windows con
   **7-Zip**. (La utilidad de archivos que trae la Mac no abre ZIP con este cifrado.)
6. Adentro hay una carpeta con:
   - `marea-upload.jks` → la llave (privada).
   - `upload_certificate.pem` → su certificado público (para el restablecimiento).
   - `ANDROID_KEYSTORE_BASE64.txt`, `ANDROID_KEYSTORE_PASSWORD.txt`, `ANDROID_KEY_ALIAS.txt`,
     `ANDROID_KEY_PASSWORD.txt` → uno por secreto.
   - `LEEME.txt` → instrucciones y huellas (no secretas) del certificado.
7. Crea los **4 secretos** en GitHub: el *Name* es el nombre del archivo sin `.txt` y el *Secret* es **todo** su
   contenido (ábrelo con TextEdit o Bloc de notas → Seleccionar todo → Copiar → Pegar).
8. **Guarda la carpeta completa** en tu gestor de contraseñas (como archivo adjunto) o en una USB guardada en un
   lugar seguro. Después borra las copias de *Descargas*. Nunca la subas al repositorio ni la mandes por chat.

### Si algún día pierdes la llave (o se filtra)

1. Corre otra vez **Android: generar llave de subida** marcando **reemplazar**. Te da una llave nueva con su
   `upload_certificate.pem`.
2. Play Console → Marea → **Prueba y lanzamiento → Configuración → Integridad de la app** → pestaña **Firma de
   apps** → **Solicitar el restablecimiento de la llave de subida** → elige el motivo → sube
   `upload_certificate.pem` → envía. Lo hace el propietario de la cuenta de desarrollador (tú).
3. Cuando Google confirme el cambio (suele tardar unos días), reemplaza los 4 secretos en GitHub. Tus usuarios
   no notan nada: la llave con la que Google firma la app no cambia.

---

## 6. Compilar el .aab

1. **Actions** → **Android (Google Play)** → **Run workflow**.
   - **Versión**: déjalo vacío para la primera (queda "1.0").
   - **Subir a Google Play**: no importa por ahora; sin el secreto `PLAY_SERVICE_ACCOUNT_JSON` se omite solo.
2. En unos 10 minutos termina. El **resumen** muestra la versión, el `versionCode` (el número de ejecución) y
   la **huella SHA-256 del certificado de subida**.
3. En **Artifacts** descarga **`marea-1.0-N.aab`** (se descarga tal cual, sin descomprimir).

---

## 7. Primera subida (a mano) en Pruebas internas

La primera versión se sube a mano; después ya se puede automatizar (paso 9).

1. Play Console → Marea → **Prueba y lanzamiento → Pruebas → Pruebas internas**.
2. Pestaña **Verificadores** → **Crear lista de correos** (tú y 1 o 2 personas) → Guardar.
3. Pestaña **Versiones** → **Crear versión**.
4. Si pregunta por la **firma de apps**, deja que **Google genere y administre la llave** (opción
   predeterminada) y acepta.
5. Arrastra el `.aab`. El nombre de la versión se llena solo. Notas de la versión: "Primera versión de prueba".
6. **Siguiente** → revisa los avisos (los amarillos no impiden seguir) → **Guardar** → **Lanzar a Pruebas
   internas**.
7. En **Verificadores** copia el enlace para unirse, ábrelo en tu Android, acepta e instala Marea desde Google Play.
8. Revisa que coincida la llave: **Integridad de la app → Firma de apps → Certificado de la llave de subida**:
   el SHA-256 debe ser el mismo que mostró el resumen del workflow.

---

## 8. Prueba cerrada: 12 probadores durante 14 días

1. **Prueba y lanzamiento → Pruebas → Prueba cerrada** → pista **Alpha** → **Administrar pista**.
2. **Países**: México (y los que quieras).
3. **Verificadores**: agrega el Grupo de Google (o la lista de correos) y un correo para comentarios.
4. **Crear versión** → **Agregar desde la biblioteca** el mismo `.aab` → Guardar → Revisar →
   **Enviar a revisión**. La prueba cerrada la revisa Google (de horas a unos días).
5. Cuando esté aprobada, manda el **enlace de inscripción** a tus probadores (paso 2).
6. En el **Panel** verás cuántos probadores van y cuántos días llevan. Se necesitan **12 o más inscritos
   durante 14 días seguidos**.
7. Si arreglas algo en esos días, sube otra versión a la misma pista (con el workflow: pista `alpha`).
8. Al cumplirse los 14 días: **Panel → Solicitar acceso a producción** → contesta el cuestionario (cómo
   reclutaste a los probadores, qué comentarios recibiste, qué cambiaste). Google responde en unos días.
9. Con acceso a producción: **Producción → Crear versión** → agrega el `.aab` → **Enviar a revisión**.

---

## 9. Subidas automáticas: cuenta de servicio (opcional)

Con esto, cada ejecución del workflow sube el `.aab` sola a Pruebas internas (o a la prueba cerrada).

1. Entra a **https://console.cloud.google.com** con la cuenta del estudio y crea un proyecto (p. ej. `marea-play`).
2. **APIs y servicios → Biblioteca** → busca **Google Play Android Developer API** → **Habilitar**.
3. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio**: nombre `github-play`.
   **No** le asignes roles de Google Cloud → **Listo**.
4. Abre esa cuenta de servicio → **Claves → Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo
   `.json`: **es un secreto**.
5. Play Console (en la página principal de la cuenta, no dentro de la app) → **Usuarios y permisos** →
   **Invitar a usuarios nuevos** → pega el correo de la cuenta de servicio (termina en
   `iam.gserviceaccount.com`) → **Permisos de la app** → agrega **Marea** → marca **Lanzar apps en segmentos de
   prueba** (más adelante, si quieres, también producción) → **Invitar**.
6. GitHub → secreto **`PLAY_SERVICE_ACCOUNT_JSON`** → pega **todo** el contenido del `.json`. Guarda el archivo
   en tu gestor de contraseñas y bórralo de *Descargas*.
7. Los permisos pueden tardar hasta un día en activarse.
8. Listo: **Run workflow** con "Subir a Google Play" marcado → pista `internal` (pruebas internas) o `alpha`
   (prueba cerrada). Si aparece *"Only releases with status draft may be created on draft app"*, la app
   todavía no tiene ninguna versión lanzada: córrelo con estado `draft` y termina el lanzamiento en Play Console.

---

## 10. Versiones siguientes

- **Run workflow** escribiendo la versión (p. ej. `1.0.1`), o crea una etiqueta: `git tag v1.0.1` y
  `git push origin v1.0.1`.
- El `versionCode` sube solo (número de ejecución). Google Play rechaza números repetidos; si alguna vez
  subiste versiones desde otro lado (Codemagic), crea la variable `ANDROID_VERSION_CODE_OFFSET` (p. ej. `100`).
- Siempre con la **misma llave de subida**.

## Reglas de Google Play que la app ya cumple

- **Android 16 (API 36)**: obligatorio para apps nuevas desde el 31 de agosto de 2026; el proyecto ya apunta
  a 36 (`android/variables.gradle`).
- **Eliminar la cuenta desde la app**: Mi perfil → Eliminar cuenta. Falta la página web (paso 4).
- **Pagos**: las clases y paquetes son servicios presenciales; Google Play prohíbe usar su sistema de cobro
  para servicios físicos (pone como ejemplo las membresías de gimnasio), así que se cobran aparte.
- **Permisos**: solo notificaciones (recordatorio 1 hora antes de clase); se quitó el permiso de alarmas
  exactas para no tener que justificarlo.

## Fuentes (consultadas el 7 de noviembre de 2026)

- Requisito de prueba para cuentas personales nuevas (12 probadores, 14 días): https://support.google.com/googleplay/android-developer/answer/14151465
- Verificar acceso a un dispositivo Android: https://support.google.com/googleplay/android-developer/answer/14316361
- Crear y configurar la cuenta (cuota de US$25, tipos de cuenta): https://support.google.com/googleplay/android-developer/answer/6112435
- Nivel de API objetivo: https://developer.android.com/google/play/requirements/target-sdk
- Firma de apps, llave de subida y su restablecimiento: https://developer.android.com/studio/publish/app-signing y https://support.google.com/googleplay/android-developer/answer/7384423
- Eliminación de cuenta (en la app y en la web): https://support.google.com/googleplay/android-developer/answer/13327111
- Recursos gráficos de la ficha (ícono, gráfico de funciones, capturas): https://support.google.com/googleplay/android-developer/answer/9866151
- Política de pagos (servicios físicos fuera de Google Play Billing): https://support.google.com/googleplay/android-developer/answer/9858738
- Acción de subida usada por el workflow: https://github.com/r0adkll/upload-google-play
