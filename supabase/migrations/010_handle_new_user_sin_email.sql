-- 010_handle_new_user_sin_email.sql
-- Fix: la columna public.users.email fue eliminada en una migración previa,
-- pero handle_new_user seguía referenciándola → signup fallaba con
-- "Database error creating new user" (column "email" does not exist).
--
-- Reescribe el trigger sin email. Vincula filas existentes por auth_user_id;
-- si no hay fila previa, inserta sólo (id, nombre, rol, auth_user_id).

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_existing_user uuid;
begin
  -- ¿ya existe una fila vinculada a este auth user?
  select id into v_existing_user
    from public.users
   where auth_user_id = new.id
   limit 1;

  if v_existing_user is not null then
    update public.users
       set nombre = coalesce(nombre, new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
           email  = coalesce(email, new.email)
     where id = v_existing_user;
  else
    insert into public.users (id, email, nombre, rol, auth_user_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
      coalesce((new.raw_user_meta_data->>'rol')::public.user_rol, 'entrenador'::public.user_rol),
      new.id
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;
