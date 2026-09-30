-- Farmakodynamikken som mekanismekort (docs/farmakodynamikk-kort-kartlegging.md)
do $farmakodynamikk$
declare
  administrator uuid;
  konvertering jsonb;
  side uuid;
  e record;
  kort jsonb;
  posisjon bigint;
  objekt uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  for konvertering in select * from jsonb_array_elements('[{"stoff":"vortioksetin","fra":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Modulerer serotonerg reseptoraktivitet og hemmer serotonin-transportøren. I tillegg sannsynligvis multimodal påvirkning av noradrenalin, dopamin, histamin, acetylkolin, GABA og glutamat. Antagonist på 5-HT"},{"type":"text","text":"3","marks":[{"type":"subscript"}]},{"type":"text","text":"-'
    ', 5-HT"},{"type":"text","text":"7","marks":[{"type":"subscript"}]},{"type":"text","text":" - og 5-HT"},{"type":"text","text":"1D","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Partiell agonist på 5-HT"},{"type":"text","text":"1B","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptor. Agonist på 5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"typ'
    'e":"text","text":"-reseptor."}]}]},"kort":[{"maal":"Serotonintransportør / SERT","effekt":"Hemmer transportøren","mekanisme":"transporterhemming","retning":"ned","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"I tillegg sannsynligvis multimodal påvirkning av noradrenalin, dopamin, histamin, acetylkolin, GABA og glutamat."}]}]}},{"maal":"5-HT3-reseptor","ef'
    'fekt":"Antagonist","mekanisme":"antagonisme","retning":"ned"},{"maal":"5-HT7-reseptor","effekt":"Antagonist","mekanisme":"antagonisme","retning":"ned"},{"maal":"5-HT1D-reseptor","effekt":"Antagonist","mekanisme":"antagonisme","retning":"ned"},{"maal":"5-HT1B-reseptor","effekt":"Partiell agonist","mekanisme":"partiell_agonisme","retning":"opp"},{"maal":"5-HT1A-reseptor","effekt":"Agonist","mekanism'
    'e":"agonisme","retning":"opp","merknad":"Ikke klassifiser som full agonist uten mer dokumentasjon"}]},{"stoff":"ziprasidon","fra":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Antagonist til både 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"- og D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text",'
    '"text":"-reseptorer. Høy affinitet for D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer og vesentlig høyere affinitet for 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Interagerer også med 5-HT"},{"type":"text","text":"2C","marks":[{"type":"subscript"}]},{"type":"text","text":"-, 5-HT"},{"type":'
    '"text","text":"1D","marks":[{"type":"subscript"}]},{"type":"text","text":"- og 5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer med lik eller større affinitet enn den for D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":". Moderat affinitet for nevronale serotonin- og noradrenalintransportører. Moderat affinitet'
    ' for H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"- og α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Ubetydelig affinitet for M"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer."}]},{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: ziprasid'
    'onsulfon (usikker betydning)"}]}]},"kort":[{"maal":"5-HT2A-reseptor","effekt":"Antagonist","mekanisme":"antagonisme","retning":"ned","kvalifikasjon":"Svært høy affinitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Aktiv metabolitt: ziprasidonsulfon (usikker betydning)"}]}]}},{"maal":"D2-reseptor","effekt":"Antagonist","mekanisme":"antagonisme","retnin'
    'g":"ned","kvalifikasjon":"Høy affinitet"},{"maal":"5-HT2C-reseptor","effekt":"Binder / interagerer","mekanisme":"reseptorbinding","retning":"ukjent","merknad":"Affinitet lik eller større enn for D2"},{"maal":"5-HT1D-reseptor","effekt":"Binder / interagerer","mekanisme":"reseptorbinding","retning":"ukjent","merknad":"Affinitet lik eller større enn for D2"},{"maal":"5-HT1A-reseptor","effekt":"Binder'
    ' / interagerer","mekanisme":"reseptorbinding","retning":"ukjent","merknad":"Affinitet lik eller større enn for D2"},{"maal":"Serotonintransportør / SERT","effekt":"Moderat affinitet","mekanisme":"transportorpavirkning","retning":"ukjent","merknad":"Ikke kall dette transporterhemming ut fra dagens tekst alene"},{"maal":"Noradrenalintransportør / NET","effekt":"Moderat affinitet","mekanisme":"transp'
    'ortorpavirkning","retning":"ukjent","merknad":"Ikke kall dette transporterhemming ut fra dagens tekst alene"},{"maal":"H1-reseptor","effekt":"Moderat affinitet","mekanisme":"reseptorbinding","retning":"ukjent"},{"maal":"α1-reseptor","effekt":"Moderat affinitet","mekanisme":"reseptorbinding","retning":"ukjent"},{"maal":"M1-reseptor","effekt":"Ubetydelig effekt","mekanisme":"ingen_effekt","retning":'
    '"ingen","kvalifikasjon":"Ubetydelig affinitet"}]},{"stoff":"zuklopentiksol","fra":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Virker hovedsakelig gjennom blokade av sentrale monaminerge reseptorer, spesielt i det dopaminerge system. Høy affinitet for D"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-, D"},{"type":"text","text":'
    '"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-, α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"- og 5-HT"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Kun svak antihistaminerg effekt."}]}]},"kort":[{"maal":"D1-reseptor","effekt":"Blokade / antagonistisk effekt","mekanisme":"antagonisme","retning":'
    '"ned","kvalifikasjon":"Høy affinitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Virker hovedsakelig gjennom blokade av sentrale monaminerge reseptorer, spesielt i det dopaminerge system."}]}]}},{"maal":"D2-reseptor","effekt":"Blokade / antagonistisk effekt","mekanisme":"antagonisme","retning":"ned","kvalifikasjon":"Høy affinitet"},{"maal":"α1-resepto'
    'r","effekt":"Blokade / antagonistisk effekt","mekanisme":"antagonisme","retning":"ned","kvalifikasjon":"Høy affinitet"},{"maal":"5-HT2-reseptor","effekt":"Blokade / antagonistisk effekt","mekanisme":"antagonisme","retning":"ned","kvalifikasjon":"Høy affinitet"},{"maal":"Histaminreseptorer","effekt":"Svak antihistaminerg effekt","mekanisme":"reseptorpavirkning","retning":"ukjent"}]}]'::jsonb) loop
    select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = konvertering->>'stoff';

    -- Teksten slik den ble importert, uten upublisert utkast.
    select u.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakodynamikk' and t.elementtype = 'riktekst'
      and r.innhold->'data'->'dokument' = konvertering->'fra'
    order by t.posisjon, t.objekt_id
    limit 1;
    if not found then
      raise notice 'Gjør ikke om farmakodynamikken på %: fant ikke teksten slik den ble importert, eller den har et upublisert utkast.',
        konvertering->>'stoff';
      continue;
    end if;

    -- Kortene, i rekkefølge, med kildene til teksten.
    perform set_config('far.revisjonskilde', 'Farmakodynamikken strukturert som mekanismekort etter kartleggingen i docs/farmakodynamikk-kort-kartlegging.md', true);
    for kort, posisjon in select k, i - 1 from jsonb_array_elements(konvertering->'kort') with ordinality as a(k, i) loop
      objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
        'infoside', side,
        'panel', 'farmakodynamikk',
        'posisjon', posisjon,
        'elementtype', 'mekanismekort',
        'data', kort
      ) || jsonb_strip_nulls(jsonb_build_object('referanser', e.innhold->'referanser')))).id;
      perform public.publiser_utkast(objekt, 1);
    end loop;

    -- Teksten tas bort fra siden, men står i historikken.
    perform set_config('far.revisjonskilde', 'Farmakodynamikkteksten erstattet av mekanismekort etter kartleggingen i docs/farmakodynamikk-kort-kartlegging.md', true);
    perform public.lagre_utkast(e.objekt_id, e.revisjon, jsonb_set(e.innhold, '{panel}', to_jsonb('fjernet'::text)));
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$farmakodynamikk$;