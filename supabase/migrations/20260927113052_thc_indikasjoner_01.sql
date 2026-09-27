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
  -- fk-sativex-cnx
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sativex «CNX Therapeutics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sativex-cnx-therapeutics-578991'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sativex «CNX Therapeutics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sativex-cnx-therapeutics-578991"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sativex-2care4
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sativex «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sativex-2care4-596276'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sativex «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sativex-2care4-596276"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- THC
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
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
    where a.kode = 'THC' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sativex «CNX Therapeutics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sativex-cnx-therapeutics-578991'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sativex-cnx';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sativex «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sativex-2care4-596276'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-sativex-2care4';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('THC');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"THC"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'THC',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 27.09.2026', true);
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"THC (delta-9-tetrahydrocannabinol, i FEST kalt dronabinol) finnes som godkjent legemiddel i Sativex munnspray, sammen med cannabidiol (CBD): 2,7 mg THC og 2,5 mg CBD per dose."}]},{"type":"paragraph","content":[{"type":"text","text":"Sativex: behandling for symptomforbedring hos voksne med moderat til alvorl'
    'ig spastisitet grunnet multippel sklerose (MS) som ikke har respondert tilstrekkelig på andre antispastiske midler, og som viser klinisk signifikant forbedring av spastisitetsrelaterte symptomer under en initial prøvebehandling."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1)
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