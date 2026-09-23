-- DOKSUM
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  side_1 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  referanse_2 uuid;
  referanse_3 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'DOKSUM') then
    raise notice 'DOKSUM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sinequan «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sinequan-orifarm-633925'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sinequan-orifarm';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trisykliske antidepressiva (TCA) – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/trisykliske-antidepressiva-tca-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-tca';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Doksepin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 12–13', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Doksepin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;
  select s.objekt_id into side_1 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Desmetyldoksepin');
  if side_1 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 12–13', true);
    side_1 := (public.opprett_utkast('infoside', '{"navn":"Desmetyldoksepin"}'::jsonb)).id;
    nye := nye || side_1;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 12–13', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'DOKSUM',
    'hovedside', side_0,
    'komponenter', jsonb_build_array(side_0, side_1)
  ))).id;
  nye := nye || objekt;

  -- identitet/preparater
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'identitet',
    'posisjon', 0,
    'elementtype', 'preparater',
    'data', '{"navn":["Sinequan"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 12–13', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":180,"ovre":550,"enhet":"nmol/L","forbehold":"Doksepin + desmetyldoksepin."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1800,"ovre":null,"enhet":"nmol/L","forbehold":"Doksepin + desmetyldoksepin."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":3600,"ovre":null,"enhet":"nmol/L","forbehold":"Doksepin + desmetyldoksepin. Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":1,"ovre":1,"enhet":"uke","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dårlig kjent. Hemmer trolig reopptak av noradrenalin."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: desmetyldoksepin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"30–300 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Felleskatalogen har ingen indikasjonstekst for Sinequan. Preparatet er parallellimportert, og referansepreparatet er avregistrert."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 12–13', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"30 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Doksepin: 3,5 (2–4) timer"}]},{"type":"paragraph","content":[{"type":"text","text":"Desmetyldoksepin: 3–10 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Doksepin: 17 (8–24) timer"}]},{"type":"paragraph","content":[{"type":"text","text":"Desmetyldoksepin: 50 (33–80) timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 1 uke"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"75 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"20 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Ca. 50 % utskilles i urin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2C19 og 2D6"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Veldig sparsomt med informasjon i SPC! Obs 2D6-hemmere."}]},{"type":"paragraph","content":[{"type":"text","text":"Redusert startdose bør vurderes hos langsomme omsettere via 2D6 (økt konsentrasjon av både moderstoff og metabolitt)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- DULO
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
  referanse_4 uuid;
  referanse_5 uuid;
  referanse_6 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'DULO') then
    raise notice 'DULO har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cymbalta «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cymbalta-orifarm-669762'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cymbalta-orifarm';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetin Pensa «Pensa Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetin-pensa-pensa-pharma-600087'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-duloxetin-pensa';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetine Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetine-medical-valley-medical-valley-736548'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-duloxetine-medical-valley';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetine Viatris «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetine-viatris-viatris-603041'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-duloxetine-viatris';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Duloksetin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 14', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Duloksetin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 14', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'DULO',
    'hovedside', side_0,
    'komponenter', jsonb_build_array(side_0)
  ))).id;
  nye := nye || objekt;

  -- identitet/preparater
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'identitet',
    'posisjon', 0,
    'elementtype', 'preparater',
    'data', '{"navn":["Cymbalta","Duloxetin Pensa","Duloxetine Medical Valley","Duloxetine Viatris"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 14', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":30,"ovre":300,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":800,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":6,"ovre":17,"enhet":"timer","forbehold":"Typisk 12 timer."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":2,"ovre":3,"enhet":"døgn","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hemmer reopptak av serotonin og noradrenalin (SNRI). Svak hemmer av reopptak av dopamin. Ikke signifikant affinitet for histaminerge, dopaminerge, kolinerge eller adrenerge reseptorer. Smertehemmende effekt antas å skyldes potensering av nedadgående smertehemmende baner i CNS."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"30–120 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne: behandling av depressive lidelser, smerter ved perifer diabetisk nevropati og generalisert angstlidelse."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 14', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"50 % (32–80 %)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"6 (2–10) timer; forlenges noe av matinntak"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"12 (6–17) timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 2–3 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"> 90 % (albumin og alfa1-surt-glykoprotein)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"7 ± 1,3 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles primært i urin som konjugerte metabolitter."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1A2 og 2D6"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Moderat hemmer av CYP2D6."}]},{"type":"paragraph","content":[{"type":"text","text":"Kontraindisert sammen med 1A2-hemmere, f.eks. ciprofloksacin og fluvoksamin. Ca. 50 % lavere konsentrasjon hos røykere pga. induksjon av 1A2."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"60–120 mg","regime":"","konsentrasjon":"10.–90. persentil: 33–287 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_6)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- ESCIT
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
  referanse_4 uuid;
  referanse_5 uuid;
  referanse_6 uuid;
  referanse_7 uuid;
  referanse_8 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'ESCIT') then
    raise notice 'ESCIT har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-lundbeck-547489'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipralex-lundbeck';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-2care4-629344'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipralex-2care4';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Abacus Medicine»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-abacus-medicine-787300'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipralex-abacus-medicine';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-orifarm-574078'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipralex-orifarm';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Escitalopram Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/escitalopram-actavis-actavis-571498'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-escitalopram-actavis';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Escitalopram Grindeks «Grindeks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/escitalopram-grindeks-grindeks-757090'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-escitalopram-grindeks';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_7 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database' and r.lenke = 'https://doi.org/10.1097/ftd.0b013e31819114ea'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'reis2009';
  end if;
  referanse_8 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_8 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Escitalopram');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 15', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Escitalopram"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 15', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'ESCIT',
    'hovedside', side_0,
    'komponenter', jsonb_build_array(side_0)
  ))).id;
  nye := nye || objekt;

  -- identitet/preparater
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'identitet',
    'posisjon', 0,
    'elementtype', 'preparater',
    'data', '{"navn":["Cipralex","Escitalopram Actavis","Escitalopram Grindeks"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 15', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":25,"ovre":140,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":16,"ovre":28,"enhet":"timer","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":4.5,"ovre":4.5,"enhet":"døgn","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kraftig og selektiv hemmer av gjenopptak av serotonin (SSRI). Ingen effekt på reopptak av noradrenalin, dopamin eller GABA. Ingen effekt på muskarine, histaminerge eller adrenerge reseptorer."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"10–20 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Behandling av depressive episoder, panikklidelse med eller uten agorafobi, sosial fobi (sosial angst), generalisert angstlidelse og tvangslidelse (OCD)."}]},{"type":"paragraph","content":[{"type":"text","text":"Anbefales ikke til pasienter under 18 år."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 15', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 80 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4–5 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"16–28 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 4,5 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"80 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"12,3 ± 2,3 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2C19, (2D6, 3A4)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hemmer CYP2D6."}]},{"type":"paragraph","content":[{"type":"text","text":"50% økning i konsentrasjon ved bruk av omeprazol. Dosejustering kan være nødvendig ved bruk av 2C19-hemmere eller cimetidin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans 0,3–1 (AGNP)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_6)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"5 mg","regime":"","konsentrasjon":"Median 26 nmol/L (10.–90. persentil: 11–75)","merknad":"Escitalopram. 146 prøver. Reis et al. (2009)"},{"dose":"10 mg","regime":"","konsentrasjon":"Median 35 nmol/L (10.–90. persentil: 15–85)","merknad":"Escitalopram. 1 470 prøver. Reis et al. (2009)"},{"dose":"15 mg","regime":"","konsentrasjon":"Median 47 nmol/L (10.–90. persentil: 22–111)","m'
    'erknad":"Escitalopram. 372 prøver. Reis et al. (2009)"},{"dose":"20 mg","regime":"","konsentrasjon":"Median 63 nmol/L (10.–90. persentil: 27–143)","merknad":"Escitalopram. 883 prøver. Reis et al. (2009)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 73 nmol/L (10.–90. persentil: 31–132)","merknad":"Escitalopram. 37 prøver. Reis et al. (2009)"},{"dose":"30 mg","regime":"","konsentrasjon":"Me'
    'dian 74 nmol/L (10.–90. persentil: 34–181)","merknad":"Escitalopram. 107 prøver. Reis et al. (2009)"},{"dose":"40 mg","regime":"","konsentrasjon":"Median 101 nmol/L (10.–90. persentil: 28–229)","merknad":"Escitalopram. 30 prøver. Reis et al. (2009)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 44 nmol/L (10.–90. persentil: 18–115)","merknad":"Escitalopram. 3 066 prøver. Reis et al. (2009)"}'
    ',{"dose":"20–60 mg","regime":"","konsentrasjon":"10.–90. persentil: 19–109 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_7, referanse_8)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;