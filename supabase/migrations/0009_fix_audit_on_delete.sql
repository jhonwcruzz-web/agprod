-- =====================================================================
-- 0009_fix_audit_on_delete — excluir uma propriedade falhava.
--
-- Ao apagar uma fazenda, o cascade apaga vendas, despesas, talhoes e
-- movimentos. Cada DELETE dispara o trigger de auditoria, que tentava
-- gravar um audit_log apontando para a fazenda — que ja' nao existe
-- mais. Resultado: violacao da FK audit_logs_farm_id_fkey e a exclusao
-- inteira era abortada.
--
-- Correcao: quando a fazenda referenciada ja' nao existe, o registro de
-- auditoria e' gravado com farm_id nulo. O id da fazenda continua dentro
-- do payload "changes", entao o rastro nao se perde.
-- =====================================================================

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  v_row  jsonb;
  v_farm uuid;
  v_rec  uuid;
begin
  v_row := to_jsonb(coalesce(new, old));
  v_rec := (v_row->>'id')::uuid;

  -- Em farms o proprio id e' o identificador da fazenda.
  v_farm := case
    when tg_table_name = 'farms' then v_rec
    else (v_row->>'farm_id')::uuid
  end;

  -- Durante a exclusao em cascata a fazenda ja' foi removida: manter a
  -- referencia violaria a FK e abortaria a operacao inteira.
  if tg_op = 'DELETE' and v_farm is not null
     and not exists (select 1 from public.farms f where f.id = v_farm) then
    v_farm := null;
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
