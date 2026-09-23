-- Lesingen fortolkningen gjør: alle scenarioregelsettene i én tilstand, og
-- kommentarene de peker på, i ett kall og fra samme øyeblikk.
--
-- Hvert objekt kommer i samme form som de andre lesefunksjonene gir
-- (public.utgave_som_json). Radsikkerheten gjelder: innloggede får det
-- publiserte, administratorer også utkastene.
create function public.les_scenarioregler(regeltilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'regelsett', coalesce((
      select jsonb_agg(public.utgave_som_json(u) order by u.innhold ->> 'modul')
      from public.objektutgaver u
      join public.redigerbare_objekter o on o.id = u.objekt_id
      where o.type = 'scenarioregelsett' and u.tilstand = regeltilstand
    ), '[]'::jsonb),
    'kommentarer', coalesce((
      select jsonb_agg(public.utgave_som_json(u) order by u.objekt_id)
      from public.objektutgaver u
      where u.tilstand = regeltilstand
        and u.objekt_id in (
          select pl.kommentar_id from public.scenarioplasseringer pl where pl.tilstand = regeltilstand
        )
    ), '[]'::jsonb)
  )
$$;

comment on function public.les_scenarioregler(public.objekttilstand) is
  'Scenarioregelsettene i én tilstand, med kommentarene de peker på. Radsikkerheten gjelder.';

revoke all on function public.les_scenarioregler(public.objekttilstand)
from public, anon, authenticated, service_role;
grant execute on function public.les_scenarioregler(public.objekttilstand) to authenticated;