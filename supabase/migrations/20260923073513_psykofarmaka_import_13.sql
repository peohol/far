-- RISPSUM
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
  referanse_9 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'RISPSUM') then
    raise notice 'RISPSUM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Okedi «ROVI»' and r.lenke = 'https://www.felleskatalogen.no/medisin/okedi-rovi-757488'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-okedi';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperdal «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperdal-janssen-563543'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-risperdal';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperdal Consta «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperdal-consta-janssen-563537'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-risperdal-consta';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperidon Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperidon-sandoz-sandoz-563550'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-risperidon-sandoz';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperidone Grindeks «Grindeks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperidone-grindeks-grindeks-758708'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-risperidone-grindeks';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
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
       and r.tittel = 'Antipsykotika – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-antipsykotika';
  end if;
  referanse_8 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000585'
     order by r.objekt_id limit 1);
  if referanse_8 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'jonsson2019';
  end if;
  referanse_9 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_9 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Risperidon');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 58', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Risperidon"}'::jsonb)).id;
    nye := nye || side_0;
  end if;
  select s.objekt_id into side_1 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Hydroksyrisperidon');
  if side_1 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 58', true);
    side_1 := (public.opprett_utkast('infoside', '{"navn":"Hydroksyrisperidon"}'::jsonb)).id;
    nye := nye || side_1;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 58', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'RISPSUM',
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
    'data', '{"navn":["Okedi","Risperdal","Risperdal Consta","Risperidon Sandoz","Risperidone Grindeks"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 58', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":20,"ovre":120,"enhet":"nmol/L","forbehold":"Risperidon + paliperidon."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":280,"ovre":null,"enhet":"nmol/L","forbehold":"Risperidon + paliperidon."}'::jsonb,
    'referanser', jsonb_build_array(referanse_5, referanse_6, referanse_7)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":4,"ovre":5,"enhet":"dager","forbehold":"Peroralt."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Potent D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonist."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: paliperidon (9-hydroksyrisperidon)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tablett: 0,5–8 mg"}]},{"type":"paragraph","content":[{"type":"text","text":"Depotinjeksjon: 25–50 mg hver 2. uke (Risperdal Consta)"}]},{"type":"paragraph","content":[{"type":"text","text":"Depotinjeksjon: 75 og 100 mg hver 28. dag (Okedi)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schizofreni."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Moderate til alvorlige maniske episoder i forbindelse med bipolare lidelser."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":['
    '{"type":"text","text":"Korttidsbehandling (opptil 6 uker) av vedvarende aggresjon hos pasienter med moderat til alvorlig Alzheimers demens som ikke responderer på ikke-farmakologisk behandling, og når det er risiko for selvskading eller skade av andre."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Barn fra 5 år og ungdom: symptomatisk korttidsbehandling '
    '(opptil 6 uker) av vedvarende aggresjon ved utagerende atferd (conduct disorder) hos pasienter med under middels intellektuell funksjon eller mental retardasjon, når alvoret av atferden krever farmakologisk behandling."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Punktene over gjelder de perorale preparatene (Risperdal, Risperidon Sandoz, Risperidone Grindeks)."}]},{"type":"paragr'
    'aph","content":[{"type":"text","text":"Risperdal Consta (depotinjeksjon): vedlikeholdsbehandling av schizofreni hos pasienter stabilisert på orale antipsykotika."}]},{"type":"paragraph","content":[{"type":"text","text":"Okedi (depotinjeksjon, voksne): behandling av schizofreni der tolerabilitet og effekt er fastslått med oralt risperidon."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_0, referanse_3, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 58', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"66 ± 28 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1.5 timer (p.o.)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Risperidon: 3 timer"}]},{"type":"paragraph","content":[{"type":"text","text":"Paliperidon: 24 timer."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4–5 dager (p.o)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"90 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1,1 ± 0,2 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin (70 %) og feces (14 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2D6, (3A4)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Både risperidon og paliperidon er substrater for P-gp."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved samtidig bruk av sterke hemmere eller induktorer av 3A4 og/eller P-gp bør doseringen av risperidon revurderes."}]},{"type":"paragraph","content":[{"type":"text","text"'
    ':"Dosering av risperidon bør revurderes ved bruk av sterke 2D6-hemmere."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 9,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans 3,6–22,7 (p.o.), 1,2–4,3 (i.m.) (AGNP)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_6)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"0,5 mg","regime":"","konsentrasjon":"Median 20 nmol/L (10.–90. persentil: 10–47)","merknad":"Risperidon + paliperidon. 95 prøver. Jönsson et al. (2019)"},{"dose":"1 mg","regime":"","konsentrasjon":"Median 33 nmol/L (10.–90. persentil: 16–81)","merknad":"Risperidon + paliperidon. 332 prøver. Jönsson et al. (2019)"},{"dose":"2 mg","regime":"","konsentrasjon":"Median 50 nmol/L (10.'
    '–90. persentil: 25–107)","merknad":"Risperidon + paliperidon. 660 prøver. Jönsson et al. (2019)"},{"dose":"4 mg","regime":"","konsentrasjon":"Median 81 nmol/L (10.–90. persentil: 42–155)","merknad":"Risperidon + paliperidon. 886 prøver. Jönsson et al. (2019)"},{"dose":"6 mg","regime":"","konsentrasjon":"Median 121 nmol/L (10.–90. persentil: 52–227)","merknad":"Risperidon + paliperidon. 409 prøver.'
    ' Jönsson et al. (2019)"},{"dose":"8 mg","regime":"","konsentrasjon":"Median 157 nmol/L (10.–90. persentil: 76–280)","merknad":"Risperidon + paliperidon. 125 prøver. Jönsson et al. (2019)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 70 nmol/L (10.–90. persentil: 26–166)","merknad":"Risperidon + paliperidon. 3 255 prøver. Jönsson et al. (2019)"},{"dose":"0,5 mg","regime":"","konsentrasjon":"'
    'Median 12 nmol/L (10.–90. persentil: 4–36)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 95 prøver. Jönsson et al. (2019)"},{"dose":"1 mg","regime":"","konsentrasjon":"Median 21 nmol/L (10.–90. persentil: 8–54)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 332 prøver. Jönsson et al. (2019)"},{"dose":"2 mg","regime":"","konsentrasjon":"Median 33 n'
    'mol/L (10.–90. persentil: 12–73)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 660 prøver. Jönsson et al. (2019)"},{"dose":"4 mg","regime":"","konsentrasjon":"Median 56 nmol/L (10.–90. persentil: 22–103)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 886 prøver. Jönsson et al. (2019)"},{"dose":"6 mg","regime":"","konsentrasjon":"Median 77 nmol/L ('
    '10.–90. persentil: 29–150)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 409 prøver. Jönsson et al. (2019)"},{"dose":"8 mg","regime":"","konsentrasjon":"Median 92 nmol/L (10.–90. persentil: 42–183)","merknad":"Paliperidon (9-hydroksyrisperidon, i prøver med risperidon) 125 prøver. Jönsson et al. (2019)"},{"dose":"1–8 mg (p.o.)","regime":"","konsentrasjon":"10.–90. persent'
    'il: 24–120 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_8, referanse_9)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- SERT
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
  referanse_9 uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'SERT') then
    raise notice 'SERT har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin Bluefish «Bluefish»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-bluefish-bluefish-568495'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sertralin-bluefish';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-hexal-hexal-596732'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sertralin-hexal';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin Zentiva «Zentiva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-zentiva-zentiva-760489'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sertralin-zentiva';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertraline Accord «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertraline-accord-accord-655239'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sertraline-accord';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Zoloft «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zoloft-2care4-639548'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-zoloft';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'schulz2020';
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
       and r.tittel = 'Sertralin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/sertralin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-sertralin';
  end if;
  referanse_8 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database' and r.lenke = 'https://doi.org/10.1097/ftd.0b013e31819114ea'
     order by r.objekt_id limit 1);
  if referanse_8 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'reis2009';
  end if;
  referanse_9 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_9 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Sertralin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 24', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Sertralin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 24', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'SERT',
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
    'data', '{"navn":["Sertralin Bluefish","Sertralin HEXAL","Sertralin Zentiva","Sertraline Accord","Zoloft"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3, referanse_4)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 24', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":20,"ovre":250,"enhet":"nmol/L","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1000,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_5, referanse_6, referanse_7)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":3600,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_5, referanse_6, referanse_7)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":22,"ovre":36,"enhet":"timer","forbehold":"Typisk 26 timer."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":5,"ovre":7,"enhet":"dager","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Potent hemmer av reopptak av serotonin (SSRI). Svak effekt på reopptak av noradrenalin og dopamin. Har ingen affinitet til muskarin-, serotonin-, dopamin-, adrenerge-, histamin- eller GABA-reseptorer. Øker ikke katekolaminerg aktivitet."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"25–200 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Depressive episoder"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Forebygging av tilbakefall av nye depressive episoder"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","'
    'text":"Panikklidelse, med eller uten agorafobi"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Tvangslidelse (OCD) hos voksne samt hos barn og ungdom i alderen 6-17 år"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sosial angstlidelse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text'
    '","text":"Posttraumatisk stresslidelse (PTSD)"}]}]}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_4)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 24', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":">44 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4–8 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"26 (22–36) timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5–7 dager"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"98 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":">20 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin og feces."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4, 2C19, (2B6)"}]},{"type":"paragraph","content":[{"type":"text","text":"Ca. 50 % høyere konsentrasjon hos langsomme omsettere via 2C19."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Mild til moderat hemmer av CYP2D6."}]},{"type":"paragraph","content":[{"type":"text","text":"Milde-moderate hemmere av 3A4 gir økt eksponering. 2C19-hemmere kan gi økt eksponering."}]},{"type":"paragraph","content":[{"type":"text","text":"Er substrat for P-gp."}]},{"type":"paragraph"'
    ',"content":[{"type":"text","text":"Kan gi økt eksponering for fenytoin (motstridende funn)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"25 mg","regime":"","konsentrasjon":"Median 23 nmol/L (10.–90. persentil: 9–54)","merknad":"Sertralin. 50 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 40 nmol/L (10.–90. persentil: 13–99)","merknad":"Sertralin. 984 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 69 nmol/L (10.–90. persentil: 25–146)","merknad":"'
    'Sertralin. 136 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 73 nmol/L (10.–90. persentil: 26–166)","merknad":"Sertralin. 1 071 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentrasjon":"Median 112 nmol/L (10.–90. persentil: 48–212)","merknad":"Sertralin. 28 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 112 nmo'
    'l/L (10.–90. persentil: 39–244)","merknad":"Sertralin. 403 prøver. Reis et al. (2009)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 125 nmol/L (10.–90. persentil: 47–261)","merknad":"Sertralin. 281 prøver. Reis et al. (2009)"},{"dose":"300 mg","regime":"","konsentrasjon":"Median 238 nmol/L (10.–90. persentil: 96–406)","merknad":"Sertralin. 11 prøver. Reis et al. (2009)"},{"dose":"Alle","r'
    'egime":"","konsentrasjon":"Median 67 nmol/L (10.–90. persentil: 19–182)","merknad":"Sertralin. 2 998 prøver. Reis et al. (2009)"},{"dose":"50–200 mg","regime":"","konsentrasjon":"10.–90. persentil: 26–291 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_8, referanse_9)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;