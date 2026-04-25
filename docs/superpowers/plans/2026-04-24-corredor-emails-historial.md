# Corredor: Emails Múltiples e Historial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar soporte de emails múltiples con etiqueta libre por corredor y un historial de cambios (plan, estado, pausas, notas manuales) visible en el perfil del corredor.

**Architecture:** Nueva migración SQL crea tablas `corredor_emails` y `corredor_historial` con un trigger Postgres que auto-registra cambios de plan/estado. El frontend extiende `FormCorredor` con gestión de emails adicionales y añade una sección de timeline en `/corredores/[id]`. Un nuevo hook `useHistorialCorredor` combina historial + pausas en un array unificado ordenado por fecha.

**Tech Stack:** Next.js (Pages Router), Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS, React Testing Library, Jest.

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Crear | `supabase/migrations/003_emails_historial.sql` | Tablas, trigger, RLS |
| Modificar | `types/database.ts` | Tipos `CorredorEmail`, `HistorialItem` |
| Crear | `hooks/useHistorialCorredor.ts` | Fetch y merge historial + pausas |
| Crear | `__tests__/hooks/useHistorialCorredor.test.ts` | Tests del hook |
| Crear | `components/corredores/ModalNotaHistorial.tsx` | Modal para notas manuales |
| Crear | `__tests__/components/ModalNotaHistorial.test.tsx` | Tests del modal |
| Modificar | `components/corredores/FormCorredor.tsx` | Sección emails adicionales |
| Modificar | `__tests__/components/FormCorredor.test.tsx` | Tests extendidos |
| Modificar | `pages/corredores/[id].tsx` | Sección emails + sección historial |

---

## Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/003_emails_historial.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/003_emails_historial.sql

-- Tabla de emails adicionales por corredor
create table public.corredor_emails (
  id          uuid primary key default gen_random_uuid(),
  corredor_id uuid not null references public.corredores(id) on delete cascade,
  email       text not null,
  etiqueta    text,
  es_principal boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Enum para tipos de eventos en el historial
create type historial_tipo as enum ('cambio_plan', 'cambio_estado', 'pausa', 'nota');

-- Tabla de historial de cambios del corredor
create table public.corredor_historial (
  id               uuid primary key default gen_random_uuid(),
  corredor_id      uuid not null references public.corredores(id) on delete cascade,
  fecha            timestamptz not null default now(),
  tipo             historial_tipo not null,
  plan_id_anterior uuid references public.planes(id) on delete set null,
  plan_id_nuevo    uuid references public.planes(id) on delete set null,
  estado_anterior  corredor_estado,
  estado_nuevo     corredor_estado,
  nota             text,
  creado_por       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Trigger: auto-registra cambios de plan_id y estado en corredores
create or replace function public.handle_corredor_historial()
returns trigger as $$
begin
  if old.plan_id is distinct from new.plan_id then
    insert into public.corredor_historial
      (corredor_id, tipo, plan_id_anterior, plan_id_nuevo)
    values
      (new.id, 'cambio_plan', old.plan_id, new.plan_id);
  end if;

  if old.estado is distinct from new.estado then
    insert into public.corredor_historial
      (corredor_id, tipo, estado_anterior, estado_nuevo)
    values
      (new.id, 'cambio_estado', old.estado, new.estado);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_corredor_updated
  after update on public.corredores
  for each row execute procedure public.handle_corredor_historial();

-- RLS: corredor_emails sigue la misma lógica que corredores
alter table public.corredor_emails enable row level security;

create policy "corredor_emails: admin ve todos" on public.corredor_emails
  for all using (public.es_admin());

create policy "corredor_emails: entrenador ve los suyos" on public.corredor_emails
  for select using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

create policy "corredor_emails: entrenador edita los suyos" on public.corredor_emails
  for insert with check (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

create policy "corredor_emails: entrenador borra los suyos" on public.corredor_emails
  for delete using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

-- RLS: corredor_historial sigue la misma lógica que corredores
alter table public.corredor_historial enable row level security;

create policy "corredor_historial: admin ve todo" on public.corredor_historial
  for all using (public.es_admin());

create policy "corredor_historial: entrenador ve el suyo" on public.corredor_historial
  for select using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

create policy "corredor_historial: entrenador inserta en los suyos" on public.corredor_historial
  for insert with check (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Aplicar la migración en Supabase**

En el dashboard de Supabase → SQL Editor, pegar y ejecutar el contenido de `003_emails_historial.sql`.

Verificar que aparecen las tablas `corredor_emails` y `corredor_historial` en Table Editor, y el trigger `on_corredor_updated` en Database → Triggers.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_emails_historial.sql
git commit -m "feat: add corredor_emails and corredor_historial tables with trigger"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Agregar los nuevos tipos**

Abrir `types/database.ts` y añadir al final del archivo:

```typescript
export interface CorredorEmail {
  id: string;
  corredor_id: string;
  email: string;
  etiqueta: string | null;
  es_principal: boolean;
  created_at: string;
}

export type HistorialTipo = "cambio_plan" | "cambio_estado" | "pausa" | "nota";

/** Entrada unificada para el timeline del corredor (historial + pausas) */
export interface HistorialItem {
  id: string;
  corredor_id: string;
  fecha: string; // ISO string
  tipo: HistorialTipo;
  // cambio_plan
  plan_anterior: { id: string; nombre: string } | null;
  plan_nuevo: { id: string; nombre: string } | null;
  // cambio_estado
  estado_anterior: CorredorEstado | null;
  estado_nuevo: CorredorEstado | null;
  // pausa
  mes: number | null;
  año: number | null;
  tarifa_mantenimiento: number | null;
  // nota / manual
  nota: string | null;
  creado_por_user: { id: string; nombre: string } | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/database.ts
git commit -m "feat: add CorredorEmail and HistorialItem types"
```

---

## Task 3: Hook `useHistorialCorredor`

**Files:**
- Create: `hooks/useHistorialCorredor.ts`
- Create: `__tests__/hooks/useHistorialCorredor.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/hooks/useHistorialCorredor.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { useHistorialCorredor } from "@/hooks/useHistorialCorredor";

const mockFrom = jest.fn();
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({ from: mockFrom }),
}));

const CORREDOR_ID = "corredor-1";

describe("useHistorialCorredor", () => {
  beforeEach(() => jest.clearAllMocks());

  it("combina historial y pausas ordenados por fecha desc", async () => {
    const mockHistorial = [
      {
        id: "h1",
        corredor_id: CORREDOR_ID,
        fecha: "2026-03-10T00:00:00Z",
        tipo: "cambio_plan",
        plan_id_anterior: null,
        plan_id_nuevo: "p1",
        estado_anterior: null,
        estado_nuevo: null,
        nota: null,
        creado_por: null,
        plan_anterior: null,
        plan_nuevo: { id: "p1", nombre: "Club Competitivo" },
        creado_por_user: null,
      },
    ];
    const mockPausas = [
      {
        id: "p1",
        corredor_id: CORREDOR_ID,
        mes: 2,
        año: 2026,
        tarifa_mantenimiento: 5,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "corredor_historial") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockHistorial, error: null }),
        };
      }
      if (table === "pausas") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: mockPausas, error: null }),
        };
      }
    });

    const { result } = renderHook(() => useHistorialCorredor(CORREDOR_ID));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.historial).toHaveLength(2);
    // historial entry first (más reciente)
    expect(result.current.historial[0].tipo).toBe("cambio_plan");
    expect(result.current.historial[0].plan_nuevo?.nombre).toBe("Club Competitivo");
    // pausa entry second
    expect(result.current.historial[1].tipo).toBe("pausa");
    expect(result.current.historial[1].mes).toBe(2);
  });

  it("expone error si Supabase falla", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "corredor_historial") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("DB fail") }),
        };
      }
      if (table === "pausas") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
    });

    const { result } = renderHook(() => useHistorialCorredor(CORREDOR_ID));
    await act(async () => {});

    expect(result.current.error).not.toBeNull();
    expect(result.current.historial).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd ~/projects/wave-one-dashboard && npx jest __tests__/hooks/useHistorialCorredor.test.ts --no-coverage
```

Resultado esperado: FAIL — `Cannot find module '@/hooks/useHistorialCorredor'`

- [ ] **Step 3: Implementar el hook**

Crear `hooks/useHistorialCorredor.ts`:

```typescript
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { HistorialItem } from "@/types/database";

export function useHistorialCorredor(corredorId: string) {
  const supabase = useSupabaseClient();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!corredorId) return;

    async function fetch() {
      setLoading(true);
      setError(null);

      const [{ data: hData, error: hErr }, { data: pData }] = await Promise.all([
        supabase
          .from("corredor_historial")
          .select(`
            *,
            plan_anterior:plan_id_anterior(id, nombre),
            plan_nuevo:plan_id_nuevo(id, nombre),
            creado_por_user:creado_por(id, nombre)
          `)
          .eq("corredor_id", corredorId)
          .order("fecha", { ascending: false }),
        supabase
          .from("pausas")
          .select("*")
          .eq("corredor_id", corredorId),
      ]);

      if (hErr) {
        setError(hErr);
        setLoading(false);
        return;
      }

      const historialItems: HistorialItem[] = (hData ?? []).map((h: Record<string, unknown>) => ({
        id: h.id as string,
        corredor_id: h.corredor_id as string,
        fecha: h.fecha as string,
        tipo: h.tipo as HistorialItem["tipo"],
        plan_anterior: (h.plan_anterior as { id: string; nombre: string } | null) ?? null,
        plan_nuevo: (h.plan_nuevo as { id: string; nombre: string } | null) ?? null,
        estado_anterior: (h.estado_anterior as HistorialItem["estado_anterior"]) ?? null,
        estado_nuevo: (h.estado_nuevo as HistorialItem["estado_nuevo"]) ?? null,
        mes: null,
        año: null,
        tarifa_mantenimiento: null,
        nota: (h.nota as string | null) ?? null,
        creado_por_user: (h.creado_por_user as { id: string; nombre: string } | null) ?? null,
      }));

      const pausaItems: HistorialItem[] = (pData ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        corredor_id: p.corredor_id as string,
        fecha: `${p.año as number}-${String(p.mes as number).padStart(2, "0")}-01T00:00:00Z`,
        tipo: "pausa" as const,
        plan_anterior: null,
        plan_nuevo: null,
        estado_anterior: null,
        estado_nuevo: null,
        mes: p.mes as number,
        año: p.año as number,
        tarifa_mantenimiento: p.tarifa_mantenimiento as number,
        nota: null,
        creado_por_user: null,
      }));

      const merged = [...historialItems, ...pausaItems].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      setHistorial(merged);
      setLoading(false);
    }

    fetch();
  }, [corredorId, supabase]);

  return { historial, loading, error };
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npx jest __tests__/hooks/useHistorialCorredor.test.ts --no-coverage
```

Resultado esperado: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useHistorialCorredor.ts __tests__/hooks/useHistorialCorredor.test.ts
git commit -m "feat: add useHistorialCorredor hook"
```

---

## Task 4: Componente `ModalNotaHistorial`

**Files:**
- Create: `components/corredores/ModalNotaHistorial.tsx`
- Create: `__tests__/components/ModalNotaHistorial.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `__tests__/components/ModalNotaHistorial.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalNotaHistorial } from "@/components/corredores/ModalNotaHistorial";

const mockInsert = jest.fn();
jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
  useUser: () => ({ id: "user-1" }),
}));

describe("ModalNotaHistorial", () => {
  const defaultProps = {
    corredorId: "corredor-1",
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("muestra el campo de nota y botón guardar", () => {
    render(<ModalNotaHistorial {...defaultProps} />);
    expect(screen.getByPlaceholderText(/nota/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("no envía si la nota está vacía", async () => {
    render(<ModalNotaHistorial {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("llama onSuccess después de guardar exitosamente", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<ModalNotaHistorial {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nota/i), {
      target: { value: "Lesión rodilla, regresa en marzo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          corredor_id: "corredor-1",
          tipo: "nota",
          nota: "Lesión rodilla, regresa en marzo",
          creado_por: "user-1",
        }),
      ])
    );
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npx jest __tests__/components/ModalNotaHistorial.test.tsx --no-coverage
```

Resultado esperado: FAIL — `Cannot find module '@/components/corredores/ModalNotaHistorial'`

- [ ] **Step 3: Implementar el componente**

Crear `components/corredores/ModalNotaHistorial.tsx`:

```typescript
import { useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";

interface ModalNotaHistorialProps {
  corredorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalNotaHistorial({ corredorId, onClose, onSuccess }: ModalNotaHistorialProps) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) {
      setError("La nota es requerida");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.from("corredor_historial").insert([
      {
        corredor_id: corredorId,
        tipo: "nota",
        nota: nota.trim(),
        fecha: new Date(fecha).toISOString(),
        creado_por: user?.id ?? null,
      },
    ]);
    setLoading(false);

    if (err) {
      toast.error("Error al guardar la nota");
      return;
    }

    toast.success("Nota registrada");
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">Registrar Evento</h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">FECHA</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">NOTA *</label>
            <textarea
              placeholder="Escribe una nota sobre este corredor..."
              value={nota}
              onChange={(e) => {
                setNota(e.target.value);
                if (error) setError("");
              }}
              rows={4}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
            {error && <p className="text-error text-xs mt-1">{error}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npx jest __tests__/components/ModalNotaHistorial.test.tsx --no-coverage
```

Resultado esperado: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/corredores/ModalNotaHistorial.tsx __tests__/components/ModalNotaHistorial.test.tsx
git commit -m "feat: add ModalNotaHistorial component"
```

---

## Task 5: FormCorredor — Emails Adicionales

**Files:**
- Modify: `components/corredores/FormCorredor.tsx`
- Modify: `__tests__/components/FormCorredor.test.tsx`

- [ ] **Step 1: Añadir tests nuevos a FormCorredor.test.tsx**

Reemplazar el contenido completo de `__tests__/components/FormCorredor.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormCorredor } from "@/components/corredores/FormCorredor";

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSelect = jest.fn();

jest.mock("@supabase/auth-helpers-react", () => ({
  useSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "corredor_emails") {
        return {
          select: mockSelect,
          insert: mockInsert,
          delete: () => ({ eq: mockDelete }),
        };
      }
      return {
        insert: mockInsert,
        update: () => ({ eq: () => mockUpdate() }),
        eq: jest.fn().mockReturnThis(),
      };
    },
  }),
  useUser: () => ({ id: "user-1" }),
}));

const mockPlanes = [
  { id: "plan-1", nombre: "Club Competitivo", precio_mensual: 45 },
];

describe("FormCorredor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  it("muestra campos requeridos", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo/i)).toBeInTheDocument();
  });

  it("no envía si nombre está vacío", async () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("llama onSuccess después de guardar exitosamente", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nombre/i), {
      target: { value: "Ana García" },
    });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), {
      target: { value: "ana@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("muestra botón para agregar correo adicional", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole("button", { name: /agregar correo/i })).toBeInTheDocument();
  });

  it("agrega y elimina filas de email adicional", () => {
    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /agregar correo/i }));
    expect(screen.getByPlaceholderText(/email adicional/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /eliminar correo/i }));
    expect(screen.queryByPlaceholderText(/email adicional/i)).not.toBeInTheDocument();
  });

  it("guarda emails adicionales junto con el corredor (modo crear)", async () => {
    mockInsert.mockResolvedValue({ error: null });
    const onSuccess = jest.fn();

    render(<FormCorredor planes={mockPlanes} onClose={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/nombre/i), {
      target: { value: "Ana García" },
    });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), {
      target: { value: "ana@test.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /agregar correo/i }));
    fireEvent.change(screen.getByPlaceholderText(/email adicional/i), {
      target: { value: "ana@trabajo.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/etiqueta/i), {
      target: { value: "trabajo" },
    });

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    // insert fue llamado al menos una vez (para el corredor y para emails)
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```bash
npx jest __tests__/components/FormCorredor.test.tsx --no-coverage
```

Resultado esperado: FAIL — los 3 tests previos pasan, los 3 nuevos fallan.

- [ ] **Step 3: Actualizar FormCorredor.tsx con la sección de emails adicionales**

Reemplazar el contenido completo de `components/corredores/FormCorredor.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";
import type { Corredor, Plan, CorredorEmail } from "@/types/database";

interface EmailAdicional {
  email: string;
  etiqueta: string;
}

interface FormCorredorProps {
  corredor?: Corredor;
  planes: Plan[];
  onClose: () => void;
  onSuccess: () => void;
}

export function FormCorredor({ corredor, planes, onClose, onSuccess }: FormCorredorProps) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const isEditing = !!corredor;

  const [form, setForm] = useState({
    nombre: corredor?.nombre ?? "",
    email: corredor?.email ?? "",
    telefono_emergencia: corredor?.telefono_emergencia ?? "",
    fecha_ingreso: corredor?.fecha_ingreso ?? new Date().toISOString().split("T")[0],
    plan_id: corredor?.plan_id ?? "",
    estado: corredor?.estado ?? "activo",
    uniforme_entregado: corredor?.uniforme_entregado ?? false,
    proxima_carrera: corredor?.proxima_carrera ?? "",
  });
  const [emailsAdicionales, setEmailsAdicionales] = useState<EmailAdicional[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar emails adicionales existentes en modo edición
  useEffect(() => {
    if (!corredor?.id) return;
    supabase
      .from("corredor_emails")
      .select("*")
      .eq("corredor_id", corredor.id)
      .then(({ data }) => {
        if (data) {
          setEmailsAdicionales(
            (data as CorredorEmail[]).map((e) => ({
              email: e.email,
              etiqueta: e.etiqueta ?? "",
            }))
          );
        }
      });
  }, [corredor?.id, supabase]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    if (!form.email.trim()) e.email = "El correo es requerido";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Correo inválido";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    const payload = {
      ...form,
      plan_id: form.plan_id || null,
      entrenador_id: corredor?.entrenador_id ?? user!.id,
    };

    let corredorId = corredor?.id;

    if (isEditing) {
      const { error } = await supabase
        .from("corredores")
        .update(payload)
        .eq("id", corredor.id);
      if (error) {
        toast.error("Error al guardar el corredor");
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("corredores")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Error al guardar el corredor");
        setLoading(false);
        return;
      }
      corredorId = data.id;
    }

    // Sincronizar emails adicionales
    if (isEditing) {
      // Borrar anteriores y reinsertar
      await supabase
        .from("corredor_emails")
        .delete()
        .eq("corredor_id", corredor.id);
    }

    const emailsValidos = emailsAdicionales.filter((e) => e.email.trim());
    if (emailsValidos.length > 0) {
      await supabase.from("corredor_emails").insert(
        emailsValidos.map((e) => ({
          corredor_id: corredorId,
          email: e.email.trim(),
          etiqueta: e.etiqueta.trim() || null,
        }))
      );
    }

    setLoading(false);
    toast.success(isEditing ? "Corredor actualizado" : "Corredor añadido");
    onSuccess();
    onClose();
  };

  const field = (key: string) => ({
    value: (form as Record<string, unknown>)[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const addEmail = () =>
    setEmailsAdicionales((prev) => [...prev, { email: "", etiqueta: "" }]);

  const removeEmail = (index: number) =>
    setEmailsAdicionales((prev) => prev.filter((_, i) => i !== index));

  const updateEmail = (index: number, field: keyof EmailAdicional, value: string) =>
    setEmailsAdicionales((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">
            {isEditing ? "Editar Corredor" : "Añadir Corredor"}
          </h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">NOMBRE *</label>
            <input
              type="text"
              placeholder="Nombre completo"
              {...field("nombre")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.nombre && <p className="text-error text-xs mt-1">{errors.nombre}</p>}
          </div>

          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">CORREO PRINCIPAL *</label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              {...field("email")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.email && <p className="text-error text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Emails adicionales */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-label-caps text-outline text-xs">CORREOS ADICIONALES</label>
              <button
                type="button"
                onClick={addEmail}
                aria-label="Agregar correo"
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-80"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Agregar correo
              </button>
            </div>
            {emailsAdicionales.map((entry, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="email"
                  placeholder="Email adicional"
                  value={entry.email}
                  onChange={(e) => updateEmail(i, "email", e.target.value)}
                  className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Etiqueta"
                  value={entry.etiqueta}
                  onChange={(e) => updateEmail(i, "etiqueta", e.target.value)}
                  className="w-28 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => removeEmail(i)}
                  aria-label="Eliminar correo"
                  className="text-outline hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">TELÉFONO EMERGENCIA</label>
              <input
                type="tel"
                placeholder="+52 55 1234 5678"
                {...field("telefono_emergencia")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">FECHA INGRESO</label>
              <input
                type="date"
                {...field("fecha_ingreso")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">PLAN</label>
              <select
                {...field("plan_id")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Sin plan</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (${p.precio_mensual}/mes)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">ESTADO</label>
              <select
                {...field("estado")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">PRÓXIMA CARRERA</label>
            <input
              type="text"
              placeholder="ej. Maratón CDMX 2024"
              {...field("proxima_carrera")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.uniforme_entregado}
              onChange={(e) => setForm((p) => ({ ...p, uniforme_entregado: e.target.checked }))}
              className="rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="text-sm text-on-surface">Uniforme entregado</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npx jest __tests__/components/FormCorredor.test.tsx --no-coverage
```

Resultado esperado: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add components/corredores/FormCorredor.tsx __tests__/components/FormCorredor.test.tsx
git commit -m "feat: add multi-email support to FormCorredor"
```

---

## Task 6: Página `/corredores/[id]` — Emails y Historial

**Files:**
- Modify: `pages/corredores/[id].tsx`

- [ ] **Step 1: Actualizar la página con emails adicionales e historial**

Reemplazar el contenido completo de `pages/corredores/[id].tsx`:

```typescript
import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { Layout } from "@/components/layout/Layout";
import { FormCorredor } from "@/components/corredores/FormCorredor";
import { ModalNotaHistorial } from "@/components/corredores/ModalNotaHistorial";
import { usePlanes } from "@/hooks/usePlanes";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useHistorialCorredor } from "@/hooks/useHistorialCorredor";
import { toast } from "@/components/ui/Toast";
import { calcularDeudas, MESES_ES } from "@/lib/deudas";
import type { Corredor, CorredorEmail, HistorialItem } from "@/types/database";

const ESTADO_COLOR: Record<string, string> = {
  pagado: "bg-secondary/10 text-secondary",
  vencido: "bg-error/10 text-error",
  pendiente: "bg-slate-100 text-slate-500",
};

const HISTORIAL_ICON: Record<string, string> = {
  cambio_plan: "swap_horiz",
  cambio_estado: "person",
  pausa: "pause_circle",
  nota: "notes",
};

const HISTORIAL_COLOR: Record<string, string> = {
  cambio_plan: "bg-blue-100 text-blue-600",
  cambio_estado: "bg-amber-100 text-amber-600",
  pausa: "bg-slate-100 text-slate-500",
  nota: "bg-purple-100 text-purple-600",
};

function formatHistorialDesc(item: HistorialItem): string {
  switch (item.tipo) {
    case "cambio_plan": {
      const de = item.plan_anterior?.nombre ?? "Sin plan";
      const a = item.plan_nuevo?.nombre ?? "Sin plan";
      return `Plan: ${de} → ${a}`;
    }
    case "cambio_estado": {
      const de = item.estado_anterior ?? "—";
      const a = item.estado_nuevo ?? "—";
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return `Estado: ${cap(de)} → ${cap(a)}`;
    }
    case "pausa":
      return `Pausa — ${MESES_ES[(item.mes ?? 1) - 1]} ${item.año} (tarifa $${item.tarifa_mantenimiento?.toFixed(2)})`;
    case "nota":
      return item.nota ?? "";
    default:
      return "";
  }
}

export default function CorredorPerfilPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const supabase = useSupabaseClient();
  const { planes } = usePlanes();
  const { transacciones } = useTransacciones({ corredorId: id });
  const { historial, loading: loadingHistorial } = useHistorialCorredor(id);

  const [corredor, setCorredor] = useState<Corredor | null>(null);
  const [emailsAdicionales, setEmailsAdicionales] = useState<CorredorEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [nota, setNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  const fetchCorredor = () => {
    if (!id) return;
    supabase
      .from("corredores")
      .select(`*, plan:planes(*), entrenador:users(id, nombre, email)`)
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setCorredor(data);
        setLoading(false);
      });
    supabase
      .from("corredor_emails")
      .select("*")
      .eq("corredor_id", id)
      .then(({ data }) => {
        setEmailsAdicionales((data as CorredorEmail[]) ?? []);
      });
  };

  useEffect(() => {
    fetchCorredor();
  }, [id, supabase]);

  const deudaData = useMemo(() => {
    if (!corredor) return null;
    const result = calcularDeudas([corredor], transacciones);
    return result[0] ?? null;
  }, [corredor, transacciones]);

  const saldo = transacciones.reduce((acc, t) => {
    return t.tipo === "ingreso" ? acc + Number(t.monto) : acc - Number(t.monto);
  }, 0);

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!corredor) {
    return (
      <Layout>
        <p className="text-outline">Corredor no encontrado.</p>
      </Layout>
    );
  }

  return (
    <>
      <Head><title>RunTeam Pro — {corredor.nombre}</title></Head>
      <Layout>
        <div className="mb-8 flex justify-between items-end">
          <div>
            <nav className="flex items-center gap-2 font-label-caps text-outline mb-2 text-xs">
              <Link href="/corredores" className="hover:text-primary">CORREDORES</Link>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-on-surface">{corredor.nombre.toUpperCase()}</span>
            </nav>
            <h2 className="text-headline-lg text-on-surface font-headline">Perfil del Corredor</h2>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Editar Corredor
          </button>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Columna izquierda */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-3xl mb-4">
                  {corredor.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <h3 className="text-headline-md font-headline">{corredor.nombre}</h3>
                <span className="px-3 py-1 bg-secondary/10 text-secondary font-label-caps rounded-full mt-2 text-xs">
                  {corredor.estado.charAt(0).toUpperCase() + corredor.estado.slice(1)}
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {/* Sección de correos */}
                <div>
                  <p className="font-label-caps text-outline text-xs mb-2">CORREOS</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-on-surface">{corredor.email}</span>
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded">
                        Principal
                      </span>
                    </div>
                    {emailsAdicionales.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="text-sm text-on-surface">{e.email}</span>
                        {e.etiqueta && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">
                            {e.etiqueta}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {corredor.telefono_emergencia && (
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">EMERGENCIA</p>
                    <p className="text-sm text-on-surface">{corredor.telefono_emergencia}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">INGRESO</p>
                    <p className="text-sm font-data-mono">
                      {new Date(corredor.fecha_ingreso).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">PLAN</p>
                    <p className="text-sm">{corredor.plan?.nombre ?? "Sin plan"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-white/80 font-label-caps text-xs">SALDO ACUMULADO</p>
                <p className="text-3xl font-bold font-body mt-1">
                  {saldo >= 0 ? "+" : ""}${Math.abs(saldo).toFixed(2)}
                </p>
                <p className="text-white/80 text-sm mt-3">
                  Plan: ${corredor.plan?.precio_mensual?.toFixed(2) ?? "0.00"}/mes
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <span className="material-symbols-outlined text-[100px]">payments</span>
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            {/* Historial de pagos */}
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h4 className="font-headline-sm">Historial de Pagos</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Fecha</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Descripción</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Método</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Estado</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {transacciones.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-outline text-sm">
                          Sin transacciones registradas.
                        </td>
                      </tr>
                    )}
                    {transacciones.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-data-mono">
                          {new Date(t.fecha).toLocaleDateString("es-MX")}
                        </td>
                        <td className="px-6 py-4 text-sm">{t.descripcion}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant capitalize">
                          {t.metodo}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[t.estado]}`}>
                            {t.estado.charAt(0).toUpperCase() + t.estado.slice(1)}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-data-mono ${t.tipo === "ingreso" ? "text-secondary" : "text-tertiary"}`}>
                          {t.tipo === "ingreso" ? "+" : "-"}${Number(t.monto).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calendario de Pagos */}
            {deudaData && (
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-headline-sm">Calendario de Pagos</h4>
                  {deudaData.mesesDeudaCount > 0 ? (
                    <span className="text-sm font-semibold text-red-600">
                      {deudaData.mesesDeudaCount} mes{deudaData.mesesDeudaCount > 1 ? "es" : ""} adeudado{deudaData.mesesDeudaCount > 1 ? "s" : ""} — ${deudaData.totalDeuda.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-secondary">Al corriente</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {deudaData.meses.map(({ year, month, estado }) => (
                    <div
                      key={`${year}-${month}`}
                      title={estado === "pagado" ? "Pagado" : estado === "deuda" ? "Adeudado" : "Pendiente"}
                      className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-[11px] font-semibold min-w-[40px] ${
                        estado === "pagado"
                          ? "bg-secondary/15 text-secondary"
                          : estado === "deuda"
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <span>{MESES_ES[month]}</span>
                      <span className="text-[10px] font-normal opacity-70">{String(year).slice(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-3 text-[11px] text-outline">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-secondary/20 inline-block" />Pagado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" />Adeudado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 inline-block" />Pendiente</span>
                </div>
              </div>
            )}

            {/* Historial del corredor */}
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-headline-sm">Historial</h4>
                <button
                  onClick={() => setShowNotaModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Registrar evento
                </button>
              </div>

              {loadingHistorial ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="h-3 bg-slate-100 rounded w-24" />
                        <div className="h-3 bg-slate-100 rounded w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : historial.length === 0 ? (
                <p className="text-sm text-outline text-center py-6">Sin eventos registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-outline-variant/40" />
                  <div className="space-y-4">
                    {historial.map((item) => (
                      <div key={item.id} className="flex gap-4 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${HISTORIAL_COLOR[item.tipo]}`}>
                          <span className="material-symbols-outlined text-sm">
                            {HISTORIAL_ICON[item.tipo]}
                          </span>
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-xs text-outline font-data-mono">
                            {new Date(item.fecha).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-sm text-on-surface mt-0.5">
                            {formatHistorialDesc(item)}
                          </p>
                          {item.creado_por_user && (
                            <p className="text-xs text-outline mt-0.5">
                              por {item.creado_por_user.nombre}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nota del Entrenador */}
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <h4 className="font-headline-sm mb-4">Nota del Entrenador</h4>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-primary text-sm h-28 p-3"
                placeholder="Añadir notas internas sobre el progreso o asistencia..."
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">info</span>
                  Las notas son privadas para los administradores.
                </p>
                <button
                  onClick={async () => {
                    setGuardandoNota(true);
                    await new Promise((r) => setTimeout(r, 500));
                    setGuardandoNota(false);
                    toast.success("Nota guardada");
                  }}
                  disabled={guardandoNota}
                  className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {guardandoNota ? "Guardando..." : "Guardar Nota"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <FormCorredor
            corredor={corredor}
            planes={planes}
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
              fetchCorredor();
            }}
          />
        )}

        {showNotaModal && (
          <ModalNotaHistorial
            corredorId={corredor.id}
            onClose={() => setShowNotaModal(false)}
            onSuccess={() => {
              setShowNotaModal(false);
              router.reload();
            }}
          />
        )}
      </Layout>
    </>
  );
}
```

- [ ] **Step 2: Correr todos los tests del proyecto**

```bash
npx jest --no-coverage
```

Resultado esperado: todos los tests pasan (sin nuevos fallos).

- [ ] **Step 3: Commit final**

```bash
git add pages/corredores/[id].tsx
git commit -m "feat: add emails and historial sections to corredor profile"
```

---

## Verificación Final

- [ ] Aplicar migración en Supabase y verificar que las tablas y el trigger existen
- [ ] Abrir `/corredores` en el navegador, editar un corredor, agregar email adicional, guardar — verificar que aparece en el perfil
- [ ] Cambiar plan o estado de un corredor — verificar que aparece en el historial automáticamente
- [ ] Usar "Registrar evento" en el perfil — verificar que aparece la nota en el timeline
- [ ] Verificar que `npx jest --no-coverage` pasa al 100%
