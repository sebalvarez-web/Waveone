-- 009_coaches_limpio.sql
-- Reemplaza 008. Tabla `coaches` independiente de users:
--   - sin email
--   - sin auto-migración desde public.users
-- corredores.entrenador_id se vuelve nullable; los valores existentes se ponen
-- a NULL (el admin reasigna desde la UI). El FK ahora apunta a coaches(id).

-- 1) Limpiar estado parcial de la 008 si existe
alter table public.corredores
  drop constraint if exists corredores_entrenador_id_fkey;

drop policy if exists "coaches: lectura autenticados" on public.coaches;
drop policy if exists "coaches: solo admin escribe" on public.coaches;
drop table if exists public.coaches;

-- 2) Crear tabla coaches (sin email)
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_coaches_auth_user_id on public.coaches(auth_user_id);

-- 3) corredores.entrenador_id → nullable, valores actuales a NULL
alter table public.corredores
  alter column entrenador_id drop not null;

update public.corredores set entrenador_id = null;

alter table public.corredores
  add constraint corredores_entrenador_id_fkey
    foreign key (entrenador_id) references public.coaches(id) on delete set null;

-- 4) RLS
alter table public.coaches enable row level security;

create policy "coaches: lectura autenticados" on public.coaches
  for select using (auth.uid() is not null);

create policy "coaches: solo admin escribe" on public.coaches
  for all using (public.es_admin());

-- 5) Reescribir políticas de corredores/pausas/transacciones para mapear
--    auth.uid() -> coaches.auth_user_id

drop policy if exists "corredores: entrenador ve los suyos" on public.corredores;
create policy "corredores: entrenador ve los suyos" on public.corredores
  for select using (
    entrenador_id in (select id from public.coaches where auth_user_id = auth.uid())
  );

drop policy if exists "corredores: entrenador edita los suyos" on public.corredores;
create policy "corredores: entrenador edita los suyos" on public.corredores
  for update using (
    entrenador_id in (select id from public.coaches where auth_user_id = auth.uid())
  );

drop policy if exists "pausas: entrenador ve las suyas" on public.pausas;
create policy "pausas: entrenador ve las suyas" on public.pausas
  for select using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id
        and c.entrenador_id in (select id from public.coaches where auth_user_id = auth.uid())
    )
  );

drop policy if exists "transacciones: entrenador ve las suyas" on public.transacciones;
create policy "transacciones: entrenador ve las suyas" on public.transacciones
  for select using (
    corredor_id is null or
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id
        and c.entrenador_id in (select id from public.coaches where auth_user_id = auth.uid())
    )
  );

-- 6) Restaurar trigger handle_new_user a su forma original (sin email-link a coaches)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_existing_user uuid;
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='users'
                and column_name='auth_user_id') then
    select id into v_existing_user
      from public.users
     where email = new.email and auth_user_id is null
     limit 1;
    if v_existing_user is not null then
      update public.users
         set auth_user_id = new.id,
             nombre = coalesce(nombre, new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
       where id = v_existing_user;
    else
      insert into public.users (id, email, nombre, rol, auth_user_id)
      values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
        coalesce((new.raw_user_meta_data->>'rol')::user_rol, 'entrenador'),
        new.id
      );
    end if;
  else
    insert into public.users (id, email, nombre, rol)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
      coalesce((new.raw_user_meta_data->>'rol')::user_rol, 'entrenador')
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
