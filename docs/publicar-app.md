# Publicar Marea en App Store y Google Play

Este es el resumen y la lista de pendientes. Los pasos a detalle están en tres guías, en este orden:

1. **[codemagic.md](codemagic.md)**: conectar Codemagic una sola vez y lanzar las compilaciones. Codemagic es
   la **única vía** para compilar las apps: compila en una Mac en la nube, así que **no necesitas Mac**.
2. **[google-play.md](google-play.md)**: cuenta de Google Play, ficha, prueba cerrada de 14 días y subida del `.aab`.
3. **[app-store.md](app-store.md)**: App Store Connect, TestFlight, capturas, ficha y envío a revisión de Apple.

> **Regla de oro: los secretos NUNCA se pegan en el chat** (ni con Claude, ni por WhatsApp, correo o issues) y
> nunca se suben al repositorio. Llaves, contraseñas y certificados viven **solo** en Codemagic y en tu gestor
> de contraseñas (1Password, Bitwarden, el llavero de iCloud…). Si alguno se filtra, ve a
> [Si un secreto se filtra](#si-un-secreto-se-filtra).

## Cómo está armada la app

- Las apps de iPhone/iPad y de Android usan **Capacitor**. La interfaz va **empaquetada dentro de la app**
  (`npm run build:app` genera el sitio estático en `out/` y Capacitor lo copia a los proyectos `ios/` y
  `android/`). No se carga un sitio remoto: Apple rechaza las apps que son "un sitio web reempaquetado"
  (regla 4.2).
- La web (https://marea-navy.vercel.app) se publica sola en Vercel desde la rama; no cambia.
- **IDs definitivos** (después de la primera subida a cada tienda ya **no** se pueden cambiar):

  | Qué | Valor |
  |---|---|
  | Bundle ID (Apple) y applicationId (Google) | `mx.marea.app` |
  | Nombre debajo del ícono | **Marea** |
  | Enlaces que abren la app | `marea://` (p. ej. `marea://alumno/reservas`) |
  | SKU en App Store Connect | `marea-ios` |

- **Pagos**: las clases son **presenciales**, así que se cobran fuera del sistema de compras de Apple y de Google
  (Apple 3.1.3(e); Google Play excluye de su facturación los servicios físicos, como las membresías de
  gimnasio). Hoy el alumno aparta su paquete y paga en recepción. Mercado Pago se integrará después.

## Lista de pendientes antes de enviar a revisión

Marca cada punto. Ninguna tienda deja enviar sin las direcciones públicas, y los revisores prueban la cuenta
de prueba y "Eliminar mi cuenta".

- [x] **Migraciones de la base de datos.** Todas aplicadas en el proyecto **Marea** (7-nov-2026): `0006` y `0007`
  (pagos a profesores y permisos por clase), `0008` (eliminar la cuenta) y `0009` (solo la administración vende
  paquetes). Si algún día se recrea la base, se aplican en orden desde Supabase → **SQL Editor**.
  - Cómo se comprueba que "Eliminar mi cuenta" está activa (sin iniciar sesión; la llave publicable está en `src/lib/supabase.ts`):

    ```bash
    curl -s -X POST https://xdojstptndarxjprxyna.supabase.co/rest/v1/rpc/delete_my_account \
      -H "apikey: <llave publicable>" -H "Content-Type: application/json" -d '{}'
    ```

    Debe responder **401** con el código `42501` (permiso denegado: la función existe y solo la puede usar
    quien inició sesión). Si responde **404** con `PGRST202`, la función todavía no existe.
- [ ] **Páginas públicas** (ábrelas en el teléfono y revisa que carguen):
  - Aviso de privacidad: https://marea-navy.vercel.app/privacidad
  - Eliminar la cuenta: https://marea-navy.vercel.app/eliminar-cuenta
  - Soporte: https://marea-navy.vercel.app/soporte
- [ ] **Tus datos en el aviso de privacidad.** La ley mexicana pide decir quién es el responsable de los datos.
  Dale al desarrollador tu **nombre legal completo** (va en `src/lib/legal.ts`, `RESPONSIBLE_NAME`) y llena el
  domicilio y el teléfono del estudio en **Admin → Configuración**. Mientras tu nombre esté vacío, las páginas
  muestran "Marea".
- [ ] **Enlace al aviso dentro de la app**: ya está en la pantalla de acceso (al crear la cuenta), en **Perfil**
  (alumnos y profesores) y en **Menú → Mi cuenta** (administración), junto con **Ayuda y soporte**.
  Revísalo una vez en el teléfono.
- [ ] **Eliminar la cuenta en la app, para todos**: alumnos y profesores en **Perfil → Eliminar mi cuenta**;
  administración en **Menú → Mi cuenta → Eliminar mi cuenta** (con al menos otra persona administradora activa:
  la última no se puede eliminar, para que el estudio no se quede sin administración).
- [ ] **Cuentas de prueba para los revisores** (Apple y Google): dos alumnos **reales** (no el modo demo),
  con el correo ya confirmado, un paquete activo y clases para reservar en las próximas dos semanas.
  La segunda es de repuesto: el revisor de Apple suele probar "Eliminar mi cuenta" con la que le das.
  Antes de **cada** envío revisa que las dos sigan existiendo y tengan créditos (si una se borró, créala de nuevo).
- [ ] **Cuenta de Apple Developer activa** y acuerdos aceptados. Es **personal**: en la App Store el vendedor
  aparecerá con **tu nombre legal**, no "Marea" ([app-store.md](app-store.md#antes-de-empezar)).
- [ ] **Cuenta de Google Play** (personal, nueva): verificada y con la **prueba cerrada de 12 probadores durante
  14 días** cumplida antes de pedir producción ([google-play.md](google-play.md)).
- [ ] **Codemagic conectado**: integración de App Store Connect, grupo `marea` y llave de Android
  ([codemagic.md](codemagic.md)).

## Orden recomendado

### Hoy (desde cualquier computadora)

1. **Crea la cuenta de Google Play** → [google-play.md, paso 1](google-play.md#1-crear-la-cuenta-de-desarrollador).
   La verificación de identidad tarda días, por eso va primero.
2. **Empieza a juntar 15 a 20 probadores con Android** (alumnos, profesores, familia) con su cuenta de Gmail.
   Se piden 12; conviene tener de sobra.
3. **Conecta Codemagic** y crea la llave de Android (flujo `android-generar-llave`, **una sola vez**) →
   [codemagic.md](codemagic.md).
4. **Crea la app en App Store Connect** → [app-store.md, paso 2](app-store.md#2-crear-la-app-en-app-store-connect).
5. **Revisa la lista de pendientes** de arriba (páginas públicas y cuentas de prueba).

### Cuando la cuenta de Google esté verificada

6. Compila el `.aab` en Codemagic (`android-play`), súbelo a **Pruebas internas** y abre la **prueba cerrada**
   con tus probadores → [google-play.md, pasos 6 a 8](google-play.md#6-compilar-el-aab-en-codemagic).

### iPhone y iPad

7. Compila en Codemagic (`ios-testflight`): la compilación llega sola a **TestFlight**. Instálala en tu iPhone,
   pruébala, toma las capturas, llena la ficha y **envía a revisión** → [app-store.md](app-store.md).

### Después

8. A los 14 días de prueba cerrada: **solicita acceso a producción** en Play Console y publica.
9. Integrar Mercado Pago (se abrirá en el navegador del sistema y regresará a la app con `marea://`).

> **¿Y la Mac?** Ya no hace falta. Si algún día quieres compilar en una Mac con Xcode (opcional), sigue siendo
> posible: `npm run cap:ios` abre el proyecto. Xcode elige solo un número de compilación mayor si al subir dejas
> marcada la opción de administrar la versión y el número de compilación, y Codemagic siempre usa uno mayor al
> último de TestFlight, así que las dos vías pueden convivir. Apple pide Xcode 26 o más reciente.

## Dónde viven los secretos

Todos en **Codemagic** (y una copia en tu gestor de contraseñas). Nada en el repositorio.

| Secreto | Dónde en Codemagic | Lo usa |
|---|---|---|
| Llave de la API de App Store Connect (integración **`Bacco-AppStoreConnect`**, la misma de Bacco) | Configuración → Integrations → **Developer Portal** | `ios-testflight` |
| `CERTIFICATE_PRIVATE_KEY` (llave del certificado de distribución de Apple) | App **Marea** → **Environment variables** → grupo **`marea`**, marcada como **Secret** | `ios-testflight` |
| Llave de subida de Android (`marea-upload.jks`, alias y contraseña) | **codemagic.yaml settings → Code signing identities → Android keystores**, referencia **`marea_upload`** | `android-play` |
| `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` *(opcional, para subir solo a Google Play)* | Grupo **`marea`**, **Secret** | `android-play` |

## Si un secreto se filtra

| Qué se filtró | Qué hacer |
|---|---|
| Llave de subida de Android o su contraseña | Pide el **restablecimiento de la llave de subida** en Play Console ([google-play.md, "Si pierdes la llave"](google-play.md#si-algún-día-pierdes-la-llave-o-se-filtra)). Gracias a *Play App Signing*, la app y tus alumnos no se ven afectados. |
| Llave de la API de App Store Connect (`.p8`) | App Store Connect → **Usuarios y acceso → Integraciones** → **Revocar** la llave, crear otra y cambiarla en la integración de Codemagic (afecta también a Bacco). |
| `CERTIFICATE_PRIVATE_KEY` | developer.apple.com → **Certificates** → revoca el certificado de distribución que usa esa llave, crea una llave nueva ([codemagic.md](codemagic.md#3-grupo-de-variables-marea-certificado-de-apple)) y cámbiala en los grupos de Marea y de Bacco. Las apps ya publicadas siguen funcionando. |
| JSON de la cuenta de servicio de Google | Google Cloud → **IAM → Cuentas de servicio → Llaves** → borra esa llave y crea otra. |

## Fuentes (consultadas el 7 de noviembre de 2026)

- Apple, App Review Guidelines (3.1.3(e), 4.2, 5.1.1(v) y 5.2.1): https://developer.apple.com/app-store/review/guidelines/
- Apple, el vendedor de una cuenta individual es tu nombre legal: https://developer.apple.com/programs/enroll/
- Apple, Xcode 26 obligatorio para subir apps desde el 28 de abril de 2026: https://developer.apple.com/news/upcoming-requirements/
- Google Play, prueba cerrada para cuentas personales nuevas: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play, servicios físicos fuera de su facturación: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play, eliminación de cuenta en la app y en la web: https://support.google.com/googleplay/android-developer/answer/13327111
- Codemagic, firma de Android y de iOS: https://docs.codemagic.io/yaml-code-signing/signing-android/ y https://docs.codemagic.io/yaml-code-signing/alternative-code-signing-methods/
