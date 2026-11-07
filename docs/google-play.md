# Google Play: de la cuenta nueva a la primera versión de Marea

Guía paso a paso. El archivo `.aab` que se sube a Google Play sale de **Codemagic** ([codemagic.md](codemagic.md));
todo lo demás se hace en el navegador, en **Play Console** (https://play.google.com/console). Resumen general:
[publicar-app.md](publicar-app.md). Los menús de Play Console cambian de vez en cuando: si algo no aparece igual,
usa el buscador de arriba de Play Console (p. ej. "Integridad de la app").

**Qué necesitas a la mano**

- Una cuenta de Google (Gmail) que vayas a conservar **siempre**. Puede ser una nueva solo para el estudio.
- Tarjeta de crédito o débito para la cuota única de **US$25**.
- Tu identificación oficial (INE o pasaporte), con el mismo nombre que vas a registrar.
- Un teléfono Android (Android 10 o más reciente) para una verificación de un minuto. Puede ser prestado.
- **12 o más** personas con Android y cuenta de Google para la prueba cerrada (paso 2).

---

## 1. Crear la cuenta de desarrollador

Usa una cuenta **personal** (igual que tu cuenta de Apple). Una cuenta de organización necesita que el estudio
sea persona moral y tenga número D-U-N-S, un trámite que puede tardar semanas.

**Lo que se verá en la tienda con una cuenta personal:** el **nombre de desarrollador** que elijas
(p. ej. "Marea Estudio de Yoga"), y además Google muestra tu **nombre legal**, tu **país** y el **correo de
desarrollador**. Tu domicilio completo solo se muestra si cobras dentro de Google Play, y Marea no lo hace.
Usa como correo de desarrollador uno que no te moleste hacer público (p. ej. el del estudio).

1. Activa la verificación en dos pasos de la cuenta de Google (myaccount.google.com → Seguridad).
2. Entra a **https://play.google.com/console/signup** y elige la opción para **ti mismo (cuenta personal)**.
3. Llena los datos:
   - **Nombre de desarrollador**: el que aparece debajo del nombre de la app. Se puede cambiar después.
   - **Nombre legal y dirección**: exactamente como en tu identificación.
   - **Correo de desarrollador** (público) y **teléfono**.
4. Responde las preguntas sobre tu experiencia (son informativas) y paga la cuota única de **US$25**.
5. **Verifica tu identidad** con foto de tu INE o pasaporte. Google avisa por correo; puede tardar unos días.
6. **Verifica el correo y el teléfono** con los códigos que te mandan.
7. **Verifica que tienes un teléfono Android**: en la página de inicio de Play Console aparece la tarea. Escanea el
   código QR con el teléfono, instala la app **Google Play Console**, entra con la misma cuenta y toca
   **Verificar**. Puede ser el teléfono de otra persona.

---

## 2. Mientras te verifican: junta a tus probadores

Las cuentas personales nuevas tienen que hacer una **prueba cerrada con al menos 12 probadores inscritos durante
14 días seguidos** antes de poder publicar.

1. Consigue **15 a 20 personas** con Android (alumnos, profesores, familia). Se piden 12; conviene tener de sobra.
2. Crea un **Grupo de Google** (groups.google.com → Crear grupo, p. ej. `marea-probadores`) y agrégalas con su
   correo de Gmail. Así en Play Console invitas al grupo completo de una vez.
3. Explícales qué harán: abrir un enlace, tocar **"Convertirse en verificador"**, instalar Marea desde Google Play,
   **quedarse inscritos 14 días seguidos** y usarla de vez en cuando (ver el horario, reservar, cancelar).
   Al final Google te pregunta qué comentarios recibiste y qué cambiaste.

---

## 3. Crear la app en Play Console

1. Play Console → **Inicio** → **Crear app**.
2. **Nombre**: Marea. **Idioma predeterminado**: Español (Latinoamérica) – es-419.
3. **App o juego**: App. **Gratis o pagada**: Gratis (las clases se cobran en el estudio, no en Google Play).
4. Acepta las declaraciones → **Crear app**.

---

## 4. Configurar la app (tareas del Panel)

En **Panel → Configura tu app** aparece la lista de tareas. Antes de llenarlas, revisa la
[lista de pendientes](publicar-app.md#lista-de-pendientes-antes-de-enviar-a-revisión): la migración 0008
(eliminar la cuenta) aplicada y las páginas públicas en línea.

1. **Política de privacidad** → `https://marea-navy.vercel.app/privacidad`.
2. **Acceso a la app** → "Todas o algunas funciones están restringidas" → agrega la **cuenta de prueba 1**:
   correo, contraseña y la nota *"Cuenta de alumno con un paquete activo. Inicia sesión con este correo y
   contraseña para ver el horario y reservar clases."*
3. **Anuncios** → La app **no** contiene anuncios.
4. **Clasificación de contenido** → correo de contacto → categoría **"Todas las demás apps"** (no es juego ni red
   social). Responde **No** a violencia, sexo, lenguaje, drogas y apuestas; **No** a que los usuarios se
   comuniquen o compartan contenido entre sí; **No** a compartir la ubicación; **No** a compras de productos
   digitales. Resultado esperado: **para todo público** (IARC 3+ / "Apto para todo público").
5. **Público objetivo** → **18 años o más**. (Si eliges menores de 13, aplica la política de Familias, con más
   requisitos.)
6. **Seguridad de los datos** → responde así. Es lo mismo que dice el aviso de privacidad y lo que declaras en la
   App Store; si cambia la app o el aviso, cambia esto también.

   | Pregunta | Respuesta |
   |---|---|
   | ¿Recopila o comparte datos? | **Sí, recopila.** No comparte: Supabase y Vercel son proveedores que procesan los datos por cuenta del estudio, y eso no cuenta como "compartir" |
   | ¿Se cifran en tránsito? | **Sí** (HTTPS) |
   | ¿Los usuarios pueden pedir que se borren? | **Sí**: en la app (**Perfil → Eliminar mi cuenta** para alumnos y profesores; **Menú → Mi cuenta** para administración) y en la página web |
   | URL para eliminar la cuenta | `https://marea-navy.vercel.app/eliminar-cuenta` |

   Tipos de datos (todos **recopilados**, **no compartidos**, **no se procesan de forma efímera**):

   | Categoría → tipo | Qué es en Marea | ¿Obligatorio? | Finalidades |
   |---|---|---|---|
   | Información personal → **Nombre** | Nombre del alumno (y del invitado) | Obligatorio | Funcionalidad de la app; Administración de la cuenta; Comunicaciones del desarrollador |
   | Información personal → **Dirección de correo electrónico** | Correo de la cuenta | Obligatorio | Funcionalidad de la app; Administración de la cuenta; Comunicaciones del desarrollador |
   | Información personal → **IDs de usuario** | Identificador de la cuenta | Obligatorio | Funcionalidad de la app; Administración de la cuenta; Prevención de fraudes, seguridad y cumplimiento |
   | Información personal → **Número de teléfono** | Teléfono | Opcional | Funcionalidad de la app; Comunicaciones del desarrollador |
   | Información personal → **Otra información** | Cumpleaños | Opcional | Funcionalidad de la app; Comunicaciones del desarrollador |
   | Información financiera → **Historial de compras** | Paquetes, montos, forma y estado del pago | Obligatorio | Funcionalidad de la app; Estadísticas |
   | Información financiera → **Otra información financiera** | Solo del personal: precio por alumno, lo ganado y los pagos que le hace el estudio | Obligatorio para el personal | Funcionalidad de la app |
   | Salud y actividad física → **Información de salud** | Solo si el estudio anota una lesión o condición que el alumno comparte | Opcional | Funcionalidad de la app |
   | Actividad en la app → **Otras acciones** | Reservaciones, cancelaciones, lista de espera y asistencias | Obligatorio | Funcionalidad de la app; Estadísticas |

   "Comunicaciones del desarrollador" va porque el aviso de privacidad dice que el estudio puede mandar novedades,
   promociones y felicitaciones de cumpleaños; "Estadísticas", por las estadísticas internas. No marques ubicación,
   contactos, fotos, archivos, identificadores del dispositivo ni publicidad: la app no los usa.
7. **Apps gubernamentales**: No. **Funciones financieras**: ninguna. **Apps de salud**: Marea no tiene funciones de
   salud (es una app para reservar clases): elige la opción de que la app no tiene funciones de salud.
8. **Ficha principal de Play Store** (menú **Crecer → Presencia en Play Store → Ficha principal**):
   - **Nombre** (hasta 30 caracteres): `Marea`.
   - **Descripción breve** (hasta 80): `Reserva tus clases de yoga, revisa tu paquete y haz check-in con tu código.`
   - **Descripción completa** (hasta 4000): qué es el estudio, qué puede hacer el alumno (horario, reservar y
     cancelar, lista de espera, reservar para un amigo, paquetes, código QR de check-in, recordatorio 1 hora antes
     de cada clase) y que **los paquetes se pagan en el estudio**. No anuncies el pago en línea hasta que exista.
   - **Ícono**: sube **`assets/play-icon-512.png`** (ya está en el repositorio: 512 × 512, PNG sin transparencia).
   - **Gráfico de funciones** (obligatorio): sube **`assets/play-feature-1024x500.png`** (1024 × 500, con el verde
     de la marca, el logotipo y "Reserva tus clases de yoga"). Si cambias el logotipo, el desarrollador los vuelve a
     generar con `node assets/generar-iconos.mjs --tienda`.
   - **Capturas de teléfono**: mínimo **2** (mejor 4 a 8), JPG o PNG sin transparencia. El lado largo **no puede
     medir más del doble** del corto: una captura de 1080 × 2400 se rechaza. Usa **1080 × 1920**.
     Con un teléfono Android y la app instalada (paso 7) es lo más fácil, pero muchas capturas de teléfonos
     nuevos son más alargadas que 2:1. Si no te las acepta: en Chrome abre https://marea-navy.vercel.app, inicia
     sesión con la cuenta de prueba, abre **Herramientas para desarrolladores → ícono de teléfono**, elige
     **Responsive**, en su menú **⋮ → Add device pixel ratio**, pon **360 × 640** con *DPR* **3** y usa
     **⋮ → Capture screenshot** (sale de 1080 × 1920; la interfaz es la misma que la de la app).
   - **Capturas de tablet** (7" y 10"): opcionales; la app funciona en tablet.
   - **Categoría**: **Salud y bienestar**. **Correo de contacto** (obligatorio), sitio web
     `https://marea-navy.vercel.app` y teléfono (opcional).

---

## 5. Llave de subida (una sola vez, en Codemagic)

**Qué es.** Con *Play App Signing* (obligatorio en apps nuevas), Google guarda la llave con la que se firma la app
que descargan tus alumnos. Tú solo tienes la **llave de subida**: le demuestra a Google que cada versión viene de ti.
**Si la pierdes no pierdes la app**: Google la restablece (ver abajo).

La llave se crea **una sola vez** con el flujo `android-generar-llave` de Codemagic y se guarda en Codemagic con el
nombre `marea_upload` → [codemagic.md, paso 4](codemagic.md#4-llave-de-subida-de-android-flujo-android-generar-llave-una-sola-vez).
Guarda los tres archivos (`marea-upload.jks`, `upload_certificate.pem` y `LEEME-llave.txt`) en tu gestor de
contraseñas. Nunca los subas al repositorio ni los mandes por chat.

### Si algún día pierdes la llave (o se filtra)

1. Crea una llave nueva con el flujo `android-generar-llave` (solo en este caso se vuelve a correr). Te da un
   `upload_certificate.pem` nuevo.
2. Play Console → Marea → **Prueba y lanzamiento → Configuración → Integridad de la app** → pestaña **Firma de
   apps** → **Solicitar el restablecimiento de la llave de subida** → elige el motivo → sube el
   `upload_certificate.pem` nuevo → envía. Lo hace el propietario de la cuenta (tú).
3. Cuando Google confirme el cambio (suele tardar unos días), en Codemagic → **Code signing identities → Android
   keystores** borra la llave `marea_upload` anterior y sube la nueva con el mismo nombre de referencia.
   Tus alumnos no notan nada: la llave con la que Google firma la app no cambia.

---

## 6. Compilar el .aab en Codemagic

1. Codemagic → **Start new build** → flujo **Marea - Android (Google Play)** → versión `1.0.0` → **Start new build**
   ([codemagic.md, "Lanzar una compilación"](codemagic.md#lanzar-una-compilación)).
2. En 10 a 15 minutos termina. En **Artifacts** descarga **`marea-1.0.0-NNNNNN.aab`** (NNNNNN es el `versionCode`,
   que sube solo en cada compilación).
3. En el registro del paso "Compilar el .aab firmado" aparece la **huella SHA-256** del certificado con el que se
   firmó; sirve para comprobar el paso 7.8.

---

## 7. Primera subida (a mano) en Pruebas internas

1. Play Console → Marea → **Prueba y lanzamiento → Pruebas → Pruebas internas**.
2. Pestaña **Verificadores** → **Crear lista de correos** (tú y 1 o 2 personas) → Guardar.
3. Pestaña **Versiones** → **Crear versión**.
4. Si pregunta por la **firma de apps**, deja que **Google genere y administre la llave** (opción predeterminada).
5. Arrastra el `.aab`. El nombre de la versión se llena solo. Notas de la versión: "Primera versión de prueba".
6. **Siguiente** → revisa los avisos (los amarillos no impiden seguir) → **Guardar** → **Lanzar a Pruebas internas**.
7. En **Verificadores** copia el enlace para unirse, ábrelo en tu Android, acepta e instala Marea desde Google Play.
8. Comprueba la llave: **Integridad de la app → Firma de apps → Certificado de la llave de subida**: el SHA-256
   debe ser el mismo de `LEEME-llave.txt` y del registro de Codemagic.

---

## 8. Prueba cerrada: 12 probadores durante 14 días

1. **Prueba y lanzamiento → Pruebas → Prueba cerrada** → pista **Alpha** → **Administrar pista**.
2. **Países**: México (y los que quieras).
3. **Verificadores**: agrega el Grupo de Google (o la lista de correos) y un correo para comentarios.
4. **Crear versión** → **Agregar desde la biblioteca** el mismo `.aab` → Guardar → Revisar → **Enviar a revisión**.
   La prueba cerrada la revisa Google (de horas a unos días).
5. Cuando esté aprobada, manda el **enlace de inscripción** a tus probadores (paso 2).
6. En el **Panel** verás cuántos probadores van y cuántos días llevan. Se necesitan **12 o más inscritos durante
   14 días seguidos**.
7. Si arreglas algo en esos días: compila otra vez en Codemagic (misma versión o una mayor; el `versionCode` sube
   solo) y sube el `.aab` nuevo a la misma pista.

---

## 9. Pedir acceso a producción y publicar

1. Al cumplirse los 14 días: **Panel → Solicitar acceso a producción** → contesta el cuestionario (cómo
   reclutaste a los probadores, qué comentarios recibiste, qué cambiaste). Google responde en unos días.
2. Con acceso a producción: **Producción → Crear versión** → agrega el `.aab` → **Enviar a revisión**.

---

## 10. Subidas automáticas desde Codemagic (opcional)

Después de la primera subida a mano, Codemagic puede subir cada `.aab` solo a Pruebas internas.

1. Entra a **https://console.cloud.google.com** con la cuenta del estudio y crea un proyecto (p. ej. `marea-play`).
2. **APIs y servicios → Biblioteca** → **Google Play Android Developer API** → **Habilitar**.
3. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio** (nombre `codemagic-play`, sin roles).
4. Abre la cuenta de servicio → **Claves → Agregar clave → Crear clave nueva → JSON**. Se descarga un `.json`:
   **es un secreto**.
5. Play Console (página principal de la cuenta) → **Usuarios y permisos → Invitar a usuarios nuevos** → el correo
   de la cuenta de servicio (termina en `iam.gserviceaccount.com`) → **Permisos de la app** → Marea → **Lanzar apps
   en segmentos de prueba** → **Invitar**. Los permisos pueden tardar hasta un día.
6. Codemagic → app Marea → **Environment variables** → `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` = todo el contenido del
   `.json`, grupo `marea`, **Secret**. Guarda el `.json` en tu gestor de contraseñas y bórralo de *Descargas*.
7. Pídele al desarrollador que active en `codemagic.yaml` (flujo `android-play`) las líneas comentadas de `groups`
   y `publishing`.

---

## Versiones siguientes

- Lanza `android-play` con una versión mayor (`1.0.1`, `1.1.0`…). El `versionCode` sube solo.
- Siempre con la **misma llave de subida** (`marea_upload`).

## Reglas de Google Play que la app ya cumple

- **Android 16 (API 36)**: obligatorio para apps nuevas y actualizaciones desde el 31 de agosto de 2026; el
  proyecto ya apunta a 36 (`android/variables.gradle`).
- **Eliminar la cuenta**: en la app (Perfil → Eliminar mi cuenta; administración en Menú → Mi cuenta) y en la
  web (`/eliminar-cuenta`). Requiere la migración 0008 aplicada
  ([cómo comprobarlo](publicar-app.md#lista-de-pendientes-antes-de-enviar-a-revisión)).
- **Pagos**: las clases y los paquetes son servicios presenciales; Google Play excluye de su sistema de cobro los
  servicios físicos (pone como ejemplo las membresías de gimnasio), así que se cobran aparte.
- **Permisos**: solo notificaciones (recordatorio 1 hora antes de cada clase). No se pide el permiso de alarmas
  exactas, para no tener que justificarlo.

## Fuentes (consultadas el 7 de noviembre de 2026)

- Prueba cerrada para cuentas personales nuevas (12 probadores, 14 días): https://support.google.com/googleplay/android-developer/answer/14151465
- Cuenta personal: qué datos se muestran en Google Play: https://support.google.com/googleplay/android-developer/answer/13634081 y https://support.google.com/googleplay/android-developer/answer/13628312
- Verificar acceso a un dispositivo Android: https://support.google.com/googleplay/android-developer/answer/14316361
- Nivel de API objetivo: https://developer.android.com/google/play/requirements/target-sdk
- Firma de apps y restablecimiento de la llave de subida: https://developer.android.com/studio/publish/app-signing y https://support.google.com/googleplay/android-developer/answer/7384423
- Eliminación de cuenta (en la app y en la web): https://support.google.com/googleplay/android-developer/answer/13327111
- Recursos gráficos (ícono 512 × 512, gráfico de funciones 1024 × 500, capturas): https://support.google.com/googleplay/android-developer/answer/9866151
- Servicios físicos fuera de la facturación de Google Play: https://support.google.com/googleplay/android-developer/answer/9858738
- Seguridad de los datos (definición de "compartir" y proveedores de servicios): https://support.google.com/googleplay/android-developer/answer/10787469
- Firma de Android en Codemagic: https://docs.codemagic.io/yaml-code-signing/signing-android/
