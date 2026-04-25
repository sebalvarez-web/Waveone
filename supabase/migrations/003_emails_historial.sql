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
