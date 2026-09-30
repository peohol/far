-- Diltiazem
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
    where s.tilstand = 'utkast' and s.slug = 'diltiazem';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Establishing Serum Reference Ranges for Antihypertensive Drugs' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000806'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'rognstad2021';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Development of UHPLC-MS/MS methods to quantify 25 antihypertensive drugs in serum in a cohort of patients treated for hypertension' and r.lenke = 'https://doi.org/10.1016/j.jpba.2022.114908'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'thorstensen2022';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Felleskatalogen' and r.lenke = 'https://www.felleskatalogen.no/'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'felleskatalogen';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Summary of the Effects of Antihypertensive Medications on Measured Blood Pressure' and r.lenke = 'https://doi.org/10.1016/j.amjhyper.2005.01.011'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'wu2005';
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
       and r.tittel = 'Disposition of Toxic Drugs and Chemicals in Man' and r.lenke = ''
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'baselt2017';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Diltiazem – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/diltiazem-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-diltiazem';
  end if;
  referanse_7 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and s.slug = 'diltiazem';
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Diltiazem","slug":"diltiazem"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);

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
    'data', '{"nedre":100,"ovre":500,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '100'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '500'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'Diltiazem', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'Diltiazem', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if not kilder ? referanse_1::text then kilder := kilder || to_jsonb(referanse_1::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: antihypertensiver.docx', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    end if;
  end if;

  -- viktige_data/toksisk_omrade
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'toksisk_omrade' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'toksisk_omrade',
    'data', '{"nedre":2000,"ovre":null,"enhet":"nmol/L","forbehold":"4 × øvre grense for referanseområdet."}'::jsonb
    ))).id;
    nye := nye || objekt;
  end if;

  -- viktige_data/halveringstid
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'viktige_data'
      and e.elementtype = 'halveringstid' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'viktige_data',
    'posisjon', 0,
    'elementtype', 'halveringstid',
    'data', '{"former":[{"form":"Depot","typisk":null,"min":4,"maks":10,"enhet":"timer"}]}'::jsonb
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakodynamikk/riktekst
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakodynamikk'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakodynamikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kalsiumantagonist, benzotiazepintype. Hemmer selektivt langsomme spenningstyrte L-type kalsiumkanaler i sarcolemma i både hjertemuskelceller og glatte muskelceller. Dette fører også til mindre frigivelse av kalsiumioner intracellulært. Effekten er vasodilatasjon, nedsatt perifer motstand og reduksjon i blodt'
    'rykk. Vasodilatasjon skjer også i kransarteriene."}]},{"type":"paragraph","content":[{"type":"text","text":"Redusert smerte ved angina pectoris fordi diltiazem reduserer hjertets pumpekraft som betyr redusert oksygenbehov og samtidig øker blodforsyningen til hjertemuskelen pga. vasodilatasjon."}]},{"type":"paragraph","content":[{"type":"text","text":"Antiarytmisk effekt fordi diltiazem spesifikt p'
    'åvirker hjertes ledningssystem: forsinker ledningstid i AV-knuten og setter ned frekvens i sinusknuten."}]},{"type":"paragraph","content":[{"type":"text","text":"Blodtrykksreduksjon ved monoterapi, sittende systolisk/diastolisk blodtrykk: 14,4 ± 2,1 / 12,1 ± 2,8 mmHg (gjennomsnitt ± SD), ifølge metastudien fra Wu et al. (2005)."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2, referanse_3)
    ))).id;
    nye := nye || objekt;
  end if;

  -- dosering/riktekst
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'dosering'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'dosering',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Depottablett én gang daglig: 240–360 mg. Dosen kan ved behov økes til 480 mg én gang daglig."}]},{"type":"paragraph","content":[{"type":"text","text":"Depottablett to ganger daglig: 180–360 mg ved angina pectoris og 240–360 mg ved hypertensjon."}]},{"type":"paragraph","content":[{"type":"text","text":"Nedsat'
    't lever- og nyrefunksjon: Økt plasmakonsentrasjon av diltiazem kan ses hos eldre og ved nedsatt nyre- eller leverfunksjon; doseres med forsiktighet. Dosereduksjon anbefales ved nedsatt leverfunksjon. Micromedex og UpToDate har ingen doseanbefaling ved moderat til alvorlig nedsatt nyrefunksjon."}]},{"type":"paragraph","content":[{"type":"text","text":"Diltiazem ble avregistrert i Norge i desember 2'
    '024 på grunn av lite bruk. Analysen beholdes fordi pasientprøver fra IDA- og BETAMI-prosjektene er tatt før denne datoen."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- indikasjon/riktekst
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hypertensjon (primær og sekundær profylakse), supraventrikulær takykardi, atrieflimmer og angina pectoris. I Norge er indikasjonen hypertensjon og angina pectoris."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- interaksjoner/riktekst
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'interaksjoner'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'interaksjoner',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"På grunn av risikoen for additive effekter, er varsomhet og nøyaktig titrering nødvendig hos pasienter som får diltiazem sammen med andre legemidler som også påvirker hjertets kontraktilitet og/eller ledningsevne."}]},{"type":"paragraph","content":[{"type":"text","text":"Forsiktighet ved kombinasjon med digi'
    'talis og betablokkere, pga fare for additiv effekt på ledningssystemet med for lav hjertefrekvens eller AV-blokk."}]},{"type":"paragraph","content":[{"type":"text","text":"Samtidig behandling med amiodarone/digoksin/digitoksin gir økt risiko for bradykardi og forsiktighet bør utvises, særlig hos eldre og ved høye doser."}]},{"type":"paragraph","content":[{"type":"text","text":"Nitratderivater: Økt'
    'e hypotensive effekter og svimmelhet (additive vasodilaterende effekter)."}]},{"type":"paragraph","content":[{"type":"text","text":"En moderat (mindre enn 2 ganger) økning i plasmakonsentrasjon av diltiazem har blitt dokumentert ved samtidig administrering med en kraftigere CYP3A4-hemmer. Diltiazem er også en moderat CYP3A4-hemmer. Samtidig administrering med andre CYP3A4-substrater kan resultere '
    'i en økning i plasmakonsentrasjon av begge legemidlene. Når diltiazem administreres samtidig med en CYP3A4-induser kan det føre til redusert plasmakonsentrasjon av diltiazem. OBS! Det er rapportert økt serumkonsentrasjon av ciclosporin og karbamazepin ved samtidig bruk."}]},{"type":"paragraph","content":[{"type":"text","text":"Diltiazem gir økt risiko for litiumindusert neurotoksisitet."}]},{"type'
    '":"paragraph","content":[{"type":"text","text":"Som andre kalsiumkanalblokkere har diltiazem hemmende effekt på tarmmotilitet og skal derfor brukes med forsiktighet av pasienter med risiko for å utvikle tarmobstruksjon."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «Biotilgjengelighet»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Biotilgjengelighet'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"40 % pga førstepassasje effekt i lever"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «tₘₐₓ»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'tₘₐₓ'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Varierer: 3–6 timer (depottablett to ganger daglig) og 6–7 timer (depottablett én gang daglig) i Felleskatalogen, og 11–18 timer for depottabletter i amerikanske kilder."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «t½»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 't½'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Varierer: 3–6 timer i Felleskatalogen, 4–10 timer i Legemiddelhåndboka og 6,5–9,5 timer i amerikanske kilder."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «Proteinbinding»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Proteinbinding'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"70–80 % (40 % til alfa-1-glykoprotein og 30 % til albumin)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «Vd»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Vd'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 4,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3 L/kg"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «Eliminasjon»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Eliminasjon'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 5,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Via CYP3A4 i lever til N-monodesmetyldiltiazem, via esterase til deacetyldiltiazem og CYP2D6 til O-desmetyldiltiazem. Siden blir metabolittene konjugert."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved terapeutisk dosering er plasmakonsentrasjonene av metabolittene henhol'
    'dsvis 40 % og 10–20 % av modersubstansens konsentrasjon. Metabolittene har mindre enn halvparten av modersubstansens effekt."}]},{"type":"paragraph","content":[{"type":"text","text":"Variert informasjon i ulike kilder. I felleskatalogen og Baselt står det at 70 % av modersubstans og metabolitter har utskillelse i urin."}]},{"type":"paragraph","content":[{"type":"text","text":"2–4 % uendret ut i ur'
    'in, 35 prosent metabolitter i urin og 65 % i feces i en frisøkkilde."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakokinetikk/kinetikkort «Annet»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakokinetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Annet'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakokinetikk',
    'posisjon', 6,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Molekylvekt: 414,5 g/mol."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- farmakogenetikk/kinetikkort «CYP-enzymer (substrat)»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'farmakogenetikk'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'CYP-enzymer (substrat)'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'farmakogenetikk',
    'posisjon', 0,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4 (2D6)"}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Prøven tas 12–24 timer etter siste dose (C"},{"type":"text","text":"12–24","marks":[{"type":"subscript"}]},{"type":"text","text":")."}]},{"type":"paragraph","content":[{"type":"text","text":"Etter en doseendring bør det gå minst fem halveringstider før ny prøve tas."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dosejustert, beregnet serumreferanseområde fra Rognstad et al. (2021). Målte konsentrasjoner fra IDA-studien (Thorstensen et al. 2022) står i tabellen over serumkonsentrasjoner."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Toksisitet»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Toksisitet'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Toksisitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hypotensjon, nyreskade, bradykardi, AV-overledning forstyrrelser, hjertesvikt."}]},{"type":"paragraph","content":[{"type":"text","text":"Grensen for toksisk område er satt til 4 × øvre grense for referanseområdet (≥ 2000 nmol/L), en felles grense for alle antihypertensivene."}]},{"type"'
    ':"paragraph","content":[{"type":"text","text":"Toksisitet er rapportert fra ca. 1930 nmol/L. Komatøse/fatale tilfeller er rapportert i området 4825–14 475 nmol/L; én pasient har overlevd med 10 856 nmol/L i serum."}]},{"type":"paragraph","content":[{"type":"text","text":"Se behandlingsanbefalingen ved forgiftning fra Helsebiblioteket."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_4, referanse_5, referanse_6)
    ))).id;
    nye := nye || objekt;
  end if;

  -- serumkonsentrasjoner/dosetabell
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'serumkonsentrasjoner'
      and e.elementtype = 'dosetabell' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'serumkonsentrasjoner',
    'posisjon', 0,
    'elementtype', 'dosetabell',
    'data', '{"rader":[{"dose":"240 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"42–62 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"240 mg","regime":"12 t etter dose, dosering hver 24. t","konsentrasjon":"128–187 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"240 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":'
    '"156–227 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"480 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"84–123 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"480 mg","regime":"12 t etter dose, dosering hver 24. t","konsentrasjon":"256–373 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dos'
    'e":"480 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"312–455 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"120–360 mg","regime":"Cmaks (målt)","konsentrasjon":"412 (246–449) nmol/L","merknad":"Målt i IDA-studien, median (min–maks), n = 5."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_7, referanse_1)
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