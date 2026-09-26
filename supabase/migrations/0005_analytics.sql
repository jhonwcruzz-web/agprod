-- =====================================================================
-- 0005_analytics — integridade dos numeros + views de indicadores
--
-- REGRA CONTABIL DO PRODUTO (evita contagem dupla):
--   "expenses" e' o unico livro de custos. Aplicacao, adubacao e irrigacao
--   lancam sua despesa automaticamente ali, ja' atribuida ao talhao.
--   A compra de insumo para estoque tambem entra em "expenses" (e' saida de
--   caixa), mas com is_production_cost = false: o custo de producao so' e'
--   reconhecido quando o insumo e' efetivamente aplicado no talhao.
--   Assim: Financeiro usa todas as linhas; Custo/kg usa so' as de producao.
-- =====================================================================

alter table public.expenses
  add column if not exists is_production_cost boolean not null default true;

comment on column public.expenses.is_production_cost is
  'false para compra de insumo (saida de caixa sem custo de producao ainda)';

-- ---------------------------------------------------------------------
-- 1. Operacoes de campo alimentam o livro de custos automaticamente.
-- ---------------------------------------------------------------------
create or replace function public.sync_expense_from_operation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_cat   public.expense_category;
  v_desc  text;
  v_date  date;
  v_cost  numeric;
begin
  if tg_op in ('UPDATE','DELETE') then
    delete from public.expenses
     where source_table = tg_table_name and source_id = old.id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'applications' then
    if new.status <> 'realizada' then
      return new;               -- aplicacao programada ainda nao e' custo
    end if;
    v_cat  := 'fitossanidade';
    v_desc := 'Aplicacao: ' || new.product_name;
    v_date := coalesce(new.application_date, current_date);
    v_cost := new.cost;
  elsif tg_table_name = 'fertilizations' then
    v_cat  := 'adubacao';
    v_desc := 'Adubacao: ' || new.product_name;
    v_date := new.fertilization_date;
    v_cost := new.cost;
  else
    v_cat  := 'irrigacao';
    v_desc := 'Irrigacao';
    v_date := new.irrigation_date;
    v_cost := new.cost;
  end if;

  if coalesce(v_cost, 0) > 0 then
    insert into public.expenses
      (farm_id, plot_id, season_id, category, description, amount,
       expense_date, status, paid_amount, source_table, source_id,
       is_production_cost, created_by)
    values
      (new.farm_id, new.plot_id, new.season_id, v_cat, v_desc, v_cost,
       v_date, 'pago', v_cost, tg_table_name, new.id, true, new.created_by);
  end if;

  return new;
end; $fn$;

do $mig$
declare t text;
begin
  foreach t in array array['applications','fertilizations','irrigation_records'] loop
    execute format('drop trigger if exists %1$s_expense_sync on public.%1$s;', t);
    execute format(
      'create trigger %1$s_expense_sync after insert or update or delete on public.%1$s
       for each row execute function public.sync_expense_from_operation();', t);
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- 2. Venda gera a receita correspondente (espelha status de recebimento).
-- ---------------------------------------------------------------------
create or replace function public.sync_revenue_from_sale()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if tg_op = 'DELETE' then
    delete from public.revenues where sale_id = old.id;
    return old;
  end if;

  delete from public.revenues where sale_id = new.id;

  insert into public.revenues
    (farm_id, season_id, sale_id, source, description, amount, revenue_date,
     due_date, status, received_amount, received_date, created_by)
  values
    (new.farm_id, new.season_id, new.id, 'venda',
     'Venda ' || to_char(new.quantity_kg, 'FM999999990.0') || ' kg',
     new.total_amount, new.sale_date, new.due_date, new.status,
     new.received_amount, new.received_date, new.created_by);

  return new;
end; $fn$;

drop trigger if exists sales_revenue_sync on public.sales;
create trigger sales_revenue_sync after insert or update or delete on public.sales
  for each row execute function public.sync_revenue_from_sale();

-- ---------------------------------------------------------------------
-- 3. Views de indicadores.
--    security_invoker = true e' obrigatorio: sem isso a view roda com os
--    privilegios do criador e ignora o RLS das tabelas de base.
-- ---------------------------------------------------------------------

-- Desempenho por talhao: producao, custo, custo/kg, receita e resultado.
create or replace view public.v_plot_performance
with (security_invoker = true) as
select
  p.id                                   as plot_id,
  p.farm_id,
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
left join public.crops c      on c.id = p.crop_id
left join public.varieties v  on v.id = p.variety_id
left join lateral (
  select sum(pr.quantity_kg) as production_kg
  from public.production_records pr where pr.plot_id = p.id
) prod on true
left join lateral (
  select sum(e.amount) as total_cost
  from public.expenses e
  where e.plot_id = p.id and e.is_production_cost
) cost on true
left join lateral (
  select sum(s.total_amount) as revenue
  from public.sales s where s.plot_id = p.id
) rev on true;

-- Custo por talhao quebrado em categoria (secao 15 do escopo).
create or replace view public.v_plot_cost_breakdown
with (security_invoker = true) as
select
  e.farm_id,
  e.plot_id,
  e.season_id,
  e.category,
  sum(e.amount) as amount
from public.expenses e
where e.is_production_cost and e.plot_id is not null
group by e.farm_id, e.plot_id, e.season_id, e.category;

-- Situacao do estoque com semaforo (secao 21).
create or replace view public.v_stock_status
with (security_invoker = true) as
select
  pr.id            as product_id,
  pr.farm_id,
  pr.name,
  pr.category,
  pr.unit,
  pr.current_stock,
  pr.min_stock,
  pr.unit_cost,
  round(pr.current_stock * pr.unit_cost, 2) as stock_value,
  case
    when pr.min_stock > 0 and pr.current_stock <= pr.min_stock * 0.5 then 'critico'
    when pr.min_stock > 0 and pr.current_stock <= pr.min_stock       then 'baixo'
    else 'normal'
  end as stock_level
from public.products pr
where pr.is_active;

-- Panorama da propriedade por safra (secao 23 / 25).
create or replace view public.v_farm_overview
with (security_invoker = true) as
select
  f.id as farm_id,
  s.id as season_id,
  coalesce(prod.production_kg, 0)                          as production_kg,
  coalesce(rev.revenue, 0)                                 as revenue,
  coalesce(rev.received, 0)                                as received,
  coalesce(rev.revenue, 0) - coalesce(rev.received, 0)     as receivable,
  coalesce(cost.production_cost, 0)                        as production_cost,
  coalesce(cost.cash_out, 0)                               as cash_out,
  coalesce(cost.payable, 0)                                as payable,
  coalesce(rev.revenue, 0) - coalesce(cost.production_cost, 0) as result,
  case when coalesce(prod.production_kg, 0) > 0
       then round(coalesce(cost.production_cost, 0) / prod.production_kg, 2) end
                                                           as cost_per_kg,
  coalesce(sold.sold_kg, 0)                                as sold_kg,
  case when coalesce(sold.sold_kg, 0) > 0
       then round(coalesce(rev.revenue, 0) / sold.sold_kg, 2) end
                                                           as avg_price_per_kg
from public.farms f
left join public.seasons s on s.farm_id = f.id
left join lateral (
  select sum(pr.quantity_kg) as production_kg
  from public.production_records pr
  where pr.farm_id = f.id and (s.id is null or pr.season_id = s.id)
) prod on true
left join lateral (
  select sum(r.amount) as revenue, sum(r.received_amount) as received
  from public.revenues r
  where r.farm_id = f.id and (s.id is null or r.season_id = s.id)
) rev on true
left join lateral (
  select
    sum(e.amount) filter (where e.is_production_cost)            as production_cost,
    sum(e.amount)                                                as cash_out,
    sum(e.amount - e.paid_amount) filter (where e.status <> 'pago') as payable
  from public.expenses e
  where e.farm_id = f.id and (s.id is null or e.season_id = s.id)
) cost on true
left join lateral (
  select sum(sa.quantity_kg) as sold_kg
  from public.sales sa
  where sa.farm_id = f.id and (s.id is null or sa.season_id = s.id)
) sold on true;

-- Preco medio por comprador (secao 18).
create or replace view public.v_buyer_prices
with (security_invoker = true) as
select
  s.farm_id,
  s.buyer_id,
  b.name as buyer_name,
  count(*)                as sales_count,
  sum(s.quantity_kg)      as total_kg,
  sum(s.total_amount)     as total_amount,
  sum(s.received_amount)  as received_amount,
  case when sum(s.quantity_kg) > 0
       then round(sum(s.total_amount) / sum(s.quantity_kg), 2) end as avg_price_per_kg
from public.sales s
left join public.buyers b on b.id = s.buyer_id
group by s.farm_id, s.buyer_id, b.name;

do $mig$
declare v text;
begin
  foreach v in array array['v_plot_performance','v_plot_cost_breakdown','v_stock_status',
                           'v_farm_overview','v_buyer_prices'] loop
    execute format('grant select on public.%I to authenticated;', v);
    execute format('revoke all on public.%I from anon;', v);
  end loop;
end $mig$;
