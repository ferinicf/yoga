# Publicar Marea en App Store y Google Play

Resumen y orden de los pasos. Los detalles están en dos guías:

- **[google-play.md](google-play.md)**: cuenta de Google Play, ficha, prueba cerrada y subida del `.aab`.
- **[app-store.md](app-store.md)**: el lunes en la Mac (Xcode → TestFlight → revisión de Apple) y la
  compilación en la nube para cuando no estés frente a la Mac.

> **Regla de oro: los secretos NUNCA se pegan en el chat** (ni con Claude, ni por WhatsApp, correo, issues o
> commits). Contraseñas, llaves `.jks` y `.p8`, archivos JSON de cuentas de servicio y la frase de respaldo
> se escriben **solo** en GitHub → *Settings → Secrets and variables → Actions* y en tu gestor de contraseñas.
> Si alguno se filtra por error, ve a la sección [Si un secreto se filtra](#si-un-secreto-se-filtra).

## Cómo está armada la app

- La app de iPhone/iPad y la de Android usan **Capacitor**. La interfaz va **empaquetada dentro de la app**
  (`npm run build:app` genera el sitio estático en `out/` y `npx cap sync` lo copia a los proyectos `ios/` y
  `android/`). No se carga un sitio remoto: Apple rechaza los "sitios reempaquetados" (regla 4.2) y la
  documentación de Capacitor dice que `server.url` no es para producción.
- La web en Vercel (https://marea-navy.vercel.app) sigue igual: `npm run build` no cambia.
- IDs (se pueden cambiar **solo antes** de la primera subida a cada tienda):
  bundle id / applicationId `mx.marea.app`, nombre **Marea**, enlaces profundos `marea://`.
- Pagos: las clases son **presenciales**, así que se cobran fuera del sistema de compras de Apple y de Google
  (Apple 3.1.3(e); Google Play no exige su facturación para servicios físicos). Por ahora el alumno aparta su
  paquete y paga en recepción. Cuando haya credenciales de **Mercado Pago**, el pago se abrirá en el
  navegador del sistema (Safari / Chrome Custom Tabs, porque Mercado Pago no permite su checkout dentro de un
  WebView) y regresará a la app con un enlace `marea://pago?estado=aprobado|pendiente|rechazado`, que ya está
  preparado: abre la pantalla `/pago` (también en la web), que solo informa el resultado; el paquete lo debe
  activar el servidor cuando Mercado Pago confirme el pago (eso se hace al integrar Mercado Pago).

## Orden recomendado

### Este fin de semana (sin Mac, desde cualquier computadora)

1. **Crear la cuenta de Google Play** → [google-play.md, paso 1](google-play.md#1-crear-la-cuenta-de-desarrollador-hoy).
   La verificación de identidad tarda días, por eso va primero.
2. **Empezar a juntar 12 o más probadores con Android** (alumnos, amigos, familia) con su cuenta de Gmail:
   las cuentas personales nuevas de Google deben tener una prueba cerrada con **al menos 12 personas durante
   14 días seguidos** antes de publicar.
3. **Revisar la cuenta de Apple Developer** y crear el registro de la app en App Store Connect →
   [app-store.md, "Antes del lunes"](app-store.md#antes-del-lunes-desde-cualquier-navegador).
4. **Publicar la política de privacidad y la página para eliminar la cuenta** en la web (las dos tiendas piden
   las direcciones). Sugerencia: `https://marea-navy.vercel.app/privacidad` y
   `https://marea-navy.vercel.app/eliminar-cuenta`. *Pendiente: todavía no existen en la web.*
5. **Crear la cuenta de prueba para los revisores** de Apple y Google: un alumno real (modo Supabase) con
   correo ya confirmado, un paquete activo y clases reservables en las próximas semanas.
6. **Llave de subida de Android**: correr el workflow *Android: generar llave de subida* y guardar los 4
   secretos → [google-play.md, paso 5](google-play.md#5-llave-de-subida-una-sola-vez).
7. **Compilar el `.aab`** con el workflow *Android (Google Play)*, subirlo a mano a **Pruebas internas** y
   luego abrir la **prueba cerrada** con tus probadores → [google-play.md, pasos 6 a 8](google-play.md#6-compilar-el-aab).

### El lunes, en la Mac

8. Compilar con Xcode, subir a **TestFlight**, probar en tu iPhone, tomar capturas, llenar la ficha y
   **enviar a revisión** → [app-store.md](app-store.md#el-lunes-en-la-mac).
9. (Opcional, 10 minutos) Crear la **llave de la API de App Store Connect** y cargarla en GitHub para poder
   compilar iOS en la nube cuando no estés en la Mac → [app-store.md, "Compilar en la nube"](app-store.md#compilar-en-la-nube-sin-mac).

### Después

10. A los 14 días de prueba cerrada: **solicitar acceso a producción** en Play Console y publicar.
11. Integrar Mercado Pago (navegador del sistema + regreso por `marea://`).

> **¿GitHub Actions o Codemagic?** Este repositorio trae las dos opciones (ver [codemagic.md](codemagic.md),
> como ya lo usas con Bacco). Elige **una** por plataforma: si generas la llave de Android en los dos lados
> tendrás dos llaves distintas y Google Play solo acepta la primera que registraste.

## Secretos que van en GitHub

Dónde: en el repositorio de GitHub → **Settings** → **Secrets and variables** → **Actions** →
pestaña **Secrets** → botón **New repository secret**. Escribe el *Name* exactamente como aparece abajo y pega
el valor en *Secret*. GitHub no deja volver a ver un secreto (solo reemplazarlo), así que guarda también una
copia en tu gestor de contraseñas.

| Secreto | Qué es | De dónde sale | Lo usa |
|---|---|---|---|
| `ANDROID_KEYSTORE_BACKUP_PASSWORD` | Una frase larga **que tú inventas** (12+ caracteres) para cifrar el respaldo de la llave | Tú; guárdala en tu gestor de contraseñas | `android-keystore.yml` |
| `ANDROID_KEYSTORE_BASE64` | La llave de subida (`.jks`) convertida a texto | Archivo `ANDROID_KEYSTORE_BASE64.txt` del respaldo | `android.yml` |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén de la llave | `ANDROID_KEYSTORE_PASSWORD.txt` | `android.yml` |
| `ANDROID_KEY_ALIAS` | Nombre de la llave (p. ej. `marea_upload`) | `ANDROID_KEY_ALIAS.txt` | `android.yml` |
| `ANDROID_KEY_PASSWORD` | Contraseña de la llave (en las que genera el workflow es la misma) | `ANDROID_KEY_PASSWORD.txt` | `android.yml` |
| `PLAY_SERVICE_ACCOUNT_JSON` *(opcional)* | Permiso para que GitHub suba versiones a Google Play | Google Cloud → cuenta de servicio → llave JSON ([google-play.md, paso 9](google-play.md#9-subidas-automáticas-cuenta-de-servicio-opcional)) | `android.yml` |
| `APP_STORE_CONNECT_KEY_ID` | ID de la llave de la API de Apple (10 caracteres) | App Store Connect → Usuarios y acceso → Integraciones | `ios.yml` |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (formato `1a2b3c4d-…`) | La misma página, arriba de la lista de llaves | `ios.yml` |
| `APP_STORE_CONNECT_KEY_P8_BASE64` | El archivo `AuthKey_XXXXXXXXXX.p8` en base64 (también acepta el texto del `.p8`) | Se descarga **una sola vez** al crear la llave | `ios.yml` |
| `APPLE_TEAM_ID` | Team ID de tu cuenta de Apple Developer (10 caracteres) | developer.apple.com/account → Membresía | `ios.yml` |

Variable opcional (no es secreta; pestaña **Variables** de la misma página):

| Variable | Para qué |
|---|---|
| `ANDROID_VERSION_CODE_OFFSET` | Número que se suma al `versionCode` de Android. Úsala solo si alguna vez subiste versiones desde otro lado (p. ej. Codemagic) y Google Play dice que el número "ya se usó". |

## Cómo correr un workflow y descargar el resultado

1. En GitHub, abre la pestaña **Actions** del repositorio.
2. A la izquierda elige el workflow: **Android (Google Play)**, **Android: generar llave de subida** o
   **iOS (TestFlight)**.
3. Botón **Run workflow** → elige la rama → llena las opciones (puedes dejar las que vienen) → **Run workflow**.
4. Espera la palomita verde (Android: unos 10 minutos; iOS: 15 a 25).
5. Abre la ejecución. Arriba verás un **resumen** en español y, al final de la página, **Artifacts** con el
   archivo para descargar (`.aab`, `.ipa` o el respaldo cifrado de la llave).

> El botón **Run workflow** solo aparece cuando los archivos de `.github/workflows/` ya están en la rama
> principal del repositorio (la que GitHub muestra por omisión). Si no lo ves, primero hay que unir esta rama.

Versiones nuevas de Android también se pueden lanzar con una etiqueta: `git tag v1.0.1` y
`git push origin v1.0.1` → compila la versión **1.0.1** y, si existe `PLAY_SERVICE_ACCOUNT_JSON`, la sube a
pruebas internas.

Costo: en repositorios privados, GitHub incluye minutos gratis al mes; las Mac de GitHub gastan esos minutos
mucho más rápido que las máquinas Linux. Para iOS, si usas mucho la nube, revisa *Settings → Billing* o usa
la Mac / Codemagic.

## Si un secreto se filtra

| Qué se filtró | Qué hacer |
|---|---|
| Llave de subida de Android o su contraseña | Genera otra con el workflow (opción *reemplazar*) y pide el **restablecimiento de la llave de subida** en Play Console ([google-play.md, paso 5](google-play.md#5-llave-de-subida-una-sola-vez)). Gracias a *Play App Signing*, la app y sus usuarios no se ven afectados. |
| Llave `.p8` de App Store Connect | App Store Connect → Usuarios y acceso → Integraciones → **Revocar** la llave y crear otra. |
| JSON de la cuenta de servicio de Google | Google Cloud → IAM → Cuentas de servicio → Llaves → **borrar** esa llave y crear otra. |
| Frase de respaldo | Cámbiala en GitHub y vuelve a guardar el respaldo cifrado con la frase nueva. |

## Fuentes (consultadas el 7 de noviembre de 2026)

- Apple, App Review Guidelines (3.1.3(e), 4.2 y 5.1.1(v)): https://developer.apple.com/app-store/review/guidelines/
- Capacitor, configuración (`server.url` no es para producción): https://capacitorjs.com/docs/config
- Google Play, requisito de prueba para cuentas personales nuevas: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play, nivel de API objetivo (Android 16 / API 36 desde el 31 de agosto de 2026): https://developer.android.com/google/play/requirements/target-sdk
