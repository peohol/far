-- Diplotype → resultat fra CPIC (arbeidspakke F), docs/cpic.md.
--
-- Oppslaget etter et kjent resultat kan oversette en diplotype til resultatet
-- CPIC slår opp på. Oversettelsen er bare CPICs egen tabell: diplotype →
-- kombinasjon av allelfunksjoner eller aktivitetsverdier (genresultat_oppslag)
-- → resultat (genresultat). OUSFAR regner ingenting ut selv.
--
-- Nettleseren henter hele tabellen for ett gen om gangen, når brukeren ber om
-- det, og søker i den selv: diplotypen brukeren skriver, sendes ikke noe sted.
-- Bare gensymbolet går til databasen. Rådataene er ikke med.

create function public.les_cpic_diplotyper(gensymbol text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with resultater as (
    select r.cpic_id, r.data
    from cpic.genresultat r
    where r.utgatt_kl is null and r.gen = gensymbol
  ),
  oppslag as (
    select o.cpic_id, o.data
    from cpic.genresultat_oppslag o
    where o.utgatt_kl is null and o.genresultat_id in (select cpic_id from resultater)
  )
  select jsonb_build_object(
    'kilde', cpic.kilde(),
    'gen', (select g.data from cpic.gen g where g.utgatt_kl is null and g.cpic_id = gensymbol),
    'genresultater', coalesce((select jsonb_agg(r.data order by r.cpic_id) from resultater r), '[]'),
    -- Diplotypene står under kombinasjonen de hører til, så ID-en ikke
    -- gjentas for hver av dem (over 60 000 for RYR1).
    'oppslag', coalesce((
      select jsonb_agg(o.data || jsonb_build_object('diplotyper', coalesce((
        select jsonb_agg(d.diplotype order by d.diplotype collate "C")
        from cpic.diplotype d
        where d.utgatt_kl is null and d.oppslag_id = o.cpic_id), '[]')) order by o.cpic_id)
      from oppslag o), '[]'),
    'alleler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'navn', a.data ->> 'navn',
        'funksjon', a.data -> 'funksjon',
        'klinisk_funksjon', a.data -> 'klinisk_funksjon',
        'aktivitetsverdi', a.data -> 'aktivitetsverdi') order by a.cpic_id)
      from cpic.allel a
      where a.utgatt_kl is null and a.gen = gensymbol), '[]')
  )
$$;

comment on function public.les_cpic_diplotyper(text) is
  'CPICs oversettelse fra diplotype til resultat for ett gen: resultatene, kombinasjonene med diplotypene sine, og allelenes funksjon.';

revoke all on function public.les_cpic_diplotyper(text) from public, anon, authenticated, service_role;
grant execute on function public.les_cpic_diplotyper(text) to authenticated, service_role;
