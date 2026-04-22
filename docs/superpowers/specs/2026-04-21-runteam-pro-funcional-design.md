# RunTeam Pro — Diseño Funcional

**Fecha:** 2026-04-21  
**Estado:** Aprobado  
**Stack:** Next.js 14 Pages Router + TypeScript + Supabase + Stripe + PayPal + Tailwind CSS + Vercel

---

## Contexto

RunTeam Pro es un dashboard administrativo para equipos de running. Actualmente existe como 4 páginas HTML estáticas. Este spec cubre la migración a una aplicación funcional con base de datos real, autenticación multi-usuario, y cobros automáticos via Stripe y PayPal.

---

## Arquitectura

```
Browser (React / Next.js Pages Router)
    ↕ Supabase JS Client  — auth + queries de DB
    ↕ Next.js API Routes  — webhooks y lógica sensible

Supabase (PostgreSQL + Auth + Row Level Security)
Next.js API Routes
    /api/webhooks/stripe   — recibe eventos de Stripe
    /api/webhooks/paypal   — recibe eventos de PayPal
    /api/pagos/sin-asignar — pagos que no matchearon corredor

Vercel — hosting gratuito, deploy automático desde GitHub
```

---

## Modelo de datos

### `users`
Manejado por Supabase Auth. Se extiende con una tabla de perfil:

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | mismo ID que auth.users |
| email | text | |
| nombre | text | |
| rol | enum | `admin` \| `entrenador` |
| created_at | timestamptz | |

### `planes`

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| nombre | text | ej. "Performance Élite" |
| precio_mensual | numeric | |
| descripcion | text | |

### `corredores`

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| nombre | text | |
| email | text | |
| telefono_emergencia | text | |
| fecha_ingreso | date | |
| fecha_salida | date | nullable |
| entrenador_id | uuid FK → users | |
| plan_id | uuid FK → planes | |
| estado | enum | `activo` \| `pausado` \| `inactivo` |
| uniforme_entregado | boolean | default false |
| proxima_carrera | text | |
| stripe_customer_id | text | para matching de webhooks |
| stripe_subscription_id | text | para gestionar suscripción activa |
| paypal_payer_id | text | para matching de webhooks |
| paypal_subscription_id | text | para suscripciones recurrentes |
| created_at | timestamptz | |

### `pausas`
Meses de año sabático donde se cobra tarifa reducida.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| corredor_id | uuid FK → corredores | |
| mes | integer | 1–12 |
| año | integer | |
| tarifa_mantenimiento | numeric | default 5.00 |

### `transacciones`

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| tipo | enum | `ingreso` \| `gasto` |
| descripcion | text | |
| monto | numeric | |
| fecha | date | |
| categoria | text | `membresia` \| `equipamiento` \| `instalaciones` \| `marketing` \| `competicion` \| `otro` |
| metodo | enum | `stripe` \| `paypal` \| `transferencia` \| `efectivo` |
| estado | enum | `pagado` \| `pendiente` \| `vencido` |
| corredor_id | uuid FK → corredores | nullable (gastos no tienen corredor) |
| stripe_payment_id | text | único, para deduplicar webhooks |
| paypal_order_id | text | único, para deduplicar webhooks |
| created_at | timestamptz | |

### `pagos_sin_asignar`
Webhooks que llegaron pero no matchearon ningún corredor.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| fuente | enum | `stripe` \| `paypal` |
| payload | jsonb | payload completo del webhook |
| monto | numeric | |
| fecha | date | |
| resuelto | boolean | default false |
| created_at | timestamptz | |

---

## Autenticación

- Proveedor: Supabase Auth (email + contraseña)
- Roles: `admin` y `entrenador`, guardados en tabla `users`
- Middleware Next.js verifica sesión en todas las rutas excepto `/login`
- Sin sesión válida → redirige a `/login`
- Row Level Security en Supabase como segunda capa:
  - `admin` tiene acceso total
  - `entrenador` solo ve corredores donde `entrenador_id = auth.uid()`

---

## Páginas

```
pages/
  login.tsx                   — Supabase Auth (email + contraseña)
  index.tsx                   — Dashboard financiero (index.html)
  corredores/
    index.tsx                 — Lista de corredores (corredores.html)
    [id].tsx                  — Perfil individual (corredor-perfil.html)
  finanzas/
    index.tsx                 — Gestión financiera (finanzas.html)
  api/
    webhooks/
      stripe.ts               — Stripe webhook handler
      paypal.ts               — PayPal webhook handler
    pagos/
      sin-asignar.ts          — Lista pagos no reconciliados
```

---

## Componentes

```
components/
  layout/
    Sidebar.tsx               — nav lateral, muestra badge si hay pagos sin asignar
    TopBar.tsx                — barra superior con búsqueda y perfil de usuario
    Layout.tsx                — wrapper que incluye Sidebar + TopBar
  corredores/
    TablaCorredores.tsx       — tabla con datos reales de Supabase
    FormCorredor.tsx          — modal crear/editar corredor, vincula Stripe/PayPal
  finanzas/
    TablaTransacciones.tsx    — tabla paginada de transacciones
    FormPagoManual.tsx        — registrar pago por transferencia/efectivo
    FormGasto.tsx             — registrar gasto operativo
    TarjetaMetrica.tsx        — card reutilizable de KPI
  pagos/
    PagosSinAsignar.tsx       — lista de webhooks no reconciliados + acción asignar
```

---

## Integración Stripe

**Crear suscripción:**
1. Admin asigna plan a corredor en `FormCorredor`
2. Si corredor no tiene `stripe_customer_id`: se crea customer en Stripe con su email
3. Se crea Subscription en Stripe con el `price_id` del plan
4. Se guarda `stripe_customer_id` y `stripe_subscription_id` en la tabla `corredores`

**Webhooks (`/api/webhooks/stripe`):**
- `invoice.payment_succeeded` → busca corredor por `stripe_customer_id` → inserta transacción como `pagado`
- `invoice.payment_failed` → inserta transacción como `vencido`
- Si no hay corredor con ese `stripe_customer_id` → guarda en `pagos_sin_asignar`
- Verificación de firma con `STRIPE_WEBHOOK_SECRET` para seguridad
- Idempotencia: `stripe_payment_id` es `UNIQUE` en `transacciones`

---

## Integración PayPal

**Crear suscripción:**
1. Admin asigna plan → se crea Subscription en PayPal
2. Se guarda `paypal_payer_id` y `paypal_subscription_id` en `corredores`

**Webhooks (`/api/webhooks/paypal`):**
- `PAYMENT.SALE.COMPLETED` → busca por `paypal_payer_id` o `paypal_subscription_id` → inserta transacción
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED` → inserta como `vencido`
- Sin match → guarda en `pagos_sin_asignar`
- Verificación de firma con certificado PayPal
- Idempotencia: `paypal_order_id` es `UNIQUE` en `transacciones`

**Pagos manuales:**
- Admin llena `FormPagoManual` → inserta directo en `transacciones` sin pasar por APIs

---

## Pagos sin asignar

- El `Sidebar` muestra badge con conteo de `pagos_sin_asignar` donde `resuelto = false`
- Admin entra a la vista, ve los pagos pendientes y selecciona el corredor correspondiente
- Al asignar: se mueve a `transacciones`, se actualiza `stripe_customer_id` / `paypal_payer_id` en `corredores`, se marca `resuelto = true`

---

## Manejo de errores

| Caso | Comportamiento |
|------|---------------|
| Webhook duplicado | `UNIQUE` constraint en `stripe_payment_id` / `paypal_order_id` rechaza el insert silenciosamente |
| Webhook sin corredor | Guarda en `pagos_sin_asignar`, no lanza error |
| Error de red en UI | Toast de error, formulario no se resetea |
| Sesión expirada | Middleware redirige a `/login` |
| Campo inválido en formulario | Error inline bajo el campo |
| Fallo al crear customer en Stripe/PayPal | Error inline en `FormCorredor`, no guarda el corredor |

---

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo en API routes

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
```

---

## Hosting

- Vercel (free tier) conectado a GitHub
- Deploy automático en cada push a `main`
- Variables de entorno configuradas en Vercel dashboard
- Webhook URLs en Stripe/PayPal apuntan al dominio de Vercel
