-- =====================================================================
-- 0018 — Ordens de servico de adubacao e de tratos culturais.
--
--   adubacao  um ou mais adubos do estoque (service_order_items), dose
--             por hectare ou por planta. Concluir cria as adubacoes
--             (fertilizations.service_order_id) — baixa e custo pelos
--             gatilhos de sempre.
--   tratos    poda, desbrota, raleio, amarracao...: turma, diarias e
--             valor da diaria. Concluir lanca a mao de obra como despesa
--             do talhao.
-- =====================================================================

alter table public.service_orders drop constraint if exists service_orders_kind_check;
alter table public.service_orders add constraint service_orders_kind_check
  check (kind in ('pulverizacao', 'colheita', 'manutencao', 'adubacao', 'tratos'));

alter table public.service_orders
  add column if not exists activity           text,                 -- tratos: poda, desbrota...
  add column if not exists application_method text,                 -- adubacao: a lanco, cova...
  add column if not exists labor_days         numeric(10,2) check (labor_days is null or labor_days > 0),
  add column if not exists daily_rate         numeric(12,2) check (daily_rate is null or daily_rate >= 0),
  add column if not exists labor_cost         numeric(14,2) check (labor_cost is null or labor_cost >= 0);

-- ------------------------------------------------------ itens (adubos)
create table if not exists public.service_order_items (
  id               uuid primary key default gen_random_uuid(),
  farm_id          uuid not null references public.farms(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  dose             numeric(14,4) not null check (dose > 0),
  dose_unit        text not null,
  quantity         numeric(14,3) not null check (quantity > 0),  -- total, na unidade do estoque
  sort             integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists service_order_items_order_idx on public.service_order_items(service_order_id, sort);

drop trigger if exists service_order_items_tenant_refs on public.service_order_items;
create trigger service_order_items_tenant_refs before insert or update on public.service_order_items
  for each row execute function public.check_tenant_refs(
    'service_order_id', 'service_orders', 'product_id', 'products');

alter table public.service_order_items enable row level security;
alter table public.service_order_items force row level security;
revoke all on public.service_order_items from anon;

drop policy if exists service_order_items_select on public.service_order_items;
drop policy if exists service_order_items_insert on public.service_order_items;
drop policy if exists service_order_items_update on public.service_order_items;
drop policy if exists service_order_items_delete on public.service_order_items;
create policy service_order_items_select on public.service_order_items
  for select to authenticated using (private.is_farm_member(farm_id));
create policy service_order_items_insert on public.service_order_items
  for insert to authenticated with check (private.has_farm_role(farm_id, 'operator'));
create policy service_order_items_update on public.service_order_items
  for update to authenticated
  using (private.has_farm_role(farm_id, 'operator'))
  with check (private.has_farm_role(farm_id, 'operator'));
-- itens saem junto quando a OS e' editada (operador) ou excluida
create policy service_order_items_delete on public.service_order_items
  for delete to authenticated using (private.has_farm_role(farm_id, 'operator'));
grant select, insert, update, delete on public.service_order_items to authenticated;

-- ------------------------------------------ adubacoes nascidas de uma OS
alter table public.fertilizations
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;
create index if not exists fertilizations_service_order_idx on public.fertilizations(service_order_id);

drop trigger if exists fertilizations_tenant_refs on public.fertilizations;
create trigger fertilizations_tenant_refs before insert or update on public.fertilizations
  for each row execute function public.check_tenant_refs(
    'plot_id', 'plots', 'product_id', 'products', 'machine_id', 'machines',
    'implement_id', 'machines', 'season_id', 'seasons', 'service_order_id', 'service_orders');

-- despesa de mao de obra lancada ao concluir OS de tratos
alter table public.expenses
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;
create index if not exists expenses_service_order_idx on public.expenses(service_order_id);

drop trigger if exists expenses_tenant_refs on public.expenses;
create trigger expenses_tenant_refs before insert or update on public.expenses
  for each row execute function public.check_tenant_refs(
    'plot_id', 'plots', 'season_id', 'seasons', 'service_order_id', 'service_orders');
