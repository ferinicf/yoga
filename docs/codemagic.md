# Compilar Marea en Codemagic

Codemagic compila la app en una **Mac en la nube** y entrega el archivo para cada tienda: el `.aab` de Google
Play y la compilación de iPhone/iPad que sube sola a **TestFlight**. Es la **única vía** de este proyecto: no
necesitas Mac ni instalar nada en tu computadora.

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

1. Entra a **https://codemagic.io** con tu cuenta.
2. **Add application** (arriba a la derecha).
3. Elige **GitHub**. Si Codemagic no ve el repositorio, toca **Install GitHub App**, elige tu cuenta de GitHub y
   en *Repository access* agrega **`ferinicf/yoga`** (o "All repositories") → **Install & Authorize**.
4. Elige el repositorio **ferinicf/yoga** y el tipo de proyecto (Ionic/Capacitor u **Other**) →
   **Finish: Add application**.
5. En la configuración de la app, si te pregunta, elige **codemagic.yaml** como forma de configuración.
   Codemagic lee el archivo de la rama que compiles.

> Si la app queda en un **equipo** (Team) de Codemagic, los menús dicen *Team settings* en lugar de los de tu
> cuenta personal. Todo lo demás es igual.

### 2. Llave de la API de App Store Connect solo para Marea (nombre: `Marea`)

Codemagic usa esta llave para firmar la app y subirla a TestFlight. Marea tiene **su propia llave**: no comparte
llaves ni certificados con ninguna otra app. Lo único común es tu cuenta de Apple Developer (a tu nombre), que es
la misma para todas tus apps.

**a) Crear la llave en App Store Connect**

1. Entra a **https://appstoreconnect.apple.com** → **Usuarios y acceso** → pestaña **Integraciones** →
   **API de App Store Connect** → **Claves del equipo**.
2. Toca **+** (Generar clave de API).
   - **Nombre**: `Marea Codemagic`.
   - **Acceso**: **App Manager** (basta para firmar y subir; no le des **Admin**).
   - **Generar**.
3. En la fila de la llave nueva toca **Descargar clave de API**. Se descarga un archivo `AuthKey_XXXXXXXXXX.p8`.
   **Apple solo deja descargarlo una vez**: guárdalo enseguida en tu gestor de contraseñas.
4. Anota dos datos de esa misma página (no son secretos, pero los vas a pegar en Codemagic):
   - **ID de la clave** (*Key ID*): la columna junto al nombre, p. ej. `ABC123DEFG`.
   - **ID del emisor** (*Issuer ID*): arriba de la lista, con formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

**b) Agregarla en Codemagic**

1. Codemagic → configuración de tu cuenta (o *Team settings → Team integrations* si usas un equipo) →
   **Integrations** → **Developer Portal** → **Manage keys** → **Add key**.
2. **App Store Connect API key name**: `Marea` (exactamente así, con M mayúscula: es el nombre que usa
   `codemagic.yaml` en la línea `app_store_connect:`).
3. **Issuer ID** y **Key ID**: los que anotaste.
4. **API key**: sube el archivo `.p8` → **Save**.
5. Borra el `.p8` de *Descargas* (ya está en tu gestor de contraseñas).

La lista de llaves de Codemagic puede tener varias; cada app usa solo la que nombra su `codemagic.yaml`.

### 3. Grupo de variables `marea` (llave del certificado de Apple)

Codemagic firma la app con un **certificado de distribución de Apple**. Para Marea se crea una **llave privada
nueva**, solo de esta app, y con ella Codemagic crea solo su certificado la primera vez que compila.

**a) Crear la llave privada** (en tu computadora; no se instala nada)

- En Windows abre **Símbolo del sistema** (cmd, no PowerShell) y escribe:
  `ssh-keygen -t rsa -b 2048 -m PEM -f marea_ios_distribution_key -q -N ""`
  Si prefieres PowerShell, cambia el final por `-N '""'`:
  `ssh-keygen -t rsa -b 2048 -m PEM -f marea_ios_distribution_key -q -N '""'`
- En una Mac (Terminal) es el mismo comando de cmd.
- Se crean dos archivos en la carpeta donde estás: `marea_ios_distribution_key` (la llave privada, la que
  necesitas) y `marea_ios_distribution_key.pub` (no se usa; puedes borrarlo). **No** los crees dentro de la
  carpeta del proyecto.

**b) Guardarla en Codemagic**

1. Codemagic → app **Marea** (ferinicf/yoga) → pestaña **Environment variables**.
2. **Variable name**: `CERTIFICATE_PRIVATE_KEY`.
3. **Variable value**: abre `marea_ios_distribution_key` con el Bloc de notas, copia **todo**, desde
   `-----BEGIN RSA PRIVATE KEY-----` hasta `-----END RSA PRIVATE KEY-----`, y pégalo aquí.
4. **Group**: escribe `marea` y créalo.
5. Marca **Secret** → **Add**.
6. Guarda el archivo en tu gestor de contraseñas y bórralo de la computadora. Codemagic no deja ver un valor
   secreto ya guardado.

Apple permite pocos certificados de distribución por cuenta. Si la primera compilación dice que llegaste al
límite, en developer.apple.com → **Certificates** revoca uno que **ya no uses en ninguna app** y vuelve a lanzar
la compilación. Revocar un certificado no afecta a las apps ya publicadas.

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
| iOS: falla al inicio con un error de la integración | En Codemagic no hay una llave llamada exactamente `Marea` (paso 2b). |
| iOS: falla en "Firma" por la llave del certificado | Falta el grupo `marea` o la variable `CERTIFICATE_PRIVATE_KEY` está incompleta (paso 3b). |
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
