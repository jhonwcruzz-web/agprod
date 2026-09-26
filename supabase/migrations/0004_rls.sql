-- =====================================================================
-- 0004_rls — Row Level Security em TODAS as tabelas do schema public.
--
-- Regras aplicadas (checklist de seguranca Supabase):
--   * toda policy usa "to authenticated" + predicado de posse (nunca
--     "to authenticated" sozinho, que seria BOLA/IDOR);
--   * toda policy de UPDATE tem USING e WITH CHECK, impedindo que a linha
--     seja reatribuida a outra fazenda;
--   * helpers SECURITY DEFINER vivem no schema privado "private", fora da
--     Data API, e checam auth.uid() internamente;
--   * auth.uid() e' encapsulado em (select ...) para ser avaliado uma vez
--     por query em vez de uma vez por linha.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cria o vinculo owner ao criar a fazenda. SECURITY DEFINER porque a
-- policy de farm_users exige ser membro, e o primeiro membro nao existe
-- ainda no momento do insert da fazenda.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_farm()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.farm_users (farm_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (farm_id, user_id) do nothing;
  return new;
end; $fn$;
revoke all on function public.handle_new_farm() from public;

drop trigger if exists on_farm_created on public.farms;
create trigger on_farm_created after insert on public.farms
  for each row execute function public.handle_new_farm();

-- Compartilha alguma fazenda com o usuario alvo? (visibilidade de perfis)
create or replace function private.shares_farm_with(p_user_id uuid)
returns boolean language sql security definer stable set search_path = '' as $fn$
  select exists (
    select 1
    from public.farm_users me
    join public.farm_users other on other.farm_id = me.farm_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user_id
  );
$fn$;
revoke all on function private.shares_farm_with(uuid) from public;
grant execute on function private.shares_farm_with(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. Habilita RLS em tudo e revoga o acesso do papel anonimo.
--    Nenhuma tabela deste app deve ser legivel sem login.
-- ---------------------------------------------------------------------
do $mig$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- 2. Tabelas com padrao "farm_id + membro da fazenda".
--    Gera as 4 policies (select/insert/update/delete) para cada uma.
-- ---------------------------------------------------------------------
do $mig$
declare
  t text;
  tenant_tables text[] := array[
    'seasons','plots','crop_cycles','products','inventory_movements',
    'production_records','applications','fertilizations','irrigation_records',
    'expenses','buyers','sales','revenues','activities','alerts','media'
  ];
begin
  foreach t in array tenant_tables loop
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

    -- USING + WITH CHECK: nao basta poder ver a linha, a linha resultante
    -- tambem precisa continuar dentro de uma fazenda do usuario.
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

-- ---------------------------------------------------------------------
-- 3. profiles — o usuario ve a si mesmo e a quem divide fazenda com ele,
--    mas so' edita o proprio perfil.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or private.shares_farm_with(id) );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ( id = (select auth.uid()) );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 4. farms — membro le; owner/admin altera; qualquer autenticado pode
--    criar desde que se declare o criador.
-- ---------------------------------------------------------------------
drop policy if exists farms_select on public.farms;
create policy farms_select on public.farms
  for select to authenticated
  using ( private.is_farm_member(id) );

drop policy if exists farms_insert on public.farms;
create policy farms_insert on public.farms
  for insert to authenticated
  with check ( created_by = (select auth.uid()) );

drop policy if exists farms_update on public.farms;
create policy farms_update on public.farms
  for update to authenticated
  using ( private.has_farm_role(id, 'admin') )
  with check ( private.has_farm_role(id, 'admin') );

drop policy if exists farms_delete on public.farms;
create policy farms_delete on public.farms
  for delete to authenticated
  using ( private.has_farm_role(id, 'owner') );

grant select, insert, update, delete on public.farms to authenticated;

-- ---------------------------------------------------------------------
-- 5. farm_users — equipe da propriedade. Somente owner/admin gerenciam.
-- ---------------------------------------------------------------------
drop policy if exists farm_users_select on public.farm_users;
create policy farm_users_select on public.farm_users
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_farm_member(farm_id) );

drop policy if exists farm_users_insert on public.farm_users;
create policy farm_users_insert on public.farm_users
  for insert to authenticated
  with check ( private.has_farm_role(farm_id, 'admin') );

drop policy if exists farm_users_update on public.farm_users;
create policy farm_users_update on public.farm_users
  for update to authenticated
  using ( private.has_farm_role(farm_id, 'admin') )
  with check ( private.has_farm_role(farm_id, 'admin') );

drop policy if exists farm_users_delete on public.farm_users;
create policy farm_users_delete on public.farm_users
  for delete to authenticated
  using ( private.has_farm_role(farm_id, 'admin') );

grant select, insert, update, delete on public.farm_users to authenticated;

-- ---------------------------------------------------------------------
-- 6. crops — catalogo global, somente leitura para o app.
-- ---------------------------------------------------------------------
drop policy if exists crops_select on public.crops;
create policy crops_select on public.crops
  for select to authenticated using ( true );
grant select on public.crops to authenticated;

-- ---------------------------------------------------------------------
-- 7. varieties / rootstocks — catalogo global (farm_id null) visivel a
--    todos; itens proprios restritos a fazenda que os criou.
-- ---------------------------------------------------------------------
do $mig$
declare t text;
begin
  foreach t in array array['varieties','rootstocks'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);

    execute format($pol$
      create policy %1$s_select on public.%1$s
        for select to authenticated
        using ( farm_id is null or private.is_farm_member(farm_id) );
    $pol$, t);

    -- so' permite criar item proprio da fazenda; o catalogo global nao e'
    -- editavel pelo app (farm_id null e' rejeitado no with check).
    execute format($pol$
      create policy %1$s_insert on public.%1$s
        for insert to authenticated
        with check ( farm_id is not null and private.has_farm_role(farm_id, 'operator') );
    $pol$, t);

    execute format($pol$
      create policy %1$s_update on public.%1$s
        for update to authenticated
        using ( farm_id is not null and private.has_farm_role(farm_id, 'operator') )
        with check ( farm_id is not null and private.has_farm_role(farm_id, 'operator') );
    $pol$, t);

    execute format($pol$
      create policy %1$s_delete on public.%1$s
        for delete to authenticated
        using ( farm_id is not null and private.has_farm_role(farm_id, 'admin') );
    $pol$, t);

    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- 8. IA — conversas sao privadas do usuario dentro da fazenda.
-- ---------------------------------------------------------------------
drop policy if exists ai_conv_select on public.ai_conversations;
create policy ai_conv_select on public.ai_conversations
  for select to authenticated
  using ( user_id = (select auth.uid()) and private.is_farm_member(farm_id) );

drop policy if exists ai_conv_insert on public.ai_conversations;
create policy ai_conv_insert on public.ai_conversations
  for insert to authenticated
  with check ( user_id = (select auth.uid()) and private.is_farm_member(farm_id) );

drop policy if exists ai_conv_delete on public.ai_conversations;
create policy ai_conv_delete on public.ai_conversations
  for delete to authenticated
  using ( user_id = (select auth.uid()) );

grant select, insert, delete on public.ai_conversations to authenticated;

drop policy if exists ai_msg_select on public.ai_messages;
create policy ai_msg_select on public.ai_messages
  for select to authenticated
  using ( exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

drop policy if exists ai_msg_insert on public.ai_messages;
create policy ai_msg_insert on public.ai_messages
  for insert to authenticated
  with check ( exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

grant select, insert on public.ai_messages to authenticated;

-- ---------------------------------------------------------------------
-- 9. audit_logs — somente leitura, e so' para owner/admin. As linhas sao
--    escritas pelo trigger SECURITY DEFINER, nunca pelo cliente.
-- ---------------------------------------------------------------------
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using ( farm_id is not null and private.has_farm_role(farm_id, 'admin') );

grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
