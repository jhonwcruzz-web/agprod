-- =====================================================================
-- 0001_core — fundacao multi-tenant: perfis, fazendas, talhoes, safras
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Schema privado: NAO exposto na Data API. Abriga helpers SECURITY DEFINER
-- usados pelas policies de RLS (evita recursao infinita nas policies).
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- ---------- enums -------------------------------------------------------
do $mig$ begin
  create type farm_role as enum ('owner','admin','operator','viewer');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type area_unit as enum ('ha','m2','alqueire');
exception when duplicate_object then null; end $mig$;

do $mig$ begin
  create type plot_status as enum ('producao','formacao','repouso','inativo');
exception when duplicate_object then null; end $mig$;

-- ---------- profiles ----------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Dados publicos do usuario, espelha auth.users';

-- Cria o profile automaticamente no signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- farms -------------------------------------------------------
create table if not exists public.farms (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trade_name     text,
  owner_name     text,
  tax_id         text,
  phone          text,
  email          citext,
  address        text,
  city           text,
  state          char(2),
  postal_code    text,
  community      text,
  latitude       numeric(10,7),
  longitude      numeric(10,7),
  total_area     numeric(12,4) not null default 0 check (total_area >= 0),
  area_unit      area_unit not null default 'ha',
  main_activity  text,
  created_by     uuid not null references auth.users(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- farm_users (tenancy) ---------------------------------------
create table if not exists public.farm_users (
  farm_id    uuid not null references public.farms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       farm_role not null default 'operator',
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);
create index if not exists farm_users_user_idx on public.farm_users(user_id);

-- ---------- helpers de RLS (schema privado) ----------------------------
-- Membro da fazenda? Usado em USING/WITH CHECK de toda tabela tenant.
create or replace function private.is_farm_member(p_farm_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $fn$
  select exists (
    select 1 from public.farm_users fu
    where fu.farm_id = p_farm_id
      and fu.user_id = (select auth.uid())
  );
$fn$;

-- Tem pelo menos o papel exigido? (owner > admin > operator > viewer)
create or replace function private.has_farm_role(p_farm_id uuid, p_min farm_role)
returns boolean
language sql
security definer
stable
set search_path = ''
as $fn$
  select exists (
    select 1 from public.farm_users fu
    where fu.farm_id = p_farm_id
      and fu.user_id = (select auth.uid())
      and case fu.role
            when 'owner'    then 4
            when 'admin'    then 3
            when 'operator' then 2
            else 1
          end >=
          case p_min
            when 'owner'    then 4
            when 'admin'    then 3
            when 'operator' then 2
            else 1
          end
  );
$fn$;

revoke all on function private.is_farm_member(uuid) from public;
revoke all on function private.has_farm_role(uuid, farm_role) from public;
grant execute on function private.is_farm_member(uuid) to authenticated;
grant execute on function private.has_farm_role(uuid, farm_role) to authenticated;

-- ---------- culturas e material vegetal (referencia) -------------------
create table if not exists public.crops (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  sort_order int not null default 100
);

-- farm_id null = catalogo global; preenchido = variedade propria da fazenda
create table if not exists public.varieties (
  id         uuid primary key default gen_random_uuid(),
  crop_id    uuid not null references public.crops(id) on delete cascade,
  farm_id    uuid references public.farms(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists varieties_global_unique
  on public.varieties(crop_id, lower(name)) where farm_id is null;
create index if not exists varieties_farm_idx on public.varieties(farm_id);

create table if not exists public.rootstocks (
  id         uuid primary key default gen_random_uuid(),
  crop_id    uuid not null references public.crops(id) on delete cascade,
  farm_id    uuid references public.farms(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists rootstocks_global_unique
  on public.rootstocks(crop_id, lower(name)) where farm_id is null;
create index if not exists rootstocks_farm_idx on public.rootstocks(farm_id);

-- ---------- safras ------------------------------------------------------
create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  name       text not null,
  start_date date,
  end_date   date,
  is_active  boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  unique (farm_id, name),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists seasons_farm_idx on public.seasons(farm_id, is_active);

-- ---------- talhoes -----------------------------------------------------
create table if not exists public.plots (
  id                uuid primary key default gen_random_uuid(),
  farm_id           uuid not null references public.farms(id) on delete cascade,
  code              text not null,
  name              text,
  area              numeric(12,4) not null default 0 check (area >= 0),
  area_unit         area_unit not null default 'ha',
  crop_id           uuid references public.crops(id) on delete set null,
  variety_id        uuid references public.varieties(id) on delete set null,
  rootstock_id      uuid references public.rootstocks(id) on delete set null,
  planting_date     date,
  plant_count       integer check (plant_count is null or plant_count >= 0),
  row_spacing       numeric(6,2),
  plant_spacing     numeric(6,2),
  irrigation_system text,
  training_system   text,
  status            plot_status not null default 'producao',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (farm_id, code)
);
create index if not exists plots_farm_idx on public.plots(farm_id);
create index if not exists plots_crop_idx on public.plots(crop_id);

-- ---------- updated_at automatico --------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  new.updated_at = now();
  return new;
end; $fn$;

do $mig$
declare t text;
begin
  foreach t in array array['profiles','farms','plots'] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $mig$;
