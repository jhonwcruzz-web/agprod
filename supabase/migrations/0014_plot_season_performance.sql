-- =====================================================================
-- 0014_plot_season_performance — desempenho do talhao por safra.
--
-- v_plot_performance soma a vida inteira do talhao. As telas mostram o
-- seletor de safra no topo, entao os numeros precisam ser da safra
-- escolhida: esta view tem uma linha por talhao x safra.
--
-- v_plot_performance continua existindo como acumulado geral (usado
-- quando a fazenda ainda nao tem safra).
-- =====================================================================

create or replace view public.v_plot_season_performance
with (security_invoker = true) as
select
  p.id                                   as plot_id,
  p.farm_id,
  s.id                                   as season_id,
  p.code,
  p.name,
  p.area,
  p.plant_count,
  c.name                                 as crop_name,
  v.name                                 as variety_name,
  coalesce(prod.production_kg, 0)        as production_kg,
  coalesce(cost.total_cost, 0)           as total_cost,
  case when coalesce(prod.production_kg, 0) > 0
       then round(coalesce(cost.total_cost, 0) / prod.production_kg, 2) end
                                         as cost_per_kg,
  case when p.area > 0
       then round(coalesce(prod.production_kg, 0) / p.area, 2) end
                                         as kg_per_ha,
  coalesce(rev.revenue, 0)               as revenue,
  coalesce(rev.revenue, 0) - coalesce(cost.total_cost, 0) as result
from public.plots p
join public.seasons s on s.farm_id = p.farm_id
left join public.crops c      on c.id = p.crop_id
left join public.varieties v  on v.id = p.variety_id
left join lateral (
  select sum(pr.quantity_kg) as production_kg
  from public.production_records pr
  where pr.plot_id = p.id and pr.season_id = s.id
) prod on true
left join lateral (
  select sum(e.amount) as total_cost
  from public.expenses e
  where e.plot_id = p.id and e.season_id = s.id and e.is_production_cost
) cost on true
left join lateral (
  select sum(sa.total_amount) as revenue
  from public.sales sa
  where sa.plot_id = p.id and sa.season_id = s.id
) rev on true;

grant select on public.v_plot_season_performance to authenticated;
revoke all on public.v_plot_season_performance from anon;
