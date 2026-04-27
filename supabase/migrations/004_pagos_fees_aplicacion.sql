-- 004_pagos_fees_aplicacion.sql
-- 1) Comisiones por transacción (procesador + impuesto sobre el fee)
-- 2) Estado 'reembolsado' (los webhooks ya lo usan)
-- 3) Tabla pagos_aplicados: relaciona 1 transacción con N meses de adeudo
-- 4) RPC aplicar_pago: aplica un pago al/los mes(es) adeudado(s) más antiguo(s)

-- ---- 1) Estado 'reembolsado' ------------------------------------------------
alter type transaccion_estado add value if not exists 'reembolsado';

-- ---- 2) Comisiones ----------------------------------------------------------
alter table public.transacciones
  add column if not exists comision numeric(10,2) not null default 0,
  add column if not exists comision_impuesto numeric(10,2) not null default 0,
  add column if not exists monto_neto numeric(10,2)
    generated always as (monto - coalesce(comision,0) - coalesce(comision_impuesto,0)) stored;

-- ---- 3) pagos_aplicados -----------------------------------------------------
create table if not exists public.pagos_aplicados (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  corredor_id uuid not null references public.corredores(id) on delete cascade,
  año smallint not null,
  mes smallint not null check (mes between 1 and 12),
  monto numeric(10,2) not null,
  aplicado_automatico boolean not null default true,
  created_at timestamptz not null default now(),
  unique (corredor_id, año, mes)
);

create index if not exists idx_pagos_aplicados_corredor
  on public.pagos_aplicados(corredor_id, año, mes);
create index if not exists idx_pagos_aplicados_transaccion
  on public.pagos_aplicados(transaccion_id);

alter table public.pagos_aplicados enable row level security;

create policy "pagos_aplicados: lectura autenticados" on public.pagos_aplicados
  for select using (auth.uid() is not null);

create policy "pagos_aplicados: solo admin escribe" on public.pagos_aplicados
  for all using (public.es_admin());

-- ---- 4) RPC aplicar_pago ----------------------------------------------------
-- Aplica un pago al/los mes(es) adeudado(s) más antiguo(s) del corredor.
-- Si p_mes_override / p_año_override vienen, fuerza ese mes (manual override).
-- Si no, calcula floor(monto/precio) meses y los aplica desde el más viejo.
-- Devuelve la cantidad de meses aplicados.
create or replace function public.aplicar_pago(
  p_transaccion_id uuid,
  p_corredor_id uuid,
  p_monto numeric,
  p_mes_override smallint default null,
  p_año_override smallint default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_precio numeric(10,2);
  v_fecha_ingreso date;
  v_fecha_fin date;
  v_meses_a_cubrir integer;
  v_aplicados integer := 0;
  v_y smallint;
  v_m smallint;
  v_now date := current_date;
begin
  -- Override manual: insert directo y salir
  if p_mes_override is not null and p_año_override is not null then
    insert into public.pagos_aplicados
      (transaccion_id, corredor_id, año, mes, monto, aplicado_automatico)
    values
      (p_transaccion_id, p_corredor_id, p_año_override, p_mes_override, p_monto, false)
    on conflict (corredor_id, año, mes) do nothing;
    return 1;
  end if;

  -- Lookup precio del plan
  select coalesce(p.precio_mensual, 0), c.fecha_ingreso, c.fecha_salida
    into v_precio, v_fecha_ingreso, v_fecha_fin
  from public.corredores c
  left join public.planes p on p.id = c.plan_id
  where c.id = p_corredor_id;

  if v_precio is null or v_precio <= 0 then
    -- Sin plan o precio cero: aplicar 1 mes al más viejo adeudo
    v_meses_a_cubrir := 1;
  else
    v_meses_a_cubrir := greatest(1, floor(p_monto / v_precio)::int);
  end if;

  -- Iterar meses desde fecha_ingreso hasta hoy (o fecha_salida)
  for v_y, v_m in
    with bounds as (
      select
        extract(year from v_fecha_ingreso)::smallint as y0,
        extract(month from v_fecha_ingreso)::smallint as m0,
        extract(year from coalesce(v_fecha_fin, v_now))::smallint as y1,
        extract(month from coalesce(v_fecha_fin, v_now))::smallint as m1
    ),
    serie as (
      select
        (extract(year from gs)::smallint) as año,
        (extract(month from gs)::smallint) as mes
      from bounds, generate_series(
        date_trunc('month', v_fecha_ingreso),
        date_trunc('month', coalesce(v_fecha_fin, v_now)),
        interval '1 month'
      ) as gs
    )
    select s.año, s.mes from serie s
    where not exists (
      select 1 from public.pagos_aplicados pa
      where pa.corredor_id = p_corredor_id
        and pa.año = s.año and pa.mes = s.mes
    )
    and not exists (
      select 1 from public.pausas pz
      where pz.corredor_id = p_corredor_id
        and pz.año = s.año and pz.mes = s.mes
    )
    order by s.año asc, s.mes asc
    limit v_meses_a_cubrir
  loop
    insert into public.pagos_aplicados
      (transaccion_id, corredor_id, año, mes, monto, aplicado_automatico)
    values
      (p_transaccion_id, p_corredor_id, v_y, v_m,
       case when v_precio > 0 then v_precio else p_monto end, true)
    on conflict (corredor_id, año, mes) do nothing;
    v_aplicados := v_aplicados + 1;
  end loop;

  return v_aplicados;
end;
$$;

grant execute on function public.aplicar_pago(uuid, uuid, numeric, smallint, smallint) to authenticated, service_role;
