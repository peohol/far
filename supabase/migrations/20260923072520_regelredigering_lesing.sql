-- Lesingen redigeringen av reglene på analyttsidene trenger. Bakgrunnen står
-- i docs/fortolkningsregler.md og docs/faginnhold.md.
--
-- Begge funksjonene kjører med rettighetene til den som kaller, så
-- radsikkerheten gjelder som ellers: innloggede ser det publiserte og
-- revisjonene som har vært publisert, administratorer alt.

-- --- Regelsettet for én analyttkode ----------------------------------------

-- Regelsettet for analyttkoden i én tilstand, i samme form som
-- les_intervallregelsett gir hvert av dem, eller null når koden ikke har noe.
create function public.finn_intervallregelsett(analyttkode text, sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.utgave_som_json(u)
  from public.intervallregelsett s
  join public.objektutgaver u on u.objekt_id = s.objekt_id and u.tilstand = s.tilstand
  where s.analyttkode = finn_intervallregelsett.analyttkode and s.tilstand = sidetilstand
$$;

comment on function public.finn_intervallregelsett(text, public.objekttilstand) is
  'Regelsettet for én analyttkode i én tilstand, eller null. Radsikkerheten gjelder.';

revoke all on function public.finn_intervallregelsett(text, public.objekttilstand)
  from public, anon, authenticated, service_role;

grant execute on function public.finn_intervallregelsett(text, public.objekttilstand) to authenticated;

-- --- Historikken til ett objekt --------------------------------------------

-- Hendelsene (opprettet, endret, gjenopprettet, publisert) med hvem og når,
-- og øyeblikksbildet i hver revisjon, lest i ett kall. Historikkvisningen i
-- appen bygger tidslinjen, sammenligningen og gjenopprettingen på dette.
create function public.les_historikk(objekt uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'hendelser',
    coalesce(
      (
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'handling', h.handling,
            'revisjon', h.revisjon,
            'gjenopprettet_fra', h.gjenopprettet_fra,
            'forrige_revisjon', h.forrige_revisjon,
            'utfort_av_fornavn', h.utfort_av_fornavn,
            'utfort_av_etternavn', h.utfort_av_etternavn,
            'utfort_kl', h.utfort_kl,
            'kilde', h.kilde
          ))
          order by h.utfort_kl, h.revisjon, h.handling = 'publisert'
        )
        from public.objekthistorikk h
        where h.objekt_id = les_historikk.objekt
      ),
      '[]'::jsonb
    ),
    'revisjoner',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('revisjon', r.revisjon, 'innhold', r.innhold) order by r.revisjon)
        from public.objektrevisjoner r
        where r.objekt_id = les_historikk.objekt
      ),
      '[]'::jsonb
    )
  )
$$;

comment on function public.les_historikk(uuid) is
  'Hendelsene og øyeblikksbildene i historikken til ett objekt. Radsikkerheten gjelder.';

revoke all on function public.les_historikk(uuid) from public, anon, authenticated, service_role;

grant execute on function public.les_historikk(uuid) to authenticated;