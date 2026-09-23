-- AMIS
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
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'AMIS') then
    raise notice 'AMIS har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Solian «sanofi-aventis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/solian-sanofi-aventis-564002'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-solian';
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
       and r.tittel = 'Antipsykotika – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-antipsykotika';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000585'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'jonsson2019';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Amisulprid');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 39', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Amisulprid"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 39', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'AMIS',
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
    'data', '{"navn":["Solian"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 39', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":100,"ovre":1500,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1700,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":25100,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":12,"ovre":20,"enhet":"timer","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":2,"ovre":4,"enhet":"døgn","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Høy affinitet til D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"- og D"},{"type":"text","text":"3","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer (antagonist). Ingen affinitet til D"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":'
    '"text","text":"-, D"},{"type":"text","text":"4","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text","text":"5","marks":[{"type":"subscript"}]},{"type":"text","text":"-, 5-HT-, α-, eller H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer, eller kolinerge reseptorer."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"50–800 (1200) mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Akutt og kronisk schizofreni."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 39', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"50 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1 time og 3–4 timer (to topper)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"12–20 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2–4 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"16 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5,8 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Uforandret i urin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"—"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"—"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"50 mg","regime":"","konsentrasjon":"Median 64 nmol/L (10.–90. persentil: 23–361)","merknad":"Amisulprid. 12 prøver. Jönsson et al. (2019)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 159 nmol/L (10.–90. persentil: 24–649)","merknad":"Amisulprid. 23 prøver. Jönsson et al. (2019)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 281 nmol/L (10.–90. persentil: 96–874'
    ')","merknad":"Amisulprid. 75 prøver. Jönsson et al. (2019)"},{"dose":"400 mg","regime":"","konsentrasjon":"Median 443 nmol/L (10.–90. persentil: 206–1 124)","merknad":"Amisulprid. 123 prøver. Jönsson et al. (2019)"},{"dose":"600 mg","regime":"","konsentrasjon":"Median 705 nmol/L (10.–90. persentil: 378–1 755)","merknad":"Amisulprid. 64 prøver. Jönsson et al. (2019)"},{"dose":"800 mg","regime":"","'
    'konsentrasjon":"Median 764 nmol/L (10.–90. persentil: 382–1 828)","merknad":"Amisulprid. 89 prøver. Jönsson et al. (2019)"},{"dose":"1000 mg","regime":"","konsentrasjon":"Median 1 417 nmol/L (10.–90. persentil: 569–3 311)","merknad":"Amisulprid. 15 prøver. Jönsson et al. (2019)"},{"dose":"1200 mg","regime":"","konsentrasjon":"Median 1 570 nmol/L (10.–90. persentil: 660–6 343)","merknad":"Amisulpri'
    'd. 15 prøver. Jönsson et al. (2019)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 529 nmol/L (10.–90. persentil: 134–1 576)","merknad":"Amisulprid. 506 prøver. Jönsson et al. (2019)"},{"dose":"50–1200 mg","regime":"","konsentrasjon":"10.–90. persentil: 128–1 326 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- AMTNORSUM
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
  referanse_8 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'AMTNORSUM') then
    raise notice 'AMTNORSUM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptylin Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/amitriptylin-abcur-abcur-640710'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-amitriptylin-abcur';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptylin Orifarm «Orifarm Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/amitriptylin-orifarm-orifarm-generics-655234'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-amitriptylin-orifarm';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sarotex «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sarotex-lundbeck-563752'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sarotex';
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
       and r.tittel = 'Trisykliske antidepressiva (TCA) – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/trisykliske-antidepressiva-tca-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-tca';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptyline – guideline annotation' and r.lenke = 'https://www.pharmgkb.org/chemical/PA448385/guidelineAnnotation/PA166105006'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'pharmgkb-amitriptylin';
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
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Amitriptylin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Amitriptylin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;
  select s.objekt_id into side_1 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Nortriptylin');
  if side_1 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
    side_1 := (public.opprett_utkast('infoside', '{"navn":"Nortriptylin"}'::jsonb)).id;
    nye := nye || side_1;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'AMTNORSUM',
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
    'data', '{"navn":["Amitriptylin Abcur","Amitriptylin Orifarm","Sarotex"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":400,"ovre":900,"enhet":"nmol/L","forbehold":"Amitriptylin + nortriptylin."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1800,"ovre":null,"enhet":"nmol/L","forbehold":"Amitriptylin + nortriptylin."}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_4, referanse_5)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":16,"ovre":40,"enhet":"timer","forbehold":"Typisk 25 timer."}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hemmer reopptak av noradrenalin og serotonin. Også virkning på natrium-, kalium- og NMDA-kanaler. Antagonist på muskarin- og histamin H1-reseptorer."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: nortriptylin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"25–150 mg for depressiv lidelse, ofte lavere for smertestillende bruk"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne: depressiv lidelse, nevropatisk smerte, og forebygging av kronisk spenningshodepine og migrene."}]},{"type":"paragraph","content":[{"type":"text","text":"Barn ≥6 år: nattlig enurese når organisk årsak er utelukket og all annen behandling er forsøkt uten effekt. Skal bare forskrives av helsepersonell m'
    'ed ekspertise på vedvarende enurese."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_2, referanse_0, referanse_1)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"53 % (30–60 %)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2–12 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"25 (16–40) timer"}]}]}}'::jsonb
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"95 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 16 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles primært som konjugerte metabolitter."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2C19, 2D6, (3A4, 1A2, 2C9)"}]},{"type":"paragraph","content":[{"type":"text","text":"Langsomme omsettere via 2D6 eller 2C19 anbefales 50 % reduksjon av startdose."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_6)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Mange interaksjoner! Obs alle enzymhemmere."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans: 0,2–1,8 (AGNP)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_4)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"25 mg","regime":"","konsentrasjon":"Median 118 nmol/L (10.–90. persentil: 51–402)","merknad":"Amitriptylin + nortriptylin. 26 prøver. Reis et al. (2009)"},{"dose":"30 mg","regime":"","konsentrasjon":"Median 113 nmol/L (10.–90. persentil: 46–245)","merknad":"Amitriptylin + nortriptylin. 22 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 260 nmol/L'
    ' (10.–90. persentil: 123–908)","merknad":"Amitriptylin + nortriptylin. 64 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 317 nmol/L (10.–90. persentil: 117–832)","merknad":"Amitriptylin + nortriptylin. 55 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 412 nmol/L (10.–90. persentil: 180–782)","merknad":"Amitriptylin + nortriptylin'
    '. 83 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentrasjon":"Median 503 nmol/L (10.–90. persentil: 301–1 024)","merknad":"Amitriptylin + nortriptylin. 17 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 594 nmol/L (10.–90. persentil: 174–1 203)","merknad":"Amitriptylin + nortriptylin. 62 prøver. Reis et al. (2009)"},{"dose":"200 mg","regime":"","'
    'konsentrasjon":"Median 919 nmol/L (10.–90. persentil: 526–1 101)","merknad":"Amitriptylin + nortriptylin. 11 prøver. Reis et al. (2009)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 77 nmol/L (10.–90. persentil: 27–159)","merknad":"Amitriptylin. 26 prøver. Reis et al. (2009)"},{"dose":"30 mg","regime":"","konsentrasjon":"Median 63 nmol/L (10.–90. persentil: 30–185)","merknad":"Amitriptylin'
    '. 22 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 148 nmol/L (10.–90. persentil: 50–502)","merknad":"Amitriptylin. 64 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 150 nmol/L (10.–90. persentil: 66–398)","merknad":"Amitriptylin. 55 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 214 nmol/L (10.'
    '–90. persentil: 92–401)","merknad":"Amitriptylin. 83 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentrasjon":"Median 187 nmol/L (10.–90. persentil: 125–532)","merknad":"Amitriptylin. 17 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 300 nmol/L (10.–90. persentil: 88–856)","merknad":"Amitriptylin. 62 prøver. Reis et al. (2009)"},{"dose":"200 mg",'
    '"regime":"","konsentrasjon":"Median 478 nmol/L (10.–90. persentil: 219–762)","merknad":"Amitriptylin. 11 prøver. Reis et al. (2009)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 168 nmol/L (10.–90. persentil: 44–514)","merknad":"Amitriptylin. 394 prøver. Reis et al. (2009)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 44 nmol/L (10.–90. persentil: 18–127)","merknad":"Nortriptylin (i'
    ' prøver med amitriptylin) 26 prøver. Reis et al. (2009)"},{"dose":"30 mg","regime":"","konsentrasjon":"Median 37 nmol/L (10.–90. persentil: 14–107)","merknad":"Nortriptylin (i prøver med amitriptylin) 22 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 104 nmol/L (10.–90. persentil: 33–396)","merknad":"Nortriptylin (i prøver med amitriptylin) 64 prøver. Reis et al. '
    '(2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 154 nmol/L (10.–90. persentil: 47–394)","merknad":"Nortriptylin (i prøver med amitriptylin) 55 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 181 nmol/L (10.–90. persentil: 68–429)","merknad":"Nortriptylin (i prøver med amitriptylin) 83 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentr'
    'asjon":"Median 219 nmol/L (10.–90. persentil: 159–433)","merknad":"Nortriptylin (i prøver med amitriptylin) 17 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 264 nmol/L (10.–90. persentil: 82–569)","merknad":"Nortriptylin (i prøver med amitriptylin) 62 prøver. Reis et al. (2009)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 330 nmol/L (10.–90. persentil:'
    ' 188–441)","merknad":"Nortriptylin (i prøver med amitriptylin) 11 prøver. Reis et al. (2009)"},{"dose":"25–200 mg","regime":"","konsentrasjon":"10.–90. persentil: 90–1 150 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
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