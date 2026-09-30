-- Bumetanid
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
    where s.tilstand = 'utkast' and s.slug = 'bumetanid';

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
       and r.tittel = 'Burinex «Karo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/burinex-karo-pharma-547150'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'spc-bumetanid';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'hiemke2017';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and s.slug = 'bumetanid';
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Bumetanid","slug":"bumetanid"}'::jsonb)).id;
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
    'data', '{"nedre":40,"ovre":400,"enhet":"nmol/L","forbehold":"Gjelder Cmaks."}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '40'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '400'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'Bumetanid', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'Bumetanid', 'referanseomrade';
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
    'data', '{"nedre":1600,"ovre":null,"enhet":"nmol/L","forbehold":"4 × øvre grense for referanseområdet."}'::jsonb
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
    'data', '{"former":[{"form":"","typisk":null,"min":1,"maks":2,"enhet":"timer"}]}'::jsonb
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Slyngediuretikum, hemmer Na+/K+/2Cl- symporter i tubuliceller hovedsakelig i oppadgående del av Henles sløyfe. I tillegg gir slyngediuretika venedilatasjon med redusert venøs tilbakestrømming til hjerte (reduserer preload), og dermed redusert belastning på hjerte. Slyngediuretika hemmer nyrenes evne til å ko'
    'nsentrere urinen, ved at den ødelegger gradienten i interstitiet."}]},{"type":"paragraph","content":[{"type":"text","text":"Bumetanid har bedre oral biotilgjengelighet, halveringstiden øker ikke like mye med grad av nyresvikt og legemidlet er 40 ganger mer potent enn furosemid."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hjertesvikt: Vanlig dosering 0,5–2 mg daglig (i alvorlige tilfeller 2–4 mg daglig), må individualiseres."}]},{"type":"paragraph","content":[{"type":"text","text":"Diuresen begynner vanligvis ca. 30 minutter etter peroral administrasjon, med en topp etter 1–2 timer, og effekten varer 3–5 timer."}]},{"type":"p'
    'aragraph","content":[{"type":"text","text":"Nedsatt lever- og nyrefunksjon: Halveringstiden forlenges hos pasienter med lever- eller nyresykdom. Forsiktighet bør utvises ved sterkt nedsatt leverfunksjon og ved alvorlig eller progressiv nedsatt nyrefunksjon."}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Alle former for ødemer"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sterkt nedsatt nyrefunksjon, nyresvikt og nefrotisk syndrom"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type"'
    ':"text","text":"Forsert diurese"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Hypertensive kriser"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved resistens overfor andre diuretika"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kronisk lungeødem, refraktære ødemer ved'
    ' hjertesvikt"}]}]}]}]}}'::jsonb,
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Digitalis grunnet hypokalemitendens og følgende økt sårbarhet for digitalisglykosider. Bumetanid reduserer utskillelsen av litium, noe som kan gi økte serumkonsentrasjoner av litium. NSAID motvirker effekten av bumetanid. Probenecid hemmer den renale tubulære sekresjon av bumetanid som igjen fører til minske'
    't natriuresis. Ototoksisiteten av aminoglykosider kan forsterkes ved samtidig bruk av bumetanid."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Biotilgjengelighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"80–95 %."}]}]}}'::jsonb,
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
    'data', '{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–2 t (ved oral administrering)."}]}]}}'::jsonb,
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
    'data', '{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1–2 t. Forlenges ved økende grad av nedsatt nyrefunksjon, og nedsatt leverfunksjon."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"90–99 %."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"0,1–0,2 L/kg."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Eliminasjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ingen aktive metabolitter er blitt funnet."}]},{"type":"paragraph","content":[{"type":"text","text":"Hovedsakelig uomdannet i urinen, resten i feces."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Annet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Molekylvekt: 364,4 g/mol."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pga. kort halveringstid, kan serumkonsentrasjonsmålinger vurderes ut i fra Cmaks, men lite dokumentasjon foreligger."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Referanseområdet for bumetanid er basert på Cmax for doser fra 0,5 til 4 mg. Litteraturen rapporterer doser opptil 3 mg, så 4 mg er beregnet ut fra antatt doselinjaritet."}]},{"type":"paragraph","content":[{"type":"text","text":"Målte konsentrasjoner fra IDA-studien ('
    'Thorstensen et al. 2022) står i tabellen over serumkonsentrasjoner."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Tolkning»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Tolkning'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 2,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Tolkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bumetanid er ikke påvisbart medikamentfastende, men kan påvises 1–6 timer etter inntak. Analysesvaret må alltid ses i sammenheng med klinikk."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Toksisitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved høye doser og langtidsbehandling kan loopdiuretika gi elektrolyttforstyrrelser med ledsagende symptomer, samt dehydrering og polyuri."}]},{"type":"paragraph","content":[{"type":"text","text":"Grensen for toksisk område er satt til 4 × øvre grense for referanseområdet (≥ 1600 nmol/L)'
    ', en felles grense for alle antihypertensivene."}]},{"type":"paragraph","content":[{"type":"text","text":"Det foreligger ikke data for å fastslå et toksisk konsentrasjonsområde for bumetanid. Grensen på 4 × øvre referanseområde er en standardisert toksisitetsgrense som brukes for alle AHT-analytter. OBS referanseområdet for bumetanid er Cmax. Den kliniske situasjonen er alltid styrende for behandl'
    'ingen."}]}]}}'::jsonb
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
    'data', '{"rader":[{"dose":"0,5 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"6–9 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"2 mg","regime":"Gjennomsnitt ved steady state","konsentrasjon":"26–36 nmol/L","merknad":"Beregnet fra clearance ± 1 SD (Hiemkes formel)."},{"dose":"1 mg","regime":"Cmaks (målt)","konsentrasjon":"51 nmol/L","merknad":"Målt i IDA-studi'
    'en, n = 1."}]}'::jsonb,
    'referanser', jsonb_build_array(referanse_3, referanse_1)
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