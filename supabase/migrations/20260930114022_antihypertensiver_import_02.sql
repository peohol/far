-- Amlodipin
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
    where s.tilstand = 'utkast' and s.slug = 'amlodipin';

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
       and r.tittel = 'Amlodipin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/amlodipin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-amlodipin';
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
      where s.tilstand = 'utkast' and s.slug = 'amlodipin';
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Amlodipin","slug":"amlodipin"}'::jsonb)).id;
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
    'data', '{"nedre":10,"ovre":70,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '10'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '70'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'Amlodipin', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'Amlodipin', 'referanseomrade';
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
    'data', '{"nedre":280,"ovre":null,"enhet":"nmol/L","forbehold":"4 × øvre grense for referanseområdet."}'::jsonb
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
    'data', '{"former":[{"form":"","typisk":null,"min":35,"maks":50,"enhet":"timer"}]}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Langtidsvirkende kalsiumantagonist av dihydropyridintype med selektivitet for vaskulær glatt muskel."}]},{"type":"paragraph","content":[{"type":"text","text":"Amlodipin binder seg til spenningstyrte L(low)-type kalsiumkanaler i sarcolemma i glatte muskelceller og hemmer kalsiuminnstrømming i cellene. Dette f'
    'ører til ytterligere redusert kalsiumfrigivelse fra sarkoplasmatisk retikulum til cytosol. Reduksjon i intracellulært fritt kalsium reduserer glatt muskelkontraksjon, dvs. vil gi vasodilatasjon, derved redusert perifer resistens og fall i blodtrykk."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved veldig høye serumkonsentrasjoner av amlodipin bindes også legemiddelet til hjertemuskelc'
    'eller og kan derfor gi redusert hjerterytme (negativ kronotropisk effekt) og hjertemuskelkontraksjon (negativ inotrop effekt) dvs. kan gi hjertesvikt."}]},{"type":"paragraph","content":[{"type":"text","text":"Kalsiumantagonister av dihydropyridintype reduserer systolisk blodtrykk og diastolisk blodtrykk med ca. 15,6 ± 5,3 / 10,3 ± 2,6 mmHg (gjennomsnitt ± SD), ifølge metastudie fra Wu et al. (2005'
    ')."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hypertensjon: 5–10 mg. Maksimal dose 10 mg."}]},{"type":"paragraph","content":[{"type":"text","text":"Nedsatt lever- og nyrefunksjon: Redusert utskillelse (økt halveringstid) kan ses hos eldre, hos pasienter med nedsatt leverfunksjon, nyresvikt (noen få studier) og ved hjertesvikt."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Hypertensjon"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kronisk stabil angina pectoris"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Vasospastisk angina"}]}'
    ']}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Grunnet metabolisme via CYP3A4 øker serumkonsentrasjonen og derved effekten ved samtidig anvendelse av kraftige og moderate hemmere av CYP3A4 (grapefruktjuice, makrolider, proteasehemmere, soppmidler, verapamil eller diltiazem) og senkes ved samtidig bruk av kraftige indusere (rifampicin m.fl.). Ikke konklus'
    'ivt om CYP3A5 polymorfismer. Amlodipin er i seg selv en svak hemmer av CYP3A4 og kan også hemme andre cytokromer."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"64–80 %"}]}]}}'::jsonb,
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
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"6–12 timer"}]}]}}'::jsonb,
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
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"35–50 t"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"97 %"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"21 L/kg"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Metaboliseres i lever via CYP3A4/5 i lever til inaktive produkter."}]},{"type":"paragraph","content":[{"type":"text","text":"10 % uendret legemiddel og 60 % metabolitter ut i nyrer"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Molekylvekt: 408,9 g/mol."}]}]}}'::jsonb,
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
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3A4/5"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dosejustert, beregnet serumreferanseområde fra Rognstad et al. (2021). Målte konsentrasjoner fra IDA-studien (Thorstensen et al. 2022) står i tabellen over serumkonsentrasjoner."}]},{"type":"paragraph","content":[{"type":"text","text":"Området avviker fra Rognstad et '
    'al. (2021) fordi det er korrigert etter sammenligning med flere målte verdier fra IDA-studien."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Toksisitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Overdosesymptomer er: kraftig perifer vasodilatasjon, reflekstakykardi. I høye konsentrasjoner effekter også på hjertet, se over under farmakodynamikk. Hyperglykemi."}]},{"type":"paragraph","content":[{"type":"text","text":"Pga. høy proteinbinding er amlodipin ikke dialyserbart."}]},{"t'
    'ype":"paragraph","content":[{"type":"text","text":"Grensen for toksisk område er satt til 4 × øvre grense for referanseområdet (≥ 280 nmol/L), en felles grense for alle antihypertensivene."}]},{"type":"paragraph","content":[{"type":"text","text":"Toksisitet er rapportert fra 215 nmol/L. Fatale/komatøse tilfeller er rapportert i området 250–1500 nmol/L, men det finnes også pasienter som har overlev'
    'd konsentrasjoner i dette området."}]},{"type":"paragraph","content":[{"type":"text","text":"Se behandlingsanbefalingen ved forgiftning fra Helsebiblioteket."}]}]}}'::jsonb,
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
    'data', '{"rader":[{"dose":"5 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"10–16 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"5 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"12–20 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"10 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"19–33 '
    'nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"10 mg","regime":"12 t etter dose, dosering hver 24. t","konsentrasjon":"24–41 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"10 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"24–41 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"2,5–20 mg","regim'
    'e":"Cmaks (målt)","konsentrasjon":"45 (10–172) nmol/L","merknad":"Målt i IDA-studien, median (min–maks), n = 169."},{"dose":"2,5–20 mg","regime":"Cmin (målt)","konsentrasjon":"28 (8–105) nmol/L","merknad":"Målt i IDA-studien, median (min–maks), n = 20."}]}'::jsonb,
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