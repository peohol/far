-- Irbesartan
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
    where s.tilstand = 'utkast' and s.slug = 'irbesartan';

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
       and r.tittel = 'Disposition of Toxic Drugs and Chemicals in Man' and r.lenke = ''
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'baselt2017';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Angiotensin-2-antagonister – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/angiotensin-2-antagonister-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-angiotensin-2-antagonister';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and s.slug = 'irbesartan';
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Irbesartan","slug":"irbesartan"}'::jsonb)).id;
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
    'data', '{"nedre":300,"ovre":3000,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '300'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '3000'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'Irbesartan', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'Irbesartan', 'referanseomrade';
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
    'data', '{"nedre":12000,"ovre":null,"enhet":"nmol/L","forbehold":"4 × øvre grense for referanseområdet."}'::jsonb
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
    'data', '{"former":[{"form":"","typisk":null,"min":11,"maks":15,"enhet":"timer"}]}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Irbesartan blokkerer reseptoren (angiotensin 2- reseptor type 1) til angiotensin 2. Angiotensin 2 er en kraftig vasokonstriktor. Ved å blokkere denne reseptoren oppnår man vasodilatasjon og påfølgende fall i blodtrykk. Den spesifikke hemmingen av AT1-reseptorer fører til økning av plasma renin og angiotensin'
    '-II nivå og reduksjon i konsentrasjon av plasma aldosteron."}]},{"type":"paragraph","content":[{"type":"text","text":"Reseptorer for angiotensin 2 finnes også i:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"bakre hypofyselapp: blokkering via irbesartan medfører redusert frigjøring av antidiuretisk hormon (ADH)."}]}]},{"type'
    '":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"binyrebarken: blokkering via irbesartan medfører redusert frigjøring av aldosteron."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"nyren: blokkering via irbesartan medfører redusert gjenopptak av vann og natrium."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Forv'
    'entet blodtrykkseffekt av monopreparat på systolisk og diastolisk kontorblodtrykk som for ACEI, se Wu et al. (2005)."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Vanlig start- og vedlikeholdsdose: 150 mg daglig, maks. dose 300 mg daglig. Hos eldre og pasienter i hemodialyse kan 75 mg daglig vurderes."}]},{"type":"paragraph","content":[{"type":"text","text":"Irbesartans farmakokinetikk er lineær og doseproporsjonal i doseområdet 10–600 mg."}]},{"type":"paragraph","con'
    'tent":[{"type":"text","text":"Nedsatt lever- og nyrefunksjon: Hos pasienter med mild til moderat cirrhose er de farmakokinetiske parameterne for irbesartan ikke signifikant endret. Det er ikke gjort studier hos pasienter med sterkt nedsatt leverfunksjon. Hos pasienter med nedsatt nyrefunksjon og pasienter i hemodialyse er de farmakokinetiske parameterne ikke signifikant endret. Irbesartan fjernes '
    'ikke ved hemodialyse."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Essensiell hypertensjon"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Behandling av nyresykdom hos voksne pasienter med hypertensjon og type 2 diabetes mellitus som en del av et antihypertensivt legemidd'
    'elregime"}]}]}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Diuretika og andre antihypertensive legemidler: andre antihypertensive legemidler kan forsterke den hypotensive effekten av irbesartan, dog er irbesartan ofte gitt sammen med andre antihypertensiva som betablokkere, langtidsvirkende kalsiumkanalblokkere og tiazider. Ser additive blodtrykkseffekter."}]},{"typ'
    'e":"paragraph","content":[{"type":"text","text":"Som med ACE-hemmere kan samtidig bruk av angiotensin-II antagonister og NSAIDs føre til økt risiko for forverring av nyrefunksjonen, eventuelt akutt nyresvikt, og økning av serumkalium, spesielt hos pasienter som allerede har dårlig nyrefunksjon. Kombinasjonen bør gis med forsiktighet, spesielt hos eldre."}]},{"type":"paragraph","content":[{"type":"'
    'text","text":"OBS! Økt kalium sammen med kaliumtilskudd."}]},{"type":"paragraph","content":[{"type":"text","text":"Kombinasjon av ARB med ACEH og renin hemmer gir mer effekt og bivirkninger. ACE-hemmere og angiotensin-II reseptorantagonister bør derfor ikke brukes samtidig hos pasienter med diabetisk nefropati."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"60–80 %"}]}]}}'::jsonb,
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
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1,5–2 timer (ved oral administrering)"}]}]}}'::jsonb,
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
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"11–15 timer"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 96 %"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"0,6–1,5 L/kg"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Irbesartan metaboliseres i hovedsak av CYP2C9. Irbesartanglukuronid er hovedmetabolitt."}]},{"type":"paragraph","content":[{"type":"text","text":"Galle (20 %) og nyrer. 2 % ut uendret ut i urin."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Molekylvekt: 428,5 g/mol."}]}]}}'::jsonb,
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
    'data', '{"tittel":"CYP-enzymer (substrat)","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"2C9 (ca. 10 %; hovedsakelig konjugering)"}]}]}}'::jsonb,
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
    'data', '{"tittel":"Toksisitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"For gruppen angiotensin II-reseptorantagonister:"}]},{"type":"paragraph","content":[{"type":"text","text":"Relativt lav toksisitet. Få rapporter om alvorlige forgiftninger grunnet angiotensin II-reseptorantagonister alene. Hypotensjon er hovedproblemet ved forgiftning. Personer med hjer'
    'tesykdom (ofte eldre) tolererer mindre enn friske personer."}]},{"type":"paragraph","content":[{"type":"text","text":"Kombinasjon med andre legemidler som påvirker sirkulasjonen kan potensere forgiftningen."}]},{"type":"paragraph","content":[{"type":"text","text":"Klinikk for gruppen: Hodepine, svimmelhet og somnolens. Hypotensjon og takykardi, ev. bradykardi. Hyperkalemi, ev. nyre- og leverpåvirk'
    'ning."}]},{"type":"paragraph","content":[{"type":"text","text":"Grensen for toksisk område er satt til 4 × øvre grense for referanseområdet (≥ 12 000 nmol/L), en felles grense for alle antihypertensivene."}]},{"type":"paragraph","content":[{"type":"text","text":"Svært få rapporterte forgiftninger. Baselt (2017) beskriver en kasuistikk med 17 500 nmol/L irbesartan ved innkomst; pasienten overlevde.'
    '"}]},{"type":"paragraph","content":[{"type":"text","text":"Se behandlingsanbefalingen ved forgiftning fra Helsebiblioteket."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_4, referanse_5)
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
    'data', '{"rader":[{"dose":"150 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"451–763 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"150 mg","regime":"12 t etter dose, dosering hver 24. t","konsentrasjon":"855–1446 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"150 mg","regime":"Gjennomsnitt ved steady state","konsentrasjo'
    'n":"915–1547 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"300 mg","regime":"24 t etter dose, dosering hver 24. t","konsentrasjon":"902–1526 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"300 mg","regime":"12 t etter dose, dosering hver 24. t","konsentrasjon":"1710–2892 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel).'
    '"},{"dose":"300 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"1830–3094 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"150–300 mg","regime":"Cmaks (målt)","konsentrasjon":"4173 (1922–11 017) nmol/L","merknad":"Målt i IDA-studien, median (min–maks), n = 17."},{"dose":"150–300 mg","regime":"Cmin (målt)","konsentrasjon":"1250 (592–1923) nmol/L","merknad"'
    ':"Målt i IDA-studien, median (min–maks), n = 3."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_6, referanse_1)
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