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
