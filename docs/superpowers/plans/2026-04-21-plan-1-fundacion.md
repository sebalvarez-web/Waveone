# RunTeam Pro — Plan 1: Fundación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el directorio de archivos HTML estáticos en un proyecto Next.js funcional con Supabase, autenticación multi-usuario, y un layout shell navegable.

**Architecture:** Next.js 14 Pages Router + TypeScript + Supabase Auth Helpers. El cliente de Supabase corre en el browser para queries. Middleware de Next.js protege todas las rutas excepto `/login`. Los archivos HTML originales se mueven a `reference/` como guía visual.

**Tech Stack:** Next.js 14, TypeScript, @supabase/supabase-js, @supabase/auth-helpers-nextjs, Tailwind CSS, Jest, @testing-library/react, react-hot-toast.

**Resultado al completar este plan:** Puedes entrar a `/login`, autenticarte con email/contraseña, ver el layout shell (Sidebar + TopBar) con navegación funcional entre las 4 páginas, y el contenido es datos estáticos de placeholder (los datos reales llegan en Plan 2).

---

## Mapa de archivos

```
// Raíz del proyecto
package.json
next.config.js
tailwind.config.ts
tsconfig.json
.env.local                          ← NUNCA commitear
.gitignore

// Supabase
lib/supabase-browser.ts             ← cliente para browser (Supabase JS)
lib/supabase-server.ts              ← cliente para API routes (service role)
types/database.ts                   ← tipos TypeScript de todas las tablas

// Migraciones SQL (ejecutar en Supabase dashboard)
supabase/migrations/001_schema.sql
supabase/migrations/002_rls.sql

// Middleware de auth
middleware.ts

// App shell
pages/_app.tsx
pages/_document.tsx

// Layout
components/layout/Layout.tsx
components/layout/Sidebar.tsx
components/layout/TopBar.tsx
components/ui/Toast.tsx

// Páginas (placeholder por ahora)
pages/login.tsx
pages/index.tsx
pages/corredores/index.tsx
pages/corredores/[id].tsx
pages/finanzas/index.tsx

// Tests
__tests__/middleware.test.ts
__tests__/components/Sidebar.test.tsx
__tests__/components/layout/Layout.test.tsx

// Referencia visual (los HTML originales)
reference/index.html
reference/corredores.html
reference/corredor-perfil.html
reference/finanzas.html
```

---

## Task 1: Inicializar proyecto Next.js en el directorio existente

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `.env.local`
- Create: `.gitignore`
- Create: `reference/` (mover los HTML aquí)

- [ ] **Step 1: Mover archivos HTML a carpeta de referencia**

```bash
cd /Users/sebastianalvarez/projects/wave-one-dashboard
mkdir -p reference
mv index.html corredores.html corredor-perfil.html finanzas.html reference/
```

- [ ] **Step 2: Inicializar Next.js**

```bash
cd /Users/sebastianalvarez/projects/wave-one-dashboard
npx create-next-app@14 . --typescript --tailwind --eslint --no-app --no-src-dir --import-alias="@/*"
```

Cuando pregunte si continuar en directorio existente: **Yes**.
Cuando pregunte por `src/` directory: **No**.
Cuando pregunte por App Router: **No** (queremos Pages Router).

- [ ] **Step 3: Instalar dependencias adicionales**

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs react-hot-toast
npm install --save-dev jest @types/jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest @testing-library/user-event
```

- [ ] **Step 4: Reemplazar `tailwind.config.ts` con el design system del proyecto**

Reemplazar el contenido generado por Next.js con:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "outline-variant": "#c4c6d1",
        "surface-dim": "#dad9de",
        "surface-variant": "#e3e2e7",
        "on-primary": "#ffffff",
        "primary-fixed": "#dce1ff",
        "on-background": "#1a1b1f",
        error: "#ba1a1a",
        "primary-container": "#002358",
        "surface-container": "#efedf2",
        secondary: "#006e2e",
        "on-error": "#ffffff",
        "surface-container-highest": "#e3e2e7",
        "on-surface-variant": "#44464f",
        "surface-container-high": "#e9e7ed",
        surface: "#faf8fe",
        primary: "#002358",
        "on-primary-container": "#ffffff",
        "on-secondary": "#ffffff",
        "surface-container-low": "#f4f3f8",
        "tertiary-container": "#4b1200",
        "on-error-container": "#93000a",
        "secondary-container": "#61fc89",
        "surface-container-lowest": "#ffffff",
        "on-secondary-container": "#007230",
        outline: "#747780",
        tertiary: "#280600",
        background: "#faf8fe",
        "error-container": "#ffdad6",
        "on-surface": "#1a1b1f",
        "on-secondary-fixed-variant": "#005321",
        "surface-container-lowest": "#ffffff",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        lg: "48px",
        gutter: "24px",
        sm: "12px",
        base: "8px",
        xs: "4px",
        md: "24px",
      },
      fontFamily: {
        headline: ["Lexend", "sans-serif"],
        body: ["Work Sans", "sans-serif"],
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "data-mono": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Crear `next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
```

- [ ] **Step 6: Crear `.env.local` (plantilla — rellenar con tus valores reales)**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

PAYPAL_CLIENT_ID=TU_CLIENT_ID
PAYPAL_CLIENT_SECRET=TU_CLIENT_SECRET
PAYPAL_WEBHOOK_ID=TU_WEBHOOK_ID
NEXT_PUBLIC_PAYPAL_CLIENT_ID=TU_CLIENT_ID
EOF
```

- [ ] **Step 7: Actualizar `.gitignore` para proteger `.env.local`**

Verificar que `.gitignore` (generado por create-next-app) contenga `.env.local`. Si no:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 8: Configurar Jest**

Crear `jest.config.ts`:

```typescript
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["<rootDir>/jest.setup.ts"],
};

export default createJestConfig(config);
```

Crear `jest.setup.ts`:

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 9: Verificar que el proyecto compila**

```bash
npm run build
```

Esperado: build exitoso sin errores de TypeScript.

- [ ] **Step 10: Commit inicial**

```bash
git init
git add -A
git commit -m "feat: initialize Next.js 14 project with Tailwind design system"
```

---

## Task 2: Tipos TypeScript y clientes de Supabase

**Files:**
- Create: `types/database.ts`
- Create: `lib/supabase-browser.ts`
- Create: `lib/supabase-server.ts`

- [ ] **Step 1: Crear `types/database.ts`**

```typescript
export type UserRol = "admin" | "entrenador";
export type CorredorEstado = "activo" | "pausado" | "inactivo";
export type TransaccionTipo = "ingreso" | "gasto";
export type TransaccionMetodo = "stripe" | "paypal" | "transferencia" | "efectivo";
export type TransaccionEstado = "pagado" | "pendiente" | "vencido";
export type PagoFuente = "stripe" | "paypal";

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRol;
  created_at: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  descripcion: string;
}

export interface Corredor {
  id: string;
  nombre: string;
  email: string;
  telefono_emergencia: string | null;
  fecha_ingreso: string;
  fecha_salida: string | null;
  entrenador_id: string;
  plan_id: string | null;
  estado: CorredorEstado;
  uniforme_entregado: boolean;
  proxima_carrera: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paypal_payer_id: string | null;
  paypal_subscription_id: string | null;
  created_at: string;
  // joins opcionales
  plan?: Plan;
  entrenador?: User;
}

export interface Pausa {
  id: string;
  corredor_id: string;
  mes: number;
  año: number;
  tarifa_mantenimiento: number;
}

export interface Transaccion {
  id: string;
  tipo: TransaccionTipo;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: string;
  metodo: TransaccionMetodo;
  estado: TransaccionEstado;
  corredor_id: string | null;
  stripe_payment_id: string | null;
  paypal_order_id: string | null;
  created_at: string;
  // joins opcionales
  corredor?: Pick<Corredor, "id" | "nombre">;
}

export interface PagoSinAsignar {
  id: string;
  fuente: PagoFuente;
  payload: Record<string, unknown>;
  monto: number;
  fecha: string;
  resuelto: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Crear `lib/supabase-browser.ts`**

```typescript
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export const createBrowserClient = () => createPagesBrowserClient();
```

- [ ] **Step 3: Crear `lib/supabase-server.ts`**

Para uso exclusivo en API routes (tiene acceso total, sin RLS).

```typescript
import { createClient } from "@supabase/supabase-js";

export const createServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
};
```

- [ ] **Step 4: Commit**

```bash
git add types/database.ts lib/supabase-browser.ts lib/supabase-server.ts
git commit -m "feat: add Supabase clients and TypeScript database types"
```

---

## Task 3: Migraciones de base de datos en Supabase

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_rls.sql`

Estas migraciones se ejecutan manualmente en el SQL Editor de Supabase (supabase.com → tu proyecto → SQL Editor).

- [ ] **Step 1: Crear `supabase/migrations/001_schema.sql`**

```sql
-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- Enum types
create type user_rol as enum ('admin', 'entrenador');
create type corredor_estado as enum ('activo', 'pausado', 'inactivo');
create type transaccion_tipo as enum ('ingreso', 'gasto');
create type transaccion_metodo as enum ('stripe', 'paypal', 'transferencia', 'efectivo');
create type transaccion_estado as enum ('pagado', 'pendiente', 'vencido');
create type pago_fuente as enum ('stripe', 'paypal');

-- Tabla users (extiende auth.users de Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol user_rol not null default 'entrenador',
  created_at timestamptz not null default now()
);

-- Tabla planes
create table public.planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio_mensual numeric(10,2) not null,
  descripcion text,
  created_at timestamptz not null default now()
);

-- Tabla corredores
create table public.corredores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono_emergencia text,
  fecha_ingreso date not null default current_date,
  fecha_salida date,
  entrenador_id uuid not null references public.users(id),
  plan_id uuid references public.planes(id),
  estado corredor_estado not null default 'activo',
  uniforme_entregado boolean not null default false,
  proxima_carrera text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  paypal_payer_id text,
  paypal_subscription_id text unique,
  created_at timestamptz not null default now()
);

-- Tabla pausas
create table public.pausas (
  id uuid primary key default gen_random_uuid(),
  corredor_id uuid not null references public.corredores(id) on delete cascade,
  mes integer not null check (mes between 1 and 12),
  año integer not null,
  tarifa_mantenimiento numeric(10,2) not null default 5.00,
  unique(corredor_id, mes, año)
);

-- Tabla transacciones
create table public.transacciones (
  id uuid primary key default gen_random_uuid(),
  tipo transaccion_tipo not null,
  descripcion text not null,
  monto numeric(10,2) not null,
  fecha date not null default current_date,
  categoria text not null default 'otro',
  metodo transaccion_metodo not null,
  estado transaccion_estado not null default 'pendiente',
  corredor_id uuid references public.corredores(id) on delete set null,
  stripe_payment_id text unique,
  paypal_order_id text unique,
  created_at timestamptz not null default now()
);

-- Tabla pagos_sin_asignar
create table public.pagos_sin_asignar (
  id uuid primary key default gen_random_uuid(),
  fuente pago_fuente not null,
  payload jsonb not null,
  monto numeric(10,2) not null,
  fecha date not null default current_date,
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

-- Trigger: crear fila en public.users cuando se registra en auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::user_rol, 'entrenador')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Datos iniciales: planes de ejemplo
insert into public.planes (nombre, precio_mensual, descripcion) values
  ('Desarrollo Juvenil', 15.00, 'Para corredores en formación'),
  ('Base de Resistencia', 25.00, 'Entrenamiento base'),
  ('Club Competitivo', 45.00, 'Preparación para competencias'),
  ('Performance Élite', 85.00, 'Alto rendimiento');
```

- [ ] **Step 2: Ejecutar `001_schema.sql` en Supabase**

1. Entrar a supabase.com → tu proyecto
2. SQL Editor → New query
3. Pegar el contenido de `001_schema.sql`
4. Click "Run"
5. Verificar que no hay errores

- [ ] **Step 3: Crear `supabase/migrations/002_rls.sql`**

```sql
-- Habilitar RLS en todas las tablas
alter table public.users enable row level security;
alter table public.planes enable row level security;
alter table public.corredores enable row level security;
alter table public.pausas enable row level security;
alter table public.transacciones enable row level security;
alter table public.pagos_sin_asignar enable row level security;

-- Helper: verificar si el usuario actual es admin
create or replace function public.es_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and rol = 'admin'
  );
$$ language sql security definer stable;

-- USERS: todos los autenticados ven todos los usuarios (para mostrar nombre de entrenador)
create policy "users: lectura autenticados" on public.users
  for select using (auth.uid() is not null);

create policy "users: solo admin escribe" on public.users
  for all using (public.es_admin());

-- PLANES: todos los autenticados pueden leer
create policy "planes: lectura autenticados" on public.planes
  for select using (auth.uid() is not null);

create policy "planes: solo admin escribe" on public.planes
  for all using (public.es_admin());

-- CORREDORES: admin ve todos, entrenador solo los suyos
create policy "corredores: admin ve todos" on public.corredores
  for all using (public.es_admin());

create policy "corredores: entrenador ve los suyos" on public.corredores
  for select using (entrenador_id = auth.uid());

create policy "corredores: entrenador edita los suyos" on public.corredores
  for update using (entrenador_id = auth.uid());

-- PAUSAS: siguen la misma lógica que corredores
create policy "pausas: admin ve todas" on public.pausas
  for all using (public.es_admin());

create policy "pausas: entrenador ve las suyas" on public.pausas
  for select using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

-- TRANSACCIONES: admin ve todas, entrenador ve las de sus corredores
create policy "transacciones: admin ve todas" on public.transacciones
  for all using (public.es_admin());

create policy "transacciones: entrenador ve las suyas" on public.transacciones
  for select using (
    corredor_id is null or
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id and c.entrenador_id = auth.uid()
    )
  );

-- PAGOS SIN ASIGNAR: solo admin
create policy "pagos_sin_asignar: solo admin" on public.pagos_sin_asignar
  for all using (public.es_admin());
```

- [ ] **Step 4: Ejecutar `002_rls.sql` en Supabase**

SQL Editor → New query → pegar contenido → Run.

- [ ] **Step 5: Crear primer usuario admin en Supabase**

En Supabase → Authentication → Users → "Invite user":
- Email: tu email de admin
- Después de crear, ir a Table Editor → `users` → editar la fila → cambiar `rol` a `admin`

- [ ] **Step 6: Commit**

```bash
git add supabase/ types/ lib/
git commit -m "feat: add database migrations, RLS policies, and Supabase types"
```

---

## Task 4: Middleware de autenticación

**Files:**
- Create: `middleware.ts`
- Create: `__tests__/middleware.test.ts`

- [ ] **Step 1: Escribir el test primero**

```typescript
// __tests__/middleware.test.ts
import { NextRequest, NextResponse } from "next/server";

// Mock de Supabase auth-helpers
jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createMiddlewareClient: jest.fn(),
}));

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { middleware } from "../middleware";

const mockCreateMiddlewareClient = createMiddlewareClient as jest.Mock;

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

describe("middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("permite acceso a /login sin sesión", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });

    const req = makeRequest("/login");
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });

  it("redirige a /login si no hay sesión en ruta protegida", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    });

    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("permite acceso a ruta protegida con sesión activa", async () => {
    mockCreateMiddlewareClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: "abc" } } },
        }),
      },
    });

    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
  });
});
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npx jest __tests__/middleware.test.ts --no-coverage
```

Esperado: FAIL — "Cannot find module '../middleware'"

- [ ] **Step 3: Crear `middleware.ts`**

```typescript
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!session && !isLoginPage) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isLoginPage) {
    const dashboardUrl = new URL("/", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npx jest __tests__/middleware.test.ts --no-coverage
```

Esperado: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts __tests__/middleware.test.ts
git commit -m "feat: add auth middleware — protects all routes except /login and webhooks"
```

---

## Task 5: Página de login

**Files:**
- Create: `pages/login.tsx`

- [ ] **Step 1: Crear `pages/login.tsx`**

```tsx
import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <>
      <Head>
        <title>RunTeam Pro — Iniciar sesión</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-headline-md font-headline text-primary">
              RunTeam Pro
            </h1>
            <p className="text-body-md text-outline mt-1">
              Panel de Administración
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-8 space-y-5"
          >
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">
                CORREO ELECTRÓNICO
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="admin@equipo.com"
              />
            </div>

            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">
                CONTRASEÑA
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-error text-body-md text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg font-headline-sm text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Correr el servidor de desarrollo y verificar**

```bash
npm run dev
```

Abrir http://localhost:3000 — debe redirigir a http://localhost:3000/login.
Intentar login con el usuario admin creado en Supabase. Debe redirigir a `/`.

- [ ] **Step 3: Commit**

```bash
git add pages/login.tsx
git commit -m "feat: add login page with Supabase email/password auth"
```

---

## Task 6: `_app.tsx`, `_document.tsx` y Toast

**Files:**
- Create: `pages/_app.tsx`
- Create: `pages/_document.tsx`
- Create: `components/ui/Toast.tsx`

- [ ] **Step 1: Crear `components/ui/Toast.tsx`**

Wrapper delgado de react-hot-toast para usar en toda la app:

```tsx
import { Toaster, toast as hotToast } from "react-hot-toast";

export const toast = {
  success: (msg: string) => hotToast.success(msg),
  error: (msg: string) => hotToast.error(msg),
};

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "Work Sans, sans-serif",
          fontSize: "14px",
        },
      }}
    />
  );
}
```

- [ ] **Step 2: Crear `pages/_document.tsx`**

```tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="es" className="light">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <style>{`
          .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

- [ ] **Step 3: Crear `pages/_app.tsx`**

```tsx
import type { AppProps } from "next/app";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
      <ToastProvider />
    </SessionContextProvider>
  );
}
```

Nota: instalar también `@supabase/auth-helpers-react`:

```bash
npm install @supabase/auth-helpers-react
```

- [ ] **Step 4: Verificar en navegador**

```bash
npm run dev
```

Hacer login → verificar que no hay errores en consola.

- [ ] **Step 5: Commit**

```bash
git add pages/_app.tsx pages/_document.tsx components/ui/Toast.tsx
git commit -m "feat: add _app with Supabase session provider and toast notifications"
```

---

## Task 7: Layout Shell (Sidebar + TopBar + Layout)

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/TopBar.tsx`
- Create: `components/layout/Layout.tsx`
- Create: `__tests__/components/Sidebar.test.tsx`

- [ ] **Step 1: Escribir test del Sidebar**

```tsx
// __tests__/components/Sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { useRouter } from "next/router";
import { Sidebar } from "@/components/layout/Sidebar";

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

const mockUseRouter = useRouter as jest.Mock;

describe("Sidebar", () => {
  it("marca Panel Control como activo en la ruta /", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={0} />);
    const link = screen.getByText("Panel Control").closest("a");
    expect(link).toHaveClass("border-r-4");
  });

  it("marca Corredores como activo en la ruta /corredores", () => {
    mockUseRouter.mockReturnValue({ pathname: "/corredores" });
    render(<Sidebar pagosSinAsignar={0} />);
    const link = screen.getByText("Corredores").closest("a");
    expect(link).toHaveClass("border-r-4");
  });

  it("muestra badge cuando hay pagos sin asignar", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("no muestra badge cuando hay 0 pagos sin asignar", () => {
    mockUseRouter.mockReturnValue({ pathname: "/" });
    render(<Sidebar pagosSinAsignar={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
npx jest __tests__/components/Sidebar.test.tsx --no-coverage
```

Esperado: FAIL — "Cannot find module"

- [ ] **Step 3: Crear `components/layout/Sidebar.tsx`**

```tsx
import Link from "next/link";
import { useRouter } from "next/router";

interface SidebarProps {
  pagosSinAsignar: number;
}

const navItems = [
  { href: "/", label: "Panel Control", icon: "dashboard" },
  { href: "/corredores", label: "Corredores", icon: "directions_run" },
  { href: "/finanzas", label: "Finanzas", icon: "payments" },
  { href: "/configuracion", label: "Configuración", icon: "settings" },
];

export function Sidebar({ pagosSinAsignar }: SidebarProps) {
  const { pathname } = useRouter();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-slate-200 bg-white z-50 flex flex-col py-6">
      <div className="px-6 mb-8">
        <h1 className="text-xl font-bold text-primary font-headline tracking-tight">
          RunTeam Pro
        </h1>
        <p className="text-label-caps text-outline tracking-widest mt-1">
          Gestión Administrativa
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 transition-all ${
                active
                  ? "text-primary bg-blue-50 border-r-4 border-primary font-semibold"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined mr-3">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
              {item.label === "Finanzas" && pagosSinAsignar > 0 && (
                <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pagosSinAsignar}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <Link
          href="/corredores/nuevo"
          className="w-full bg-primary text-white py-3 rounded-lg font-headline text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Añadir Corredor
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Correr test — verificar que pasa**

```bash
npx jest __tests__/components/Sidebar.test.tsx --no-coverage
```

Esperado: PASS (4 tests)

- [ ] **Step 5: Crear `components/layout/TopBar.tsx`**

```tsx
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export function TopBar({ onSearch }: TopBarProps) {
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

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-40 flex justify-between items-center px-8">
      <div className="flex items-center bg-surface-container-low px-4 py-1.5 rounded-full w-96">
        <span className="material-symbols-outlined text-outline text-lg">search</span>
        <input
          className="bg-transparent border-none focus:ring-0 text-sm font-body w-full placeholder:text-outline-variant ml-2"
          placeholder="Buscar corredores o transacciones..."
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="hover:bg-slate-100 rounded-full p-2 transition-all">
          <span className="material-symbols-outlined text-outline">notifications</span>
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-on-surface">{email}</p>
          </div>
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

- [ ] **Step 6: Crear `components/layout/Layout.tsx`**

```tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  pagosSinAsignar?: number;
  onSearch?: (query: string) => void;
}

export function Layout({ children, pagosSinAsignar = 0, onSearch }: LayoutProps) {
  return (
    <div className="bg-background min-h-screen">
      <Sidebar pagosSinAsignar={pagosSinAsignar} />
      <TopBar onSearch={onSearch} />
      <main className="ml-60 pt-20 px-8 pb-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add components/layout/ __tests__/components/Sidebar.test.tsx
git commit -m "feat: add Layout shell with Sidebar, TopBar, and active nav state"
```

---

## Task 8: Páginas placeholder con layout real

**Files:**
- Modify: `pages/index.tsx`
- Create: `pages/corredores/index.tsx`
- Create: `pages/corredores/[id].tsx`
- Create: `pages/finanzas/index.tsx`

Estas páginas usan el layout real pero con contenido estático de placeholder. Los datos reales llegan en el Plan 2.

- [ ] **Step 1: Actualizar `pages/index.tsx`**

```tsx
import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function DashboardPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Panel</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-primary font-headline">
            Resumen del Panel
          </h2>
          <p className="text-body-lg text-outline">
            Métricas de rendimiento y salud financiera en tiempo real.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
          <p className="text-body-md">Dashboard con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 2: Crear `pages/corredores/index.tsx`**

```tsx
import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function CorredoresPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Corredores</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-surface font-headline">
            Base de Datos de Corredores
          </h2>
          <p className="text-body-lg text-outline">
            Gestiona los miembros activos y su logística de entrenamiento.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">directions_run</span>
          <p className="text-body-md">Tabla de corredores con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 3: Crear `pages/corredores/[id].tsx`**

```tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";

export default function CorredorPerfilPage() {
  const { query } = useRouter();

  return (
    <>
      <Head><title>RunTeam Pro — Perfil del Corredor</title></Head>
      <Layout>
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-label-caps text-outline mb-2 text-xs">
            <a href="/corredores" className="hover:text-primary">CORREDORES</a>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-on-surface">{query.id ?? "..."}</span>
          </nav>
          <h2 className="text-headline-lg text-on-surface font-headline">
            Perfil del Corredor
          </h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">person</span>
          <p className="text-body-md">Perfil con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 4: Crear `pages/finanzas/index.tsx`**

```tsx
import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function FinanzasPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Finanzas</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-background font-headline">
            Gestión Financiera
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Seguimiento de ingresos y costes operativos.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">payments</span>
          <p className="text-body-md">Gestión financiera con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
```

- [ ] **Step 5: Verificar navegación en el browser**

```bash
npm run dev
```

1. Login → aterrizas en `/` con layout completo
2. Click Corredores → `/corredores` con sidebar activo correcto
3. Click Finanzas → `/finanzas` con sidebar activo correcto
4. Click el avatar → logout → regresa a `/login`

- [ ] **Step 6: Commit**

```bash
git add pages/
git commit -m "feat: add placeholder pages with working layout and navigation"
```

---

## Task 9: Verificación final y build de producción

- [ ] **Step 1: Correr todos los tests**

```bash
npx jest --no-coverage
```

Esperado: PASS — middleware (3 tests) + Sidebar (4 tests)

- [ ] **Step 2: Build de producción**

```bash
npm run build
```

Esperado: sin errores de TypeScript ni build warnings críticos.

- [ ] **Step 3: Crear repositorio en GitHub**

```bash
gh repo create wave-one-dashboard --private --source=. --remote=origin --push
```

Si no tienes `gh` CLI instalado:
```bash
# Crear el repo manualmente en github.com, luego:
git remote add origin https://github.com/TU_USUARIO/wave-one-dashboard.git
git push -u origin main
```

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: Plan 1 complete — Next.js foundation with Supabase auth and layout shell"
git push origin main
```

---

## Resultado al completar Plan 1

- Proyecto Next.js 14 + TypeScript corriendo localmente
- Base de datos Supabase con todas las tablas, tipos y RLS
- Login funcional con Supabase Auth
- Middleware que protege todas las rutas
- Layout shell navegable (Sidebar + TopBar) con estado activo correcto
- Logout funcional
- 7 tests pasando
- Código en GitHub

**Siguiente:** Plan 2 — CRUD con datos reales (corredores, dashboard, finanzas).
