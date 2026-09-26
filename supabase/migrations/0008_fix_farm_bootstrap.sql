-- =====================================================================
-- 0008_fix_farm_bootstrap — corrige dois defeitos encontrados no teste
--                           ponta a ponta (tools/verify.js).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. write_audit_log() assumia que toda tabela auditada tem "farm_id".
--    A tabela farms nao tem: o proprio id dela e' o id da fazenda.
--    Resultado: qualquer INSERT em farms falhava com
--    'record "new" has no field "farm_id"'.
-- ---------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  v_row  jsonb;
  v_farm uuid;
  v_rec  uuid;
begin
  v_row := to_jsonb(coalesce(new, old));
  v_rec := (v_row->>'id')::uuid;

  -- Em farms o proprio id e' o identificador da fazenda; nas demais
  -- tabelas o vinculo vem da coluna farm_id.
  v_farm := case
    when tg_table_name = 'farms' then v_rec
    else (v_row->>'farm_id')::uuid
  end;

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

-- ---------------------------------------------------------------------
-- 2. Bootstrap da primeira propriedade.
--
--    A policy de SELECT exigia ser membro da fazenda, mas o vinculo de
--    owner nasce num trigger AFTER INSERT — que roda DEPOIS de o
--    RETURNING ser avaliado. Com isso, "insert ... returning id" (o que
--    o supabase-js faz em .insert().select()) era recusado pelo RLS.
--
--    A correcao permite que quem criou a fazenda sempre a enxergue.
--    Nao amplia o acesso de mais ninguem: created_by e' imutavel para o
--    cliente, porque a policy de INSERT exige created_by = auth.uid() e
--    a de UPDATE so' aceita admin da propria fazenda.
-- ---------------------------------------------------------------------
drop policy if exists farms_select on public.farms;
create policy farms_select on public.farms
  for select to authenticated
  using ( private.is_farm_member(id) or created_by = (select auth.uid()) );

-- Impede que um admin troque o created_by e "sequestre" a propriedade.
create or replace function public.freeze_farm_creator()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  new.created_by := old.created_by;
  return new;
end; $fn$;

drop trigger if exists farms_freeze_creator on public.farms;
create trigger farms_freeze_creator before update on public.farms
  for each row execute function public.freeze_farm_creator();
