-- Alle analyttsidene i én tilstand, i ett kall: grunnlaget for søket i hele
-- kunnskapsbasen.
--
-- Det globale søket (docs/ux-reimagination.md, del 6) indekserer alle sidene
-- med den samme TypeScript-koden som søket på én side (src/faginnhold/sok.ts).
-- Rangeringen skjer der og ikke her; funksjonen gir bare sidene, på samme form
-- som les_analyttside, så appen bygger den samme sidemodellen av dem.
--
-- Referansene går igjen på mange sider. De står derfor én gang, i
-- `referanser`, og hver side har bare ID-ene til dem den siterer.
--
-- Funksjonen kjører med rettighetene til den som leser (security invoker), som
-- les_analyttside: en vanlig bruker får bare det publiserte, og ber hen om
-- utkastet, får hen ingenting. Ingenting her skriver.

create function public.les_analyttsider(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with utgaver as (
    select u.objekt_id, public.utgave_som_json(u) as json
    from public.objektutgaver u
    where u.tilstand = sidetilstand
  ),
  analytter as (
    select a.objekt_id, a.kode, a.hovedside_id
    from public.laboratorieanalytter a
    where a.tilstand = sidetilstand
  ),
  elementer as (
    select a.objekt_id as analytt_id, e.objekt_id
    from analytter a
    join public.innholdselementer e on e.infoside_id = a.hovedside_id and e.tilstand = sidetilstand
  ),
  -- Referansene siden siterer: fra panelene (på hovedsiden), kortene og teksten.
  siteringer as (
    select a.objekt_id as analytt_id, k.referanse_id
    from analytter a
    join public.referansekoblinger k on k.objekt_id = a.hovedside_id and k.tilstand = sidetilstand
    union
    select e.analytt_id, k.referanse_id
    from elementer e
    join public.referansekoblinger k on k.objekt_id = e.objekt_id and k.tilstand = sidetilstand
  ),
  elementer_per_side as (
    select e.analytt_id, jsonb_agg(u.json order by u.objekt_id) as elementer
    from elementer e
    join utgaver u on u.objekt_id = e.objekt_id
    group by e.analytt_id
  ),
  komponenter_per_side as (
    select
      k.analytt_id,
      jsonb_agg(
        u.json || jsonb_build_object(
          'koder', coalesce(
            (select jsonb_agg(b.kode order by b.kode) from analytter b where b.hovedside_id = k.infoside_id),
            '[]'::jsonb
          )
        )
        order by k.posisjon
      ) as komponenter
    from public.analyttkomponenter k
    join utgaver u on u.objekt_id = k.infoside_id
    where k.tilstand = sidetilstand
    group by k.analytt_id
  ),
  referanser_per_side as (
    select s.analytt_id, jsonb_agg(s.referanse_id order by s.referanse_id) as referanser
    from siteringer s
    group by s.analytt_id
  )
  select jsonb_build_object(
    'sider', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'analytt', ua.json,
            'infoside', ui.json,
            'elementer', coalesce(e.elementer, '[]'::jsonb),
            'komponenter', coalesce(k.komponenter, '[]'::jsonb),
            'referanser', coalesce(r.referanser, '[]'::jsonb)
          )
          order by a.kode
        )
        from analytter a
        left join utgaver ua on ua.objekt_id = a.objekt_id
        left join utgaver ui on ui.objekt_id = a.hovedside_id
        left join elementer_per_side e on e.analytt_id = a.objekt_id
        left join komponenter_per_side k on k.analytt_id = a.objekt_id
        left join referanser_per_side r on r.analytt_id = a.objekt_id
      ),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(u.json order by u.objekt_id)
        from utgaver u
        where u.objekt_id in (select referanse_id from siteringer)
      ),
      '[]'::jsonb
    )
  )
$$;

comment on function public.les_analyttsider(public.objekttilstand) is
  'Alle analyttsidene i én tilstand, på samme form som les_analyttside, med referansene én gang. Radsikkerheten gjelder.';

revoke all on function public.les_analyttsider(public.objekttilstand)
  from public, anon, authenticated, service_role;

grant execute on function public.les_analyttsider(public.objekttilstand) to authenticated;