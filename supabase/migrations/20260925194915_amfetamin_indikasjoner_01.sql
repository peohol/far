-- Referansene
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- fk-attentin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Attentin «Medice»' and r.lenke = 'https://www.felleskatalogen.no/medisin/attentin-medice-602877'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Attentin «Medice»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/attentin-medice-602877"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-dexatin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexatin «Abboxia»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexatin-abboxia-750402'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Dexatin «Abboxia»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/dexatin-abboxia-750402"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-dexfarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexfarm «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexfarm-orifarm-healthcare-754521'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Dexfarm «Orifarm Healthcare»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/dexfarm-orifarm-healthcare-754521"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-elvanse
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Elvanse «Takeda»' and r.lenke = 'https://www.felleskatalogen.no/medisin/elvanse-takeda-588199'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Elvanse «Takeda»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/elvanse-takeda-588199"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-balidax
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Balidax «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/balidax-teva-728889'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Balidax «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/balidax-teva-728889"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-dexhility
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexhility «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexhility-sandoz-781874'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Dexhility «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/dexhility-sandoz-781874"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-silarosa
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Silarosa «FrostPharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/silarosa-frostpharma-743290'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Silarosa «FrostPharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/silarosa-frostpharma-743290"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-aduvanz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Aduvanz «Takeda»' and r.lenke = 'https://www.felleskatalogen.no/medisin/aduvanz-takeda-643161'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Aduvanz «Takeda»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/aduvanz-takeda-643161"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-volidax
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Volidax «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/volidax-teva-729320'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Volidax «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/volidax-teva-729320"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- AMF1
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
    where a.kode = 'AMF1' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Attentin «Medice»' and r.lenke = 'https://www.felleskatalogen.no/medisin/attentin-medice-602877'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-attentin';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexatin «Abboxia»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexatin-abboxia-750402'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-dexatin';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexfarm «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexfarm-orifarm-healthcare-754521'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-dexfarm';
  end if;
  referanse_3 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Elvanse «Takeda»' and r.lenke = 'https://www.felleskatalogen.no/medisin/elvanse-takeda-588199'
     order by r.objekt_id limit 1);
  if referanse_3 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-elvanse';
  end if;
  referanse_4 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Balidax «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/balidax-teva-728889'
     order by r.objekt_id limit 1);
  if referanse_4 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-balidax';
  end if;
  referanse_5 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dexhility «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dexhility-sandoz-781874'
     order by r.objekt_id limit 1);
  if referanse_5 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-dexhility';
  end if;
  referanse_6 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Silarosa «FrostPharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/silarosa-frostpharma-743290'
     order by r.objekt_id limit 1);
  if referanse_6 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-silarosa';
  end if;
  referanse_7 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Aduvanz «Takeda»' and r.lenke = 'https://www.felleskatalogen.no/medisin/aduvanz-takeda-643161'
     order by r.objekt_id limit 1);
  if referanse_7 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-aduvanz';
  end if;
  referanse_8 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Volidax «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/volidax-teva-729320'
     order by r.objekt_id limit 1);
  if referanse_8 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-volidax';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Amfetamin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Amfetamin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'AMF1',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Deksamfetamin (Attentin, Dexatin, Dexfarm): barn og ungdom 6–17 år med ADHD, som del av et omfattende behandlingsprogram, når respons på tidligere behandling med metylfenidat anses som klinisk uegnet. Behandlingen skal være under oppsyn av spesialist innen atferdsforstyrrelser hos barn og/eller ungdom."}]},{'
    '"type":"paragraph","content":[{"type":"text","text":"Lisdeksamfetamin, som del av et omfattende behandlingsprogram ved ADHD, under tilsyn av spesialist innen atferdsforstyrrelser:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Elvanse, Balidax og Dexhility: barn ≥6 år når respons på tidligere metylfenidatbehandling ikke anses'
    ' som klinisk tilstrekkelig, og voksne med symptomer på ADHD i barndommen."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Silarosa: bare barn ≥6 år, når respons på tidligere metylfenidatbehandling ikke anses som klinisk tilstrekkelig."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Aduvanz og Volidax: bare voksne."'
    '}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Hos voksne skal symptomene på ADHD ha vært til stede i barndommen og kunne bekreftes retrospektivt, og pasienten skal minst ha ADHD av moderat alvorlighetsgrad, med minst moderat funksjonssvekkelse i to eller flere situasjoner."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2, referanse_3, referanse_4, referanse_5, referanse_6, referanse_7, referanse_8)
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