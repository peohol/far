-- ARISUM
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
  referanse_4 uuid;
  referanse_5 uuid;
  referanse_6 uuid;
  referanse_7 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'ARISUM') then
    raise notice 'ARISUM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Abilify «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/abilify-otsuka-pharmaceutical-545656'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-abilify';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Abilify Maintena «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/abilify-maintena-otsuka-pharmaceutical-586071'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-abilify-maintena';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Aripiprazol – substansregister' and r.lenke = 'https://www.felleskatalogen.no/medisin/substansregister/aripiprazol'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-substansregister-aripiprazol';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Antipsykotika – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-antipsykotika';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000585'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'jonsson2019';
  end if;
  referanse_7 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Aripiprazol');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 40', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Aripiprazol"}'::jsonb)).id;
    nye := nye || side_0;
  end if;
  select s.objekt_id into side_1 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Dehydroaripiprazol');
  if side_1 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 40', true);
    side_1 := (public.opprett_utkast('infoside', '{"navn":"Dehydroaripiprazol"}'::jsonb)).id;
    nye := nye || side_1;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 40', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'ARISUM',
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
    'data', '{"navn":["Abilify","Abilify Maintena","Aripiprazole Accord"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 40', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":200,"ovre":1300,"enhet":"nmol/L","forbehold":"Aripiprazol + dehydroaripiprazol."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":2200,"ovre":null,"enhet":"nmol/L","forbehold":"Aripiprazol + dehydroaripiprazol."}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":4200,"ovre":null,"enhet":"nmol/L","forbehold":"Aripiprazol + dehydroaripiprazol. Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":75,"ovre":75,"enhet":"timer","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":2,"ovre":2,"enhet":"uker","forbehold":"Omtrentlig. Peroralt; ved depotinjeksjon etter 4 injeksjoner."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Partiell agonist på D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"- og 5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Antagonist på 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","t'
    'ext":"-reseptorer."}]},{"type":"paragraph","content":[{"type":"text","text":"Binder med høy affinitet til D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptoren. Bytte fra potent D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonist til aripiprazol kan paradoksalt gi redusert D"},{"type":"text","text":"2","marks":'
    '[{"type":"subscript"}]},{"type":"text","text":"-blokkade og økt symptomtrykk når dosen av aripiprazol økes."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: dehydroaripiprazol."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tablett: 5–30 mg"}]},{"type":"paragraph","content":[{"type":"text","text":"Depotinjeksjon: 400 mg, se "},{"type":"text","text":"Abilify Maintena","marks":[{"type":"link","attrs":{"href":"https://www.felleskatalogen.no/medisin/abilify-maintena-otsuka-pharmaceutical-586071"}}]},{"type":"text","text":" for dose'
    'ring"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Abilify tabletter, smeltetabletter og mikstur:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne og ungdom ≥15 år: schizofreni."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne: modera'
    't til alvorlig manisk episode ved bipolar I lidelse, og forebygging av tilbakefall."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ungdom ≥13 år: opptil 12 ukers behandling av moderat til alvorlig manisk episode ved bipolar I lidelse."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Abilify injeksjonsvæske: voksne, hurtig kontroll av agitasjo'
    'n og atferdsforstyrrelser hos pasienter med schizofreni eller maniske episoder ved bipolar I lidelse, når oral behandling ikke er egnet."}]},{"type":"paragraph","content":[{"type":"text","text":"Abilify Maintena (depotinjeksjon): vedlikeholdsbehandling av schizofreni hos voksne stabilisert med aripiprazol (400 mg: stabilisert med oral aripiprazol)."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 40', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"87 % p.o."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3 ± 0.6 timer (p.o.)"}]},{"type":"paragraph","content":[{"type":"text","text":"7 dager (depot)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 75 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 2 uker (p.o), eller 4 depotinjeksjoner"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":">99 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4,9 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin (27 %) og feces (60 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4, 2D6"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved bruk av potente 2D6- eller 3A4-hemmere bør dosen halveres."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved bruk av potente 3A4-indusere bør dosen dobles."}]},{"type":"paragraph","content":[{"type":"text","text":"Kan bidra til serotonergt syndrom."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans: 0,3–0,5 (AGNP)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_4)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"5 mg","regime":"","konsentrasjon":"Median 166 nmol/L (10.–90. persentil: 73–365)","merknad":"Aripiprazol. 128 prøver. Jönsson et al. (2019)"},{"dose":"10 mg","regime":"","konsentrasjon":"Median 285 nmol/L (10.–90. persentil: 134–613)","merknad":"Aripiprazol. 418 prøver. Jönsson et al. (2019)"},{"dose":"15 mg","regime":"","konsentrasjon":"Median 415 nmol/L (10.–90. persentil: 206'
    '–764)","merknad":"Aripiprazol. 568 prøver. Jönsson et al. (2019)"},{"dose":"20 mg","regime":"","konsentrasjon":"Median 527 nmol/L (10.–90. persentil: 247–973)","merknad":"Aripiprazol. 207 prøver. Jönsson et al. (2019)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 685 nmol/L (10.–90. persentil: 406–1 235)","merknad":"Aripiprazol. 32 prøver. Jönsson et al. (2019)"},{"dose":"30 mg","regime":"'
    '","konsentrasjon":"Median 792 nmol/L (10.–90. persentil: 371–1 392)","merknad":"Aripiprazol. 215 prøver. Jönsson et al. (2019)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 401 nmol/L (10.–90. persentil: 151–915)","merknad":"Aripiprazol. 1 610 prøver. Jönsson et al. (2019)"},{"dose":"5 mg","regime":"","konsentrasjon":"Median 54 nmol/L (10.–90. persentil: 42–72)","merknad":"Dehydroaripiprazo'
    'l. 128 prøver. Jönsson et al. (2019)"},{"dose":"10 mg","regime":"","konsentrasjon":"Median 95 nmol/L (10.–90. persentil: 48–175)","merknad":"Dehydroaripiprazol. 418 prøver. Jönsson et al. (2019)"},{"dose":"15 mg","regime":"","konsentrasjon":"Median 136 nmol/L (10.–90. persentil: 68–231)","merknad":"Dehydroaripiprazol. 568 prøver. Jönsson et al. (2019)"},{"dose":"20 mg","regime":"","konsentrasjon":'
    '"Median 165 nmol/L (10.–90. persentil: 84–297)","merknad":"Dehydroaripiprazol. 207 prøver. Jönsson et al. (2019)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 191 nmol/L (10.–90. persentil: 91–306)","merknad":"Dehydroaripiprazol. 32 prøver. Jönsson et al. (2019)"},{"dose":"30 mg","regime":"","konsentrasjon":"Median 235 nmol/L (10.–90. persentil: 110–396)","merknad":"Dehydroaripiprazol. 215'
    ' prøver. Jönsson et al. (2019)"},{"dose":"10–30 mg","regime":"","konsentrasjon":"10.–90. persentil: 280–1 298 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_6, referanse_7)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- BREK
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'BREK') then
    raise notice 'BREK har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Rxulti «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/rxulti-otsuka-pharmaceutical-657929'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-rxulti';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Brekspiprazol');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 42', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Brekspiprazol"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 42', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'BREK',
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
    'data', '{"navn":["Rxulti"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 42', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":50,"ovre":350,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":91.4,"ovre":91.4,"enhet":"timer","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":19,"ovre":19,"enhet":"dager","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Partiell agonist på D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"- og 5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Antagonist på 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","t'
    'ext":"- og noradrenerge reseptorer."}]},{"type":"paragraph","content":[{"type":"text","text":"Binder med høy affinitet til D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptoren. Bytte fra potent D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonist til brekspiprazol kan paradoksalt gi redusert D"},{"type":"text",'
    '"text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-blokkade og økt symptomtrykk, på samme måte som for aripiprazol."}]},{"type":"paragraph","content":[{"type":"text","text":"Metabolitt: DM-3411, bidrar ikke til den terapeutiske effekten."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tablett: 1-4 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne og ungdom ≥13 år: schizofreni."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 42', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"95 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"91,4 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"19 dager"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":">99 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1,6 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin (25 %) og feces (46 %)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4, 2D6"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Halv dose når det administreres samtidig med potente CYP3A4-hemmere eller CYP2D6-hemmere"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"En fjerdedel av dosen ved kombinasjon med p'
    'otente CYP3A4 OG CYP2D6 hemmere"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Økt dosebehov ved kombinasjon med CYP3A4-induktorer (x3)"}]}]}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- CITAL
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
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'CITAL') then
    raise notice 'CITAL har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipramil «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipramil-lundbeck-547492'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipramil-lundbeck';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipramil «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipramil-2care4-686468'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-cipramil-2care4';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Citalopram Orion «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/citalopram-orion-orion-591942'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-citalopram-orion';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Citalopram – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/citalopram-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-citalopram';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database' and r.lenke = 'https://doi.org/10.1097/ftd.0b013e31819114ea'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'reis2009';
  end if;
  referanse_7 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Citalopram');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 10', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Citalopram"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 10', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'CITAL',
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
    'data', '{"navn":["Cipramil","Citalopram Orion"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 10', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":70,"ovre":350,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":700,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":10000,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":33,"ovre":33,"enhet":"timer","forbehold":"Oppgitt som 33 ± 4 timer."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":6,"ovre":8,"enhet":"døgn","forbehold":""}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"10–40 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Behandling av alvorlige depressive episoder, panikklidelser med eller uten agorafobi og tvangslidelse (OCD). Profylakse ved tilbakevendende depressive episoder."}]},{"type":"paragraph","content":[{"type":"text","text":"Bør ikke brukes hos pasienter under 18 år."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 10', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"80 ± 13 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3 (1–7) timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"33 ± 4 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"6–8 døgn"}]}]}}'::jsonb
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"15,4 ± 2,4 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin (ca. 15 %) og i feces (ca. 85 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2C19, 2D6, (3A4)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hemmer CYP2D6."}]},{"type":"paragraph","content":[{"type":"text","text":"Dosejustering kan være nødvendig ved bruk av 2C19-hemmere som f.eks. omeprazol, esomeprazol, flukonazol, fluvoksamin, lansoprazol, tiklopidin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"10 mg","regime":"","konsentrasjon":"Median 70 nmol/L (10.–90. persentil: 29–185)","merknad":"Citalopram. 202 prøver. Reis et al. (2009)"},{"dose":"20 mg","regime":"","konsentrasjon":"Median 119 nmol/L (10.–90. persentil: 57–253)","merknad":"Citalopram. 2 330 prøver. Reis et al. (2009)"},{"dose":"30 mg","regime":"","konsentrasjon":"Median 174 nmol/L (10.–90. persentil: 83–339)","'
    'merknad":"Citalopram. 573 prøver. Reis et al. (2009)"},{"dose":"40 mg","regime":"","konsentrasjon":"Median 216 nmol/L (10.–90. persentil: 107–414)","merknad":"Citalopram. 1 671 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 256 nmol/L (10.–90. persentil: 124–425)","merknad":"Citalopram. 117 prøver. Reis et al. (2009)"},{"dose":"60 mg","regime":"","konsentrasjon":"'
    'Median 297 nmol/L (10.–90. persentil: 153–534)","merknad":"Citalopram. 467 prøver. Reis et al. (2009)"},{"dose":"80 mg","regime":"","konsentrasjon":"Median 250 nmol/L (10.–90. persentil: 111–583)","merknad":"Citalopram. 41 prøver. Reis et al. (2009)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 165 nmol/L (10.–90. persentil: 65–372)","merknad":"Citalopram. 5 457 prøver. Reis et al. (2009)"}'
    ',{"dose":"20–60 mg","regime":"","konsentrasjon":"10.–90. persentil: 64–328 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_6, referanse_7)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;