# App Store: Marea en iPhone y iPad

Guía paso a paso para publicar Marea en la App Store **sin Mac**: Codemagic compila y sube la app a TestFlight
([codemagic.md](codemagic.md)) y todo lo demás se hace desde el navegador en **App Store Connect**
(https://appstoreconnect.apple.com). Resumen general y lista de pendientes: [publicar-app.md](publicar-app.md).

---

## Antes de empezar

1. **Membresía activa.** https://developer.apple.com/account → **Membresía**: debe estar vigente (se paga cada año).
2. **Acuerdos.** En App Store Connect, si aparece un aviso de acuerdos o términos nuevos, acéptalos (también en
   **Negocios**). Sin eso Apple no acepta compilaciones. Como Marea es gratis y no vende nada dentro de la app, no
   necesitas el acuerdo de apps de pago ni datos bancarios.
3. **Tu nombre será el vendedor.** Tu cuenta de Apple Developer es **personal**, así que en la App Store, debajo
   de "Marea", aparecerá **tu nombre legal** como vendedor (no "Marea" ni el nombre del estudio). Así funciona
   para todas las cuentas individuales; para mostrar el nombre de una empresa hace falta una cuenta de
   organización (persona moral con número D-U-N-S).
   - La regla **5.2.1** pide que la app la publique quien es dueño de la marca o tiene permiso para usarla.
     Es un motivo común de rechazo cuando una app de un negocio sale desde una cuenta personal. Ten listo un
     documento que muestre que eres dueño o representante del estudio Marea, por ejemplo tu constancia de
     situación fiscal con la actividad del estudio, el contrato del local a tu nombre o, si el estudio es de
     otra persona, una carta firmada en la que te autoriza a publicar la app con el nombre Marea.
     Si Apple lo pide, adjúntalo al responder en App Store Connect. Las notas al revisor (paso 9) ya lo explican.
4. **La lista de pendientes** de [publicar-app.md](publicar-app.md#lista-de-pendientes-antes-de-enviar-a-revisión):
   páginas públicas, migración 0008 aplicada por el desarrollador y las dos cuentas de prueba.

---

## 1. Registrar el Bundle ID

Es el identificador de la app en tu cuenta de Apple. Codemagic también lo registra solo en la primera
compilación, pero hacerlo a mano antes te deja crear la app en el paso 2 sin esperar.

1. https://developer.apple.com/account → **Certificates, IDs & Profiles → Identifiers → +**.
2. **App IDs** → **App** → **Continue**.
3. *Description*: `Marea`. *Bundle ID*: **Explicit** → `mx.marea.app`.
4. No marques capacidades extra → **Continue → Register**.

Si dice que ya existe, perfecto: sigue al paso 2.

## 2. Crear la app en App Store Connect

**Apps → + → Nueva app**:

- Plataforma: **iOS**.
- Nombre: **Marea**. Tiene que ser único en toda la App Store; si ya está ocupado usa, por ejemplo,
  "Marea Yoga" o "Marea Estudio". Debajo del ícono en el teléfono seguirá diciendo "Marea".
- Idioma principal: **Español (México)**.
- ID del paquete (Bundle ID): **mx.marea.app**.
- SKU: `marea-ios`. Acceso de usuarios: **Acceso completo**.

## 3. Compilar y subir a TestFlight

1. En Codemagic lanza el flujo **Marea - iPhone/iPad (TestFlight)** con la versión `1.0.0`
   ([codemagic.md, "Lanzar una compilación"](codemagic.md#lanzar-una-compilación)). Tarda de 15 a 25 minutos.
2. Al terminar, la compilación aparece en App Store Connect → **Marea → TestFlight** como *Procesando*
   (de 5 a 30 minutos; Apple te manda un correo cuando está lista).
3. **Cumplimiento de exportación**: ya está resuelto en el proyecto (la app no usa cifrado propio), así que no
   debería preguntarte nada.

## 4. Probar en tu iPhone con TestFlight

1. **TestFlight → Pruebas internas → +** → crea un grupo (p. ej. "Equipo") y agrégate (y a quien quieras de tu
   equipo de App Store Connect, hasta 100 personas).
2. Agrega la compilación al grupo (o activa la distribución automática del grupo).
3. En tu iPhone instala **TestFlight** desde la App Store → acepta la invitación → instala Marea.
4. Revisa con una cuenta de prueba (modo real, no el demo):
   - Iniciar sesión, reservar y cancelar una clase.
   - El aviso de recordatorios al reservar y la notificación del sistema (acéptala). En **Perfil →
     Recordatorios de clases** debe decir «Activados».
   - **Perfil**: código QR, enlace al aviso de privacidad y **Eliminar mi cuenta** (pruébalo con una cuenta
     que no vayas a darle al revisor).
   - Un enlace `marea://alumno/reservas` (escríbelo en Notas y tócalo): debe abrir Marea en *Mis reservas*.
5. Cada compilación de TestFlight dura 90 días.

## 5. Capturas de pantalla

Para Marea basta con dos tamaños; App Store Connect reduce las capturas para las pantallas más chicas:

| Casilla en App Store Connect | Tamaño (vertical) | Cómo sacarlas |
|---|---|---|
| **iPhone 6.9"** | 1320 × 2868 (también acepta 1290 × 2796) | Con un iPhone Pro Max (16 o 17; el 15 Pro Max da 1290 × 2796): botón lateral + subir volumen |
| **iPad 13"** (obligatoria porque la app funciona en iPad) | 2064 × 2752 (también acepta 2048 × 2732) | Con un iPad Pro o iPad Air de 13" |

- De 3 a 5 capturas por tamaño (máximo 10): horario, reservar una clase, mis reservas, paquetes y el código QR.
  PNG o JPG, **sin transparencias**. Las capturas deben mostrar la app en uso (no solo la pantalla de acceso).
- **Si tu iPhone no es Pro Max** (p. ej. iPhone 15, 16 o 17), sus capturas sirven para la casilla
  **iPhone 6.3"** (1179 × 2556 o 1206 × 2622), que es la obligatoria; súbelas ahí.
- **Sin el aparato a la mano**: la interfaz de la app es la misma que la de la web. En Chrome abre
  https://marea-navy.vercel.app e inicia sesión con la cuenta de prueba → menú **⋮ → Más herramientas →
  Herramientas para desarrolladores** → ícono de teléfono (*Toggle device toolbar*). En la barra que aparece
  arriba de la página elige **Responsive**, abre su menú **⋮ → Add device pixel ratio** y escribe:
  - iPhone 6.9": **440 × 956**, *DPR* **3** → sale de 1320 × 2868.
  - iPad 13": **1032 × 1376**, *DPR* **2** → sale de 2064 × 2752.

  Luego, en ese mismo menú **⋮ → Capture screenshot**. La imagen no incluye las barras del navegador.

## 6. Ficha de la App Store

App Store Connect → Marea:

- **Información de la app**: subtítulo (hasta 30 caracteres, p. ej. "Reserva tus clases de yoga"),
  categoría principal **Salud y forma física**, secundaria **Estilo de vida**.
- **URL de la política de privacidad**: `https://marea-navy.vercel.app/privacidad`.
- **Precio y disponibilidad**: **Gratis**; países: México (y los que quieras).
- **Versión 1.0.0 (Preparar para envío)**:
  - Capturas de iPhone y de iPad (paso 5).
  - **Descripción**: qué es el estudio, qué puede hacer el alumno (ver el horario, reservar y cancelar, lista de
    espera, reservar para un amigo, ver su paquete y créditos, código QR para el check-in, recordatorio 1 hora
    antes de cada clase) y que **los paquetes se pagan en el estudio**. No anuncies funciones que todavía no
    existen (pago en línea).
  - **Palabras clave** (hasta 100 caracteres, separadas por comas): `yoga,clases,reservas,estudio,meditación,pilates,horario`.
  - **URL de soporte** (obligatoria): `https://marea-navy.vercel.app/soporte`.
  - **Copyright**: `2026 [tu nombre legal]`.
  - **Compilación**: botón **+** → elige la que subió Codemagic.

## 7. Clasificación por edad

App Store Connect → Marea → **Información de la app → Clasificación por edad → Editar**. Respuestas para Marea:

| Pregunta | Respuesta |
|---|---|
| Controles parentales / Verificación de edad | No |
| Acceso web sin restricciones | No (la app no tiene navegador propio) |
| Contenido generado por los usuarios / Redes sociales / Mensajes o chat | No |
| Publicidad | No |
| Temas médicos o de tratamiento | No |
| **Temas de salud o bienestar** (recomendaciones de ejercicio o estilo de vida) | **Sí**: es una app de yoga y las descripciones de las clases hablan de ejercicio |
| Violencia, sexo, lenguaje, drogas, apuestas, terror, etc. | No |

Resultado esperado: **9+**. Es correcto para una app de yoga; responder "No" a salud o bienestar y que el revisor
opine otra cosa cuesta una ronda de revisión.

## 8. Privacidad de la app (App Privacy)

App Store Connect → Marea → **Privacidad de la app** → **Comenzar**. Responde "Sí, recopilamos datos" y marca
esto (es lo mismo que dice el aviso de privacidad y lo que declaras en Google Play):

| Tipo de dato | Qué es en Marea | Para qué (finalidades) |
|---|---|---|
| Información de contacto → **Nombre** | Nombre del alumno (y del invitado, si reserva para alguien) | Funcionalidad de la app; Publicidad o marketing del desarrollador |
| Información de contacto → **Correo electrónico** | Correo de la cuenta | Funcionalidad de la app; Publicidad o marketing del desarrollador |
| Información de contacto → **Número de teléfono** | Opcional | Funcionalidad de la app; Publicidad o marketing del desarrollador |
| Salud y forma física → **Salud** | Solo si el estudio anota una lesión o condición que el alumno comparte | Funcionalidad de la app |
| Compras → **Historial de compras** | Paquetes, montos, forma y estado del pago | Funcionalidad de la app; Analíticas |
| Información financiera → **Otra información financiera** | Solo del personal: precio por alumno, lo ganado y los pagos que le hace el estudio | Funcionalidad de la app |
| Identificadores → **ID de usuario** | Identificador de la cuenta | Funcionalidad de la app |
| Otros datos → **Otros tipos de datos** | Reservaciones, asistencias, lugar en el salón y cumpleaños (opcional) | Funcionalidad de la app; Analíticas |

Para cada uno: **vinculado a la identidad: Sí**; **se usa para rastreo (tracking): No**. Al final, **Publicar**.

- "Publicidad o marketing del desarrollador" va porque el aviso de privacidad dice que el estudio puede mandarte
  novedades, promociones y felicitaciones de cumpleaños. "Analíticas" va por las estadísticas internas. Si un día
  se quitan esas finalidades del aviso, quítalas aquí también.
- No marques ubicación, contactos, fotos, diagnósticos ni identificadores de publicidad: la app no los usa.

## 9. Información para la revisión

App Store Connect → Marea → versión 1.0.0 → **Información para la revisión de la app**:

- Marca **Se requiere inicio de sesión** y escribe el correo y la contraseña de la **cuenta de prueba 1**.
- Tus datos de contacto (nombre, teléfono, correo).
- **Notas**: copia el texto de abajo (los revisores leen inglés). Rellena lo que está entre corchetes y **borra
  cualquier frase que no coincida con lo que viste en TestFlight** (paso 4).

```text
Marea is the booking app of [studio name], a yoga studio in [city], Mexico. All classes take place in person at the studio. The app is published by [your legal name], [owner / authorized representative] of the studio.

Demo accounts (students with an active class package):
  Account 1: [email] / [password]
  Account 2 (spare; feel free to delete it to test account deletion): [email] / [password]

Payments (Guideline 3.1.3(e)): students reserve class packages for in-person classes that are consumed at the physical studio, outside the app. The app sells no digital content and has no in-app payments: packages are paid at the studio's front desk.

Account deletion (Guideline 5.1.1(v)): Perfil (Profile) > Eliminar mi cuenta (Delete my account), then type ELIMINAR to confirm. Teachers have the same option in Perfil, and administrators in Menú (Menu) > Mi cuenta (My account). The privacy policy and the support page are linked on the sign-up screen and in the profile.

Native features (Guideline 4.2): the interface is bundled in the app, not loaded from a website. The app schedules local notifications that remind students of each booked class 1 hour before it starts (it asks for notification permission after the first booking), gives haptic feedback when a booking is confirmed, shows a QR check-in code for the front desk, opens specific screens through the marea:// URL scheme and refreshes the data when it returns to the foreground.

The app is in Spanish. "Ver demo con datos de ejemplo" on the sign-in screen opens a demo with sample data stored only on this device.
```

## 10. Enviar a revisión

1. Revisa que no falte nada (App Store Connect marca en rojo lo pendiente).
2. **Agregar para revisión → Enviar a la revisión de apps**. Suele tardar uno o dos días.
3. Si Apple pide cambios o documentos (por ejemplo, la prueba de que eres dueño de la marca, ver
   [Antes de empezar](#antes-de-empezar)), el mensaje llega a App Store Connect; contesta ahí mismo.
4. Cuando la aprueben, publícala (o deja que se publique sola si elegiste esa opción).

## Versiones siguientes

1. Lanza **ios-testflight** en Codemagic con una versión mayor (`1.0.1`, `1.1.0`…). El número de compilación sube solo.
2. En App Store Connect → **+ Versión** con el mismo número, elige la compilación nueva, escribe "Novedades" y envía.
3. Antes de cada envío, revisa que las dos cuentas de prueba sigan existiendo y tengan créditos.

> **Opcional: compilar en una Mac.** No hace falta, pero si algún día quieres usar Xcode (26 o más reciente):
> `npm ci && npm run cap:ios` abre el proyecto. Al distribuir deja marcada la opción de administrar la versión y el
> número de compilación; Codemagic después usa un número mayor al de TestFlight, así que las dos vías conviven.

## Fuentes (consultadas el 7 de noviembre de 2026)

- Vendedor = nombre legal en cuentas individuales; nombre de la organización con D-U-N-S: https://developer.apple.com/programs/enroll/
- Reglas de revisión (2.1 cuenta de prueba, 3.1.3(e), 4.2, 5.1.1(v), 5.2.1): https://developer.apple.com/app-store/review/guidelines/
- Tamaños y casillas obligatorias de capturas: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Clasificación por edad ("Health or Wellness Topics" → 9+): https://developer.apple.com/help/app-store-connect/reference/age-ratings
- Xcode 26 obligatorio desde el 28 de abril de 2026: https://developer.apple.com/news/upcoming-requirements/
- Crear la app: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- Probadores internos de TestFlight: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- Privacidad de la app: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Eliminación de cuenta dentro de la app: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Publicar en App Store Connect desde Codemagic: https://docs.codemagic.io/yaml-publishing/app-store-connect/
