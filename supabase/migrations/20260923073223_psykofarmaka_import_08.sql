-- KLORP
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
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'KLORP') then
    raise notice 'KLORP har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Truxal «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/truxal-lundbeck-564882'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-truxal';
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
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  -- Sidene: en side med samme navn som alt finnes, brukes.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Klorprotiksen');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 46', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Klorprotiksen"}'::jsonb)).id;
    nye := nye || side_0;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 46', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'KLORP',
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
    'data', '{"navn":["Truxal"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 46', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":10,"ovre":100,"enhet":"nmol/L","forbehold":"Tidligere ref.omr. høydose: 100–800 nmol/L."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1200,"ovre":null,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":1200,"ovre":null,"enhet":"nmol/L","forbehold":"Komatøs/fatal. Omtrentlig grense."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/halveringstid
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"nedre":15,"ovre":15,"enhet":"timer","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/steady_state
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'steady_state',
    'data', '{"nedre":2,"ovre":3,"enhet":"døgn","forbehold":""}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakodynamikk/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Høy affinitet (antagonist) til D"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-, 5-HT"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"- og α"},{"typ'
    'e":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-adrenerge reseptorer samt kolinerge reseptorer. Også antihistamineffekt."}]},{"type":"paragraph","content":[{"type":"text","text":"Reseptorbindingsprofilen ligner den til klozapin, men klorprotiksen har 10 ganger høyere affinitet for dopaminreseptorer."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tablett: 15–20 mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Akutte og kroniske psykoser"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Søvnforstyrrelser ved psykiske lidelser"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":'
    '"Adjuvans ved psykiske lidelser preget av langvarig/vedvarende angstfølelse"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Adjuvans ved behandling av abstinenssymptomer ved alkohol- og annen rusmiddelavhengighet"}]}]}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 46', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"20 %"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2,5–3 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"15 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2–3 døgn"}]}]}}'::jsonb
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"10–25 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme til inaktive metabolitter. Utskilles i urin og feces."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Lite."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 8,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Interaksjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kan øke serumkonsentrasjon av TCA, AED, AHT, betablokkere, antikoagulantia."}]},{"type":"paragraph","content":[{"type":"text","text":"2D6-hemmere kan øke konsentrasjonen av klorprotiksen, f.eks paroksetin, fluoksetin, MAO-hemmere, kloramfenikol, disulfiram, isoniazid, p-piller, buspi'
    'ron"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"…?","regime":"","konsentrasjon":"10.–90. persentil: 5–103 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_4)
  ))).id;
  nye := nye || objekt;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- KLOSUM
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
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.laboratorieanalytter a where a.kode = 'KLOSUM') then
    raise notice 'KLOSUM har alt en side og hoppes over.';
    return;
  end if;

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Anafranil «Pharma&»' and r.lenke = 'https://www.felleskatalogen.no/medisin/anafranil-pharma-546059'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-anafranil';
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
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Annotation of CPIC Guideline for clomipramine and CYP2C19, CYP2D6' and r.lenke = 'https://www.pharmgkb.org/guidelineAnnotation/PA166105007'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'pharmgkb-klomipramin';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database' and r.lenke = 'https://doi.org/10.1097/ftd.0b013e31819114ea'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'reis2009';
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
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Klomipramin');
  if side_0 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
    side_0 := (public.opprett_utkast('infoside', '{"navn":"Klomipramin"}'::jsonb)).id;
    nye := nye || side_0;
  end if;
  select s.objekt_id into side_1 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Desmetylklomipramin');
  if side_1 is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
    side_1 := (public.opprett_utkast('infoside', '{"navn":"Desmetylklomipramin"}'::jsonb)).id;
    nye := nye || side_1;
  end if;

  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
    'kode', 'KLOSUM',
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
    'data', '{"navn":["Anafranil"],"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/referanseomrade
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'referanseomrade',
    'data', '{"nedre":700,"ovre":1500,"enhet":"nmol/L","forbehold":"Klomipramin + desmetylklomipramin."}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- viktige_data/toksisk_omrade
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":1600,"ovre":null,"enhet":"nmol/L","forbehold":"Klomipramin + desmetylklomipramin."}'::jsonb,
    'referanser', jsonb_build_array(referanse_1, referanse_2, referanse_3)
  ))).id;
  nye := nye || objekt;

  -- viktige_data/alvorlig_intoksikasjon
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'alvorlig_intoksikasjon',
    'data', '{"nedre":3200,"ovre":null,"enhet":"nmol/L","forbehold":"Klomipramin + desmetylklomipramin. Komatøs/fatal. Omtrentlig grense."}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hemmer reopptak av serotonin, men også noradrenalin. Har også alfa1-adrenerge, antikolinerge og antihistaminerge effekter."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: desmetylklomipramin."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- dosering/riktekst
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"10–200 (250) mg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Depresjoner, obsessive tilstander og panikksyndrom."}]},{"type":"paragraph","content":[{"type":"text","text":"Forsøksvis ved assosierte symptomer ved narkolepsi (katapleksi, hypnagoge hallusinasjoner og søvnparalyse)."}]}]},"kontrollert":"2026-09-23"}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
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
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2–6 timer"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Klomipramin: 21 (12–36) timer"}]},{"type":"paragraph","content":[{"type":"text","text":"Desmetylklomipramin: ca. 36 timer"}]}]}}'::jsonb
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"98 % (både klomimpramin og desmetylklomipramin)"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 12–17 L/kg"}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hepatisk metabolisme. Utskilles i urin (55 %) og feces (28 %)."}]}]}}'::jsonb
  ))).id;
  nye := nye || objekt;

  -- farmakokinetikk/kinetikkort
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 7,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Klomipramin: 3A4, 2C19 og 1A2"}]},{"type":"paragraph","content":[{"type":"text","text":"Desmetylklomipramin: 2D6"}]},{"type":"paragraph","content":[{"type":"text","text":"Langsomme omsettere via 2D6 eller 2C19 anbefales 50 % reduksjon i startdose."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_4)
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
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ratio metabolitt/modersubstans: 0,8-2,6 (AGNP)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
  ))).id;
  nye := nye || objekt;

  -- serumkonsentrasjoner/dosetabell
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"25 mg","regime":"","konsentrasjon":"Median 97 nmol/L (10.–90. persentil: 38–353)","merknad":"Klomipramin + desmetylklomipramin. 10 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 298 nmol/L (10.–90. persentil: 104–772)","merknad":"Klomipramin + desmetylklomipramin. 36 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Media'
    'n 354 nmol/L (10.–90. persentil: 233–1 210)","merknad":"Klomipramin + desmetylklomipramin. 41 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 542 nmol/L (10.–90. persentil: 267–1 196)","merknad":"Klomipramin + desmetylklomipramin. 59 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentrasjon":"Median 753 nmol/L (10.–90. persentil: 435–1 573)","merkna'
    'd":"Klomipramin + desmetylklomipramin. 39 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 833 nmol/L (10.–90. persentil: 389–1 520)","merknad":"Klomipramin + desmetylklomipramin. 115 prøver. Reis et al. (2009)"},{"dose":"175 mg","regime":"","konsentrasjon":"Median 768 nmol/L (10.–90. persentil: 610–1 329)","merknad":"Klomipramin + desmetylklomipramin. 12 prøver. R'
    'eis et al. (2009)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 927 nmol/L (10.–90. persentil: 444–2 094)","merknad":"Klomipramin + desmetylklomipramin. 30 prøver. Reis et al. (2009)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 38 nmol/L (10.–90. persentil: 28–202)","merknad":"Klomipramin. 10 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 121 nmo'
    'l/L (10.–90. persentil: 47–345)","merknad":"Klomipramin. 36 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 165 nmol/L (10.–90. persentil: 71–476)","merknad":"Klomipramin. 41 prøver. Reis et al. (2009)"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 236 nmol/L (10.–90. persentil: 102–672)","merknad":"Klomipramin. 59 prøver. Reis et al. (2009)"},{"dose":"125 '
    'mg","regime":"","konsentrasjon":"Median 303 nmol/L (10.–90. persentil: 109–731)","merknad":"Klomipramin. 39 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 284 nmol/L (10.–90. persentil: 118–700)","merknad":"Klomipramin. 115 prøver. Reis et al. (2009)"},{"dose":"175 mg","regime":"","konsentrasjon":"Median 255 nmol/L (10.–90. persentil: 189–515)","merknad":"Klomipr'
    'amin. 12 prøver. Reis et al. (2009)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 248 nmol/L (10.–90. persentil: 136–952)","merknad":"Klomipramin. 30 prøver. Reis et al. (2009)"},{"dose":"Alle","regime":"","konsentrasjon":"Median 236 nmol/L (10.–90. persentil: 71–673)","merknad":"Klomipramin. 400 prøver. Reis et al. (2009)"},{"dose":"25 mg","regime":"","konsentrasjon":"Median 38 nmol/L (1'
    '0.–90. persentil: 10–202)","merknad":"Desmetylklomipramin. 10 prøver. Reis et al. (2009)"},{"dose":"50 mg","regime":"","konsentrasjon":"Median 157 nmol/L (10.–90. persentil: 52–420)","merknad":"Desmetylklomipramin. 36 prøver. Reis et al. (2009)"},{"dose":"75 mg","regime":"","konsentrasjon":"Median 205 nmol/L (10.–90. persentil: 77–849)","merknad":"Desmetylklomipramin. 41 prøver. Reis et al. (2009)'
    '"},{"dose":"100 mg","regime":"","konsentrasjon":"Median 303 nmol/L (10.–90. persentil: 112–661)","merknad":"Desmetylklomipramin. 59 prøver. Reis et al. (2009)"},{"dose":"125 mg","regime":"","konsentrasjon":"Median 437 nmol/L (10.–90. persentil: 219–789)","merknad":"Desmetylklomipramin. 39 prøver. Reis et al. (2009)"},{"dose":"150 mg","regime":"","konsentrasjon":"Median 486 nmol/L (10.–90. persenti'
    'l: 185–1 008)","merknad":"Desmetylklomipramin. 115 prøver. Reis et al. (2009)"},{"dose":"175 mg","regime":"","konsentrasjon":"Median 539 nmol/L (10.–90. persentil: 387–887)","merknad":"Desmetylklomipramin. 12 prøver. Reis et al. (2009)"},{"dose":"200 mg","regime":"","konsentrasjon":"Median 618 nmol/L (10.–90. persentil: 253–1 076)","merknad":"Desmetylklomipramin. 30 prøver. Reis et al. (2009)"},{"'
    'dose":"50–250 mg","regime":"","konsentrasjon":"10.–90. persentil: 148–1 559 nmol/L","merknad":"Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs)."}]}'::jsonb,
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