-- =====================================================================
-- 0016_categories_machines_stock
--
-- 1. Categorias criaveis pelo produtor (botao "+"), no estoque e nos
--    custos. Antes eram enums fixos no banco.
-- 2. Pulverizacao e adubacao registram trator e implemento usados.
-- 3. Diario da maquina ligado ao estoque: abastecimento ou peca retirada
--    do estoque da' baixa sozinha.
-- 4. Custo medio ponderado do estoque (antes: ultimo preco pago).
-- 5. Toda referencia (talhao, produto, maquina, safra...) precisa ser da
--    mesma fazenda do lancamento.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Categorias de custo: catalogo padrao + as criadas pela fazenda.
--     expenses.category guarda o CODIGO (os triggers e relatorios usam os
--     codigos padrao, ex.: 'fitossanidade'); o nome exibido vem daqui.
-- ---------------------------------------------------------------------
create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid references public.farms(id) on delete cascade,
  code       text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  name       text not null check (length(trim(name)) between 2 and 60),
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists expense_cat_global_code
  on public.expense_categories(code) where farm_id is null;
create unique index if not exists expense_cat_farm_code
  on public.expense_categories(farm_id, code) where farm_id is not null;
create unique index if not exists expense_cat_farm_name
  on public.expense_categories(farm_id, lower(name)) where farm_id is not null;

insert into public.expense_categories (farm_id, code, name, sort_order) values
  (null, 'mao_de_obra',   'Mão de obra',   1),
  (null, 'adubacao',      'Adubação',      2),
  (null, 'fitossanidade', 'Pulverização',  3),
  (null, 'irrigacao',     'Irrigação',     4),
  (null, 'combustivel',   'Combustível',   5),
  (null, 'energia',       'Energia',       6),
  (null, 'manutencao',    'Manutenção',    7),
  (null, 'maquinas',      'Máquinas',      8),
  (null, 'embalagens',    'Embalagens',    9),
  (null, 'frete',         'Frete',        10),
  (null, 'servicos',      'Serviços',     11),
  (null, 'outros',        'Outros',       99)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1b. Categorias de estoque. Cada uma diz em que categoria de custo a
--     compra cai (ex.: Fertilizante -> adubacao).
-- ---------------------------------------------------------------------
create table if not exists public.product_categories (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid references public.farms(id) on delete cascade,
  name              text not null check (length(trim(name)) between 2 and 60),
  expense_category  text not null default 'outros',
  sort_order        int not null default 100,
  created_at        timestamptz not null default now()
);
create unique index if not exists product_cat_global_name
  on public.product_categories(lower(name)) where farm_id is null;
create unique index if not exists product_cat_farm_name
  on public.product_categories(farm_id, lower(name)) where farm_id is not null;

insert into public.product_categories (farm_id, name, expense_category, sort_order) values
  (null, 'Fertilizante',        'adubacao',      1),
  (null, 'Defensivo',           'fitossanidade', 2),
  (null, 'Corretivo',           'adubacao',      3),
  (null, 'Combustível',         'combustivel',   4),
  (null, 'Peças e manutenção',  'manutencao',    5),
  (null, 'Ferramentas e EPI',   'outros',        6),
  (null, 'Material',            'outros',        7),
  (null, 'Embalagem',           'embalagens',    8),
  (null, 'Outro',               'outros',       99)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1c. Converte as colunas. As views que dependem delas sao recriadas
--     logo abaixo com a mesma definicao.
-- ---------------------------------------------------------------------
drop view if exists public.v_expense_summary;
drop view if exists public.v_plot_cost_breakdown;
drop view if exists public.v_stock_status;

alter table public.expenses alter column category drop default;
alter table public.expenses alter column category type text using category::text;
alter table public.expenses alter column category set default 'outros';

alter table public.products add column if not exists category_id uuid
  references public.product_categories(id) on delete restrict;

-- valores antigos do enum -> categorias padrao correspondentes
update public.products p
   set category_id = pc.id
  from public.product_categories pc
 where pc.farm_id is null
   and p.category_id is null
   and lower(pc.name) = case p.category::text
         when 'fertilizante' then 'fertilizante'
         when 'defensivo'    then 'defensivo'
         when 'corretivo'    then 'corretivo'
         when 'material'     then 'material'
         when 'embalagem'    then 'embalagem'
         when 'combustivel'  then 'combustível'
         else 'outro'
       end;

alter table public.products drop column if exists category;
alter table public.products alter column category_id set not null;
create index if not exists products_category_idx on public.products(category_id);

drop type if exists public.product_category;

-- ---------------------------------------------------------------------
-- 2. Maquinas na pulverizacao e na adubacao.
-- ---------------------------------------------------------------------
alter table public.applications
  add column if not exists machine_id   uuid references public.machines(id) on delete set null,
  add column if not exists implement_id uuid references public.machines(id) on delete set null;
alter table public.fertilizations
  add column if not exists machine_id   uuid references public.machines(id) on delete set null,
  add column if not exists implement_id uuid references public.machines(id) on delete set null;
create index if not exists app_machine_idx on public.applications(machine_id);
create index if not exists fert_machine_idx on public.fertilizations(machine_id);

comment on column public.applications.spray_volume is 'Volume de calda em L/ha';

-- ---------------------------------------------------------------------
-- 3. Diario da maquina ligado ao estoque.
-- ---------------------------------------------------------------------
alter table public.machine_logs
  add column if not exists product_id       uuid references public.products(id) on delete set null,
  add column if not exists product_quantity numeric(14,3)
    check (product_quantity is null or product_quantity >= 0);

create or replace function public.sync_stock_from_operation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_qty     numeric;
  v_product uuid;
  v_date    date;
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
    if new.status <> 'realizada' then
      return new;               -- so' baixa pulverizacao efetivamente feita
    end if;
    v_product := new.product_id;
    v_qty     := new.total_quantity;
    v_date    := coalesce(new.application_date, new.scheduled_date, current_date);
  elsif tg_table_name = 'fertilizations' then
    v_product := new.product_id;
    v_qty     := new.quantity;
    v_date    := new.fertilization_date;
  elsif tg_table_name = 'machine_logs' then
    v_product := new.product_id;
    -- abastecimento sem quantidade explicita usa os litros abastecidos
    v_qty     := coalesce(new.product_quantity,
                          case when new.log_type = 'abastecimento' then new.liters end);
    v_date    := new.log_date;
  else
    return new;
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

drop trigger if exists machine_logs_stock_sync on public.machine_logs;
create trigger machine_logs_stock_sync
  after insert or update or delete on public.machine_logs
  for each row execute function public.sync_stock_from_operation();

-- Livro de custos: categoria agora e' texto (codigo).
create or replace function public.sync_expense_from_operation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_cat   text;
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
      return new;
    end if;
    v_cat  := 'fitossanidade';
    v_desc := 'Pulverização: ' || new.product_name;
    v_date := coalesce(new.application_date, current_date);
    v_cost := new.cost;
  elsif tg_table_name = 'fertilizations' then
    v_cat  := 'adubacao';
    v_desc := 'Adubação: ' || new.product_name;
    v_date := new.fertilization_date;
    v_cost := new.cost;
  elsif tg_table_name = 'irrigation_records' then
    v_cat  := 'irrigacao';
    v_desc := 'Irrigação';
    v_date := new.irrigation_date;
    v_cost := new.cost;
  elsif tg_table_name = 'machine_logs' then
    v_cat  := case when new.log_type = 'abastecimento' then 'combustivel' else 'maquinas' end;
    v_desc := case new.log_type
                when 'abastecimento' then 'Abastecimento: '
                when 'corretiva'     then 'Conserto: '
                when 'revisao'       then 'Revisão: '
                else 'Manutenção: '
              end || coalesce((select m.name from public.machines m where m.id = new.machine_id), 'máquina');
    v_date := new.log_date;
    v_cost := new.cost;
  else
    return new;
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

drop type if exists public.expense_category;

-- ---------------------------------------------------------------------
-- 4. Custo medio ponderado: cada compra recalcula o custo unitario do
--    produto pela media entre o saldo que havia e o que entrou. E' esse
--    custo que a pulverizacao e a adubacao usam para calcular o valor.
-- ---------------------------------------------------------------------
create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.products
       set current_stock = current_stock - case old.movement_type
             when 'entrada' then old.quantity
             when 'saida'   then -old.quantity
             else 0 end
     where id = old.product_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.movement_type = 'ajuste' then
    -- ajuste define o saldo absoluto contado no inventario
    update public.products set current_stock = new.quantity where id = new.product_id;
  elsif new.movement_type = 'entrada' then
    update public.products
       set unit_cost = case
             when new.unit_cost > 0 and greatest(current_stock, 0) + new.quantity > 0
               then round((greatest(current_stock, 0) * unit_cost + new.quantity * new.unit_cost)
                          / (greatest(current_stock, 0) + new.quantity), 4)
             else unit_cost end,
           current_stock = current_stock + new.quantity
     where id = new.product_id;
  else
    update public.products
       set current_stock = current_stock - new.quantity
     where id = new.product_id;
  end if;

  return new;
end; $fn$;

-- ---------------------------------------------------------------------
-- 5. Referencias sempre da mesma fazenda.
--
--    A FK garante que o id existe, nao que e' SEU. Sem isto, alguem
--    poderia gravar na propria fazenda um lancamento apontando para o
--    produto, talhao ou maquina de outra — e a baixa de estoque tentaria
--    mexer no produto alheio. Argumentos: pares (coluna, tabela).
--    security invoker: um id de outra fazenda nao aparece para quem grava
--    (RLS), entao cai no "nao pertence" do mesmo jeito.
-- ---------------------------------------------------------------------
create or replace function public.check_tenant_refs()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare
  v_row jsonb := to_jsonb(new);
  v_i   int := 0;
  v_col text;
  v_tbl text;
  v_ref uuid;
  v_ok  boolean;
begin
  while v_i < tg_nargs loop
    v_col := tg_argv[v_i];
    v_tbl := tg_argv[v_i + 1];
    v_i := v_i + 2;
    v_ref := nullif(v_row ->> v_col, '')::uuid;
    if v_ref is not null then
      execute format('select exists (select 1 from public.%I where id = $1 and farm_id = $2)', v_tbl)
        into v_ok using v_ref, new.farm_id;
      if not v_ok then
        raise exception 'Referência inválida: % não pertence a esta propriedade', v_col
          using errcode = '23503';
      end if;
    end if;
  end loop;
  return new;
end; $fn$;

do $mig$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('applications',        array['plot_id','plots','product_id','products','machine_id','machines','implement_id','machines','season_id','seasons']),
      ('fertilizations',      array['plot_id','plots','product_id','products','machine_id','machines','implement_id','machines','season_id','seasons']),
      ('machine_logs',        array['plot_id','plots','product_id','products','season_id','seasons']),
      ('production_records',  array['plot_id','plots','season_id','seasons','crop_cycle_id','crop_cycles']),
      ('sales',               array['plot_id','plots','buyer_id','buyers','season_id','seasons']),
      ('expenses',            array['plot_id','plots','season_id','seasons']),
      ('revenues',            array['season_id','seasons','sale_id','sales']),
      ('inventory_movements', array['product_id','products']),
      ('irrigation_records',  array['plot_id','plots','season_id','seasons']),
      ('crop_cycles',         array['plot_id','plots','season_id','seasons']),
      ('activities',          array['plot_id','plots','season_id','seasons'])
    ) as t(tbl, args)
  loop
    execute format('drop trigger if exists %I on public.%I', spec.tbl || '_tenant_refs', spec.tbl);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.check_tenant_refs(%s)',
      spec.tbl || '_tenant_refs', spec.tbl,
      (select string_agg(quote_literal(a), ', ') from unnest(spec.args) a)
    );
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- Views recriadas (mesma definicao; categoria de produto agora vem da
-- tabela de categorias).
-- ---------------------------------------------------------------------
create or replace view public.v_plot_cost_breakdown
with (security_invoker = true) as
select e.farm_id, e.plot_id, e.season_id, e.category, sum(e.amount) as amount
from public.expenses e
where e.is_production_cost and e.plot_id is not null
group by e.farm_id, e.plot_id, e.season_id, e.category;

create or replace view public.v_stock_status
with (security_invoker = true) as
select
  pr.id            as product_id,
  pr.farm_id,
  pr.name,
  pc.name          as category,
  pr.category_id,
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
join public.product_categories pc on pc.id = pr.category_id
where pr.is_active;

create or replace view public.v_expense_summary
with (security_invoker = true) as
select
  e.farm_id, e.season_id, e.category, e.is_production_cost,
  (e.plot_id is null)                         as unallocated,
  count(*)                                    as entries,
  sum(e.amount)                               as amount,
  sum(e.paid_amount)                          as paid_amount,
  sum(e.amount - e.paid_amount) filter (where e.status <> 'pago') as open_amount,
  sum(e.amount - e.paid_amount) filter (
    where e.status <> 'pago' and e.due_date is not null and e.due_date < current_date
  )                                           as overdue_amount
from public.expenses e
group by e.farm_id, e.season_id, e.category, e.is_production_cost, (e.plot_id is null);

do $mig$
declare v text;
begin
  foreach v in array array['v_plot_cost_breakdown','v_stock_status','v_expense_summary'] loop
    execute format('grant select on public.%I to authenticated;', v);
    execute format('revoke all on public.%I from anon;', v);
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- RLS das categorias (mesmo padrao de variedades e destinos).
-- ---------------------------------------------------------------------
do $mig$
declare t text;
begin
  foreach t in array array['expense_categories','product_categories'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format($pol$
      create policy %1$s_select on public.%1$s for select to authenticated
        using ( farm_id is null or private.is_farm_member(farm_id) );
    $pol$, t);
    execute format($pol$
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check ( farm_id is not null and private.has_farm_role(farm_id, 'operator') );
    $pol$, t);
    execute format($pol$
      create policy %1$s_update on public.%1$s for update to authenticated
        using ( farm_id is not null and private.has_farm_role(farm_id, 'operator') )
        with check ( farm_id is not null and private.has_farm_role(farm_id, 'operator') );
    $pol$, t);
    execute format($pol$
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using ( farm_id is not null and private.has_farm_role(farm_id, 'admin') );
    $pol$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $mig$;

-- Funcoes de trigger novas nao sao API (regra da 0010).
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
