# Análisis de referencia: Boostapp y Fitco

Fecha: 6 nov 2026. Herramientas: [REA](https://github.com/morluto/rea) (`rea inspect-web-page` vía Chrome DevTools Protocol), Playwright y análisis estático del bundle público.

> Objetivo: entender **qué hacen y cómo están organizadas** estas apps para diseñar la nuestra.
> No se copió código, marca, textos ni imágenes; todo lo de este repositorio es implementación propia.

---

## 1. Boostapp (`app.boostapp.com.mx`)

### Tecnología
| Aspecto | Hallazgo |
|---|---|
| Frontend | **Flutter Web** (`main.dart.js` de 3.7 MB, `flutter_service_worker.js`) — la misma base de código sirve iOS, Android y web. |
| Notificaciones | Firebase Cloud Messaging (`firebase-messaging.js` 10.7). |
| Backend | API REST propia en `boostapp.top`, autenticación con **JWT + refresh token** (`/auth/jwt/refresh/`). |
| Pagos | **Stripe** (payment sheet, setup intent, portal de cliente, suscripciones) y **Mercado Pago** (Checkout Bricks y Preference). |
| Modelo | Multi-estudio: un usuario se registra en varios estudios ("+ Agregar estudio", "Buscar mi estudio") y cada estudio tiene sucursales. |

### Mapa de la API (endpoints detectados en el bundle)
```
auth/      jwt/refresh · users/set_password · users/reset_password
members/   login · join · current · session · account-delete
studios/   search · my · branches
schedules/ v1.1/slots            ← horario de clases
rooms/                            ← salones con lugares (seats)
rsvp/      (crear) · update · user · upcoming · waitlist · waitlist/update
plans/     · registration-fees/  · coupons/validate
sales/     · member/pending · freebuy · free-registration
credits/   transactions
stripe/    payment-sheet · checkout-session · setup-intent · cards · payment-methods · portal
payments-mp/ · confirm
notifications/ · devices
```

### Pantallas (32 rutas)
Welcome, Login, Registration, ForgotPassword, ChangePassword, Home, MyStudios, SelectBranch, ConfirmNewStudio,
MemberStudioDetails, **ReservationConfirm**, **ReservationHistory**, WaitlistSuccess, **MembershipStore**,
ConfirmPurchase, Purchases, MembershipHistory, ListCreditsHistory, RegistrationFees, ProfileDetails,
StudioNotifications, AccountDelete, Success, checkouts de Stripe y Mercado Pago.

### Reglas de negocio (nombres de campos del modelo)
- **Créditos y vigencia:** `credits_available`, `no_limit_credits`, `days_duration`, `date_of_expiration`, `does_not_expire`.
- **Límites:** `day_reservations_limit`, `week_reservations_limit`, `max_purchases_per_member`, `max_rsvp_without_payment`.
- **Cancelación:** `hours_to_cancellation`, `morning_hours_to_cancellation`, `morning_cancellation_hour_limit` (política distinta para clases de la mañana).
- **Lugares:** `seats`, `occupied_seats`, `extra_seats`, `extra_spots_qty`, "Selecciona tu lugar".
- **Invitados:** `allow_friend_rsvp` ("+ Reservar para un amigo").
- **Restricción por clase:** `allow_all_classes`, `allowed_classes` (paquetes que solo sirven para ciertas disciplinas).
- **Pago en sucursal:** `allow_member_in_shop_payment`, "Confirmar pago en sucursal", `block_rsvp_on_pending_fee`.
- **No-show:** `no_show_min_count`.
- **Cupones:** `coupon_code`, `coupon_amount`, `discount_amount`.
- **Inscripción:** `registration_fees` (cuota de inscripción, "Matrícula").

## 2. Fitco (`fitcolatam.com/competencia`)

Es la landing comparativa (contra Fitune, ABC EVO, CrossHero, Mindbody). Lista de funcionalidades que promete:

1. Punto de venta · 2. Impresión con tiquetera · 3. Matrícula obligatoria · 4. Disciplinas ilimitadas ·
5. **Calendario de clases** · 6. **Reserva de posiciones** · 7. **Código QR** · 8. **Membresías con créditos** ·
9. Agentes de IA · 10. Emails y notificaciones · 11. **Cupones** · 12. Pixel de Facebook / Google Analytics ·
13. **App y web personalizada (marca propia)** · 14. **Panel de control y accesos** · 15. Chat · 16. Acceso biométrico ·
17. Clases en vivo / grabadas · 18. Inventario · 19. Migración · 20. Dominio propio · 21. **CRM** ·
22. **Tiempo límite de reservas y cancelaciones** · 23. Kit para eventos.

Diferenciadores que vende: usuarios ilimitados, comisión baja, **no-show fee también para clientes de Wellhub/TotalPass**, factura en México, integraciones (Wellhub, Mercado Pago, Stripe, TotalPass, Webpay), multi-sucursal.

---

## 3. Qué tomamos para nuestra app (un solo estudio)

| Funcionalidad | Inspirada en | Estado v0.1 |
|---|---|---|
| Horario por día con filtros por disciplina/profesor | Boostapp `schedules/slots` | ✅ |
| Reserva con **selección de lugar** en mapa del salón | Boostapp `seats` · Fitco #6 | ✅ |
| **Lista de espera** con promoción automática | Boostapp `rsvp/waitlist` | ✅ |
| Paquetes con **créditos + vigencia**, ilimitados, restringidos por disciplina, máx. por alumno | Boostapp `plans` · Fitco #8 | ✅ |
| Límite de reservas por día/semana y ventana de reserva | Boostapp · Fitco #22 | ✅ |
| Cancelación con reembolso hasta X horas antes; cancelación tardía | Boostapp `hours_to_cancellation` | ✅ |
| Reservar para un amigo | Boostapp `allow_friend_rsvp` | ✅ |
| Pago en línea o **pago en recepción** (confirmado por admin) | Boostapp | ✅ (pago simulado) |
| Cupones de descuento | ambos | ✅ |
| **Check-in con código / QR**, pase de lista y no-show | Fitco #7 | ✅ |
| Espacio de **profesor** (sus clases, lista de asistencia) | — | ✅ |
| Panel **admin**: dashboard, calendario, alumnos (CRM básico), ventas/POS, planes, salones, profesores, configuración | Fitco #1, #14, #21 | ✅ |
| Marca propia (nombre, color) | Fitco #13 | ✅ |
| App instalable (PWA) para iPhone/iPad/Android | Fitco #13 | ✅ básica |
| Backend real + login real | Boostapp JWT | ⏳ siguiente paso (ver `supabase/schema.sql`) |
| Pagos reales (Stripe / Mercado Pago) | ambos | ⏳ |
| Notificaciones push / email / WhatsApp | ambos | ⏳ |
| Política de cancelación distinta para clases de mañana | Boostapp | ⏳ |
| Cuota de inscripción | ambos | ⏳ |
| Integración Wellhub / TotalPass | Fitco | ⏳ |
