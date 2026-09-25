-- Stoffsidene: farmakogenetikk og interaksjoner får egne paneler, og kildene i serumkonsentrasjonene gjelder hele panelet
--
-- Peders ønske (2026-09-25):
--
-- * Kortet «CYP-enzymer (substrat)» flyttes fra farmakokinetikken til den nye
--   seksjonen Farmakogenetikk (`farmakogenetikk`), som samme slags kort med
--   samme tittel, tekst og kilder.
-- * Kortet «Interaksjoner» i farmakokinetikken blir teksten øverst i seksjonen
--   Interaksjoner (`interaksjoner`), over oppføringene fra FEST: en riktekst
--   med samme tekst og kilder.
-- * Kildene til tabellen over serumkonsentrasjoner (Jönsson et al., Reis et
--   al., referanseområdeprosjektet …) står i dag på tabellen. De flyttes til
--   panelet, i samme rekkefølge, så de gjelder hele seksjonen. Appen viser
--   ikke lenger kilden som tekst over hver tabell.
--
-- Hver endring er en ny revisjon, publisert straks, så det som sto før, står i
-- historikken. Sjekksummen er tatt over kortene, tabellene og sidene slik de
-- sto i produksjonen da migrasjonen ble laget; er noe endret siden, stopper
-- migrasjonen uten å endre noe. Uten administratoren (som i en tom database)
-- gjøres ingenting.
do $monograf_seksjoner$
declare
  administrator uuid;
  forventet constant text := '6a77b9a50270edd37fc33a0ac4d0ec54/4daca8e52ee17d70ce5c109e53d4a807';
  sjekksum text;
  rad record;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så flyttingen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  -- Elementene som flyttes, og sidene tabellene står på, som utkastet står nå.
  create temporary table elementer on commit drop as
  select e.objekt_id, u.revisjon, i.navn, e.infoside_id, e.panel, e.elementtype, e.data, r.innhold, (u.revisjon = p.revisjon) as publisert
  from public.innholdselementer e
  join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
  join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
  join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
  where e.tilstand = 'utkast' and (
    (e.panel = 'farmakokinetikk' and e.elementtype = 'kinetikkort' and e.data ->> 'tittel' in ('CYP-enzymer (substrat)', 'Interaksjoner'))
    or (e.panel = 'serumkonsentrasjoner' and e.elementtype = 'dosetabell'));

  create temporary table sider on commit drop as
  select s.objekt_id, s.navn, u.revisjon, (u.revisjon = p.revisjon) as publisert, r.innhold
  from public.infosider s
  join public.objekttilstander u on u.objekt_id = s.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = s.objekt_id and p.tilstand = 'publisert'
  join public.objektrevisjoner r on r.objekt_id = s.objekt_id and r.revisjon = u.revisjon
  where s.tilstand = 'utkast'
    and s.objekt_id in (select infoside_id from elementer where panel = 'serumkonsentrasjoner');

  select
    (select md5(string_agg(
       k.navn || '|' || k.panel || '|' || k.elementtype || '|' || k.data::text || '|' || coalesce((
         -- Kildene med innholdet sitt, ikke ID-en, som er ulik fra database til database.
         select string_agg(r.forfattere || ' ' || r.aar || ' ' || r.tittel, '; ' order by x.nr)
         from jsonb_array_elements_text(k.innhold -> 'referanser') with ordinality as x(id, nr)
         join public.referanser r on r.objekt_id = x.id::uuid and r.tilstand = 'utkast'), ''),
       E'\n' order by k.navn collate "C", k.panel collate "C", k.data ->> 'tittel' collate "C"))
     from elementer k)
    || '/' ||
    (select md5(string_agg(s.navn || '|' || s.innhold::text, E'\n' order by s.navn collate "C")) from sider s)
  into sjekksum;
  if sjekksum is distinct from forventet then
    raise notice 'Kortene eller sidene er endret siden flyttingen ble laget (sjekksum %), så den hoppes over.', sjekksum;
    return;
  end if;
  if exists (select 1 from elementer where not publisert) or exists (select 1 from sider where not publisert) then
    raise exception 'Et av kortene eller sidene har et upublisert utkast; flyttingen ville publisert det.';
  end if;

  -- Kildene til tabellen blir panelets kilder, før de tas bort fra tabellen.
  perform set_config('far.revisjonskilde', 'Flyttet: kildene til tabellen over serumkonsentrasjoner gjelder nå hele panelet', true);
  for rad in
    select s.objekt_id, s.revisjon, s.innhold, e.innhold -> 'referanser' as referanser
    from sider s join elementer e on e.infoside_id = s.objekt_id and e.panel = 'serumkonsentrasjoner'
    where jsonb_array_length(coalesce(e.innhold -> 'referanser', '[]')) > 0
    order by s.navn
  loop
    perform public.lagre_utkast(rad.objekt_id, rad.revisjon, jsonb_set(
      rad.innhold || jsonb_build_object('panelreferanser', coalesce(rad.innhold -> 'panelreferanser', '{}')),
      '{panelreferanser,serumkonsentrasjoner}', rad.referanser));
    perform public.publiser_utkast(rad.objekt_id, rad.revisjon + 1);
  end loop;

  for rad in select * from elementer order by navn, panel, data ->> 'tittel' loop
    if rad.panel = 'serumkonsentrasjoner' then
      if jsonb_array_length(coalesce(rad.innhold -> 'referanser', '[]')) = 0 then
        continue;
      end if;
      perform set_config('far.revisjonskilde', 'Flyttet: kildene står nå på hele panelet', true);
      perform public.lagre_utkast(rad.objekt_id, rad.revisjon, rad.innhold - 'referanser');
    elsif rad.data ->> 'tittel' = 'CYP-enzymer (substrat)' then
      perform set_config('far.revisjonskilde', 'Flyttet: fra farmakokinetikken til farmakogenetikken', true);
      perform public.lagre_utkast(rad.objekt_id, rad.revisjon,
        rad.innhold || jsonb_build_object('panel', 'farmakogenetikk', 'posisjon', 0));
    else
      perform set_config('far.revisjonskilde', 'Flyttet: fra kortet i farmakokinetikken til teksten øverst i interaksjonene', true);
      perform public.lagre_utkast(rad.objekt_id, rad.revisjon,
        rad.innhold || jsonb_build_object(
          'panel', 'interaksjoner', 'posisjon', 0, 'elementtype', 'riktekst',
          'data', jsonb_build_object('dokument', rad.data -> 'dokument')));
    end if;
    perform public.publiser_utkast(rad.objekt_id, rad.revisjon + 1);
  end loop;
end
$monograf_seksjoner$;