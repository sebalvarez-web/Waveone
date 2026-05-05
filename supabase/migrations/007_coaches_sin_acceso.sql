-- 007_coaches_sin_acceso.sql
-- Permite crear coaches (rol='entrenador') que no tienen cuenta en auth.users.
-- Antes: public.users.id era FK directo a auth.users(id) — imposible insertar
-- un usuario sin cuenta de auth. Ahora: id es un UUID independiente y
-- auth_user_id (nullable, unique) opcionalmente vincula con auth.users.

-- 1) Romper FK de id -> auth.users(id)
alter table public.users
  drop constraint if exists users_id_fkey;

-- 2) Añadir columna de vínculo opcional
alter table public.users
  add column if not exists auth_user_id uuid unique
    references auth.users(id) on delete set null;

-- 3) Backfill: usuarios existentes tenían id == auth.users.id
update public.users u
   set auth_user_id = u.id
 where u.auth_user_id is null
   and exists (select 1 from auth.users a where a.id = u.id);

create index if not exists idx_users_auth_user_id on public.users(auth_user_id);

-- 4) Actualizar es_admin() para usar auth_user_id
create or replace function public.es_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid() and rol = 'admin'
  );
$$ language sql security definer stable;

-- 5) Actualizar trigger de signup: si ya existe un coach "fantasma" con el
--    mismo email y sin auth_user_id, lo vinculamos. Si no, creamos fila nueva.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_existing uuid;
begin
  select id into v_existing
    from public.users
   where email = new.email and auth_user_id is null
   limit 1;

  if v_existing is not null then
    update public.users
       set auth_user_id = new.id,
           nombre = coalesce(nombre, new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
     where id = v_existing;
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
  return new;
end;
$$ language plpgsql security definer;

-- 6) Reescribir policies que comparaban entrenador_id = auth.uid()
--    Ahora deben mapear auth.uid() -> users.id vía auth_user_id.

drop policy if exists "corredores: entrenador ve los suyos" on public.corredores;
create policy "corredores: entrenador ve los suyos" on public.corredores
  for select using (
    entrenador_id in (select id from public.users where auth_user_id = auth.uid())
  );

drop policy if exists "corredores: entrenador edita los suyos" on public.corredores;
create policy "corredores: entrenador edita los suyos" on public.corredores
  for update using (
    entrenador_id in (select id from public.users where auth_user_id = auth.uid())
  );

drop policy if exists "pausas: entrenador ve las suyas" on public.pausas;
create policy "pausas: entrenador ve las suyas" on public.pausas
  for select using (
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id
        and c.entrenador_id in (select id from public.users where auth_user_id = auth.uid())
    )
  );

drop policy if exists "transacciones: entrenador ve las suyas" on public.transacciones;
create policy "transacciones: entrenador ve las suyas" on public.transacciones
  for select using (
    corredor_id is null or
    exists (
      select 1 from public.corredores c
      where c.id = corredor_id
        and c.entrenador_id in (select id from public.users where auth_user_id = auth.uid())
    )
  );
