-- =====================================================================
-- 0013_forecast_destinations
--
-- 1. Previsao de safra: t/ha esperado por talhao em cada safra, guardado
--    no ciclo de cultivo (talhao x safra). O volume previsto nao e'
--    armazenado — e' sempre t/ha x area do talhao, para nunca divergir.
--    Como cada talhao tem sua variedade, a previsao soma por variedade.
--
-- 2. Destinos da colheita: lista suspensa com opcoes padrao (catalogo
--    global) e as que o produtor criar (proprias da fazenda). Mesmo
--    padrao de variedades e porta-enxertos.
-- =====================================================================

-- ------------------------------------------------------------ previsao
alter table public.crop_cycles
  add column if not exists expected_t_ha numeric(8,2)
    check (expected_t_ha is null or expected_t_ha >= 0);

alter table public.crop_cycles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists touch_crop_cycles on public.crop_cycles;
create trigger touch_crop_cycles before update on public.crop_cycles
  for each row execute function public.touch_updated_at();

-- Previsto x realizado por talhao e safra. Parte do cruzamento talhao x
-- safra (e nao so' dos ciclos existentes) para que talhoes sem previsao
-- tambem aparecam, com a previsao em branco.
create or replace view public.v_forecast
with (security_invoker = true) as
select
  p.farm_id,
  s.id                                         as season_id,
  p.id                                         as plot_id,
  p.code,
  p.area,
  coalesce(cc.variety_id, p.variety_id)        as variety_id,
  v.name                                       as variety_name,
  c.name                                       as crop_name,
  cc.expected_t_ha,
  case when cc.expected_t_ha is not null
       then round(cc.expected_t_ha * p.area * 1000, 0) end
                                               as expected_kg,
  coalesce(prod.realized_kg, 0)                as realized_kg,
  case when p.area > 0
       then round(coalesce(prod.realized_kg, 0) / 1000 / p.area, 2) end
                                               as realized_t_ha,
  case when cc.expected_t_ha > 0 and p.area > 0
       then round(coalesce(prod.realized_kg, 0) / (cc.expected_t_ha * p.area * 1000) * 100, 1) end
                                               as pct_achieved
from public.plots p
join public.seasons s on s.farm_id = p.farm_id
left join public.crop_cycles cc on cc.plot_id = p.id and cc.season_id = s.id
left join public.varieties v on v.id = coalesce(cc.variety_id, p.variety_id)
left join public.crops c on c.id = p.crop_id
left join lateral (
  select sum(pr.quantity_kg) as realized_kg
  from public.production_records pr
  where pr.plot_id = p.id and pr.season_id = s.id
) prod on true
where p.status <> 'inativo';

grant select on public.v_forecast to authenticated;
revoke all on public.v_forecast from anon;

-- ------------------------------------------------ destinos da colheita
create table if not exists public.harvest_destinations (
  id         uuid primary key default gen_random_uuid(),
  -- null = opcao padrao para todos; preenchido = criada pela fazenda
  farm_id    uuid references public.farms(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists harvest_dest_global_unique
  on public.harvest_destinations(lower(name)) where farm_id is null;
create unique index if not exists harvest_dest_farm_unique
  on public.harvest_destinations(farm_id, lower(name)) where farm_id is not null;

insert into public.harvest_destinations (farm_id, name, sort_order) values
  (null, 'Packing house', 1),
  (null, 'Venda direta', 2),
  (null, 'Mercado interno', 3),
  (null, 'Exportação', 4),
  (null, 'Câmara fria', 5),
  (null, 'Indústria / polpa', 6),
  (null, 'Descarte', 7)
on conflict do nothing;

alter table public.harvest_destinations enable row level security;
alter table public.harvest_destinations force row level security;
revoke all on public.harvest_destinations from anon;

drop policy if exists harvest_dest_select on public.harvest_destinations;
create policy harvest_dest_select on public.harvest_destinations
  for select to authenticated
  using ( farm_id is null or private.is_farm_member(farm_id) );

-- O produtor so' cria opcao da propria fazenda; o catalogo padrao nao e'
-- editavel pelo app.
drop policy if exists harvest_dest_insert on public.harvest_destinations;
create policy harvest_dest_insert on public.harvest_destinations
  for insert to authenticated
  with check ( farm_id is not null and private.has_farm_role(farm_id, 'operator') );

drop policy if exists harvest_dest_delete on public.harvest_destinations;
create policy harvest_dest_delete on public.harvest_destinations
  for delete to authenticated
  using ( farm_id is not null and private.has_farm_role(farm_id, 'admin') );

grant select, insert, delete on public.harvest_destinations to authenticated;

-- touch_updated_at ganhou um trigger novo: mantem as funcoes de trigger
-- fechadas para a Data API (regra da 0010).
do $mig$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('revoke all on function %s from authenticated', fn.sig);
  end loop;
end $mig$;
