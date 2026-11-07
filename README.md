# Yoga — app de reservas para un estudio

App web adaptable para **celular, iPad y escritorio** (instalable como PWA) con tres espacios:

- **Alumno**: horario por día, reserva con selección de lugar, lista de espera, reservar para un amigo, compra de paquetes con cupón (pago en línea simulado o en recepción), historial y código QR de check-in.
- **Profesor**: sus clases por día, pase de lista (asistió / no asistió), check-in por código, agregar alumnos, mapa del salón.
- **Administrador**: dashboard, calendario semanal y horario recurrente, alumnos (CRM y venta de paquetes), ventas y pagos pendientes, profesores, disciplinas y salones, planes y precios, cupones y configuración del estudio (marca y políticas de reserva).

El análisis de las apps de referencia está en [`docs/analisis-competencia.md`](docs/analisis-competencia.md).

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Base de datos (Supabase)

La app está conectada al proyecto Supabase **Marea** (organización "yoga y pilates"):

- **Login real** con correo y contraseña (confirmación por correo). Al registrarse, cada persona entra como alumno.
- **Administradores:** quien se registre y confirme su correo con uno de los correos de *Admin → Configuración → Administradores* entra como admin.
- **Profesores:** el admin los da de alta en *Admin → Profesores*; cuando la persona se registra con ese mismo correo, su cuenta queda ligada al perfil de profesor.
- **Seguridad:** las reglas (créditos, límites, cancelaciones, lista de espera, pagos) se aplican en funciones de la base; las políticas RLS impiden que un alumno vea datos de otros o se dé créditos.
- **Pagos:** todavía no hay pasarela; lo que compra un alumno queda *pendiente* hasta que recepción confirma el pago en *Admin → Ventas*.

Migraciones en `supabase/migrations/` (0001–0007 ya aplicadas al proyecto; **0008, eliminar la cuenta, la aplica el desarrollador** antes de enviar las apps a revisión).

## App de iOS y Android (Capacitor)

La interfaz va **empaquetada** dentro de la app (export estático de Next en `out/`, sin `server.url`):

```bash
npm run build:app     # export estático → out/ (la web en Vercel sigue usando `npm run build`)
npm run cap:sync      # build:app + copia a ios/ y android/
npm run typecheck     # genera los tipos de rutas y corre tsc
```

**Las compilaciones de las tiendas se hacen solo en Codemagic** (`codemagic.yaml`; no hace falta Mac):
`android-generar-llave` (una sola vez), `android-play` (`.aab` firmado para Google Play) e `ios-testflight`
(compila y sube a TestFlight). Los números internos de versión se calculan solos y siempre crecen. Las llaves
viven en Codemagic, nunca en el repositorio. Opcional: `npm run cap:ios` / `npm run cap:android` abren Xcode
(en una Mac) o Android Studio para probar en local.

Funciones nativas en `src/lib/native.ts` y `src/components/native-bridge.tsx` (enlaces `marea://`, recordatorios
1 h antes de cada clase reservada, vibración, botón atrás de Android, pantalla de inicio). Guías para publicar, en
este orden: [`docs/publicar-app.md`](docs/publicar-app.md) (resumen y pendientes),
[`docs/codemagic.md`](docs/codemagic.md), [`docs/google-play.md`](docs/google-play.md) y
[`docs/app-store.md`](docs/app-store.md). Imágenes de la ficha de Google Play: `assets/play-icon-512.png` y
`assets/play-feature-1024x500.png` (`node assets/generar-iconos.mjs --tienda`).

## Modo demo

En la pantalla de acceso, "Ver demo con datos de ejemplo" abre la app con datos ficticios guardados solo en el dispositivo (o el navegador).

## Código

- `src/lib/types.ts` — modelo de datos
- `src/lib/rules.ts` — reglas de negocio (también se usan para mostrar avisos en pantalla)
- `src/lib/live.ts` — lectura y acciones contra Supabase
- `src/lib/store.ts` — estado de la app (modo real o demo)
- `supabase/migrations/` — esquema, seguridad y funciones
