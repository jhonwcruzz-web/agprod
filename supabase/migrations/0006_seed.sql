-- =====================================================================
-- 0006_seed — catalogo global de culturas, variedades e porta-enxertos.
-- Focado no Vale do Sao Francisco (uva e manga). Idempotente.
-- =====================================================================

insert into public.crops (slug, name, sort_order) values
  ('uva',   'Uva',   1),
  ('manga', 'Manga', 2),
  ('outra', 'Outra cultura', 99)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ---------- variedades de uva ------------------------------------------
insert into public.varieties (crop_id, farm_id, name)
select c.id, null, v.name
from public.crops c
cross join (values
  ('Vitória'), ('BRS Vitória'), ('BRS Isis'), ('BRS Núbia'), ('BRS Melodia'),
  ('Arra 15'), ('Arra 29'), ('Arra Sweeties'),
  ('Crimson Seedless'), ('Sugraone'), ('Thompson Seedless'), ('Autumn Royal'),
  ('Red Globe'), ('Sweet Globe'), ('Sweet Celebration'), ('Timco'), ('Timpson'),
  ('Itália'), ('Benitaka'), ('Brasil'), ('Rubi'), ('Niágara Rosada'),
  ('Festival'), ('Midnight Beauty'), ('Jack Salute')
) as v(name)
where c.slug = 'uva'
on conflict do nothing;

-- ---------- porta-enxertos de uva --------------------------------------
insert into public.rootstocks (crop_id, farm_id, name)
select c.id, null, r.name
from public.crops c
cross join (values
  ('IAC 572 (Jales)'), ('IAC 766 (Campinas)'), ('IAC 313 (Tropical)'),
  ('SO4'), ('Paulsen 1103'), ('Kober 5BB'), ('420-A'),
  ('Harmony'), ('Freedom'), ('Ramsey'), ('Salt Creek'), ('Pé franco')
) as r(name)
where c.slug = 'uva'
on conflict do nothing;

-- ---------- variedades de manga ----------------------------------------
insert into public.varieties (crop_id, farm_id, name)
select c.id, null, v.name
from public.crops c
cross join (values
  ('Tommy Atkins'), ('Palmer'), ('Keitt'), ('Kent'), ('Haden'),
  ('Espada'), ('Rosa'), ('Ubá'), ('Golden'), ('Maçã'),
  ('Coité'), ('Van Dyke'), ('Edward'), ('Omer'), ('Osteen')
) as v(name)
where c.slug = 'manga'
on conflict do nothing;

-- ---------- porta-enxertos de manga ------------------------------------
insert into public.rootstocks (crop_id, farm_id, name)
select c.id, null, r.name
from public.crops c
cross join (values
  ('Espada'), ('Coquinho'), ('Rosinha'), ('Imbu'), ('Manga d''água'), ('Pé franco')
) as r(name)
where c.slug = 'manga'
on conflict do nothing;
