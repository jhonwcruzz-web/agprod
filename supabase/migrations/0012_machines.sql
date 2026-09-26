-- =====================================================================
-- 0012_machines — gestao de maquinas e implementos.
--
-- Duas tabelas:
--   machines        cadastro: tratores, pulverizadores, veiculos (maquinas)
--                   e grades, rocadeiras, carretas (implementos)
--   machine_logs    diario da maquina: manutencao preventiva, corretiva,
--                   revisao e abastecimento
--
-- O diario alimenta sozinho:
--   * o livro de custos (expenses) — manutencao em "maquinas",
--     abastecimento em "combustivel";
--   * o horimetro/odometro da maquina, que so' anda para frente.
-- =====================================================================

do $mig$ begin
  create type machine_class as enum ('maquina','implemento');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type machine_status as enum ('operacional','manutencao','inativo');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type meter_type as enum ('horas','km','nenhum');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type machine_log_type as enum ('preventiva','corretiva','revisao','abastecimento');
exception when duplicate_object then null; end $mig$;

-- ---------------------------------------------------------- cadastro
create table if not exists public.machines (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  class             machine_class not null default 'maquina',
  kind              text,                     -- Trator, Grade, Carreta...
  name              text not null,            -- como o produtor chama: "Trator azul"
  brand             text,
  model             text,
  year              integer check (year is null or year between 1950 and 2100),
  identifier        text,                     -- placa, chassi ou numero de serie
  power_hp          numeric(7,1) check (power_hp is null or power_hp >= 0),
  meter_type        meter_type not null default 'horas',
  current_meter     numeric(12,1) not null default 0 check (current_meter >= 0),
  acquisition_date  date,
  acquisition_value numeric(14,2) check (acquisition_value is null or acquisition_value >= 0),
  -- implemento normalmente acoplado a qual maquina
  coupled_to        uuid references public.machines(id) on delete set null,
  status            machine_status not null default 'operacional',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (coupled_to is null or coupled_to <> id)
);
create index if not exists machines_farm_idx on public.machines(farm_id, class);
create index if not exists machines_coupled_idx on public.machines(coupled_to);

-- ---------------------------------------------------------- diario
create table if not exists public.machine_logs (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references public.farms(id) on delete cascade,
  machine_id      uuid not null references public.machines(id) on delete cascade,
  -- opcional: atribui o custo a um talhao quando a maquina trabalhou so' nele
  plot_id         uuid references public.plots(id) on delete set null,
  season_id       uuid references public.seasons(id) on delete set null,
  log_type        machine_log_type not null default 'preventiva',
  log_date        date not null default current_date,
  description     text,
  meter_reading   numeric(12,1) check (meter_reading is null or meter_reading >= 0),
  liters          numeric(10,2) check (liters is null or liters >= 0),
  cost            numeric(14,2) not null default 0 check (cost >= 0),
  next_due_date   date,
  next_due_meter  numeric(12,1) check (next_due_meter is null or next_due_meter >= 0),
  supplier        text,                     -- oficina, posto
  responsible     text,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists machine_logs_machine_idx on public.machine_logs(machine_id, log_date desc);
create index if not exists machine_logs_farm_idx on public.machine_logs(farm_id, log_date desc);

-- ---------------------------------------------------------------------
-- O implemento so' pode ser acoplado a uma maquina da mesma fazenda.
-- Sem isso, um usuario poderia apontar coupled_to para o id de uma
-- maquina alheia (o RLS protege a leitura, nao a integridade da FK).
-- ---------------------------------------------------------------------
create or replace function public.check_machine_coupling()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if new.coupled_to is not null and not exists (
    select 1 from public.machines m
    where m.id = new.coupled_to and m.farm_id = new.farm_id
  ) then
    raise exception 'Acoplamento invalido: a maquina precisa ser da mesma propriedade';
  end if;
  return new;
end; $fn$;

drop trigger if exists machines_check_coupling on public.machines;
create trigger machines_check_coupling before insert or update on public.machines
  for each row execute function public.check_machine_coupling();

-- O registro do diario precisa pertencer a' mesma fazenda da maquina.
create or replace function public.check_machine_log_farm()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if not exists (
    select 1 from public.machines m
    where m.id = new.machine_id and m.farm_id = new.farm_id
  ) then
    raise exception 'Maquina nao pertence a esta propriedade';
  end if;
  return new;
end; $fn$;

drop trigger if exists machine_logs_check_farm on public.machine_logs;
create trigger machine_logs_check_farm before insert or update on public.machine_logs
  for each row execute function public.check_machine_log_farm();

-- ---------------------------------------------------------------------
-- Horimetro/odometro so' anda para frente: um lancamento antigo digitado
-- depois nao pode "voltar" a leitura atual da maquina.
-- ---------------------------------------------------------------------
create or replace function public.advance_machine_meter()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if new.meter_reading is not null then
    update public.machines
       set current_meter = greatest(current_meter, new.meter_reading)
     where id = new.machine_id;
  end if;
  return new;
end; $fn$;

drop trigger if exists machine_logs_advance_meter on public.machine_logs;
create trigger machine_logs_advance_meter after insert or update on public.machine_logs
  for each row execute function public.advance_machine_meter();

-- ---------------------------------------------------------------------
-- Livro de custos: substitui a funcao para ganhar o ramo de maquinas.
-- O ramo de irrigacao passa a ser explicito — antes era o "else", e um
-- diario de maquina cairia nele e viraria custo de irrigacao.
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
  elsif tg_table_name = 'irrigation_records' then
    v_cat  := 'irrigacao';
    v_desc := 'Irrigacao';
    v_date := new.irrigation_date;
    v_cost := new.cost;
  elsif tg_table_name = 'machine_logs' then
    v_cat  := case when new.log_type = 'abastecimento'
                   then 'combustivel'::public.expense_category
                   else 'maquinas'::public.expense_category end;
    v_desc := case new.log_type
                when 'abastecimento' then 'Abastecimento: '
                when 'corretiva'     then 'Conserto: '
                when 'revisao'       then 'Revisao: '
                else 'Manutencao: '
              end || coalesce((select m.name from public.machines m where m.id = new.machine_id), 'maquina');
    v_date := new.log_date;
    v_cost := new.cost;
  else
    return new;                 -- tabela desconhecida: nao lanca nada
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

drop trigger if exists machine_logs_expense_sync on public.machine_logs;
create trigger machine_logs_expense_sync after insert or update or delete on public.machine_logs
  for each row execute function public.sync_expense_from_operation();

drop trigger if exists touch_machines on public.machines;
create trigger touch_machines before update on public.machines
  for each row execute function public.touch_updated_at();

-- Cadastro de maquina e' patrimonio: fica auditado como vendas e despesas.
drop trigger if exists audit_machines on public.machines;
create trigger audit_machines after insert or update or delete on public.machines
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------
-- Situacao de cada maquina: ultimo registro, proxima manutencao e custo.
-- ---------------------------------------------------------------------
create or replace view public.v_machine_status
with (security_invoker = true) as
select
  m.id                                  as machine_id,
  m.farm_id,
  m.class,
  m.kind,
  m.name,
  m.brand,
  m.model,
  m.year,
  m.meter_type,
  m.current_meter,
  m.status,
  m.coupled_to,
  last_svc.log_date                     as last_service_date,
  due.next_due_date,
  due.next_due_meter,
  coalesce(costs.maintenance_cost, 0)   as maintenance_cost,
  coalesce(costs.fuel_cost, 0)          as fuel_cost,
  coalesce(costs.fuel_liters, 0)        as fuel_liters,
  case
    when m.status = 'inativo' then 'ok'
    when (due.next_due_date is not null and due.next_due_date < current_date)
      or (due.next_due_meter is not null and m.current_meter >= due.next_due_meter)
      then 'vencida'
    when (due.next_due_date is not null and due.next_due_date <= current_date + 7)
      or (due.next_due_meter is not null and m.current_meter >= due.next_due_meter - 20)
      then 'proxima'
    else 'ok'
  end                                   as due_level
from public.machines m
left join lateral (
  select l.log_date
  from public.machine_logs l
  where l.machine_id = m.id and l.log_type <> 'abastecimento'
  order by l.log_date desc, l.created_at desc
  limit 1
) last_svc on true
-- A "proxima manutencao" vem do registro mais recente que a definiu.
left join lateral (
  select l.next_due_date, l.next_due_meter
  from public.machine_logs l
  where l.machine_id = m.id
    and (l.next_due_date is not null or l.next_due_meter is not null)
  order by l.log_date desc, l.created_at desc
  limit 1
) due on true
left join lateral (
  select
    sum(l.cost) filter (where l.log_type <> 'abastecimento') as maintenance_cost,
    sum(l.cost) filter (where l.log_type = 'abastecimento')  as fuel_cost,
    sum(l.liters) filter (where l.log_type = 'abastecimento') as fuel_liters
  from public.machine_logs l
  where l.machine_id = m.id
) costs on true;

grant select on public.v_machine_status to authenticated;
revoke all on public.v_machine_status from anon;

-- ---------------------------------------------------------------------
-- RLS — mesmo padrao das demais tabelas da fazenda.
-- ---------------------------------------------------------------------
do $mig$
declare t text;
begin
  foreach t in array array['machines','machine_logs'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on public.%I from anon;', t);

    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);

    execute format($pol$
      create policy %1$s_select on public.%1$s
        for select to authenticated
        using (private.is_farm_member(farm_id));
    $pol$, t);

    execute format($pol$
      create policy %1$s_insert on public.%1$s
        for insert to authenticated
        with check (private.has_farm_role(farm_id, 'operator'));
    $pol$, t);

    execute format($pol$
      create policy %1$s_update on public.%1$s
        for update to authenticated
        using (private.has_farm_role(farm_id, 'operator'))
        with check (private.has_farm_role(farm_id, 'operator'));
    $pol$, t);

    execute format($pol$
      create policy %1$s_delete on public.%1$s
        for delete to authenticated
        using (private.has_farm_role(farm_id, 'admin'));
    $pol$, t);

    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $mig$;

-- Funcoes de trigger novas nao sao API (mesma regra da 0010).
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
