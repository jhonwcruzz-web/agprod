-- =====================================================================
-- 0011_move_citext — tira a extensao citext do schema public.
--
-- "create extension citext" sem SCHEMA instala no schema corrente, e com
-- isso ~30 funcoes da extensao passam a viver em public, expostas na Data
-- API e executaveis por anon. E' o lint "extension_in_public" do Supabase.
--
-- As funcoes de citext sao operacoes puras de texto, sem risco de
-- escalonamento — mas schema public exposto nao e' lugar de extensao.
-- pgcrypto e uuid-ossp ja' vivem em "extensions"; citext vai junto.
--
-- Os tipos sao referenciados por OID, entao as colunas farms.email e
-- buyers.email continuam funcionando sem alteracao. Os papeis do Supabase
-- ja' trazem "extensions" no search_path.
-- =====================================================================

do $mig$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'citext' and n.nspname = 'public'
  ) then
    alter extension citext set schema extensions;
  end if;
end $mig$;
