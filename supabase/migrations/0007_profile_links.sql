-- =====================================================================
-- 0007_profile_links — permite embeds de perfil via PostgREST.
--
-- farm_users.user_id ja' referencia auth.users, mas o PostgREST so' enxerga
-- relacoes dentro dos schemas expostos. Sem uma FK apontando para
-- public.profiles, ".select('*, profiles(...)')" falha.
--
-- A FK adicional e' consistente: profiles.id e' o mesmo id de auth.users,
-- e o profile e' criado pelo trigger on_auth_user_created.
-- =====================================================================

-- Garante que todo usuario existente tenha profile antes de criar a FK.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

do $mig$ begin
  alter table public.farm_users
    add constraint farm_users_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $mig$;
