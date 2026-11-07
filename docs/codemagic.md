# Compilar Marea en Codemagic

Codemagic compila la app en una **Mac en la nube** y entrega el archivo para cada tienda: el `.aab` de Google
Play y la compilación de iPhone/iPad que sube sola a **TestFlight**. Es la **única vía** de este proyecto: no
necesitas Mac ni instalar nada en tu computadora. Es el mismo servicio que ya usas con Bacco.

La configuración está en el archivo `codemagic.yaml` (raíz del repositorio `ferinicf/yoga`). Trae tres flujos:

| Flujo | Para qué | Cuándo |
|---|---|---|
| `android-generar-llave` | Crea la llave de subida de Google Play | **Una sola vez** |
| `android-play` | Compila el `.aab` firmado para Google Play | Cada versión de Android |
| `ios-testflight` | Compila la app de iPhone/iPad y la sube a TestFlight | Cada versión de iPhone/iPad |

> Los secretos (llaves, contraseñas) **nunca** se pegan en el chat ni se suben al repositorio: se guardan en
> Codemagic y en tu gestor de contraseñas.

**Costo.** Una cuenta personal de Codemagic trae **500 minutos gratis al mes** en Mac M2 (se reinician el día 1).
Por eso los tres flujos usan esa máquina. Las máquinas Linux no tienen minutos gratis: solo existen si activas
la facturación. Los registros y archivos de cada compilación se guardan **30 días** en cuentas personales;
descarga lo que quieras conservar.

---

## Una sola vez

### 1. Conectar el repositorio

1. Entra a **https://codemagic.io** con tu cuenta (la misma de Bacco).
2. **Add application** (arriba a la derecha).
3. Elige **GitHub**. Si Codemagic no ve el repositorio, toca **Install GitHub App**, elige tu cuenta de GitHub y
   en *Repository access* agrega **`ferinicf/yoga`** (o "All repositories") → **Install & Authorize**.
4. Elige el repositorio **ferinicf/yoga** y el tipo de proyecto (Ionic/Capacitor u **Other**) →
   **Finish: Add application**.
5. En la configuración de la app, si te pregunta, elige **codemagic.yaml** como forma de configuración.
   Codemagic lee el archivo de la rama que compiles.

> Si la app queda en un **equipo** (Team) de Codemagic, los menús dicen *Team settings* en lugar de los de tu
> cuenta personal. Todo lo demás es igual.

### 2. Integración de App Store Connect (ya la tienes: `Bacco-AppStoreConnect`)

La integración es una llave de la API de **tu cuenta de Apple**, no de una app, así que sirve igual para Marea.

1. En Codemagic abre la configuración de tu cuenta (o *Team settings → Team integrations* si usas un equipo) →
   **Integrations** → **Developer Portal** → **Manage keys**.
2. Revisa el **nombre** de la llave. Tiene que ser **exactamente** `Bacco-AppStoreConnect`, como en
   `codemagic.yaml` (línea `app_store_connect:`). Si se llama distinto, pídele al desarrollador que cambie esa línea.
3. Esa llave necesita el rol **Admin** o **App Manager** en App Store Connect (con el de Bacco ya funciona).

### 3. Grupo de variables `marea` (certificado de Apple)

Codemagic firma la app con tu **certificado de distribución de Apple**. Solo necesita su llave privada, en una
variable llamada `CERTIFICATE_PRIVATE_KEY`.

1. Codemagic → app **Marea** (ferinicf/yoga) → pestaña **Environment variables**.
2. **Variable name**: `CERTIFICATE_PRIVATE_KEY`.
3. **Variable value**: el contenido **completo** del archivo de la llave, desde `-----BEGIN RSA PRIVATE KEY-----`
   hasta `-----END RSA PRIVATE KEY-----`. Usa **la misma llave que pusiste en Bacco**: así Codemagic reutiliza tu
   certificado actual y no crea otro. Codemagic no deja ver un valor secreto ya guardado, así que necesitas el
   archivo original (búscalo en tu gestor de contraseñas).
4. **Group**: escribe `marea` y créalo.
5. Marca **Secret** → **Add**.

**¿Ya no tienes ese archivo?** Crea una llave nueva y Codemagic creará un certificado nuevo en tu cuenta de Apple
la primera vez que compiles:

- En una Mac (Terminal) o en Windows (PowerShell), escribe:
  `ssh-keygen -t rsa -b 2048 -m PEM -f ios_distribution_private_key -q -N ""`
- Se crea el archivo `ios_distribution_private_key` en la carpeta donde estás. Ábrelo con un editor de texto,
  copia todo y pégalo como valor de `CERTIFICATE_PRIVATE_KEY`. Guárdalo en tu gestor de contraseñas y bórralo de
  la computadora. **No** lo guardes dentro de la carpeta del proyecto.
- Apple permite pocos certificados de distribución por cuenta. Si Codemagic dice que llegaste al límite, revoca
  en developer.apple.com → **Certificates** uno que **ya no uses** (no el de Bacco si Bacco sigue compilando con él).

### 4. Llave de subida de Android (flujo `android-generar-llave`, una sola vez)

1. **Start new build** → rama (ver [Lanzar una compilación](#lanzar-una-compilación)) → flujo
   **Marea - Android (generar llave, una sola vez)** → **Start new build**. Tarda 2 o 3 minutos.
2. Al terminar, en **Artifacts** descarga los **tres** archivos: `marea-upload.jks` (la llave),
   `upload_certificate.pem` (su certificado público) y `LEEME-llave.txt` (alias, contraseña y huella).
3. Codemagic → configuración (de tu cuenta o del equipo) → **codemagic.yaml settings → Code signing identities**
   → pestaña **Android keystores**:
   - Sube `marea-upload.jks`.
   - **Keystore password** y **Key password**: la contraseña de `LEEME-llave.txt` (es la misma).
   - **Key alias**: `marea_upload`.
   - **Reference name**: `marea_upload` (exactamente así; es el nombre que usa `codemagic.yaml`).
   - **Add keystore**.
4. Guarda los **tres** archivos en tu gestor de contraseñas y bórralos de *Descargas*. **Codemagic no deja volver a
   descargar la llave** y los Artifacts se borran a los 30 días.
5. **No vuelvas a correr este flujo.** Una llave nueva no sirve para la app que ya subiste a Google Play. Si algún
   día pierdes la llave, Google la puede restablecer ([google-play.md](google-play.md#si-algún-día-pierdes-la-llave-o-se-filtra)).

### 5. Crear la app en App Store Connect

Antes de la primera compilación de iPhone/iPad, la app tiene que existir en App Store Connect; si no, Codemagic
compila pero no puede subirla. Pasos en [app-store.md, paso 2](app-store.md#2-crear-la-app-en-app-store-connect).

---

## Lanzar una compilación

1. Codemagic → app **Marea** → **Start new build**.
2. **Branch**: la rama con la versión que quieres publicar (hoy `claude/nifty-gates-32j863`; `main` cuando se una).
3. **Workflow**: `Marea - Android (Google Play)` o `Marea - iPhone/iPad (TestFlight)`.
4. **version**: la versión que verán tus alumnos en la tienda. La primera es `1.0.0` (ya viene escrita).
   Cuando una versión ya se publicó en una tienda, la siguiente debe ser mayor: `1.0.1`, `1.1.0`…
5. **Start new build**. Puedes cerrar la página: Codemagic te avisa por correo cuando termina.

| Flujo | Tiempo aproximado | Qué obtienes |
|---|---|---|
| Android (Google Play) | 10 a 15 min | En **Artifacts**: `marea-1.0.0-NNNNNN.aab`. Súbelo en Play Console ([google-play.md, paso 7](google-play.md#7-primera-subida-a-mano-en-pruebas-internas)). |
| iPhone/iPad (TestFlight) | 15 a 25 min | Se sube sola a App Store Connect. En 5 a 30 min más aparece en **TestFlight** ([app-store.md, paso 3](app-store.md#3-compilar-y-subir-a-testflight)). |

### Números de versión (automático)

Cada tienda pide dos números: la **versión** (la que tú escribes, p. ej. `1.0.0`) y un **número interno** que
debe crecer en cada subida. El número interno lo calcula el flujo solo y **siempre es un entero que crece**:

- **Android** (`versionCode`) y **iPhone/iPad** (número de compilación): los minutos que han pasado desde el
  1 de enero de 2026. Por ejemplo, una compilación de noviembre de 2026 lleva un número cercano a 450 000.
- En iPhone/iPad, además, el flujo revisa TestFlight: si ahí hay un número mayor (por ejemplo, de una subida desde
  Xcode), usa ese más uno.

Así nunca se repite un número, aunque vuelvas a lanzar la misma compilación.

## Si algo falla

| Mensaje o síntoma | Qué hacer |
|---|---|
| *No encontré la llave 'marea_upload'* | Revisa el paso 4: el **Reference name** debe ser `marea_upload`. |
| *La versión "…" no es válida* | Escribe solo números con puntos: `1.0.0`. |
| iOS: falla al inicio con un error de la integración | El nombre de la integración no coincide con `Bacco-AppStoreConnect` (paso 2). |
| iOS: falla en "Firma" por la llave del certificado | Falta el grupo `marea` o la variable `CERTIFICATE_PRIVATE_KEY` está incompleta (paso 3). |
| iOS: compila pero falla al publicar en App Store Connect | La app aún no existe en App Store Connect (paso 5) o hay acuerdos pendientes en App Store Connect → **Negocios**. |
| iOS: *The train version '1.0.0' is closed* | Esa versión ya se publicó. Vuelve a lanzar con una versión mayor (`1.0.1`). |
| Android: Play Console dice que el código de versión ya se usó | Vuelve a lanzar `android-play` (el número sube solo). |

Si no se entiende el error, descarga el registro de la compilación (botón de descarga junto a cada paso) y
compártelo con el desarrollador. Los registros no muestran las contraseñas.

## Fuentes (consultadas el 7 de noviembre de 2026)

- Agregar una app desde GitHub: https://docs.codemagic.io/getting-started/adding-apps/
- Firma de Android (`android_signing`, `CM_KEYSTORE_PATH`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD`): https://docs.codemagic.io/yaml-code-signing/signing-android/
- Firma de iOS con `app-store-connect fetch-signing-files` y `CERTIFICATE_PRIVATE_KEY`: https://docs.codemagic.io/yaml-code-signing/alternative-code-signing-methods/
- Publicar en App Store Connect con la integración: https://docs.codemagic.io/yaml-publishing/app-store-connect/
- Variables de entorno, grupos y `BUILD_NUMBER`: https://docs.codemagic.io/yaml-basic-configuration/configuring-environment-variables/ y https://docs.codemagic.io/yaml-basic-configuration/environment-variables/
- Preguntas al lanzar una compilación (`inputs`): https://docs.codemagic.io/knowledge-codemagic/build-inputs/
- Numeración de compilaciones: https://docs.codemagic.io/knowledge-codemagic/build-versioning/
- Minutos gratis, tipos de máquina y retención de 30 días: https://docs.codemagic.io/billing/pricing/ y https://docs.codemagic.io/yaml-basic-configuration/yaml-getting-started/
- Ejemplo oficial de Codemagic para Ionic/Capacitor: https://github.com/codemagic-ci-cd/codemagic-sample-projects/tree/main/ionic/ionic-capacitor-demo-project
