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
