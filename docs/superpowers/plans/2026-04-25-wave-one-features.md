# Wave One Dashboard — Feature Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 features: filtros, meses de pausa, deudas de inactivos, sidebar colapsable, versión móvil, reembolsos, pantalla coaches, rename Wave One, y UI/UX pass.

**Architecture:** Frontend-driven para la mayoría. API route para registro atómico de deudas al desactivar un corredor. Supabase Realtime ya activo en transacciones.

**Tech Stack:** Next.js 14 Pages Router, Supabase, TypeScript, Tailwind CSS, Jest

---

## File Map

| Archivo | Acción |
|---|---|
| `types/database.ts` | Agregar `"reembolsado"` a TransaccionEstado, agregar tipo Pausa |
| `lib/deudas.ts` | Incluir inactivos, aceptar pausas como parámetro |
| `hooks/useCorredores.ts` | Agregar filtros estado/entrenadorId/planId |
| `hooks/usePausas.ts` | Crear — CRUD pausas |
| `hooks/useCoach.ts` | Crear — datos de un coach con stats |
| `components/layout/Layout.tsx` | Estado collapsed + mobileOpen, pasar props |
| `components/layout/Sidebar.tsx` | Colapsable + drawer móvil + link coaches |
| `components/layout/TopBar.tsx` | Ancho dinámico + botón hamburguesa |
| `components/corredores/FormCorredor.tsx` | Sección pausas + lógica desactivar |
| `components/finanzas/TablaTransacciones.tsx` | Badge reembolsado + botón reembolsar |
| `pages/corredores/index.tsx` | UI filtros |
| `pages/api/corredores/[id]/desactivar.ts` | Nueva API route |
| `pages/api/webhooks/stripe.ts` | Evento charge.refunded |
| `pages/api/webhooks/paypal.ts` | Evento PAYMENT.SALE.REVERSED |
| `pages/coaches/index.tsx` | Lista de coaches |
| `pages/coaches/[id].tsx` | Detalle de coach |
| `middleware.ts` | Proteger /coaches/[id] por rol |
| Todos los `<title>` y brand | Rename Wave One |

---

### Task 1: Rename — Wave One

**Files:**
- Modify: `pages/login.tsx`
- Modify: `pages/signup.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `pages/corredores/index.tsx`
- Modify: `pages/finanzas/index.tsx`
- Modify: `pages/pagos/index.tsx`
- Modify: `pages/gastos/index.tsx`
- Modify: `pages/deudas/index.tsx`
- Modify: `pages/index.tsx`

- [ ] **Step 1: Reemplazar "RunTeam Pro" en todos los archivos**

```bash
grep -rl "RunTeam Pro" /Users/sebastianalvarez/projects/wave-one-dashboard/pages /Users/sebastianalvarez/projects/wave-one-dashboard/components --include="*.tsx" --include="*.ts"
```

En cada archivo encontrado, cambiar `RunTeam Pro` por `Wave One`. En `Sidebar.tsx`:

```tsx
// components/layout/Sidebar.tsx — sección brand (línea ~38)
<h1 className="text-xl font-bold text-primary font-headline tracking-tight">
  Wave One
</h1>
<p className="text-label-caps text-outline tracking-widest mt-1">
  Gestión Administrativa
</p>
```

En `pages/login.tsx` y `pages/signup.tsx`:

```tsx
<title>Wave One — Iniciar sesión</title>
// y en el h1:
<h1 className="text-headline-md font-headline text-primary">Wave One</h1>
```

En cada `pages/*/index.tsx` cambiar el `<title>` de `RunTeam Pro — X` a `Wave One — X`.

- [ ] **Step 2: Verificar que no queden instancias**

```bash
grep -r "RunTeam Pro" /Users/sebastianalvarez/projects/wave-one-dashboard --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next
```

Esperado: sin output.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: rename RunTeam Pro to Wave One"
```

---

### Task 2: Modelo de datos — estado reembolsado

**Files:**
- Modify: `types/database.ts`
- Modify: `components/finanzas/TablaTransacciones.tsx`

- [ ] **Step 1: Agregar "reembolsado" al tipo**

En `types/database.ts`, cambiar:

```typescript
export type TransaccionEstado = "pagado" | "pendiente" | "vencido" | "reembolsado";
```

- [ ] **Step 2: Agregar badge en TablaTransacciones**

En `components/finanzas/TablaTransacciones.tsx`, actualizar `ESTADO_BADGE`:

```typescript
const ESTADO_BADGE: Record<string, string> = {
  pagado: "bg-secondary/10 text-secondary",
  vencido: "bg-tertiary/10 text-tertiary",
  pendiente: "bg-primary/10 text-primary",
  reembolsado: "bg-slate-100 text-slate-500",
};
```

- [ ] **Step 3: Agregar al enum en Supabase**

En Supabase SQL Editor ejecutar:

```sql
ALTER TYPE transaccion_estado ADD VALUE IF NOT EXISTS 'reembolsado';
```

- [ ] **Step 4: Verificar tipos**

```bash
cd /Users/sebastianalvarez/projects/wave-one-dashboard && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts components/finanzas/TablaTransacciones.tsx
git commit -m "feat: add reembolsado transaction state"
```

---

### Task 3: calcularDeudas — incluir inactivos + pausas

**Files:**
- Modify: `lib/deudas.ts`
- Modify: `types/database.ts` (importar Pausa si no está)

- [ ] **Step 1: Actualizar monthRange para aceptar fecha fin**

En `lib/deudas.ts`, reemplazar la función completa:

```typescript
import type { Corredor, Transaccion, Pausa } from "@/types/database";

export type MesEstado = "pagado" | "deuda" | "pausa" | "futuro";

export interface MesDeuda {
  year: number;
  month: number;
  estado: MesEstado;
  monto: number;
}

export interface DeudaCorredor {
  corredor: Corredor;
  meses: MesDeuda[];
  totalDeuda: number;
  mesesDeudaCount: number;
}

function monthRange(
  desde: string,
  hasta?: string
): Array<{ year: number; month: number }> {
  const inicio = new Date(desde);
  const fin = hasta ? new Date(hasta) : new Date();
  const result: Array<{ year: number; month: number }> = [];
  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  while (
    y < fin.getFullYear() ||
    (y === fin.getFullYear() && m <= fin.getMonth())
  ) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

export function calcularDeudas(
  corredores: Corredor[],
  transacciones: Transaccion[],
  pausas: Pausa[] = []
): DeudaCorredor[] {
  const hoy = new Date();

  return corredores
    .map(corredor => {
      const precio = corredor.plan?.precio_mensual ?? 0;
      const ingresos = transacciones.filter(
        t =>
          t.corredor_id === corredor.id &&
          t.tipo === "ingreso" &&
          t.estado === "pagado"
      );

      const pagadosSet = new Set(
        ingresos.map(t => {
          const d = new Date(t.fecha);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      );

      const pausasSet = new Set(
        pausas
          .filter(p => p.corredor_id === corredor.id)
          .map(p => `${p.año}-${p.mes - 1}`)
      );

      const fechaFin = corredor.estado === "inactivo" && corredor.fecha_salida
        ? corredor.fecha_salida
        : undefined;

      const meses: MesDeuda[] = monthRange(corredor.fecha_ingreso, fechaFin).map(
        ({ year, month }) => {
          const esFuturo =
            year > hoy.getFullYear() ||
            (year === hoy.getFullYear() && month > hoy.getMonth());
          const pagado = pagadosSet.has(`${year}-${month}`);
          const pausado = pausasSet.has(`${year}-${month}`);
          return {
            year,
            month,
            estado: esFuturo
              ? "futuro"
              : pausado
              ? "pausa"
              : pagado
              ? "pagado"
              : "deuda",
            monto: precio,
          };
        }
      );

      const deudas = meses.filter(m => m.estado === "deuda");
      return {
        corredor,
        meses,
        totalDeuda: deudas.reduce((s, m) => s + m.monto, 0),
        mesesDeudaCount: deudas.length,
      };
    })
    .sort((a, b) => b.mesesDeudaCount - a.mesesDeudaCount);
}

export const MESES_ES = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];
```

- [ ] **Step 2: Verificar tipos**

```bash
cd /Users/sebastianalvarez/projects/wave-one-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/deudas.ts
git commit -m "feat: calcularDeudas includes inactive runners and pauses"
```

---

### Task 4: Filtros en /corredores

**Files:**
- Modify: `hooks/useCorredores.ts`
- Modify: `pages/corredores/index.tsx`

- [ ] **Step 1: Extender useCorredores con filtros**

Reemplazar `hooks/useCorredores.ts` completo:

```typescript
import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Corredor, CorredorEstado } from "@/types/database";

interface UseCorredoresOptions {
  search?: string;
  estado?: CorredorEstado | "";
  entrenadorId?: string;
  planId?: string;
}

export function useCorredores({
  search = "",
  estado = "",
  entrenadorId = "",
  planId = "",
}: UseCorredoresOptions = {}) {
  const supabase = useSupabaseClient();
  const [corredores, setCorredores] = useState<Corredor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCorredores = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("corredores")
      .select(`*, plan:planes(id, nombre, precio_mensual), entrenador:users(id, nombre, email)`)
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("nombre", `%${search}%`);
    if (estado) query = query.eq("estado", estado);
    if (entrenadorId) query = query.eq("entrenador_id", entrenadorId);
    if (planId) query = query.eq("plan_id", planId);

    const { data, error: err } = await query;
    if (err) {
      setError(err);
      setCorredores([]);
    } else {
      setCorredores(data ?? []);
    }
    setLoading(false);
  }, [supabase, search, estado, entrenadorId, planId]);

  useEffect(() => {
    fetchCorredores();
  }, [fetchCorredores]);

  const deleteCorredor = async (id: string) => {
    const { error: err } = await supabase.from("corredores").delete().eq("id", id);
    if (!err) fetchCorredores();
    return err;
  };

  return { corredores, loading, error, refetch: fetchCorredores, deleteCorredor };
}
```

- [ ] **Step 2: Agregar UI de filtros en la página**

En `pages/corredores/index.tsx`, agregar estado de filtros y UI. Agregar imports y estado:

```tsx
import { useState, useEffect } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Corredor, CorredorEstado } from "@/types/database";
// ... imports existentes

export default function CorredoresPage() {
  const supabase = useSupabaseClient();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<CorredorEstado | "">("");
  const [filtroEntrenador, setFiltroEntrenador] = useState("");
  const [filtroPlan, setFiltroPlan] = useState("");
  const [entrenadores, setEntrenadores] = useState<{ id: string; nombre: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCorredor, setEditingCorredor] = useState<Corredor | undefined>();

  const { corredores, loading, refetch, deleteCorredor } = useCorredores({
    search,
    estado: filtroEstado,
    entrenadorId: filtroEntrenador,
    planId: filtroPlan,
  });
  const { planes } = usePlanes();

  useEffect(() => {
    supabase
      .from("users")
      .select("id, nombre")
      .eq("rol", "entrenador")
      .then(({ data }) => setEntrenadores(data ?? []));
  }, [supabase]);

  // ... resto de handlers existentes sin cambios
```

Agregar sección de filtros justo debajo del header y encima de las tarjetas de métricas:

```tsx
{/* Filtros */}
<div className="flex flex-wrap gap-3">
  <select
    value={filtroEstado}
    onChange={(e) => setFiltroEstado(e.target.value as CorredorEstado | "")}
    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
  >
    <option value="">Todos los estados</option>
    <option value="activo">Activo</option>
    <option value="pausado">Pausado</option>
    <option value="inactivo">Inactivo</option>
  </select>

  <select
    value={filtroEntrenador}
    onChange={(e) => setFiltroEntrenador(e.target.value)}
    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
  >
    <option value="">Todos los entrenadores</option>
    {entrenadores.map((e) => (
      <option key={e.id} value={e.id}>{e.nombre}</option>
    ))}
  </select>

  <select
    value={filtroPlan}
    onChange={(e) => setFiltroPlan(e.target.value)}
    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
  >
    <option value="">Todos los planes</option>
    {planes.map((p) => (
      <option key={p.id} value={p.id}>{p.nombre}</option>
    ))}
  </select>

  {(filtroEstado || filtroEntrenador || filtroPlan) && (
    <button
      onClick={() => { setFiltroEstado(""); setFiltroEntrenador(""); setFiltroPlan(""); }}
      className="text-sm text-outline hover:text-error flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-sm">close</span>
      Limpiar filtros
    </button>
  )}
</div>
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add hooks/useCorredores.ts pages/corredores/index.tsx
git commit -m "feat: add filters to /corredores (estado, entrenador, plan)"
```

---

### Task 5: Hook usePausas

**Files:**
- Create: `hooks/usePausas.ts`

- [ ] **Step 1: Crear el hook**

```typescript
// hooks/usePausas.ts
import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Pausa } from "@/types/database";

export function usePausas(corredorId: string | undefined) {
  const supabase = useSupabaseClient();
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPausas = useCallback(async () => {
    if (!corredorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pausas")
      .select("*")
      .eq("corredor_id", corredorId)
      .order("año", { ascending: false })
      .order("mes", { ascending: false });
    setPausas(data ?? []);
    setLoading(false);
  }, [supabase, corredorId]);

  useEffect(() => {
    fetchPausas();
  }, [fetchPausas]);

  const addPausa = async (mes: number, año: number, tarifa_mantenimiento: number) => {
    if (!corredorId) return null;
    const { error } = await supabase.from("pausas").insert({
      corredor_id: corredorId,
      mes,
      año,
      tarifa_mantenimiento,
    });
    if (!error) fetchPausas();
    return error;
  };

  const removePausa = async (id: string) => {
    const { error } = await supabase.from("pausas").delete().eq("id", id);
    if (!error) fetchPausas();
    return error;
  };

  return { pausas, loading, addPausa, removePausa, refetch: fetchPausas };
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/usePausas.ts
git commit -m "feat: add usePausas hook"
```

---

### Task 6: FormCorredor — sección pausas

**Files:**
- Modify: `components/corredores/FormCorredor.tsx`

- [ ] **Step 1: Agregar import y hook**

Al inicio de `FormCorredor.tsx`, agregar:

```typescript
import { usePausas } from "@/hooks/usePausas";
import { MESES_ES } from "@/lib/deudas";
```

Dentro de la función `FormCorredor`, después de `const isEditing = !!corredor;`:

```typescript
const { pausas, addPausa, removePausa } = usePausas(corredor?.id);
const [nuevaPausa, setNuevaPausa] = useState({
  mes: new Date().getMonth() + 1,
  año: new Date().getFullYear(),
  tarifa_mantenimiento: 0,
});
const [addingPausa, setAddingPausa] = useState(false);
```

- [ ] **Step 2: Agregar sección pausas en el formulario**

Después del bloque de emails adicionales y antes del grid de teléfono/fecha, agregar:

```tsx
{isEditing && (
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="font-label-caps text-outline text-xs">MESES DE PAUSA</label>
      <button
        type="button"
        onClick={() => setAddingPausa(!addingPausa)}
        className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-80"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Agregar pausa
      </button>
    </div>

    {addingPausa && (
      <div className="flex gap-2 mb-3 p-3 bg-slate-50 rounded-lg">
        <select
          value={nuevaPausa.mes}
          onChange={(e) => setNuevaPausa(p => ({ ...p, mes: Number(e.target.value) }))}
          className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
        >
          {MESES_ES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Año"
          value={nuevaPausa.año}
          onChange={(e) => setNuevaPausa(p => ({ ...p, año: Number(e.target.value) }))}
          className="w-24 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <input
          type="number"
          placeholder="Tarifa ($)"
          value={nuevaPausa.tarifa_mantenimiento}
          onChange={(e) => setNuevaPausa(p => ({ ...p, tarifa_mantenimiento: Number(e.target.value) }))}
          className="w-28 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={async () => {
            await addPausa(nuevaPausa.mes, nuevaPausa.año, nuevaPausa.tarifa_mantenimiento);
            setAddingPausa(false);
          }}
          className="bg-primary text-white rounded-lg px-3 py-2 text-sm font-semibold"
        >
          Guardar
        </button>
      </div>
    )}

    <div className="space-y-1">
      {pausas.length === 0 && (
        <p className="text-xs text-outline italic">Sin meses de pausa registrados.</p>
      )}
      {pausas.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
          <span className="text-on-surface">
            {MESES_ES[p.mes - 1]} {p.año}
            {p.tarifa_mantenimiento > 0 && (
              <span className="text-outline ml-2">(${p.tarifa_mantenimiento} mantenimiento)</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => removePausa(p.id)}
            className="text-outline hover:text-error"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/corredores/FormCorredor.tsx
git commit -m "feat: add pause months section to FormCorredor"
```

---

### Task 7: Sidebar colapsable + mobile drawer

**Files:**
- Modify: `components/layout/Layout.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/TopBar.tsx`

- [ ] **Step 1: Actualizar Layout.tsx**

Reemplazar `components/layout/Layout.tsx` completo:

```tsx
import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  pagosSinAsignar?: number;
  onSearch?: (query: string) => void;
}

export function Layout({ children, pagosSinAsignar = 0, onSearch }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const sidebarWidth = collapsed ? "w-16" : "w-60";
  const mainMargin = collapsed ? "md:ml-16" : "md:ml-60";

  return (
    <div className="bg-background min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        pagosSinAsignar={pagosSinAsignar}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <TopBar
        onSearch={onSearch}
        collapsed={collapsed}
        onMobileMenuClick={() => setMobileOpen(true)}
      />

      <main className={`${mainMargin} pt-20 px-4 md:px-8 pb-12 transition-all duration-200`}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar Sidebar.tsx**

Reemplazar `components/layout/Sidebar.tsx` completo:

```tsx
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface SidebarProps {
  pagosSinAsignar: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { href: "/", label: "Panel Control", icon: "dashboard" },
  { href: "/corredores", label: "Corredores", icon: "directions_run" },
  { href: "/coaches", label: "Coaches", icon: "sports" },
  { href: "/finanzas", label: "Finanzas", icon: "payments" },
  { href: "/pagos", label: "Pagos", icon: "account_balance_wallet" },
  { href: "/gastos", label: "Gastos", icon: "receipt_long" },
  { href: "/deudas", label: "Deudas", icon: "calendar_month" },
];

export function Sidebar({
  pagosSinAsignar,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { pathname } = useRouter();
  const [sinAsignar, setSinAsignar] = useState(pagosSinAsignar);

  useEffect(() => {
    fetch("/api/pagos/sin-asignar")
      .then((r) => r.json())
      .then((data: unknown) => setSinAsignar(Array.isArray(data) ? (data as unknown[]).length : 0))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarClass = [
    "fixed left-0 top-0 h-screen border-r border-slate-200 bg-white z-50 flex flex-col py-6 transition-all duration-200",
    collapsed ? "w-16" : "w-60",
    // Mobile: drawer
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
  ].join(" ");

  return (
    <aside className={sidebarClass}>
      {/* Brand */}
      <div className={`mb-8 ${collapsed ? "px-2 text-center" : "px-6"}`}>
        {collapsed ? (
          <span className="material-symbols-outlined text-primary text-2xl">waves</span>
        ) : (
          <>
            <h1 className="text-xl font-bold text-primary font-headline tracking-tight">Wave One</h1>
            <p className="text-label-caps text-outline tracking-widest mt-1">Gestión Administrativa</p>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center transition-all group relative ${
                collapsed ? "px-0 py-3 justify-center" : "px-4 py-3"
              } ${
                active
                  ? "text-primary bg-blue-50 border-r-4 border-primary font-semibold"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {!collapsed && <span className="text-sm ml-3">{item.label}</span>}
              {!collapsed && item.label === "Finanzas" && sinAsignar > 0 && (
                <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {sinAsignar}
                </span>
              )}
              {collapsed && item.label === "Finanzas" && sinAsignar > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
              )}
              {/* Tooltip on collapsed */}
              {collapsed && (
                <span className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle collapse button */}
      <div className="mt-auto px-4">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2 text-outline hover:text-on-surface hover:bg-slate-50 rounded-lg transition-all"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          <span className="material-symbols-outlined text-sm">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span className="text-xs">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Actualizar TopBar.tsx**

Reemplazar `components/layout/TopBar.tsx` completo:

```tsx
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

interface TopBarProps {
  onSearch?: (query: string) => void;
  collapsed?: boolean;
  onMobileMenuClick?: () => void;
}

export function TopBar({ onSearch, collapsed = false, onMobileMenuClick }: TopBarProps) {
  const { session } = useSessionContext();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const email = session?.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const leftOffset = collapsed ? "md:left-16" : "md:left-60";
  const rightWidth = collapsed ? "md:w-[calc(100%-64px)]" : "md:w-[calc(100%-240px)]";

  return (
    <header
      className={`fixed top-0 right-0 left-0 ${leftOffset} ${rightWidth} h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-40 flex justify-between items-center px-4 md:px-8 transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={onMobileMenuClick}
        >
          <span className="material-symbols-outlined text-outline">menu</span>
        </button>

        <div className="flex items-center bg-surface-container-low px-4 py-1.5 rounded-full w-48 md:w-96">
          <span className="material-symbols-outlined text-outline text-lg">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm font-body w-full placeholder:text-outline-variant ml-2"
            placeholder="Buscar..."
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch?.(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="hover:bg-slate-100 rounded-full p-2 transition-all hidden md:block">
          <span className="material-symbols-outlined text-outline">notifications</span>
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-on-surface hidden md:block">{email}</p>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-xs hover:opacity-80 transition-all"
            title="Cerrar sesión"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Probar en browser**

```bash
npm run dev
```

Verificar: sidebar colapsa al hacer click en chevron, persiste en localStorage, en móvil (<768px) aparece botón hamburguesa y drawer deslizable.

- [ ] **Step 6: Commit**

```bash
git add components/layout/Layout.tsx components/layout/Sidebar.tsx components/layout/TopBar.tsx
git commit -m "feat: collapsible sidebar + mobile drawer"
```

---

### Task 8: API route — desactivar corredor

**Files:**
- Create: `pages/api/corredores/[id]/desactivar.ts`

- [ ] **Step 1: Crear la ruta**

```bash
mkdir -p /Users/sebastianalvarez/projects/wave-one-dashboard/pages/api/corredores/\[id\]
```

```typescript
// pages/api/corredores/[id]/desactivar.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { id } = req.query as { id: string };
  const supabase = createServerClient();
  const hoy = new Date().toISOString().split("T")[0];

  // 1. Obtener corredor con plan
  const { data: corredor, error: fetchErr } = await supabase
    .from("corredores")
    .select("*, plan:planes(precio_mensual)")
    .eq("id", id)
    .single();

  if (fetchErr || !corredor) {
    return res.status(404).json({ error: "Corredor no encontrado" });
  }

  // 2. Obtener transacciones pagadas existentes
  const { data: transacciones } = await supabase
    .from("transacciones")
    .select("fecha")
    .eq("corredor_id", id)
    .eq("tipo", "ingreso")
    .eq("estado", "pagado");

  const pagadosSet = new Set(
    (transacciones ?? []).map((t) => {
      const d = new Date(t.fecha);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );

  // 3. Obtener pausas
  const { data: pausas } = await supabase
    .from("pausas")
    .select("mes, año")
    .eq("corredor_id", id);

  const pausasSet = new Set(
    (pausas ?? []).map((p) => `${p.año}-${p.mes - 1}`)
  );

  // 4. Calcular meses con deuda
  const inicio = new Date(corredor.fecha_ingreso);
  const fin = new Date();
  const precio = corredor.plan?.precio_mensual ?? 0;
  const mesesDeuda: { fecha: string; monto: number }[] = [];

  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  while (y < fin.getFullYear() || (y === fin.getFullYear() && m <= fin.getMonth())) {
    const key = `${y}-${m}`;
    if (!pagadosSet.has(key) && !pausasSet.has(key)) {
      const fecha = new Date(y, m, 1).toISOString().split("T")[0];
      mesesDeuda.push({ fecha, monto: precio });
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }

  // 5. Insertar deudas pendientes (upsert por corredor_id + fecha)
  if (mesesDeuda.length > 0) {
    const registros = mesesDeuda.map(({ fecha, monto }) => ({
      tipo: "ingreso",
      descripcion: `Deuda pendiente — mes ${fecha.slice(0, 7)}`,
      monto,
      fecha,
      categoria: "membresia",
      metodo: "transferencia",
      estado: "pendiente",
      corredor_id: id,
      stripe_payment_id: null,
      paypal_order_id: null,
    }));

    const { error: insertErr } = await supabase
      .from("transacciones")
      .upsert(registros, { onConflict: "corredor_id,fecha" });

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message });
    }
  }

  // 6. Actualizar estado del corredor
  const { error: updateErr } = await supabase
    .from("corredores")
    .update({ estado: "inactivo", fecha_salida: hoy })
    .eq("id", id);

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({ ok: true, deudasRegistradas: mesesDeuda.length });
}
```

**Nota:** La constraint `upsert` en `corredor_id,fecha` requiere un índice único en Supabase. Ejecutar en SQL Editor:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS transacciones_corredor_fecha_idx
ON transacciones (corredor_id, fecha)
WHERE tipo = 'ingreso' AND estado = 'pendiente';
```

- [ ] **Step 2: Actualizar FormCorredor para llamar la API al desactivar**

En `components/corredores/FormCorredor.tsx`, dentro de `handleSubmit`, reemplazar el bloque `if (isEditing)` del update:

```typescript
if (isEditing) {
  const estaDesactivando =
    form.estado === "inactivo" && corredor.estado !== "inactivo";

  if (estaDesactivando) {
    // Llamar API route atómica
    const response = await fetch(`/api/corredores/${corredor.id}/desactivar`, {
      method: "POST",
    });
    if (!response.ok) {
      toast.error("Error al desactivar el corredor");
      setLoading(false);
      return;
    }
    // Actualizar resto de campos excepto estado (ya lo maneja la API)
    const { estado: _, ...restoPayload } = payload;
    const { error } = await supabase
      .from("corredores")
      .update(restoPayload)
      .eq("id", corredor.id);
    if (error) {
      toast.error("Error al actualizar datos del corredor");
      setLoading(false);
      return;
    }
  } else {
    const { error } = await supabase
      .from("corredores")
      .update(payload)
      .eq("id", corredor.id);
    if (error) {
      toast.error("Error al guardar el corredor");
      setLoading(false);
      return;
    }
  }
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add pages/api/corredores components/corredores/FormCorredor.tsx
git commit -m "feat: auto-register debts when deactivating a corredor"
```

---

### Task 9: Reembolsos automáticos — webhooks

**Files:**
- Modify: `pages/api/webhooks/stripe.ts`
- Modify: `pages/api/webhooks/paypal.ts`

- [ ] **Step 1: Agregar charge.refunded en Stripe webhook**

En `pages/api/webhooks/stripe.ts`, dentro del bloque `try` después del `if (event.type === "invoice.payment_failed")`:

```typescript
if (event.type === "charge.refunded") {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string | null;
  if (paymentIntentId) {
    await supabase
      .from("transacciones")
      .update({ estado: "reembolsado" })
      .eq("stripe_payment_id", paymentIntentId);
  }
}
```

Agregar el import de tipo si hace falta (ya está importado `Stripe` desde `stripe`).

- [ ] **Step 2: Agregar PAYMENT.SALE.REVERSED en PayPal webhook**

En `pages/api/webhooks/paypal.ts`, dentro del bloque `try` después del `if (body.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED")`:

```typescript
if (body.event_type === "PAYMENT.SALE.REVERSED") {
  const saleId = body.resource.id;
  await supabase
    .from("transacciones")
    .update({ estado: "reembolsado" })
    .eq("paypal_order_id", saleId);
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add pages/api/webhooks/stripe.ts pages/api/webhooks/paypal.ts
git commit -m "feat: handle automatic refunds from Stripe and PayPal webhooks"
```

---

### Task 10: Reembolso manual en TablaTransacciones

**Files:**
- Modify: `components/finanzas/TablaTransacciones.tsx`
- Modify: `pages/finanzas/index.tsx`

- [ ] **Step 1: Agregar columna ACCIONES y botón reembolsar**

En `components/finanzas/TablaTransacciones.tsx`, agregar prop `onRefund` e implementar botón:

```tsx
interface TablaTransaccionesProps {
  transacciones: Transaccion[];
  loading: boolean;
  onRefund?: (id: string) => Promise<void>;
}

export function TablaTransacciones({ transacciones, loading, onRefund }: TablaTransaccionesProps) {
```

En los headers de la tabla, agregar `"ACCIONES"` al final del array si `onRefund` está definido:

```tsx
{["FECHA", "ENTIDAD", "CATEGORÍA", "CANTIDAD", "ESTADO", "FUENTE", ...(onRefund ? ["ACCIONES"] : [])].map((h) => (
  <th key={h} className="px-md py-4 font-label-caps text-on-surface-variant text-xs">{h}</th>
))}
```

En cada fila, agregar celda de acciones al final:

```tsx
{onRefund && (
  <td className="px-md py-4">
    {t.estado === "pagado" && (
      <button
        onClick={async () => {
          if (confirm(`¿Marcar como reembolsado el pago de $${Number(t.monto).toFixed(2)}?`)) {
            await onRefund(t.id);
          }
        }}
        className="text-xs text-outline hover:text-error flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-sm">undo</span>
        Reembolsar
      </button>
    )}
  </td>
)}
```

- [ ] **Step 2: Conectar onRefund en finanzas/index.tsx**

En `pages/finanzas/index.tsx`, localizar donde se usa `<TablaTransacciones>` y agregar:

```tsx
const supabase = useSupabaseClient();

const handleRefund = async (id: string) => {
  const { error } = await supabase
    .from("transacciones")
    .update({ estado: "reembolsado" })
    .eq("id", id);
  if (error) toast.error("Error al registrar reembolso");
  else { toast.success("Reembolso registrado"); refetch(); }
};

// En el JSX:
<TablaTransacciones
  transacciones={transacciones}
  loading={loading}
  onRefund={handleRefund}
/>
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/finanzas/TablaTransacciones.tsx pages/finanzas/index.tsx
git commit -m "feat: manual refund button in transactions table"
```

---

### Task 11: Coaches — hook y páginas

**Files:**
- Create: `hooks/useCoach.ts`
- Create: `pages/coaches/index.tsx`
- Create: `pages/coaches/[id].tsx`

- [ ] **Step 1: Crear hook useCoach**

```typescript
// hooks/useCoach.ts
import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { User, Corredor, Transaccion, HistorialItem } from "@/types/database";

export interface CoachStats {
  coach: User;
  corredores: Corredor[];
  transacciones: Transaccion[];
  historial: HistorialItem[];
  totalActivos: number;
  ingresosMes: number;
}

export function useCoach(coachId: string | undefined) {
  const supabase = useSupabaseClient();
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoach = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    const inicioMesStr = inicioMes.toISOString().split("T")[0];

    const [
      { data: coach },
      { data: corredores },
    ] = await Promise.all([
      supabase.from("users").select("*").eq("id", coachId).single(),
      supabase
        .from("corredores")
        .select("*, plan:planes(id, nombre, precio_mensual)")
        .eq("entrenador_id", coachId),
    ]);

    if (!coach || !corredores) { setLoading(false); return; }

    const corredorIds = corredores.map((c) => c.id);

    const [{ data: transacciones }, { data: historial }] = await Promise.all([
      corredorIds.length > 0
        ? supabase
            .from("transacciones")
            .select("*, corredor:corredores(id, nombre)")
            .in("corredor_id", corredorIds)
            .eq("tipo", "ingreso")
            .eq("estado", "pagado")
            .gte("fecha", inicioMesStr)
        : Promise.resolve({ data: [] }),
      corredorIds.length > 0
        ? supabase
            .from("historial_corredores")
            .select("*, creado_por_user:users(id, nombre)")
            .in("corredor_id", corredorIds)
            .order("fecha", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    setStats({
      coach: coach as User,
      corredores: corredores as Corredor[],
      transacciones: (transacciones ?? []) as Transaccion[],
      historial: (historial ?? []) as HistorialItem[],
      totalActivos: corredores.filter((c) => c.estado === "activo").length,
      ingresosMes: (transacciones ?? []).reduce((s, t) => s + Number(t.monto), 0),
    });
    setLoading(false);
  }, [supabase, coachId]);

  useEffect(() => { fetchCoach(); }, [fetchCoach]);

  return { stats, loading };
}
```

- [ ] **Step 2: Crear página /coaches/index.tsx**

```tsx
// pages/coaches/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";
import type { User } from "@/types/database";

interface CoachRow extends User {
  totalCorredores: number;
  corredoresActivos: number;
}

export default function CoachesPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("rol")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const rol = data?.rol ?? "";
        setUserRol(rol);
        if (rol === "entrenador") {
          router.replace(`/coaches/${user.id}`);
        }
      });
  }, [user, supabase, router]);

  useEffect(() => {
    if (userRol !== "admin") return;
    supabase
      .from("users")
      .select("*")
      .eq("rol", "entrenador")
      .then(async ({ data: entrenadores }) => {
        if (!entrenadores) { setLoading(false); return; }
        const rows = await Promise.all(
          entrenadores.map(async (e) => {
            const { data: corredores } = await supabase
              .from("corredores")
              .select("id, estado")
              .eq("entrenador_id", e.id);
            return {
              ...e,
              totalCorredores: corredores?.length ?? 0,
              corredoresActivos: corredores?.filter((c) => c.estado === "activo").length ?? 0,
            } as CoachRow;
          })
        );
        setCoaches(rows);
        setLoading(false);
      });
  }, [userRol, supabase]);

  if (userRol === "entrenador") return null;

  return (
    <>
      <Head><title>Wave One — Coaches</title></Head>
      <Layout>
        <div className="space-y-8">
          <h2 className="text-headline-lg text-on-surface font-headline">Coaches</h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-slate-100">
                    {["NOMBRE", "EMAIL", "CORREDORES", "ACTIVOS", ""].map((h) => (
                      <th key={h} className="px-6 py-4 font-label-caps text-on-surface-variant text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coaches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-outline text-sm">
                        No hay coaches registrados.
                      </td>
                    </tr>
                  )}
                  {coaches.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-on-surface text-sm">{c.nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.totalCorredores}</td>
                      <td className="px-6 py-4 text-sm text-secondary font-semibold">{c.corredoresActivos}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/coaches/${c.id}`}
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          Ver detalle
                          <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 3: Crear página /coaches/[id].tsx**

```tsx
// pages/coaches/[id].tsx
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { Layout } from "@/components/layout/Layout";
import { useCoach } from "@/hooks/useCoach";
import { MESES_ES } from "@/lib/deudas";

export default function CoachDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { stats, loading } = useCoach(id);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <p className="text-outline">Coach no encontrado.</p>
      </Layout>
    );
  }

  return (
    <>
      <Head><title>Wave One — {stats.coach.nombre}</title></Head>
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/coaches" className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h2 className="text-headline-lg text-on-surface font-headline">{stats.coach.nombre}</h2>
              <p className="text-body-md text-outline">{stats.coach.email}</p>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Corredores", value: stats.corredores.length },
              { label: "Activos", value: stats.totalActivos },
              { label: "Ingresos del Mes", value: `$${stats.ingresosMes.toFixed(2)}` },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-label-caps text-slate-400 uppercase mb-2 text-xs">{m.label}</p>
                <span className="text-headline-md font-headline text-on-surface">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Corredores */}
          <div>
            <h3 className="text-headline-sm font-headline text-on-surface mb-4">Corredores asignados</h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-slate-100">
                    {["NOMBRE", "PLAN", "ESTADO"].map((h) => (
                      <th key={h} className="px-6 py-4 font-label-caps text-on-surface-variant text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.corredores.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-outline text-sm">
                        Sin corredores asignados.
                      </td>
                    </tr>
                  )}
                  {stats.corredores.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-sm">
                        <Link href={`/corredores/${c.id}`} className="text-primary hover:underline">{c.nombre}</Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.plan?.nombre ?? "Sin plan"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          c.estado === "activo" ? "bg-secondary/10 text-secondary" :
                          c.estado === "pausado" ? "bg-primary/10 text-primary" :
                          "bg-slate-100 text-slate-500"
                        }`}>{c.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial reciente */}
          {stats.historial.length > 0 && (
            <div>
              <h3 className="text-headline-sm font-headline text-on-surface mb-4">Historial reciente</h3>
              <div className="space-y-2">
                {stats.historial.map((h) => (
                  <div key={h.id} className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-start gap-4">
                    <span className="material-symbols-outlined text-outline text-sm mt-0.5">history</span>
                    <div>
                      <p className="text-sm text-on-surface">
                        {h.tipo === "cambio_estado" && `Estado: ${h.estado_anterior} → ${h.estado_nuevo}`}
                        {h.tipo === "cambio_plan" && `Plan: ${h.plan_anterior?.nombre ?? "-"} → ${h.plan_nuevo?.nombre ?? "-"}`}
                        {h.tipo === "pausa" && `Pausa: ${MESES_ES[(h.mes ?? 1) - 1]} ${h.año}`}
                        {h.tipo === "nota" && h.nota}
                      </p>
                      <p className="text-xs text-outline mt-0.5">
                        {new Date(h.fecha).toLocaleDateString("es-MX")}
                        {h.creado_por_user && ` · ${h.creado_por_user.nombre}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add hooks/useCoach.ts pages/coaches/
git commit -m "feat: coaches list and detail pages"
```

---

### Task 12: Middleware — proteger /coaches/[id] por rol

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Actualizar middleware**

Reemplazar `middleware.ts` completo:

```typescript
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  const publicPaths = ["/login", "/signup"];
  const isPublicPage = publicPaths.includes(req.nextUrl.pathname);

  if (!session && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && isPublicPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Proteger /coaches/[id]: entrenador solo puede ver su propio perfil
  const coachDetailMatch = req.nextUrl.pathname.match(/^\/coaches\/([^/]+)$/);
  if (session && coachDetailMatch) {
    const requestedId = coachDetailMatch[1];
    const userId = session.user.id;

    const { data: userRow } = await supabase
      .from("users")
      .select("rol")
      .eq("id", userId)
      .single();

    if (userRow?.rol === "entrenador" && requestedId !== userId) {
      return NextResponse.redirect(new URL(`/coaches/${userId}`, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /coaches/[id] route by user role"
```

---

### Task 13: Deploy final

- [ ] **Step 1: Build de producción**

```bash
npm run build
```

Esperado: sin errores de compilación ni type errors.

- [ ] **Step 2: Agregar variables de entorno en Vercel**

En Vercel Dashboard → Project → Settings → Environment Variables, verificar que existan:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para las API routes server-side)
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_WEBHOOK_ID`

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```

- [ ] **Step 4: Invocar ui-ux-pro-max**

Usar el skill `ui-ux-pro-max:ui-ux-pro-max` para hacer un pase de mejoras visuales sobre todo lo implementado.

---

## Notas de implementación

- La constraint única `transacciones(corredor_id, fecha)` debe crearse en Supabase antes de desactivar corredores.
- La tabla `historial_corredores` debe existir en Supabase para que la página de coaches muestre historial.
- El enum `reembolsado` en Supabase debe agregarse antes de intentar insertar transacciones con ese estado.
