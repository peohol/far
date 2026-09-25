-- OKSY
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'OKSY' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serumkonsentrasjonsmålinger av vanedannende legemidler' and r.lenke = 'https://tidsskriftet.no/sites/default/files/pdf2016--400-2.pdf'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helland2016';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Oksykodon');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Oksykodon"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'OKSY',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);

  -- viktige_data/referanseomrade
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'referanseomrade' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":null,"ovre":200,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = 'null'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '200'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'OKSY', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'OKSY', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    end if;
  end if;

  -- tdm/kinetikkort «Prøvetakingstidspunkt»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetakingstidspunkt'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Medikamentfastende, det vil si like før neste dose. Prøver tatt nær toppkonsentrasjonen er misvisende og kan ikke sammenlignes med referansegrensen."}]},{"type":"paragraph","content":[{"type":"text","text":"Dosering, tidspunkt for siste inntak og tidspunkt for prøvetaking må '
    'stå på rekvisisjonen, så laboratoriet kan tolke svaret."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Referansegrense»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Referansegrense'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Referansegrense","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Øvre referansegrense 200 nmol/L er den øvre forventede medikamentfastende konsentrasjonen ved døgndose 60 mg. For sterke opioider er grensen beregnet ut fra en døgndose som tilsvarer 100 mg peroral morfin (morfinekvivalenter), siden de fleste som bruker opioider over tid, bruker la'
    'vere doser."}]},{"type":"paragraph","content":[{"type":"text","text":"Det er ikke satt noen nedre grense, siden konsentrasjonen bør holdes så lav som mulig. Laveste effektive dose bør tilstrebes."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Tolkning»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Tolkning'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Tolkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pasienter som holder seg innenfor anbefalt dosering, har i de aller fleste tilfeller medikamentfastende konsentrasjoner under referansegrensen. Konsentrasjoner over grensen kan tyde på høyere doser enn anbefalt, gitt at feil prøvetakingstidspunkt er utelukket."}]},{"type":"paragraph","con'
    'tent":[{"type":"text","text":"Variasjonen mellom pasienter er stor. Nedsatt organfunksjon og aldersrelaterte endringer kan gi høyere konsentrasjon, mens interaksjoner og genetiske forskjeller i metabolismen kan gi både høyere og lavere konsentrasjon enn ventet."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved tvil om tolkningen, eller om hvordan prøven skal tas, bør det utførende labo'
    'ratoriet kontaktes, gjerne før prøven tas."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Indikasjoner for måling»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Indikasjoner for måling'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Indikasjoner for måling","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serumkonsentrasjonsmåling kan være nyttig ved:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontroll av medikamentetterlevelse, som er den vanligste grunnen"}]}]},{"type":"listItem","content":[{"type'
    '":"paragraph","content":[{"type":"text","text":"Terapisvikt ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Uventede eller uttalte bivirkninger ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ruspåvirkning, mistanke om overdosering eller intoksikasjon"}]}]},{"type":"listI'
    'tem","content":[{"type":"paragraph","content":[{"type":"text","text":"Misbruksdiagnostikk (urinprøver er oftest bedre egnet)"}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- OLAN
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'OLAN' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fortolkningskommentarer til serumkonsentrasjoner av antipsykotika' and r.lenke = ''
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'ousfortolkning';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Olanzapin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 24, 41, og fortolkningskommentarene i FAR', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Olanzapin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 24, 41, og fortolkningskommentarene i FAR', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'OLAN',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 24, 41, og fortolkningskommentarene i FAR', true);

  -- viktige_data/referanseomrade
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'referanseomrade' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":30,"ovre":200,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '30'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '200'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'OLAN', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'OLAN', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 24, 41, og fortolkningskommentarene i FAR', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 24, 41, og fortolkningskommentarene i FAR', true);
    end if;
  end if;

  -- tdm/kinetikkort «Prøvetakingstidspunkt»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetakingstidspunkt'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rett før neste dose, det vil si 12–24 timer etter siste dose."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Prøvetaking ved depotinjeksjon»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetaking ved depotinjeksjon'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetaking ved depotinjeksjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"0–2 dager før neste injeksjon."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_1)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Grunnlag for referanseområdet»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Grunnlag for referanseområdet'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Referanseområdet bygger på serumkonsentrasjoner målt hos pasienter som brukte 5–30 mg peroralt daglig: 10- og 90-persentilen, rundet av, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007)."}]},{"type":"paragraph","content":[{"type":"text","text":"Områd'
    'et viser hvilke konsentrasjoner som er vanlige ved anbefalte doser, og er ikke et dokumentert terapeutisk område."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- OTRAM
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'OTRAM' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serumkonsentrasjonsmålinger av vanedannende legemidler' and r.lenke = 'https://tidsskriftet.no/sites/default/files/pdf2016--400-2.pdf'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helland2016';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('O-desmetyltramadol');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"O-desmetyltramadol"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'OTRAM',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);

  -- viktige_data/referanseomrade
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'referanseomrade' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":null,"ovre":400,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = 'null'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '400'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'OTRAM', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'OTRAM', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    end if;
  end if;

  -- tdm/kinetikkort «Prøvetakingstidspunkt»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetakingstidspunkt'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Medikamentfastende, det vil si like før neste dose. Prøver tatt nær toppkonsentrasjonen er misvisende og kan ikke sammenlignes med referansegrensen."}]},{"type":"paragraph","content":[{"type":"text","text":"Dosering, tidspunkt for siste inntak og tidspunkt for prøvetaking må '
    'stå på rekvisisjonen, så laboratoriet kan tolke svaret."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Referansegrense»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Referansegrense'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Referansegrense","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Øvre referansegrense 400 nmol/L er den øvre forventede medikamentfastende konsentrasjonen ved døgndose 400 mg tramadol, høyeste døgndose i godkjent preparatomtale."}]},{"type":"paragraph","content":[{"type":"text","text":"O-desmetyltramadol er en aktiv metabolitt av tramadol, og st'
    'år sannsynligvis for det meste av opioideffekten."}]},{"type":"paragraph","content":[{"type":"text","text":"Det er ikke satt noen nedre grense, siden konsentrasjonen bør holdes så lav som mulig. Laveste effektive dose bør tilstrebes."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Tolkning»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Tolkning'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Tolkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pasienter som holder seg innenfor anbefalt dosering, har i de aller fleste tilfeller medikamentfastende konsentrasjoner under referansegrensen. Konsentrasjoner over grensen kan tyde på høyere doser enn anbefalt, gitt at feil prøvetakingstidspunkt er utelukket."}]},{"type":"paragraph","con'
    'tent":[{"type":"text","text":"Variasjonen mellom pasienter er stor. Nedsatt organfunksjon og aldersrelaterte endringer kan gi høyere konsentrasjon, mens interaksjoner og genetiske forskjeller i metabolismen kan gi både høyere og lavere konsentrasjon enn ventet."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved tvil om tolkningen, eller om hvordan prøven skal tas, bør det utførende labo'
    'ratoriet kontaktes, gjerne før prøven tas."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Indikasjoner for måling»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Indikasjoner for måling'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Indikasjoner for måling","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serumkonsentrasjonsmåling kan være nyttig ved:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontroll av medikamentetterlevelse, som er den vanligste grunnen"}]}]},{"type":"listItem","content":[{"type'
    '":"paragraph","content":[{"type":"text","text":"Terapisvikt ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Uventede eller uttalte bivirkninger ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ruspåvirkning, mistanke om overdosering eller intoksikasjon"}]}]},{"type":"listI'
    'tem","content":[{"type":"paragraph","content":[{"type":"text","text":"Misbruksdiagnostikk (urinprøver er oftest bedre egnet)"}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- OXA
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'OXA' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serumkonsentrasjonsmålinger av vanedannende legemidler' and r.lenke = 'https://tidsskriftet.no/sites/default/files/pdf2016--400-2.pdf'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helland2016';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Oksazepam');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Oksazepam"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'OXA',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);

  -- viktige_data/referanseomrade
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'referanseomrade' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":null,"ovre":2500,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = 'null'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '2500'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'OXA', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'OXA', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    end if;
  end if;

  -- tdm/kinetikkort «Prøvetakingstidspunkt»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetakingstidspunkt'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Medikamentfastende, det vil si like før neste dose. Prøver tatt nær toppkonsentrasjonen er misvisende og kan ikke sammenlignes med referansegrensen."}]},{"type":"paragraph","content":[{"type":"text","text":"Dosering, tidspunkt for siste inntak og tidspunkt for prøvetaking må '
    'stå på rekvisisjonen, så laboratoriet kan tolke svaret."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Referansegrense»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Referansegrense'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Referansegrense","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Øvre referansegrense 2 500 nmol/L er den øvre forventede medikamentfastende konsentrasjonen ved døgndose 45 mg, høyeste døgndose ved angst, uro og/eller søvnvansker."}]},{"type":"paragraph","content":[{"type":"text","text":"Det er ikke satt noen nedre grense, siden konsentrasjonen '
    'bør holdes så lav som mulig. Lavest mulig dosering og kortvarig eller periodevis bruk bør tilstrebes."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Tolkning»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Tolkning'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Tolkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pasienter som holder seg innenfor anbefalt dosering, har i de aller fleste tilfeller medikamentfastende konsentrasjoner under referansegrensen. Konsentrasjoner over grensen kan tyde på høyere doser enn anbefalt, gitt at feil prøvetakingstidspunkt er utelukket."}]},{"type":"paragraph","con'
    'tent":[{"type":"text","text":"Variasjonen mellom pasienter er stor. Nedsatt organfunksjon og aldersrelaterte endringer kan gi høyere konsentrasjon, mens interaksjoner og genetiske forskjeller i metabolismen kan gi både høyere og lavere konsentrasjon enn ventet."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved tvil om tolkningen, eller om hvordan prøven skal tas, bør det utførende labo'
    'ratoriet kontaktes, gjerne før prøven tas."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Indikasjoner for måling»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Indikasjoner for måling'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Indikasjoner for måling","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serumkonsentrasjonsmåling kan være nyttig ved:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontroll av medikamentetterlevelse, som er den vanligste grunnen"}]}]},{"type":"listItem","content":[{"type'
    '":"paragraph","content":[{"type":"text","text":"Terapisvikt ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Uventede eller uttalte bivirkninger ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ruspåvirkning, mistanke om overdosering eller intoksikasjon"}]}]},{"type":"listI'
    'tem","content":[{"type":"paragraph","content":[{"type":"text","text":"Misbruksdiagnostikk (urinprøver er oftest bedre egnet)"}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- PALI
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'PALI' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fortolkningskommentarer til serumkonsentrasjoner av antipsykotika' and r.lenke = ''
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'ousfortolkning';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Paliperidon (hydroksyrisperidon)');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra fortolkningskommentarene i FAR', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Paliperidon (hydroksyrisperidon)"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra fortolkningskommentarene i FAR', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'PALI',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra fortolkningskommentarene i FAR', true);

  -- tdm/kinetikkort «Prøvetakingstidspunkt»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Prøvetakingstidspunkt'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"0–2 dager før neste depotinjeksjon, når likevektskonsentrasjonen er nådd. Referanseområdet bygger på prøver tatt slik."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;