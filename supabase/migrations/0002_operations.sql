-- =====================================================================
-- 0002_operations — ciclos, producao, aplicacoes, adubacao, irrigacao,
--                   estoque e insumos
-- =====================================================================

do $mig$ begin
  create type quantity_unit as enum ('kg','t','caixa','unidade','L','g','mL','saco','dose');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type operation_status as enum ('programada','realizada','pendente','cancelada');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type product_category as enum
    ('fertilizante','defensivo','corretivo','material','embalagem','combustivel','outro');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type movement_type as enum ('entrada','saida','ajuste');
exception when duplicate_object then null; end $mig$;

-- Fator de conversao para kg. Retorna null quando a unidade nao e' massa,
-- para que a normalizacao use o peso informado pelo usuario.
create or replace function public.to_kg(p_qty numeric, p_unit quantity_unit, p_unit_weight numeric default null)
returns numeric language sql immutable set search_path = '' as $fn$
  select case p_unit
    when 'kg' then p_qty
    when 't'  then p_qty * 1000
    when 'g'  then p_qty / 1000
    else p_qty * coalesce(p_unit_weight, 0)
  end;
$fn$;

-- ---------- ciclos de cultivo (talhao x safra) -------------------------
create table if not exists public.crop_cycles (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  plot_id    uuid not null references public.plots(id) on delete cascade,
  season_id  uuid not null references public.seasons(id) on delete cascade,
  crop_id    uuid references public.crops(id) on delete set null,
  variety_id uuid references public.varieties(id) on delete set null,
  start_date date,
  end_date   date,
  status     text not null default 'em_andamento',
  notes      text,
  created_at timestamptz not null default now(),
  unique (plot_id, season_id)
);
create index if not exists crop_cycles_farm_idx on public.crop_cycles(farm_id);

-- ---------- insumos / produtos -----------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  name              text not null,
  category          product_category not null default 'outro',
  unit              quantity_unit not null default 'kg',
  active_ingredient text,
  current_stock     numeric(14,3) not null default 0,
  min_stock         numeric(14,3) not null default 0 check (min_stock >= 0),
  unit_cost         numeric(14,4) not null default 0 check (unit_cost >= 0),
  location          text,
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists products_farm_name_unique
  on public.products(farm_id, lower(name));
create index if not exists products_farm_idx on public.products(farm_id, category);

-- ---------- movimentos de estoque --------------------------------------
create table if not exists public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  farm_id        uuid not null references public.farms(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  movement_type  movement_type not null,
  quantity       numeric(14,3) not null check (quantity >= 0),
  unit_cost      numeric(14,4) not null default 0,
  total_cost     numeric(14,2) not null default 0,
  movement_date  date not null default current_date,
  -- origem do movimento quando gerado automaticamente por outra operacao
  source_table   text,
  source_id      uuid,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists inv_mov_product_idx on public.inventory_movements(product_id, movement_date desc);
create index if not exists inv_mov_farm_idx on public.inventory_movements(farm_id, movement_date desc);
create index if not exists inv_mov_source_idx on public.inventory_movements(source_table, source_id);

-- Mantem products.current_stock coerente a cada movimento (secao 20 do escopo).
create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_delta numeric := 0;
begin
  if tg_op in ('INSERT','UPDATE') then
    v_delta := case new.movement_type
                 when 'entrada' then new.quantity
                 when 'saida'   then -new.quantity
                 else 0 end;
  end if;

  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    update public.products
       set current_stock = current_stock - case old.movement_type
             when 'entrada' then old.quantity
             when 'saida'   then -old.quantity
             else 0 end
     where id = old.product_id;
  end if;

  if tg_op in ('INSERT','UPDATE') then
    if new.movement_type = 'ajuste' then
      -- ajuste define o saldo absoluto informado no inventario
      update public.products set current_stock = new.quantity where id = new.product_id;
    else
      update public.products
         set current_stock = current_stock + v_delta
       where id = new.product_id;
    end if;
    return new;
  end if;

  return old;
end; $fn$;

drop trigger if exists inv_mov_apply on public.inventory_movements;
create trigger inv_mov_apply
  after insert or update or delete on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ---------- producao / colheita ----------------------------------------
create table if not exists public.production_records (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references public.farms(id) on delete cascade,
  plot_id         uuid references public.plots(id) on delete set null,
  season_id       uuid references public.seasons(id) on delete set null,
  crop_cycle_id   uuid references public.crop_cycles(id) on delete set null,
  crop_id         uuid references public.crops(id) on delete set null,
  variety_id      uuid references public.varieties(id) on delete set null,
  harvest_date    date not null default current_date,
  quantity        numeric(14,3) not null check (quantity > 0),
  unit            quantity_unit not null default 'kg',
  unit_weight_kg  numeric(10,3),
  quantity_kg     numeric(14,3) not null default 0,
  production_type text,
  team            text,
  destination     text,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists prod_farm_date_idx on public.production_records(farm_id, harvest_date desc);
create index if not exists prod_plot_idx on public.production_records(plot_id, harvest_date desc);
create index if not exists prod_season_idx on public.production_records(season_id);

create or replace function public.normalize_production_kg()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  new.quantity_kg := public.to_kg(new.quantity, new.unit, new.unit_weight_kg);
  return new;
end; $fn$;

drop trigger if exists prod_normalize on public.production_records;
create trigger prod_normalize before insert or update on public.production_records
  for each row execute function public.normalize_production_kg();

-- ---------- aplicacoes (fitossanidade) ---------------------------------
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  plot_id           uuid references public.plots(id) on delete set null,
  season_id         uuid references public.seasons(id) on delete set null,
  crop_id           uuid references public.crops(id) on delete set null,
  product_id        uuid references public.products(id) on delete set null,
  product_name      text not null,
  active_ingredient text,
  dose              numeric(12,4) check (dose is null or dose >= 0),
  dose_unit         text,
  area              numeric(12,4) check (area is null or area >= 0),
  total_quantity    numeric(14,3),
  spray_volume      numeric(12,2),
  equipment         text,
  responsible       text,
  cost              numeric(14,2) not null default 0 check (cost >= 0),
  status            operation_status not null default 'realizada',
  scheduled_date    date,
  application_date  date,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (status <> 'realizada' or application_date is not null)
);
create index if not exists app_farm_idx on public.applications(farm_id, coalesce(application_date, scheduled_date) desc);
create index if not exists app_plot_idx on public.applications(plot_id);
create index if not exists app_status_idx on public.applications(farm_id, status);

-- ---------- adubacao ----------------------------------------------------
create table if not exists public.fertilizations (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  plot_id           uuid references public.plots(id) on delete set null,
  season_id         uuid references public.seasons(id) on delete set null,
  product_id        uuid references public.products(id) on delete set null,
  product_name      text not null,
  fert_type         text,
  quantity          numeric(14,3) not null check (quantity > 0),
  unit              quantity_unit not null default 'kg',
  dose_per_ha       numeric(12,4),
  area              numeric(12,4),
  cost              numeric(14,2) not null default 0 check (cost >= 0),
  application_method text,
  responsible       text,
  fertilization_date date not null default current_date,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists fert_farm_idx on public.fertilizations(farm_id, fertilization_date desc);
create index if not exists fert_plot_idx on public.fertilizations(plot_id);

-- ---------- irrigacao ---------------------------------------------------
create table if not exists public.irrigation_records (
  id               uuid primary key default gen_random_uuid(),
  farm_id          uuid not null references public.farms(id) on delete cascade,
  plot_id          uuid references public.plots(id) on delete set null,
  season_id        uuid references public.seasons(id) on delete set null,
  irrigation_date  date not null default current_date,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  volume_m3        numeric(14,3),
  method           text,
  cost             numeric(14,2) not null default 0 check (cost >= 0),
  responsible      text,
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists irrig_farm_idx on public.irrigation_records(farm_id, irrigation_date desc);
create index if not exists irrig_plot_idx on public.irrigation_records(plot_id, irrigation_date desc);

-- ---------- baixa automatica de estoque (secao 20) ---------------------
-- Aplicacao e adubacao consomem insumo sem o produtor lancar a saida.
create or replace function public.sync_stock_from_operation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_qty numeric;
  v_product uuid;
  v_date date;
begin
  -- remove o movimento anterior gerado por esta operacao
  if tg_op in ('UPDATE','DELETE') then
    delete from public.inventory_movements
     where source_table = tg_table_name and source_id = old.id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'applications' then
    v_product := new.product_id;
    v_qty := new.total_quantity;
    v_date := coalesce(new.application_date, new.scheduled_date, current_date);
    -- so' baixa estoque de aplicacao efetivamente realizada
    if new.status <> 'realizada' then
      return new;
    end if;
  else
    v_product := new.product_id;
    v_qty := new.quantity;
    v_date := new.fertilization_date;
  end if;

  if v_product is not null and v_qty is not null and v_qty > 0 then
    insert into public.inventory_movements
      (farm_id, product_id, movement_type, quantity, total_cost, movement_date,
       source_table, source_id, notes, created_by)
    values
      (new.farm_id, v_product, 'saida', v_qty, coalesce(new.cost, 0), v_date,
       tg_table_name, new.id, 'Baixa automatica', new.created_by);
  end if;

  return new;
end; $fn$;

drop trigger if exists app_stock_sync on public.applications;
create trigger app_stock_sync
  after insert or update or delete on public.applications
  for each row execute function public.sync_stock_from_operation();

drop trigger if exists fert_stock_sync on public.fertilizations;
create trigger fert_stock_sync
  after insert or update or delete on public.fertilizations
  for each row execute function public.sync_stock_from_operation();

do $mig$
declare t text;
begin
  foreach t in array array['products','applications','fertilizations'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $mig$;
