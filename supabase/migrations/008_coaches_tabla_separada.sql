-- 008_coaches_tabla_separada.sql
-- Mueve los coaches a su propia tabla, independiente de public.users / auth.users.
-- Conserva los UUIDs existentes para no tocar corredores.entrenador_id.

-- 1) Tabla coaches
create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  telefono text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coaches_auth_user_id on public.coaches(auth_user_id);

-- 2) Migrar entrenadores existentes desde public.users a coaches.
--    Usamos el MISMO id para que corredores.entrenador_id siga siendo válido.
--    Copiamos TODA fila de users referenciada por algún corredores.entrenador_id
--    (sin importar rol) para no romper el FK.
do $$
declare
  v_has_auth_user_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='users'
       and column_name='auth_user_id'
  ) into v_has_auth_user_id;

  if v_has_auth_user_id then
    insert into public.coaches (id, nombre, email, auth_user_id, created_at)
    select u.id, u.nombre, u.email, u.auth_user_id, u.created_at
      from public.users u
     where u.rol = 'entrenador'
        or u.id in (select distinct entrenador_id from public.corredores where entrenador_id is not null)
    on conflict (email) do nothing;
  else
    insert into public.coaches (id, nombre, email, auth_user_id, created_at)
    select u.id, u.nombre, u.email,
           (select a.id from auth.users a where a.id = u.id),
           u.created_at
      from public.users u
     where u.rol = 'entrenador'
        or u.id in (select distinct entrenador_id from public.corredores where entrenador_id is not null)
    on conflict (email) do nothing;
  end if;
end $$;

-- Si alguno chocó por email único, reusamos el coach existente reasignando
-- corredores que apuntaban al user "perdedor".
update public.corredores c
   set entrenador_id = co.id
  from public.users u
  join public.coaches co on co.email = u.email
 where c.entrenador_id = u.id
   and co.id <> u.id;

-- Verificación: todo entrenador_id debe existir ya en coaches.
do $$
declare
  v_falta integer;
begin
  select count(*) into v_falta
    from public.corredores c
   where c.entrenador_id is not null
     and not exists (select 1 from public.coaches co where co.id = c.entrenador_id);
  if v_falta > 0 then
    raise exception 'Migración abortada: % corredores tienen entrenador_id sin fila en coaches. Resuélvelos antes de continuar.', v_falta;
  end if;
end $$;

-- 3) FK corredores.entrenador_id: ahora apunta a coaches.id (no a users.id)
alter table public.corredores
  drop constraint if exists corredores_entrenador_id_fkey;

alter table public.corredores
  add constraint corredores_entrenador_id_fkey
    foreign key (entrenador_id) references public.coaches(id) on delete restrict;

-- 4) RLS: coaches
alter table public.coaches enable row level security;

drop policy if exists "coaches: lectura autenticados" on public.coaches;
create policy "coaches: lectura autenticados" on public.coaches
  for select using (auth.uid() is not null);

drop policy if exists "coaches: solo admin escribe" on public.coaches;
create policy "coaches: solo admin escribe" on public.coaches
  for all using (public.es_admin());

-- 5) Reescribir políticas que mapeaban entrenador_id <-> auth.uid()
--    Ahora se mapea vía coaches.auth_user_id.

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

-- 6) Trigger: al crearse una cuenta auth, vincular coach existente por email.
--    Mantenemos también la inserción en public.users por compatibilidad
--    (admins, sesión actual, etc.).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_existing_user uuid;
  v_existing_coach uuid;
begin
  -- 1) Vincular coach fantasma si existe por email
  select id into v_existing_coach
    from public.coaches
   where email = new.email and auth_user_id is null
   limit 1;
  if v_existing_coach is not null then
    update public.coaches set auth_user_id = new.id where id = v_existing_coach;
  end if;

  -- 2) Manejo de public.users (mantiene comportamiento previo)
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
