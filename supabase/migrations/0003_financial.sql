-- =====================================================================
-- 0003_financial — custos, receitas, comercializacao, atividades,
--                  alertas, IA, midia e auditoria
-- =====================================================================

do $mig$ begin
  create type expense_category as enum (
    'mao_de_obra','adubacao','fitossanidade','irrigacao','combustivel',
    'energia','manutencao','maquinas','embalagens','frete','servicos','outros');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type payment_status as enum ('pendente','parcial','pago');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type alert_severity as enum ('info','atencao','critico');
exception when duplicate_object then null; end $mig$;

-- ---------- despesas / custos ------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references public.farms(id) on delete cascade,
  plot_id       uuid references public.plots(id) on delete set null,
  season_id     uuid references public.seasons(id) on delete set null,
  category      expense_category not null default 'outros',
  description   text not null,
  amount        numeric(14,2) not null check (amount >= 0),
  expense_date  date not null default current_date,
  due_date      date,
  status        payment_status not null default 'pago',
  paid_amount   numeric(14,2) not null default 0 check (paid_amount >= 0),
  paid_date     date,
  supplier      text,
  -- vinculo com a operacao que gerou o custo (aplicacao, adubacao, compra...)
  source_table  text,
  source_id     uuid,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists exp_farm_date_idx on public.expenses(farm_id, expense_date desc);
create index if not exists exp_plot_idx on public.expenses(plot_id);
create index if not exists exp_season_idx on public.expenses(season_id, category);
create index if not exists exp_open_idx on public.expenses(farm_id, due_date)
  where status <> 'pago';
create index if not exists exp_source_idx on public.expenses(source_table, source_id);

-- ---------- compradores -------------------------------------------------
create table if not exists public.buyers (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  name       text not null,
  tax_id     text,
  phone      text,
  email      citext,
  location   text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists buyers_farm_idx on public.buyers(farm_id);

-- ---------- vendas ------------------------------------------------------
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  farm_id        uuid not null references public.farms(id) on delete cascade,
  buyer_id       uuid references public.buyers(id) on delete set null,
  season_id      uuid references public.seasons(id) on delete set null,
  plot_id        uuid references public.plots(id) on delete set null,
  crop_id        uuid references public.crops(id) on delete set null,
  variety_id     uuid references public.varieties(id) on delete set null,
  sale_date      date not null default current_date,
  quantity       numeric(14,3) not null check (quantity > 0),
  unit           quantity_unit not null default 'kg',
  unit_weight_kg numeric(10,3),
  quantity_kg    numeric(14,3) not null default 0,
  price_per_kg   numeric(14,4) not null default 0 check (price_per_kg >= 0),
  total_amount   numeric(14,2) not null default 0 check (total_amount >= 0),
  payment_method text,
  due_date       date,
  status         payment_status not null default 'pendente',
  received_amount numeric(14,2) not null default 0 check (received_amount >= 0),
  received_date  date,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists sales_farm_date_idx on public.sales(farm_id, sale_date desc);
create index if not exists sales_buyer_idx on public.sales(buyer_id);
create index if not exists sales_open_idx on public.sales(farm_id, due_date) where status <> 'pago';

-- Normaliza kg e recalcula o total quando nao informado explicitamente.
create or replace function public.normalize_sale()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  new.quantity_kg := public.to_kg(new.quantity, new.unit, new.unit_weight_kg);
  if new.total_amount is null or new.total_amount = 0 then
    new.total_amount := round(coalesce(new.quantity_kg, 0) * coalesce(new.price_per_kg, 0), 2);
  end if;
  new.status := case
    when new.received_amount >= new.total_amount and new.total_amount > 0 then 'pago'::public.payment_status
    when new.received_amount > 0 then 'parcial'::public.payment_status
    else 'pendente'::public.payment_status
  end;
  return new;
end; $fn$;

drop trigger if exists sales_normalize on public.sales;
create trigger sales_normalize before insert or update on public.sales
  for each row execute function public.normalize_sale();

-- ---------- receitas ----------------------------------------------------
create table if not exists public.revenues (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references public.farms(id) on delete cascade,
  season_id       uuid references public.seasons(id) on delete set null,
  sale_id         uuid references public.sales(id) on delete cascade,
  source          text not null default 'venda',
  description     text not null,
  amount          numeric(14,2) not null check (amount >= 0),
  revenue_date    date not null default current_date,
  due_date        date,
  status          payment_status not null default 'pendente',
  received_amount numeric(14,2) not null default 0,
  received_date   date,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rev_farm_date_idx on public.revenues(farm_id, revenue_date desc);
create index if not exists rev_open_idx on public.revenues(farm_id, due_date) where status <> 'pago';

-- ---------- atividades / tarefas ---------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  plot_id     uuid references public.plots(id) on delete set null,
  season_id   uuid references public.seasons(id) on delete set null,
  type        text not null default 'tarefa',
  title       text not null,
  description text,
  due_date    date,
  done        boolean not null default false,
  done_date   date,
  responsible text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists act_farm_idx on public.activities(farm_id, due_date);
create index if not exists act_open_idx on public.activities(farm_id, done) where done = false;

-- ---------- alertas -----------------------------------------------------
create table if not exists public.alerts (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  plot_id    uuid references public.plots(id) on delete set null,
  kind       text not null,
  severity   alert_severity not null default 'info',
  title      text not null,
  message    text,
  resolved   boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_open_idx on public.alerts(farm_id, severity) where resolved = false;

-- ---------- midia e documentos -----------------------------------------
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  farm_id      uuid not null references public.farms(id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid,
  kind         text not null default 'foto',
  storage_path text not null,
  caption      text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists media_entity_idx on public.media(farm_id, entity_type, entity_id);

-- ---------- conversas de IA ---------------------------------------------
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  farm_id         uuid not null references public.farms(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  -- payload da acao proposta pela IA quando o usuario lanca por texto
  action          jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists ai_msg_conv_idx on public.ai_messages(conversation_id, created_at);

-- ---------- auditoria ---------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  farm_id    uuid references public.farms(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id  uuid,
  action     text not null,
  changes    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_farm_idx on public.audit_logs(farm_id, created_at desc);

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  v_farm uuid;
  v_rec  uuid;
begin
  if tg_op = 'DELETE' then
    v_farm := old.farm_id; v_rec := old.id;
  else
    v_farm := new.farm_id; v_rec := new.id;
  end if;

  insert into public.audit_logs (farm_id, user_id, table_name, record_id, action, changes)
  values (
    v_farm, (select auth.uid()), tg_table_name, v_rec, tg_op,
    case tg_op
      when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end; $fn$;
revoke all on function public.write_audit_log() from public;

-- Audita apenas as tabelas de valor financeiro/patrimonial.
do $mig$
declare t text;
begin
  foreach t in array array['sales','expenses','revenues','inventory_movements','plots','farms'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s;', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s
       for each row execute function public.write_audit_log();', t);
  end loop;

  foreach t in array array['expenses','buyers','sales','revenues','activities'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $mig$;
