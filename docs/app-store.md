# App Store: Marea en iPhone y iPad

Guía paso a paso: lo que se adelanta desde el navegador, lo que se hace **el lunes en la Mac** con Xcode y
cómo compilar en la nube cuando no estés frente a la Mac. Resumen general y lista de secretos:
[publicar-app.md](publicar-app.md).

---

## Antes del lunes (desde cualquier navegador)

1. **Revisa tu membresía**: https://developer.apple.com/account → **Membresía**. Debe estar activa (el
   programa se paga cada año). Anota tu **Team ID** (10 letras y números); lo pide GitHub para compilar en la nube.
2. **Acepta los acuerdos pendientes**: https://appstoreconnect.apple.com → **Negocios** (Business). Sin eso no
   deja subir compilaciones. Como Marea es gratis y no vende nada dentro de la app, no necesitas el acuerdo de
   apps de pago ni datos bancarios.
3. **Registra el Bundle ID**: developer.apple.com/account → **Certificates, IDs & Profiles → Identifiers → +**
   → **App IDs** → **App** → Descripción `Marea`, Bundle ID **Explicit** `mx.marea.app` → no marques
   capacidades extra → **Continue → Register**.
4. **Crea la app en App Store Connect**: **Apps → + → Nueva app**:
   - Plataforma: **iOS**.
   - Nombre: **Marea** (tiene que ser único en la App Store; si ya está ocupado usa, por ejemplo,
     "Marea Yoga". Debajo del ícono en el teléfono seguirá diciendo "Marea").
   - Idioma principal: **Español (México)**. Bundle ID: **mx.marea.app**. SKU: `marea-ios`. Acceso: completo.
5. **Ten listos los textos y direcciones** (ver pasos 8 y 9): descripción, palabras clave, URL de soporte y
   **URL de la política de privacidad** (p. ej. `https://marea-navy.vercel.app/privacidad`; *pendiente de
   publicar en la web*).
6. **Crea la cuenta de prueba para el revisor de Apple**: un alumno real (no el modo demo) con el correo ya
   confirmado, un paquete activo y clases disponibles en las próximas dos semanas. No la uses para probar
   "Eliminar cuenta".

> **¿Tu Mac sirve?** Apple pide compilar las apps de iOS con **Xcode 26 o más reciente**. Hoy la versión
> actual es **Xcode 27.2**, que necesita **macOS Tahoe 26.6 o más reciente** (Xcode 26.6 necesita macOS Tahoe
> 26.2). Si tu Mac no puede actualizarse a macOS Tahoe, no podrá compilar para la App Store: en ese caso usa la
> compilación en la nube ([abajo](#compilar-en-la-nube-sin-mac)) o Codemagic ([codemagic.md](codemagic.md)).

---

## El lunes, en la Mac

### 1. Preparar la Mac (lo primero: son descargas grandes)

1. **Menú  → Acerca de esta Mac**: revisa la versión de macOS. Si hace falta, **Configuración del Sistema →
   General → Actualización de software** (puede tardar una hora).
2. Instala o actualiza **Xcode** desde la **Mac App Store**. Ábrelo una vez, acepta la licencia y, si lo pide,
   descarga el componente **iOS** (trae los simuladores de iPhone y iPad).
3. Instala **Node.js 22**: https://nodejs.org/en/download → elige la versión **22** y el instalador para macOS
   (`.pkg`). Es la misma versión que usan las compilaciones en la nube.
4. Abre **Terminal** y escribe `git --version`. Si te ofrece instalar las herramientas de desarrollo, acepta.
5. En Xcode: **Xcode → Settings → Accounts → + → Apple Account** → entra con la cuenta de Apple Developer.

### 2. Bajar el proyecto y prepararlo

Con la app **GitHub Desktop** (https://desktop.github.com): **File → Clone repository** → `ferinicf/yoga` →
elige la carpeta → **Clone**, y luego cambia a la rama que tenga la carpeta `ios/` (*Current branch*).
O desde Terminal:

```bash
cd ~/Desktop
git clone https://github.com/ferinicf/yoga.git marea
cd marea
git checkout NOMBRE-DE-LA-RAMA   # la rama que tenga la carpeta ios/ (o main, cuando ya esté unida)
```

Después, en Terminal, dentro de la carpeta del proyecto:

```bash
npm ci               # instala las dependencias (unos minutos)
npm run cap:sync     # arma la interfaz (out/) y la copia a los proyectos de iOS y Android
npx cap open ios     # abre ios/App/App.xcodeproj en Xcode
```

### 3. Firma en Xcode

1. Espera a que Xcode termine de descargar los paquetes (arriba dice *Resolving packages*).
2. A la izquierda, clic en **App** (ícono azul) → en **TARGETS** elige **App** → pestaña **Signing & Capabilities**.
3. Marca **Automatically manage signing**. En **Team** elige tu nombre (la cuenta de pago; **no** la que dice
   "Personal Team").
4. **Bundle Identifier**: `mx.marea.app` (ya viene).
5. Pestaña **General**: **Display Name** Marea, **Version** `1.0`, **Build** `1`. En *Supported Destinations*
   ya vienen iPhone y iPad.

### 4. Probar

1. Arriba, junto al botón ▶, elige el simulador **iPhone 17 Pro** (o 18 Pro) y presiona ▶ (Cmd+R).
2. Revisa: iniciar sesión con la cuenta de prueba, reservar y cancelar, aceptar las notificaciones, la pantalla
   **Mi perfil** (código QR y **Eliminar cuenta**, esta última con otra cuenta de prueba).
3. Enlace profundo: en Safari del simulador escribe `marea://alumno/reservas` → debe abrir Marea en *Mis reservas*.
4. (Opcional) En tu iPhone: conéctalo con cable, toca **Confiar**, activa **Configuración → Privacidad y
   seguridad → Modo de desarrollador**, elígelo arriba en Xcode y presiona ▶.

### 5. Capturas de pantalla

Según la página de Apple (consultada el 7 de noviembre de 2026) son **obligatorias**: iPhone "con Dynamic
Island, pantalla mediana" y **iPad de 13"** (la app también corre en iPad). Toma también la de **6.9"**, que es
la más grande: App Store Connect reduce las capturas grandes para las pantallas más chicas.

| Pantalla | Simulador | Tamaño (vertical) |
|---|---|---|
| iPhone 6.9" | iPhone 17 Pro Max (o 18 Pro Max) | 1320 × 2868 |
| iPhone 6.3" (obligatoria) | iPhone 17 Pro (o 18 Pro) | 1206 × 2622 |
| iPad 13" (obligatoria) | iPad Pro 13 pulgadas | 2064 × 2752 |

1. Elige el simulador y presiona ▶.
2. En cada pantalla que quieras mostrar (horario, reservar, mis reservas, paquetes, código QR) presiona
   **Cmd+S** en el simulador: la captura se guarda en el Escritorio, ya del tamaño correcto.
3. De 3 a 5 capturas por tamaño (máximo 10). PNG o JPG, sin transparencias.

### 6. Archivar y subir (Archive)

1. Arriba, como destino, elige **Any iOS Device (arm64)**.
2. Menú **Product → Archive**. Tarda unos minutos y luego se abre el **Organizer**.
3. Selecciona el archivo nuevo → **Distribute App** → **App Store Connect** → **Distribute**. Si te pregunta,
   deja marcado subir los símbolos y **administrar la versión y el número de compilación**, con firma automática.
4. Espera el mensaje de que se subió correctamente.

### 7. TestFlight

1. App Store Connect → **Apps → Marea → TestFlight**. La compilación aparece como *Procesando* (5 a 30
   minutos; te llega un correo cuando está lista).
2. **Cumplimiento de exportación**: ya está resuelto en el proyecto (la app no usa cifrado propio), así que no
   debería preguntarte nada.
3. **Pruebas internas → +** → crea un grupo (p. ej. "Equipo") → agrégate (y a otras personas de tu equipo de
   App Store Connect, hasta 100).
4. En tu iPhone instala **TestFlight** desde la App Store → acepta la invitación → instala Marea.
   Cada compilación de TestFlight dura 90 días.

### 8. Ficha de la App Store

App Store Connect → Marea → pestaña **App Store**:

- **Información de la app**: subtítulo (hasta 30 caracteres, p. ej. "Reserva tus clases de yoga"), categoría
  principal **Salud y forma física**, secundaria **Estilo de vida**; **clasificación por edad**: responde el
  cuestionario (todo "No"); URL de la política de privacidad.
- **Precio y disponibilidad**: **Gratis**; países: México (y los que quieras).
- **Versión 1.0 (Preparar para envío)**:
  - Capturas de iPhone y de iPad (paso 5).
  - Texto promocional, **descripción** (qué puede hacer el alumno y que los paquetes se pagan en el estudio),
    **palabras clave** (hasta 100 caracteres, separadas por comas: `yoga,clases,reservas,estudio,meditación,…`),
    **URL de soporte** (obligatoria) y copyright (`2026 Tu nombre`).
  - **Compilación**: botón **+** → elige la que subiste.
  - **Información para la revisión de la app**: marca *Se requiere inicio de sesión* y escribe el **correo y la
    contraseña de la cuenta de prueba**, tus datos de contacto y las **notas** del paso 10.

### 9. Privacidad de la app (App Privacy)

App Store Connect → Marea → **Privacidad de la app** → **Comenzar**:

| Tipo de dato | Ejemplo en Marea |
|---|---|
| Información de contacto → Nombre, Correo electrónico, Número de teléfono | Perfil del alumno |
| Compras → Historial de compras | Paquetes |
| Identificadores → ID de usuario | Cuenta |
| Otros datos | Reservas, asistencias, cumpleaños (si se captura) |
| Salud *(solo si el estudio anota lesiones o condiciones en las notas del alumno)* | Notas del alumno |

Para cada uno: uso **Funcionalidad de la app**; **vinculado a la identidad: Sí**; **rastreo (tracking): No**.
Al final, **Publicar**.

### 10. Notas para el revisor (copiar y pegar)

Los revisores leen inglés. Rellena lo que está entre corchetes y **borra cualquier punto que todavía no esté en
la versión que envías**. Los recordatorios (1 h antes de cada clase reservada; la app pide permiso la primera vez
que reservas) y la vibración al reservar ya están conectados; compruébalos en tu iPhone con TestFlight antes de enviar.

```text
Marea is the booking app of [studio name], a yoga studio in [city], Mexico. All classes take place in person at the studio.

Demo account (student, with an active class package):
  Email: [correo]
  Password: [contraseña]

Payments (Guideline 3.1.3(e)): students buy class packages for in-person classes that are consumed outside the app, at the physical studio. The app sells no digital content. Today a package is reserved in the app and paid at the studio's front desk. When online payment is enabled, Mercado Pago's checkout will open in Safari View Controller and return to the app through the marea:// URL scheme.

Account deletion (Guideline 5.1.1(v)): Mi perfil (Profile) > Eliminar cuenta (Delete account) permanently deletes the account and its personal data.

App functionality (Guideline 4.2): the interface is bundled in the app, not loaded from a website. Native features: local notifications that remind students of each booked class 1 hour before it starts, haptic feedback when a booking is confirmed, a QR check-in code for the front desk, marea:// deep links (notifications and payment returns) and data refresh when the app returns to the foreground.

The app is in Spanish. "Ver demo con datos de ejemplo" on the sign-in screen opens a local demo with sample data; any online payment inside that demo is simulated and charges nothing.
```

### 11. Enviar a revisión

1. Revisa que no falte nada (App Store Connect marca en rojo lo pendiente).
2. **Agregar para revisión → Enviar a la revisión de apps**. Suele tardar uno o dos días.
3. Si Apple pide cambios, el mensaje llega a App Store Connect; contesta ahí mismo.

---

## Compilar en la nube (sin Mac)

El workflow **iOS (TestFlight)** de GitHub compila en una Mac de GitHub (la más reciente, con el Xcode estable
más nuevo) y sube a TestFlight. Hay que prepararlo **una vez**:

### Crear la llave de la API de App Store Connect

1. https://appstoreconnect.apple.com → **Usuarios y acceso** → pestaña **Integraciones** → **App Store Connect API**.
2. Si es la primera vez: **Solicitar acceso** (solo el titular de la cuenta, que eres tú) → acepta los términos
   → **Enviar**. Apple lo aprueba caso por caso.
3. Sección **Claves del equipo** → **Generar clave de API** (o **+**) → nombre `GitHub Actions` → acceso
   **Admin** → **Generar**.
   - **¿Por qué Admin?** El workflow firma con el certificado de distribución que Apple guarda en la nube; con
     roles menores, Apple rechaza esa firma ("Cloud signing permission error"). Por lo mismo, esta llave es
     poderosa: trátala como contraseña.
   - Si ya tienes una llave para Codemagic (Bacco) con rol Admin, puedes usar esa; si no es Admin, crea esta.
4. **Descargar** la llave: el archivo `AuthKey_XXXXXXXXXX.p8` **solo se puede descargar una vez**. Anota el
   **ID de la clave** (columna *Key ID*) y el **Issuer ID** (arriba de la lista).

### Guardar los secretos en GitHub

1. En la Mac, en Terminal: `base64 -i ~/Downloads/AuthKey_XXXXXXXXXX.p8 | pbcopy` (queda copiado).
   (También puedes abrir el `.p8` con TextEdit y copiar todo el texto: el workflow acepta las dos formas.)
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret**, cuatro veces:
   - `APP_STORE_CONNECT_KEY_ID` → el Key ID.
   - `APP_STORE_CONNECT_ISSUER_ID` → el Issuer ID.
   - `APP_STORE_CONNECT_KEY_P8_BASE64` → lo que copiaste.
   - `APPLE_TEAM_ID` → tu Team ID (developer.apple.com/account → Membresía).
3. Guarda el `.p8` en tu gestor de contraseñas y bórralo de *Descargas*.

### Correrlo

1. **Actions → iOS (TestFlight) → Run workflow**. *Versión*: vacío (usa la del proyecto) o, p. ej., `1.0.1`.
   Deja marcado **Subir a TestFlight** → **Run workflow**. Tarda de 15 a 25 minutos.
2. Al terminar, el resumen dice la versión y el número de compilación; en 5 a 30 minutos aparece en TestFlight.
3. Requisito: la app ya debe existir en App Store Connect (paso 4 de "Antes del lunes").

Detalles:

- El **número de compilación** es la fecha y hora (UTC) en formato `AAAAMMDD.HHMM`, p. ej. `20261110.1530`:
  siempre es mayor que el anterior y que las compilaciones subidas a mano (1, 2, 3…). Si después subes desde
  Xcode, deja marcada la opción de administrar el número de compilación para que Xcode elija uno mayor.
- Si falla la firma, el workflow explica la causa más común (rol de la llave, app no creada, acuerdo
  pendiente). Opciones: correrlo con **Firmar también el .xcarchive** marcado; desmarcar *Subir a TestFlight*
  para obtener el `.ipa` en *Artifacts* y subirlo con la app **Transporter** de Apple; o compilar en la Mac o
  en Codemagic.
- La subida la hace el mismo `xcodebuild` (lo que usa Xcode al distribuir). No se usa `altool --upload-app`,
  que Apple marcó como obsoleto.
- En repositorios privados, las Mac de GitHub gastan los minutos gratis del mes mucho más rápido que Linux.

## Fuentes (consultadas el 7 de noviembre de 2026)

- Tamaños de capturas: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Subir compilaciones (versiones de Xcode aceptadas, altool, Transporter): https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- Versiones de Xcode y macOS necesarias: https://developer.apple.com/xcode/system-requirements/
- Llaves de la API de App Store Connect: https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api
- Crear la app: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- Probadores internos de TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- Privacidad de la app: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Reglas de revisión (2.1 cuenta de prueba, 3.1.3(e), 4.2, 5.1.1(v)): https://developer.apple.com/app-store/review/guidelines/
- Eliminación de cuenta dentro de la app: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Firma en la nube con llave API (requiere rol Admin; reporte en los foros de Apple): https://developer.apple.com/forums/thread/690676
- Mac de GitHub (`macos-latest` = macOS 26): https://github.com/actions/runner-images
