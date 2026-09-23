-- KLOZ
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
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'KLOZ') then
    raise notice 'KLOZ har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Clozapin HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/clozapin-hexal-hexal-547590'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-clozapin-hexal';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Leponex «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/leponex-viatris-560891'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-leponex';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Antipsykotika – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-antipsykotika';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000585'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'jonsson2019';
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
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Klozapin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 47', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Klozapin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 47', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'KLOZ',
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
    'data', '{"navn":["Clozapin HEXAL","Leponex"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 47', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":300,"ovre":2500,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1800,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_2, referanse_3, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":3600,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_2, referanse_3, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":6,"ovre":26,"enhet":"timer","forbehold":"Typisk 12 timer."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":1,"ovre":5,"enhet":"døgn","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Antagonist på serotonerge (5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"), alfa-adrenerge, kolinerge, histaminerge og dopaminerge reseptorer. Lav affinitet til D"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text'
    '","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text","text":"3","marks":[{"type":"subscript"}]},{"type":"text","text":"- og D"},{"type":"text","text":"5","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer, men viser høy affinitet til D"},{"type":"text","text":"4","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tablett: (12,5) 100–900 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Behandlingsresistent schizofreni, og schizofrene pasienter som ved bruk av andre antipsykotika (inkl. et atypisk antipsykotikum) har fått alvorlige nevrologiske bivirkninger som ikke lar seg behandle."}]},{"type":"paragraph","content":[{"type":"text","text":"Psykotiske lidelser ved Parkinsons sykdom, når sta'
    'ndardbehandling har sviktet."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 47', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"55 ± 12 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–3 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"12 (6–26) timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–5 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":">95 %"}]},{"type":"paragraph","content":[{"type":"text","text":"Bindes i stor grad til alfa1-surt glykoprotein som er et akuttfaseprotein. Ved akutt inflammasjon øker serumkonsentrasjonen av klozapin pga. økning av proteinbundet fraksjon. Fri fraksjon vil være relativt sett lite end'
    'ret, og derfor forventes ikke vesentlig endret effekt. Doseendring i denne fasen bør som regel avventes. Det anbefales å unngå TDM av klozapin i akutt fase!"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5,4 ± 3,5 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Nesten fullstendig. Utskilles i urin (50 %) og feces (30 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1A2, 3A4, (2D6, 2C19)"}]},{"type":"paragraph","content":[{"type":"text","text":"Hemming av CYP-enzymer under inflammasjon bidrar trolig også til økning i serumkonsentrasjon."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kan gi økt fri fraksjon av legemidler med høy proteinbinding, f.eks. warfarin og digoksin."}]},{"type":"paragraph","content":[{"type":"text","text":"1A2-hemmere (f.eks fluvoksamin, perazin, koffein) kan gi behov for dosereduksjon. Seponering av hemmer kan gi behov for doseøkning. Ett'
    'er en 5 dagers koffeinfri periode kan serumkonsentrasjonen av klozapin synke 50 %. Induksjon av 1A2 (røyking, omeprazol) kan gi behov for doseøkning."}]},{"type":"paragraph","content":[{"type":"text","text":"Induksjon/hemming av 3A4 kan gi behov for doseendring."}]},{"type":"paragraph","content":[{"type":"text","text":"Oppstart/seponering av hormonell prevensjon (som hemmer 1A2, 3A4, 2C19) kan end'
    're dosebehovet."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans: 0,45–0,8 (AGNP, lavere hos røykere)"}]},{"type":"paragraph","content":[{"type":"text","text":"Vanlig bivirkning: alvorlig obstipasjon."}]},{"type":"paragraph","content":[{"type":"text","text":"Kontraindisert sammen med andre legemidler som påvirker beinmargsfu'
    'nsjonen."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_3)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"100 mg","regime":"","konsentrasjon":"Median 549 nmol/L (10.–90. persentil: 155–1 276)","merknad":"Klozapin. 51 prøver. Jönsson et al. (2019)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 833 nmol/L (10.–90. persentil: 368–1 644)","merknad":"Klozapin. 128 prøver. Jönsson et al. (2019)"},{"dose":"300 mg","regime":"","konsentrasjon":"Median 1 026 nmol/L (10.–90. persentil:'
    ' 380–2 060)","merknad":"Klozapin. 178 prøver. Jönsson et al. (2019)"},{"dose":"400 mg","regime":"","konsentrasjon":"Median 1 243 nmol/L (10.–90. persentil: 547–2 333)","merknad":"Klozapin. 158 prøver. Jönsson et al. (2019)"},{"dose":"500 mg","regime":"","konsentrasjon":"Median 1 373 nmol/L (10.–90. persentil: 599–2 547)","merknad":"Klozapin. 90 prøver. Jönsson et al. (2019)"},{"dose":"600 mg","reg'
    'ime":"","konsentrasjon":"Median 1 437 nmol/L (10.–90. persentil: 545–3 275)","merknad":"Klozapin. 87 prøver. Jönsson et al. (2019)"},{"dose":"700 mg","regime":"","konsentrasjon":"Median 1 391 nmol/L (10.–90. persentil: 1 000–3 108)","merknad":"Klozapin. 31 prøver. Jönsson et al. (2019)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 1 067 nmol/L (10.–90. persentil: 341–2 348)","merknad":"Kloz'
    'apin. 1 189 prøver. Jönsson et al. (2019)"},{"dose":"100–900 mg","regime":"","konsentrasjon":"10.–90. persentil: 405–2 270 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_5, referanse_6)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- KVE
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
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'KVE') then
    raise notice 'KVE har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Seroquel «AstraZeneca»' and r.lenke = 'https://www.felleskatalogen.no/medisin/seroquel-astrazeneca-563858'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-seroquel';
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
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Kvetiapin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 49', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Kvetiapin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 49', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'KVE',
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
    'data', '{"navn":["Seroquel"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 49', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":50,"ovre":700,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":3600,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":3600,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal fra ca. (2400) 3600 nmol/L. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":7,"ovre":7,"enhet":"timer","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":2,"ovre":2,"enhet":"døgn","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Antagonist til 5-HT"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"- og D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Høyere affinite'
    't til 5-HT"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":" enn D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":". Antagonist også på H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-, α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"- og α"},{"type":"text'
    '","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: norkvetiapin, som har affinitet til muskarinerge reseptorer, hemmer noradrenalintransportøren og er en partiell agonist av 5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptoren."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Immediate release: (25) 50–800 mg"}]},{"type":"paragraph","content":[{"type":"text","text":"Extended release: 50–800 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Seroquel (filmdrasjerte tabletter):"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schizofreni"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Moderate til alvorlige maniske episoder ved bipolar'
    ' lidelse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Depressive episoder ved bipolar lidelse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Forebygging av tilbakefall av maniske eller depressive episoder hos pasienter med bipolar lidelse som tidligere har respondert på behandling med kvetiapin"}]}]}]}]},"kontr'
    'ollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 49', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Extended release: samtidig inntak av fettrikt måltid øker C"},{"type":"text","text":"max","marks":[{"type":"subscript"}]},{"type":"text","text":" og AUC."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–1,8 timer (immediate release)"}]},{"type":"paragraph","content":[{"type":"text","text":"6 timer (extended release)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"7 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 2 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"83 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"10 ± 4 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Inaktive metabolitter. Utskilles i urin (73 %) og feces (21 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4 (2D6)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontraindisert ved samtidig bruk av 3A4-hemmere (f.eks hiv-proteasehemmere, antifungale midler av azoltypen, erytromycin, klaritromycin og nefazodon). Grapefruktjuice bør unngås."}]},{"type":"paragraph","content":[{"type":"text","text":"Enzyminducere kan gi vesentlig økt clearance av'
    ' kvetiapin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans: 0,54–3,1 (AGNP). Metabolitt maks 35 % av moderstoff ved steady state (SPC)."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"50 mg","regime":"","konsentrasjon":"Median 46 nmol/L (10.–90. persentil: 16–756)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 252 prøver. Jönsson et al. (2019)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 85 nmol/L (10.–90. persentil: 27–151)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 4'
    '74 prøver. Jönsson et al. (2019)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 140 nmol/L (10.–90. persentil: 36–272)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 633 prøver. Jönsson et al. (2019)"},{"dose":"300 mg","regime":"","konsentrasjon":"Median 205 nmol/L (10.–90. persentil: 59–499)","merknad":"Kvetiapin (inkluderer både immediate og extende'
    'd release. Obs ulik tmax.) 718 prøver. Jönsson et al. (2019)"},{"dose":"400 mg","regime":"","konsentrasjon":"Median 217 nmol/L (10.–90. persentil: 60–573)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 888 prøver. Jönsson et al. (2019)"},{"dose":"600 mg","regime":"","konsentrasjon":"Median 328 nmol/L (10.–90. persentil: 90–693)","merknad":"Kvetiapin (inkluder'
    'er både immediate og extended release. Obs ulik tmax.) 832 prøver. Jönsson et al. (2019)"},{"dose":"800 mg","regime":"","konsentrasjon":"Median 335 nmol/L (10.–90. persentil: 89–1 053)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 495 prøver. Jönsson et al. (2019)"},{"dose":"1000 mg","regime":"","konsentrasjon":"Median 430 nmol/L (10.–90. persentil: 157–952)'
    '","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 110 prøver. Jönsson et al. (2019)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 198 nmol/L (10.–90. persentil: 37–1 406)","merknad":"Kvetiapin (inkluderer både immediate og extended release. Obs ulik tmax.) 5 853 prøver. Jönsson et al. (2019)"},{"dose":"50–1000 mg","regime":"","konsentrasjon":"10.–90. per'
    'sentil: 57–639 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
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

-- LAM
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
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'LAM') then
    raise notice 'LAM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lamictal «GlaxoSmithKline»' and r.lenke = 'https://www.felleskatalogen.no/medisin/lamictal-glaxosmithkline-560748'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-lamictal';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Lamotrigin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 63', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Lamotrigin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 63', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'LAM',
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
    'data', '{"navn":["Lamictal"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 63', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":10,"ovre":50,"enhet":"µmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":33,"ovre":33,"enhet":"timer","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":7,"ovre":7,"enhet":"døgn","forbehold":"Omtrentlig."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bruks- og spenningsavhengig hemmer av spenningsstyrte natriumkanaler, hemmer frigjøring av glutamat."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"25-700 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Epilepsi:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne og ungdom >13 år: kombinasjonsbehandling eller monoterapi ved partielle og generaliserte anfall, inkl. tonisk-kloniske anfall, og anfall assosiert med Lennox-Gastaut syndro'
    'm."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Barn 2–12 år: kombinasjonsbehandling ved partielle og generaliserte anfall, inkl. tonisk-kloniske anfall og anfall assosiert med Lennox-Gastaut syndrom, og monoterapi ved typiske absensanfall."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Bipolar lidelse:"}]},{"type":"bulletList","content":'
    '[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne >18 år: forebygging av depressive episoder hos pasienter med bipolar I lidelse, som hovedsakelig opplever depressive episoder. Ikke anbefalt til barn og ungdom <18 år."}]}]}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 63', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"98 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2,5 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 33 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 7 døgn"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"50-66 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"0,92-1,22 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme via UDP-glukuronyltransferaser (UGT1A4). Utskilles hovedsakelig i urin (94%)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Valproat: hemmer glukuronidering av lamotrigin; halvdose anbefales"}]},{"type":"paragraph","content":[{"type":"text","text":"Induktører (karbamazepin, fenytoin, fenobarbital, primidon): dobbel dose anbefales"}]},{"type":"paragraph","content":[{"type":"text","text":"Hormonelle antikon'
    'septiva: økt clearance (ca. x2). OBS. preparater med \"pillefri\" uke"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;