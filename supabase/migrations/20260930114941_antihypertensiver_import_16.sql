-- Labetalol
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
    where s.tilstand = 'utkast' and s.slug = 'labetalol';

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
       and r.tittel = 'Trandate «Aspen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trandate-aspen-564767'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'spc-labetalol';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Betablokkere – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/betablokkere-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helsebiblioteket-betablokkere';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and s.slug = 'labetalol';
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Labetalol","slug":"labetalol"}'::jsonb)).id;
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
    'data', '{"nedre":50,"ovre":1000,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '50'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '1000'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'Labetalol', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'Labetalol', 'referanseomrade';
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
    'data', '{"nedre":4000,"ovre":null,"enhet":"nmol/L","forbehold":"4 × øvre grense for referanseområdet."}'::jsonb
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
    'data', '{"former":[{"form":"","typisk":null,"min":4,"maks":8,"enhet":"timer"}]}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Selektiv alfa-1-adrenerg reseptorantagonist og ikke-selektiv beta-1-reseptorantagonist."}]},{"type":"paragraph","content":[{"type":"text","text":"Labetalol senker blodtrykket ved å blokkere perifere arteriolære alfa-adrenoseptorer. Blokkeringen reduserer perifer motstand, og gjennom samtidig beta-blokkering '
    'beskyttes hjertet mot reflekssympatisk arbeid som ellers ville oppstå."}]},{"type":"paragraph","content":[{"type":"text","text":"Den reduserte perifere motstanden senker den myokardiale etterbelastningen og oksygenbehovet."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Malign hypertensjon (injeksjonsvæske): Startdose 50 mg iv, hvis nødvendig repeteres hvert 5. minutt til tilfredsstillende blodtrykk oppnås. Total dose bør ikke overstige 200 mg."}]},{"type":"paragraph","content":[{"type":"text","text":"Kontrollert hypotensjon under anestesi (injeksjonsvæske): Startdose 10–20'
    ' mg iv, trinnvis doseøkning hvert 5. minutt på 5–10 mg til tilfredsstillende blodtrykk oppnås."}]},{"type":"paragraph","content":[{"type":"text","text":"Hypertensjon: Startdose 100 mg × 2 i 2–14 dager før vedlikeholdsdose 200 mg × 2. Ved behov kan dosen økes opp til maks anbefalt dose på 400 mg × 2. Ved alvorlig refraktær hypertensjon har daglige doser opptil 2400 mg/døgn blitt gitt."}]},{"type":"'
    'paragraph","content":[{"type":"text","text":"Svangerskapshypertensjon (tabletter): Startdose 100 mg × 2. Ved behov kan dosen økes ukentlig med +100 mg × 2. Daglig dose på 2400 mg/døgn skal ikke overskrides."}]},{"type":"paragraph","content":[{"type":"text","text":"Angina pectoris med samtidig hypertensjon (tabletter): Doseres som nødvendig for å kontrollere hypertensjonen."}]},{"type":"paragraph",'
    '"content":[{"type":"text","text":"Nedsatt lever- og nyrefunksjon: Skal brukes med forsiktighet ved alvorlig nedsatt nyrefunksjon og ved alvorlig nedsatt leverfunksjon."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Malign hypertensjon (injeksjonsvæske)"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved planlagt hypotensjon under anestesi (injeksjonsvæske)"}]}]},{"type":"listItem","content":[{"type":"paragraph","cont'
    'ent":[{"type":"text","text":"Hypertensjon inkl. svangerskapshypertensjon (tabletter)"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Angina pectoris med samtidig hypertensjon (tabletter)"}]}]}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Den hypotensive virkingen til labetalol kan reduseres ved bruk i kombinasjon med prostaglandinsyntesehemmere (NSAIDs)."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Samtidig administrering av labetalol o'
    'g adrenalin kan resultere i bradykardi og hypertensjon."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Fare for uttalt bradykardi og hypotensjon ved kombinasjon med kalsiumantagonister med negativ inotrop effekt (f.eks. verapamil, diltiazem."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Forsiktighet må utvises v'
    'ed generell anestesi av pasienter som bruker betablokkere. Betablokkere reduserer risikoen for arytmier ved anestesi men kan føre til nedsettelse av den reflektoriske takykardi og øke risikoen for hypotensjon ved anestesi."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Midler med β-reseptor-blokkerende egenskaper kan forsterke den blodsukkerreduserende ef'
    'fekten av insulin og orale antidiabetika samtidig som det kan maskere symptomer på hypoglykemi som takykardi og tremor."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Dersom pasienter som får labetalol trenger adrenalinbehandling, skal det brukes en redusert dose av adrenalin, da samtidig administrering av labetalol og adrenalin kan resultere i bradykardi'
    ' og hypertensjon."}]}]}]}]}}'::jsonb,
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
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"25 %."}]}]}}'::jsonb,
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
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–2 timer"}]}]}}'::jsonb,
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
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"4–8 timer."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 50 %."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5,1–9,4 L/kg."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Labetalol metaboliseres hovedsakelig i lever via konjugering til inaktive metabolitter."}]},{"type":"paragraph","content":[{"type":"text","text":"Legemiddelet utskilles både via nyrene i urin (ca. 60 %) og via galle/feces, som metabolitter og uforandret moderstoff (< 5 %)."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Molekylvekt: 328,4 g/mol."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_2)
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
    'data', '{"tittel":"Toksisitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Selektiv alfa-1-reseptorantagonist og uselektiv beta-reseptorantagonist (alfa- og betablokker)."}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Forventer mer uttalt hypotensjon og noe mindre uttalte hjerteeffekter."'
    '}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Det er stor individuell følsomhet for toksisiteten til betablokkere. Relativt lave doser kan gi alvorlig forgiftning hos risikopasienter (hjertesyke), mens friske voksne og barn ofte tolererer større doser godt."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Grensen for toksisk område er satt t'
    'il 4 × øvre grense for referanseområdet (≥ 4000 nmol/L), en felles grense for alle antihypertensivene."}]},{"type":"paragraph","content":[{"type":"text","text":"Se behandlingsanbefalingen ved forgiftning fra Helsebiblioteket."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_3)
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
    'data', '{"rader":[{"dose":"200 mg","regime":"12 t etter dose, dosering hver 12. t","konsentrasjon":"56–89 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"200 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"107–171 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"2400 mg","regime":"12 t etter dose, dosering hver 12. t","konsentrasjon"'
    ':"667–1067 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"2400 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"1281–2048 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"200 mg","regime":"Cmaks (målt)","konsentrasjon":"217 nmol/L","merknad":"Målt i IDA-studien, n = 1."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_4, referanse_1)
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