-- =====================================================================
-- 0017_service_orders — Ordens de servico.
--
-- A OS e' o papel que vai para quem executa: aplicador, turma de
-- colheita, mecanico. Numerada por propriedade (OS 0001, 0002...), com
-- executor, telefone (WhatsApp) e instrucoes, e gera um PDF.
--
--   pulverizacao  a calda: uma ou mais pulverizacoes programadas ligadas
--                 a' OS (applications.service_order_id). Concluir a OS
--                 marca todas como realizadas — baixa de estoque e custo
--                 acontecem pelos gatilhos de sempre.
--   colheita      talhao, variedade, volume esperado, destino e turma.
--                 Concluida ao registrar a colheita feita.
--   manutencao    maquina, tipo e lista do que fazer. Concluida ao
--                 registrar a manutencao no diario da maquina.
-- =====================================================================

create table if not exists public.service_orders (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  season_id         uuid references public.seasons(id) on delete set null,
  number            integer not null,
  kind              text not null check (kind in ('pulverizacao', 'colheita', 'manutencao')),
  status            text not null default 'aberta' check (status in ('aberta', 'concluida', 'cancelada')),
  scheduled_date    date not null default current_date,

  -- onde e com o que
  plot_id           uuid references public.plots(id) on delete set null,
  machine_id        uuid references public.machines(id) on delete set null,
  implement_id      uuid references public.machines(id) on delete set null,

  -- quem executa
  assignee          text,
  assignee_phone    text,
  instructions      text,

  -- pulverizacao
  area              numeric(12,4) check (area is null or area > 0),
  spray_volume      numeric(10,2) check (spray_volume is null or spray_volume > 0),   -- L de calda por ha
  tank_capacity     numeric(10,2) check (tank_capacity is null or tank_capacity > 0), -- L do tanque

  -- colheita
  variety_id        uuid references public.varieties(id) on delete set null,
  expected_quantity numeric(14,3) check (expected_quantity is null or expected_quantity > 0),
  expected_unit     quantity_unit,
  destination       text,
  team_size         integer check (team_size is null or team_size > 0),

  -- manutencao
  log_type          machine_log_type,
  checklist         text,   -- um item por linha

  completed_at      timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (farm_id, number)
);
create index if not exists service_orders_farm_idx on public.service_orders(farm_id, scheduled_date desc);
create index if not exists service_orders_status_idx on public.service_orders(farm_id, status);

alter table public.applications
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;
create index if not exists applications_service_order_idx on public.applications(service_order_id);

-- ---------------------------------------------------------------------
-- Numero sequencial por propriedade. O lock evita que duas OS criadas ao
-- mesmo tempo peguem o mesmo numero (o unique barraria, mas com erro).
-- ---------------------------------------------------------------------
create or replace function public.assign_service_order_number()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  perform pg_advisory_xact_lock(hashtext('service_orders:' || new.farm_id::text));
  select coalesce(max(number), 0) + 1 into new.number
    from public.service_orders where farm_id = new.farm_id;
  return new;
end; $fn$;

drop trigger if exists service_orders_number on public.service_orders;
create trigger service_orders_number before insert on public.service_orders
  for each row execute function public.assign_service_order_number();

drop trigger if exists touch_service_orders on public.service_orders;
create trigger touch_service_orders before update on public.service_orders
  for each row execute function public.touch_updated_at();

drop trigger if exists audit_service_orders on public.service_orders;
create trigger audit_service_orders after insert or update or delete on public.service_orders
  for each row execute function public.write_audit_log();

-- Referencias da mesma fazenda (mesmo gatilho das demais tabelas).
drop trigger if exists service_orders_tenant_refs on public.service_orders;
create trigger service_orders_tenant_refs before insert or update on public.service_orders
  for each row execute function public.check_tenant_refs(
    'plot_id', 'plots', 'machine_id', 'machines', 'implement_id', 'machines', 'season_id', 'seasons');

drop trigger if exists applications_tenant_refs on public.applications;
create trigger applications_tenant_refs before insert or update on public.applications
  for each row execute function public.check_tenant_refs(
    'plot_id', 'plots', 'product_id', 'products', 'machine_id', 'machines',
    'implement_id', 'machines', 'season_id', 'seasons', 'service_order_id', 'service_orders');

-- ---------------------------------------------------------------------
-- RLS — mesmo padrao das demais tabelas da fazenda.
-- ---------------------------------------------------------------------
alter table public.service_orders enable row level security;
alter table public.service_orders force row level security;
revoke all on public.service_orders from anon;

drop policy if exists service_orders_select on public.service_orders;
drop policy if exists service_orders_insert on public.service_orders;
drop policy if exists service_orders_update on public.service_orders;
drop policy if exists service_orders_delete on public.service_orders;

create policy service_orders_select on public.service_orders
  for select to authenticated
  using (private.is_farm_member(farm_id));
create policy service_orders_insert on public.service_orders
  for insert to authenticated
  with check (private.has_farm_role(farm_id, 'operator'));
create policy service_orders_update on public.service_orders
  for update to authenticated
  using (private.has_farm_role(farm_id, 'operator'))
  with check (private.has_farm_role(farm_id, 'operator'));
create policy service_orders_delete on public.service_orders
  for delete to authenticated
  using (private.has_farm_role(farm_id, 'admin'));

grant select, insert, update, delete on public.service_orders to authenticated;
