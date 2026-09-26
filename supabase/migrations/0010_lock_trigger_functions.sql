-- =====================================================================
-- 0010_lock_trigger_functions — fecha as funcoes de trigger para os
--                               papeis da Data API.
--
-- O Postgres concede EXECUTE a PUBLIC em toda funcao nova, e o Supabase
-- ainda aplica default privileges para anon e authenticated no schema
-- public. Resultado: "revoke ... from public" NAO era suficiente —
-- handle_new_farm e write_audit_log continuavam executaveis por anon,
-- virando endpoints publicos (o caso mais perigoso, porque ambas sao
-- SECURITY DEFINER e ignoram o RLS).
--
-- Na pratica chamar uma funcao de trigger fora de um trigger falha, mas
-- o certo e' nao expor: se amanha uma delas ganhar um caminho alternativo
-- de execucao, o furo ja' estaria aberto.
--
-- Esta migracao revoga EXECUTE de anon e authenticated em TODA funcao de
-- trigger do schema public — as atuais e, por ser idempotente, as futuras
-- quando reaplicada.
-- =====================================================================

do $mig$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('revoke all on function %s from authenticated', fn.sig);
  end loop;
end $mig$;

-- Funcoes auxiliares que tambem nao sao API: sao chamadas pelos triggers
-- e pelas views, nunca pelo cliente.
do $mig$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('to_kg')
  loop
    execute format('revoke all on function %s from anon', fn.sig);
  end loop;
end $mig$;

-- Impede que novas funcoes em public nascam executaveis pelo papel
-- anonimo. Nao afeta authenticated, que precisa chamar to_kg atraves das
-- views e dos triggers durante suas proprias escritas.
alter default privileges in schema public revoke execute on functions from anon;
