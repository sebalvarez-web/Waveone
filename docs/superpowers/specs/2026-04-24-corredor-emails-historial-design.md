# Diseño: Emails múltiples e historial de corredor

**Fecha:** 2026-04-24  
**Proyecto:** wave-one-dashboard  
**Estado:** Aprobado

---

## Alcance

Dos features nuevas para el módulo de corredores:

1. **Emails múltiples por corredor** — cada corredor puede tener N emails adicionales con etiqueta libre
2. **Historial de corredor** — timeline de cambios de plan, cambios de estado, pausas y notas manuales

---

## Base de datos

### Tabla `corredor_emails`

```sql
CREATE TABLE public.corredor_emails (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corredor_id    uuid NOT NULL REFERENCES public.corredores(id) ON DELETE CASCADE,
  email          text NOT NULL,
  etiqueta       text,  -- ej. "trabajo", "mamá", "facturación"
  es_principal   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

- El campo `email` en la tabla `corredores` se conserva sin cambios (es el email principal usado por Stripe/PayPal).
- `corredor_emails` almacena únicamente emails adicionales.
- `es_principal` es reservado para uso futuro (actualmente siempre `false` en esta tabla).

### Tabla `corredor_historial`

```sql
CREATE TYPE historial_tipo AS ENUM ('cambio_plan', 'cambio_estado', 'pausa', 'nota');

CREATE TABLE public.corredor_historial (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corredor_id        uuid NOT NULL REFERENCES public.corredores(id) ON DELETE CASCADE,
  fecha              timestamptz NOT NULL DEFAULT now(),
  tipo               historial_tipo NOT NULL,
  plan_id_anterior   uuid REFERENCES public.planes(id) ON DELETE SET NULL,
  plan_id_nuevo      uuid REFERENCES public.planes(id) ON DELETE SET NULL,
  estado_anterior    corredor_estado,
  estado_nuevo       corredor_estado,
  nota               text,
  creado_por         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

### Trigger Postgres — auto-snapshot

Se dispara en `UPDATE` sobre `corredores`. Si cambia `plan_id` inserta una fila `cambio_plan`. Si cambia `estado` inserta una fila `cambio_estado`. Ambos pueden ocurrir en el mismo UPDATE (se insertan dos filas).

```sql
CREATE OR REPLACE FUNCTION public.handle_corredor_historial()
RETURNS trigger AS $$
BEGIN
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
    INSERT INTO public.corredor_historial
      (corredor_id, tipo, plan_id_anterior, plan_id_nuevo)
    VALUES
      (NEW.id, 'cambio_plan', OLD.plan_id, NEW.plan_id);
  END IF;

  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.corredor_historial
      (corredor_id, tipo, estado_anterior, estado_nuevo)
    VALUES
      (NEW.id, 'cambio_estado', OLD.estado, NEW.estado);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_corredor_updated
  AFTER UPDATE ON public.corredores
  FOR EACH ROW EXECUTE PROCEDURE public.handle_corredor_historial();
```

Los registros de la tabla `pausas` existente se muestran en el historial como filas de tipo `pausa` mediante JOIN en el hook — no se duplican en `corredor_historial`.

---

## Tipos TypeScript

```typescript
export interface CorredorEmail {
  id: string;
  corredor_id: string;
  email: string;
  etiqueta: string | null;
  es_principal: boolean;
  created_at: string;
}

export type HistorialTipo = 'cambio_plan' | 'cambio_estado' | 'pausa' | 'nota';

export interface HistorialEntry {
  id: string;
  corredor_id: string;
  fecha: string;
  tipo: HistorialTipo;
  plan_id_anterior: string | null;
  plan_id_nuevo: string | null;
  estado_anterior: CorredorEstado | null;
  estado_nuevo: CorredorEstado | null;
  nota: string | null;
  creado_por: string | null;
  // joins
  plan_anterior?: Pick<Plan, 'id' | 'nombre'>;
  plan_nuevo?: Pick<Plan, 'id' | 'nombre'>;
  creado_por_user?: Pick<User, 'id' | 'nombre'>;
}
```

---

## Hook: `useHistorialCorredor`

Archivo: `hooks/useHistorialCorredor.ts`

- Query a `corredor_historial` con JOIN a `planes` (x2) y `users`
- Query paralela a `pausas` para el corredor
- Combina y ordena todo por `fecha` desc
- Retorna `{ historial: HistorialEntry[], loading, error }`

---

## Cambios en FormCorredor

- Nueva sección "Correos adicionales" al final del formulario (antes de los botones)
- Estado local: `emailsAdicionales: { email: string; etiqueta: string }[]`
- Botón "+ Agregar correo" agrega fila vacía al array
- Cada fila: input email + input etiqueta + botón eliminar (ícono `delete`)
- Al guardar (handleSubmit):
  1. Update/insert corredor (lógica existente)
  2. Delete `corredor_emails` donde `corredor_id = id` (al editar)
  3. Insert nuevos registros en `corredor_emails`
- Al cargar (modo edición): fetch de `corredor_emails` por `corredor_id` para pre-poblar

---

## Cambios en `/corredores/[id]`

### Tarjeta de datos (columna izquierda)

- Sección "CORREOS" muestra:
  - Email principal (de `corredor.email`) con badge "Principal"
  - Lista de emails adicionales con su etiqueta

### Nueva sección "Historial" (columna derecha, debajo de Calendario de Pagos)

- Timeline vertical con íconos por tipo:
  - `cambio_plan` → ícono `swap_horiz`
  - `cambio_estado` → ícono `person`
  - `pausa` → ícono `pause_circle`
  - `nota` → ícono `notes`
- Cada entrada muestra fecha, tipo y descripción legible
- Botón "Registrar evento" (arriba derecha de la sección) abre `ModalNotaHistorial`

### Nuevo componente `ModalNotaHistorial`

Archivo: `components/corredores/ModalNotaHistorial.tsx`

- Campos: fecha (default hoy), nota (textarea requerida)
- Al guardar: insert en `corredor_historial` con `tipo = 'nota'`, `creado_por = user.id`

---

## Archivos a crear / modificar

| Acción | Archivo |
|--------|---------|
| Crear | `supabase/migrations/003_emails_historial.sql` |
| Crear | `hooks/useHistorialCorredor.ts` |
| Crear | `components/corredores/ModalNotaHistorial.tsx` |
| Modificar | `types/database.ts` — agregar `CorredorEmail`, `HistorialTipo`, `HistorialEntry` |
| Modificar | `components/corredores/FormCorredor.tsx` — sección emails adicionales |
| Modificar | `pages/corredores/[id].tsx` — sección emails + sección historial |

---

## Restricciones y casos límite

- Email adicional sin etiqueta es válido (campo opcional)
- Al eliminar un corredor, `corredor_emails` y `corredor_historial` se borran en cascada
- El trigger no registra el insert inicial (solo updates), por lo que el "Alta" se muestra como el primer registro de `corredor_historial` con tipo `nota` creado manualmente, o se infiere de `fecha_ingreso`
- RLS: mismas políticas que `corredores` (solo admin puede insertar/actualizar/borrar; entrenador solo lee sus corredores)
