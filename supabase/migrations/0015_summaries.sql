-- =====================================================================
-- 0015_summaries — totais agregados no banco.
--
-- Custos e Financeiro somavam os valores a partir da lista exibida, que
-- tem limite (os 400 lancamentos mais recentes). Com mais lancamentos que
-- isso — a fazenda de demonstracao tem 1.370 despesas — os totais saiam
-- subcontados. Somar no banco nao tem limite e nao trafega linhas.
--
-- As tres views agrupam por safra; para o acumulado geral basta somar as
-- linhas de todas as safras (season_id nulo tambem entra).
-- =====================================================================

-- Despesas: base de Custos (por categoria, rateio) e Financeiro (a pagar).
create or replace view public.v_expense_summary
with (security_invoker = true) as
select
  e.farm_id,
  e.season_id,
  e.category,
  e.is_production_cost,
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

-- Receitas: base do Financeiro (receita, recebido, a receber).
create or replace view public.v_revenue_summary
with (security_invoker = true) as
select
  r.farm_id,
  r.season_id,
  r.source,
  count(*)                                    as entries,
  sum(r.amount)                               as amount,
  sum(r.received_amount)                      as received_amount,
  sum(r.amount - r.received_amount) filter (where r.status <> 'pago') as open_amount
from public.revenues r
group by r.farm_id, r.season_id, r.source;

-- Vendas por comprador e safra: base da Comercializacao.
create or replace view public.v_sales_summary
with (security_invoker = true) as
select
  s.farm_id,
  s.season_id,
  s.buyer_id,
  b.name                                      as buyer_name,
  count(*)                                    as sales_count,
  sum(s.quantity_kg)                          as total_kg,
  sum(s.total_amount)                         as total_amount,
  sum(s.received_amount)                      as received_amount
from public.sales s
left join public.buyers b on b.id = s.buyer_id
group by s.farm_id, s.season_id, s.buyer_id, b.name;

do $mig$
declare v text;
begin
  foreach v in array array['v_expense_summary','v_revenue_summary','v_sales_summary'] loop
    execute format('grant select on public.%I to authenticated;', v);
    execute format('revoke all on public.%I from anon;', v);
  end loop;
end $mig$;
