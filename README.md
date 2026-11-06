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

Abre http://localhost:3000 y elige un perfil (modo demo).

## Modo demo y siguiente paso

Hoy los datos viven en el navegador (`localStorage`) con datos de ejemplo. En **Admin → Configuración** puedes restablecerlos.
Toda la lógica está separada:

- `src/lib/types.ts` — modelo de datos
- `src/lib/rules.ts` — reglas de negocio (créditos, límites, cancelación, lista de espera)
- `src/lib/store.ts` — acciones (cada una equivale a un endpoint)
- `supabase/schema.sql` — esquema de base de datos propuesto para producción

Para producción, solo hay que reemplazar las acciones del store por llamadas al backend (Supabase), agregar login real y la pasarela de pago (Stripe / Mercado Pago).
