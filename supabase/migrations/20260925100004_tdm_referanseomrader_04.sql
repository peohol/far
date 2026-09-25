-- HALO
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'HALO' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Haloperidol');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 21, 22, 41', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Haloperidol"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 21, 22, 41', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'HALO',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 21, 22, 41', true);

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
    'data', '{"nedre":2,"ovre":25,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '2'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '25'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'HALO', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'HALO', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 21, 22, 41', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 21, 22, 41', true);
    end if;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rett før neste dose, det vil si 12–24 timer etter siste dose."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Referanseområdet bygger på serumkonsentrasjoner målt hos pasienter som brukte 1–20 mg peroralt daglig: 10- og 90-persentilen, rundet utover til runde tall, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007)."}]},{"type":"paragraph","content":[{"type":"'
    'text","text":"Området viser hvilke konsentrasjoner som er vanlige ved anbefalte doser, og er ikke et dokumentert terapeutisk område."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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

-- KLORP
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'KLORP' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Klorprotiksen');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 22, 41, 45', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Klorprotiksen"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 22, 41, 45', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'KLORP',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 22, 41, 45', true);

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
    'data', '{"nedre":10,"ovre":100,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '10'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '100'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'KLORP', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'KLORP', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 22, 41, 45', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 22, 41, 45', true);
    end if;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rett før neste dose, det vil si 12–24 timer etter siste dose."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Referanseområdet bygger på serumkonsentrasjoner målt hos pasienter som brukte 15–300 mg daglig: 10- og 90-persentilen, rundet utover til runde tall, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007)."}]},{"type":"paragraph","content":[{"type":"text","'
    'text":"Klorprotiksen brukes i dag mest som tilleggsmedikasjon, i lavere doser enn da det ble brukt som primært antipsykotikum. Referanseområdet tar utgangspunkt i dosene som brukes i dag, og er derfor vesentlig lavere enn de tidligere områdene (100–800 og 150–1000 nmol/L)."}]},{"type":"paragraph","content":[{"type":"text","text":"Området viser hvilke konsentrasjoner som er vanlige ved anbefalte do'
    'ser, og er ikke et dokumentert terapeutisk område."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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

-- KLOSUM
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  side_1 uuid;
  referanse_0 uuid;
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'KLOSUM' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Klomipramin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Klomipramin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
    select s.objekt_id into side_1 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Desmetylklomipramin');
    if side_1 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);
      side_1 := (public.opprett_utkast('infoside', '{"navn":"Desmetylklomipramin"}'::jsonb)).id;
      nye := nye || side_1;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'KLOSUM',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0, side_1)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);

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
    'data', '{"nedre":700,"ovre":1500,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '700'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '1500'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'KLOSUM', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'KLOSUM', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 9, 13, 14, 40', true);
    end if;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rett før neste dose, det vil si 12–24 timer etter siste dose."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"For trisykliske antidepressiva er referanseområdet satt ut fra litteraturen, ikke ut fra laboratoriedata, og det videste av områdene de to laboratoriene brukte, ble valgt. Sammenhengen mellom konsentrasjon og effekt er best vist for nortriptylin, deretter amitriptylin'
    ' og til en viss grad klomipramin. Øvre grense settes i stor grad av doseavhengig toksisitet."}]},{"type":"paragraph","content":[{"type":"text","text":"Området gjelder summen av klomipramin og desmetylklomipramin."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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

-- KLOZ
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'KLOZ' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'referanseomradeprosjektet';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Klozapin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 23, 41', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Klozapin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 23, 41', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'KLOZ',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 23, 41', true);

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
    'data', '{"nedre":300,"ovre":2500,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = '300'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '2500'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'KLOZ', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'KLOZ', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 23, 41', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 23, 41', true);
    end if;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rett før neste dose, det vil si 12–24 timer etter siste dose."}]}]}}'::jsonb,
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
    'data', '{"tittel":"Grunnlag for referanseområdet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Referanseområdet bygger på serumkonsentrasjoner målt hos pasienter som brukte 100–900 mg daglig: 10- og 90-persentilen, rundet utover til runde tall, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007)."}]},{"type":"paragraph","content":[{"type":"text",'
    '"text":"Området viser hvilke konsentrasjoner som er vanlige ved anbefalte doser, og er ikke et dokumentert terapeutisk område."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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

-- KOD
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'KOD' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serumkonsentrasjonsmålinger av vanedannende legemidler' and r.lenke = 'https://tidsskriftet.no/sites/default/files/pdf2016--400-2.pdf'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'helland2016';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Kodein');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Kodein"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'KOD',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);

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
    'data', '{"nedre":null,"ovre":850,"enhet":"nmol/L","forbehold":""}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  elsif not (coalesce(innhold -> 'data' -> 'nedre', 'null') = 'null'::jsonb
      and coalesce(innhold -> 'data' -> 'ovre', 'null') = '850'::jsonb
      and coalesce(innhold -> 'data' ->> 'enhet', '') = 'nmol/L') then
    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', 'KOD', 'referanseomrade';
  elsif not publisert then
    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', 'KOD', 'referanseomrade';
  else
    kilder := coalesce(innhold -> 'referanser', '[]');
    if not kilder ? referanse_0::text then kilder := kilder || to_jsonb(referanse_0::text); end if;
    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then
      perform set_config('far.revisjonskilde', 'Kilde lagt til: Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));
      perform public.publiser_utkast(kort, revisjon + 1);
      perform set_config('far.revisjonskilde', 'Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2', true);
    end if;
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
    'data', '{"tittel":"Prøvetakingstidspunkt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Medikamentfastende, det vil si like før neste dose. Prøver tatt nær toppkonsentrasjonen er misvisende og kan ikke sammenlignes med referansegrensen."}]},{"type":"paragraph","content":[{"type":"text","text":"Dosering, tidspunkt for siste inntak og tidspunkt for prøvetaking må '
    'stå på rekvisisjonen, så laboratoriet kan tolke svaret."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Referansegrense»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Referansegrense'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 1,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Referansegrense","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Øvre referansegrense 850 nmol/L er den øvre forventede medikamentfastende konsentrasjonen ved døgndose 240 mg, høyeste døgndose i godkjent preparatomtale."}]},{"type":"paragraph","content":[{"type":"text","text":"Det er ikke satt noen nedre grense, siden konsentrasjonen bør holdes '
    'så lav som mulig. Laveste effektive dose bør tilstrebes."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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
    'data', '{"tittel":"Tolkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pasienter som holder seg innenfor anbefalt dosering, har i de aller fleste tilfeller medikamentfastende konsentrasjoner under referansegrensen. Konsentrasjoner over grensen kan tyde på høyere doser enn anbefalt, gitt at feil prøvetakingstidspunkt er utelukket."}]},{"type":"paragraph","con'
    'tent":[{"type":"text","text":"Variasjonen mellom pasienter er stor. Nedsatt organfunksjon og aldersrelaterte endringer kan gi høyere konsentrasjon, mens interaksjoner og genetiske forskjeller i metabolismen kan gi både høyere og lavere konsentrasjon enn ventet."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved tvil om tolkningen, eller om hvordan prøven skal tas, bør det utførende labo'
    'ratoriet kontaktes, gjerne før prøven tas."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- tdm/kinetikkort «Indikasjoner for måling»
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'tdm'
      and e.elementtype = 'kinetikkort' and (e.data ->> 'tittel') is not distinct from 'Indikasjoner for måling'
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'tdm',
    'posisjon', 3,
    'elementtype', 'kinetikkort',
    'data', '{"tittel":"Indikasjoner for måling","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serumkonsentrasjonsmåling kan være nyttig ved:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kontroll av medikamentetterlevelse, som er den vanligste grunnen"}]}]},{"type":"listItem","content":[{"type'
    '":"paragraph","content":[{"type":"text","text":"Terapisvikt ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Uventede eller uttalte bivirkninger ved standard dosering"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ruspåvirkning, mistanke om overdosering eller intoksikasjon"}]}]},{"type":"listI'
    'tem","content":[{"type":"paragraph","content":[{"type":"text","text":"Misbruksdiagnostikk (urinprøver er oftest bedre egnet)"}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
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