-- Referansene
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- fk-xyrem
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Xyrem «UCB»' and r.lenke = 'https://www.felleskatalogen.no/medisin/xyrem-ucb-565556'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Xyrem «UCB»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/xyrem-ucb-565556"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oxiore
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Oxiore «Oresund Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxiore-oresund-pharma-784015'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Oxiore «Oresund Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oxiore-oresund-pharma-784015"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-natriumoksybat-kalceks
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Natriumoksybat Kalceks «Kalceks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/natriumoksybat-kalceks-kalceks-669766'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Natriumoksybat Kalceks «Kalceks»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/natriumoksybat-kalceks-kalceks-669766"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-ketalar
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketalar «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketalar-pfizer-560507'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ketalar «Pfizer»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ketalar-pfizer-560507"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-ketamin-abcur
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketamin Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketamin-abcur-abcur-631315'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ketamin Abcur «Abcur»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ketamin-abcur-abcur-631315"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-ketanest
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketanest «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketanest-pfizer-585463'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ketanest «Pfizer»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ketanest-pfizer-585463"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-spravato
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Spravato «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/spravato-janssen-670393'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Spravato «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/spravato-janssen-670393"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- GHB
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  referanse_2 uuid;
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
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('GHB');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Xyrem «UCB»' and r.lenke = 'https://www.felleskatalogen.no/medisin/xyrem-ucb-565556'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-xyrem';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Oxiore «Oresund Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxiore-oresund-pharma-784015'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-oxiore';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Natriumoksybat Kalceks «Kalceks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/natriumoksybat-kalceks-kalceks-669766'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-natriumoksybat-kalceks';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('GHB');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"GHB"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"GHB (gammahydroksybutyrat) er det samme stoffet som natriumoksybat, natriumsaltet av GHB, som er godkjent som legemiddel."}]},{"type":"paragraph","content":[{"type":"text","text":"Natriumoksybat: behandling av narkolepsi med katapleksi."}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type'
    '":"paragraph","content":[{"type":"text","text":"Xyrem og Oxiore: voksne, ungdom og barn ≥7 år."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Natriumoksybat Kalceks: voksne."}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
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

-- Ketamin
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  referanse_2 uuid;
  referanse_3 uuid;
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
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Ketamin');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketalar «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketalar-pfizer-560507'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-ketalar';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketamin Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketamin-abcur-abcur-631315'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-ketamin-abcur';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ketanest «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ketanest-pfizer-585463'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-ketanest';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Spravato «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/spravato-janssen-670393'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-spravato';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Ketamin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Ketamin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Racemisk ketamin (Ketalar, Ketamin Abcur), barn og voksne: anestetikum ved diagnostiske og kirurgiske inngrep, til innledning og vedlikehold av generell anestesi, alene eller sammen med andre anestetika, og før induksjon eller som supplement ved regional anestesi."}]},{"type":"paragraph","content":[{"type":"'
    'text","text":"Esketamin som injeksjon (Ketanest): innledning og vedlikehold av generell anestesi, alene eller sammen med et annet anestetikum; anestesi og smertelindring under akuttmedisinsk behandling; supplement til regional eller lokal anestesi."}]},{"type":"paragraph","content":[{"type":"text","text":"Esketamin som nesespray (Spravato), voksne med moderat til alvorlig klinisk depresjon:"}]},{"'
    'type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"i kombinasjon med et SSRI eller SNRI ved behandlingsresistent depresjon som ikke har respondert på minst 2 forskjellige behandlinger med antidepressiver i den pågående episoden;"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"i kombinasjon med '
    'oral antidepressiv behandling, som akutt korttidsbehandling for rask reduksjon av depressive symptomer som etter klinisk vurdering utgjør en psykiatrisk nødsituasjon."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Nye metoder, slik Felleskatalogen gjengir det: racemisk ketamin er innført med vilkår ved behandlingsresistent depresjon (ID2022_018) og til pasienter med akutt suicidfare'
    ' (ID2025_034). Esketamin nesespray er ikke innført ved behandlingsresistent depresjon (ID2023_013)."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3)
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