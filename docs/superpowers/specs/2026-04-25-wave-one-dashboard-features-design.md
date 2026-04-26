# Wave One Dashboard — Feature Batch Design
**Date:** 2026-04-25
**Status:** Approved

## Overview

9 features implemented as a single batch. Approach: frontend-driven para la mayoría, API route para el auto-registro de deudas (requiere atomicidad).

---

## 1. Modelo de Datos

### TransaccionEstado
Agregar `"reembolsado"` al tipo existente en `types/database.ts` y al enum de Supabase.

### calcularDeudas
Eliminar el filtro `.filter(c => c.estado !== "inactivo")`. Los corredores inactivos generan deuda solo hasta `fecha_salida` (o hasta hoy si no tienen fecha_salida).

### Sin tablas nuevas
Todas las features usan el esquema existente.

---

## 2. Features

### 2.1 Filtros en /corredores
- Extender `useCorredores(options)` con `estado: CorredorEstado | undefined`, `entrenadorId: string | undefined`, `planId: string | undefined`.
- UI: fila de 4 controles encima de la tabla — búsqueda por nombre (existente), dropdown estado, dropdown entrenador, dropdown plan.
- Los filtros se aplican en la query de Supabase (server-side), no en el cliente.

### 2.2 Meses de pausa
- La tabla `Pausa` ya existe con `corredor_id`, `mes`, `año`, `tarifa_mantenimiento`.
- Agregar sección "Meses de pausa" en `FormCorredor`: lista de pausas existentes + botón para añadir mes/año/tarifa opcional + botón para eliminar.
- Hook `usePausas(corredorId)` para fetch/insert/delete de pausas.
- `calcularDeudas` ya debe recibir pausas y marcar esos meses como no-deuda.

### 2.3 Registro automático de deudas de inactivos
- Nueva API route: `POST /api/corredores/[id]/desactivar`
- Operación: en una sola llamada, actualiza `estado = "inactivo"` + `fecha_salida = hoy` y calcula todos los meses sin pago desde `fecha_ingreso` hasta hoy → inserta transacciones con `estado: "pendiente"`, `tipo: "ingreso"`, `categoria: "membresia"`, `metodo: "transferencia"`.
- Evita duplicados con `upsert` usando una constraint única por `corredor_id + fecha` (mes).
- `FormCorredor` detecta cuando el nuevo estado es `inactivo` y llama esta ruta en lugar del update directo.

### 2.4 Sidebar colapsable
- Estado `collapsed: boolean` en `Layout` (localStorage para persistencia).
- Expandido: `w-64`, muestra icono + label.
- Colapsado: `w-16`, muestra solo icono + tooltip al hover.
- Botón toggle en la parte inferior del sidebar.
- Animación con `transition-all duration-200`.

### 2.5 Versión móvil
- En `< md` (< 768px): sidebar se convierte en drawer lateral controlado por estado `mobileOpen`.
- `TopBar` muestra botón hamburguesa en móvil.
- Overlay oscuro al abrir el drawer.
- Tablas: `overflow-x-auto` con scroll horizontal.
- Formularios: `grid-cols-1` en móvil, `grid-cols-2` en desktop.
- Cards del dashboard: `grid-cols-2` en móvil.

### 2.6 Reembolsos
**Automático:**
- Stripe: capturar evento `charge.refunded` en `/api/webhooks/stripe` → buscar transacción por `stripe_payment_id` → actualizar `estado = "reembolsado"`.
- PayPal: capturar evento `PAYMENT.SALE.REVERSED` en `/api/webhooks/paypal` → buscar por `paypal_order_id` → actualizar `estado = "reembolsado"`.

**Manual:**
- En `TablaTransacciones`, las filas con `estado = "pagado"` muestran botón "Reembolsar".
- Confirmar con dialog antes de actualizar.
- El estado pasa a `"reembolsado"` con update directo en Supabase.

### 2.7 Pantalla de coaches
- Nueva página `/coaches`.
- Acceso: `admin` ve todos los entrenadores; `entrenador` es redirigido a `/coaches/[su_id]`.
- Vista lista (admin): tabla con nombre, email, nº corredores activos, ingresos del mes.
- Vista detalle `/coaches/[id]`: card de perfil + métricas + tabla de corredores asignados + historial de cambios recientes de esos corredores.
- Datos: join `users (rol=entrenador)` + `corredores` + `transacciones` + `historial_corredores`.
- Hook `useCoach(id)` para la vista detalle.
- Middleware: entrenador solo puede acceder a `/coaches/[su_propio_id]`.

### 2.8 Rename a Wave One
- Reemplazar "RunTeam Pro" en: `pages/login.tsx`, `pages/signup.tsx`, todos los `<Head><title>`, brand en `Sidebar`.
- Sin cambios a rutas, DB ni variables de entorno.

### 2.9 UI/UX
- Invocar skill `ui-ux-pro-max` al finalizar la implementación de los ítems 1–8.
- Pase de mejoras visuales sobre todo lo construido.

---

## 3. Orden de implementación

1. Rename (Wave One) — sin dependencias, 5 min
2. Data model (`reembolsado`, `calcularDeudas`)
3. Filtros /corredores
4. Meses de pausa
5. Sidebar colapsable
6. Versión móvil
7. Deudas de inactivos (API route)
8. Reembolsos (webhooks + manual)
9. Coaches page
10. UI/UX pass (ui-ux-pro-max)

---

## 4. Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `types/database.ts` | Agregar `"reembolsado"` a TransaccionEstado |
| `lib/deudas.ts` | Incluir inactivos, recibir pausas |
| `hooks/useCorredores.ts` | Agregar filtros estado/entrenador/plan |
| `hooks/usePausas.ts` | Nuevo hook |
| `hooks/useCoach.ts` | Nuevo hook |
| `components/layout/Sidebar.tsx` | Colapsable + mobile drawer |
| `components/layout/Layout.tsx` | Estado collapsed + mobileOpen |
| `components/layout/TopBar.tsx` | Botón hamburguesa móvil |
| `components/corredores/FormCorredor.tsx` | Pausas + lógica desactivar |
| `components/finanzas/TablaTransacciones.tsx` | Botón reembolsar manual |
| `pages/api/corredores/[id]/desactivar.ts` | Nueva API route |
| `pages/api/webhooks/stripe.ts` | Evento `charge.refunded` |
| `pages/api/webhooks/paypal.ts` | Evento `PAYMENT.SALE.REVERSED` |
| `pages/corredores/index.tsx` | UI filtros |
| `pages/coaches/index.tsx` | Nueva página |
| `pages/coaches/[id].tsx` | Nueva página detalle |
| `pages/login.tsx` | Rename Wave One |
| `pages/signup.tsx` | Rename Wave One |
| `middleware.ts` | Proteger `/coaches/[id]` por rol |
