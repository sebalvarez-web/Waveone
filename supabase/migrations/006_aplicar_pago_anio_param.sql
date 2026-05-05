-- 006_aplicar_pago_anio_param.sql
-- Fix: el RPC `aplicar_pago` declaraba el parámetro `p_año_override` con ñ,
-- pero los callers (webhooks Stripe/PayPal y syncs) lo pasan como `p_anio_override`
-- (ASCII). PostgREST requiere coincidencia exacta de nombres y la llamada
-- fallaba silenciosamente — los pagos no se aplicaban al adeudo más antiguo.
-- Recreamos la función con el parámetro en ASCII.

drop function if exists public.aplicar_pago(uuid, uuid, numeric, smallint, smallint);

create or replace function public.aplicar_pago(
  p_transaccion_id uuid,
  p_corredor_id uuid,
  p_monto numeric,
  p_mes_override smallint default null,
  p_anio_override smallint default null
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
  if p_mes_override is not null and p_anio_override is not null then
    insert into public.pagos_aplicados
      (transaccion_id, corredor_id, año, mes, monto, aplicado_automatico)
    values
      (p_transaccion_id, p_corredor_id, p_anio_override, p_mes_override, p_monto, false)
    on conflict (corredor_id, año, mes) do nothing;
    return 1;
  end if;

  select coalesce(p.precio_mensual, 0), c.fecha_ingreso, c.fecha_salida
    into v_precio, v_fecha_ingreso, v_fecha_fin
  from public.corredores c
  left join public.planes p on p.id = c.plan_id
  where c.id = p_corredor_id;

  if v_precio is null or v_precio <= 0 then
    v_meses_a_cubrir := 1;
  else
    v_meses_a_cubrir := greatest(1, floor(p_monto / v_precio)::int);
  end if;

  for v_y, v_m in
    with serie as (
      select
        (extract(year from gs)::smallint) as año,
        (extract(month from gs)::smallint) as mes
      from generate_series(
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
