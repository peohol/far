-- Bupropion og Paliperidon blir stoffsider under stoffets eget navn og nøkkel.
--
-- To fagsider ble laget med laboratorieanalyttens navn: «Hydroksybupropion»
-- (HBUP) og «Paliperidon (hydroksyrisperidon)» (PALI). Innholdet handler om
-- legemidlene, så sidene får stoffets navn og nøkkel (bupropion,
-- paliperidon) — de samme objektene, med innholdet og historikken de har.
-- Sidene finnes etter navnet, ikke gjennom noen analytt. Koblingen mellom
-- analyttene og stoffene står i stoffregisteret (src/data/stoffregister.json).
--
-- Laboratorieanalyttene beholder det de faktisk måler. Sidene var også
-- analyttenes målte komponent (`analyttkomponenter`), så et nytt navn på
-- siden ville gjort komponenten om til et annet stoff:
--
-- - HBUP måler hydroksybupropion, ikke bupropion. Komponenten flyttes derfor
--   til et eget objekt, «Hydroksybupropion», som lages (og publiseres) når
--   det ikke finnes. Hovedsiden er fortsatt Bupropion-siden.
-- - PALI måler paliperidon, som er hydroksyrisperidon: det nye navnet
--   gjelder det samme stoffet, og komponenten står.
--
-- Migrasjonen gjør ingenting uten administratoren (som i testdatabasen), med
-- sider eller analytter som ikke er fullt publisert, når stoffets navn eller
-- nøkkel alt brukes av en annen side, eller når den kjøres igjen. Krever
-- stoffidentitet (nøkkelen på sidene).
do $kanoniske_stoffsider$
declare
  administrator uuid;
  m record;
  side record;
  analytt record;
  stoffside uuid;
  eksisterende uuid;
  komponentside uuid;
  status public.objektstatus;
begin
  select p.id into administrator
  from public.profiles p
  where p.username = 'peohol' and p.role = 'admin';

  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så omarbeidingen hoppes over.', 'peohol';
    return;
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', administrator, 'role', 'authenticated')::text,
    true
  );
  perform set_config(
    'far.revisjonskilde',
    'Stoffside: fagsiden fikk stoffets navn og nøkkel i stedet for analyttens',
    true
  );

  -- `malt_av`: analytten som måler stoffet med det gamle navnet, og som
  -- derfor skal beholde det som komponent (se over).
  for m in
    select * from (values
      ('Hydroksybupropion', 'Bupropion', 'bupropion', 'HBUP'),
      ('Paliperidon (hydroksyrisperidon)', 'Paliperidon', 'paliperidon', null)
    ) as t(gammelt_navn, nytt_navn, ny_slug, malt_av)
  loop
    side := null;
    select
      i.objekt_id as id,
      u.revisjon,
      r.innhold
    into side
    from public.infosider i
    join public.objekttilstander u
      on u.objekt_id = i.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p
      on p.objekt_id = i.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r
      on r.objekt_id = i.objekt_id and r.revisjon = u.revisjon
    where i.tilstand = 'utkast' and lower(i.navn) = lower(m.gammelt_navn);

    if side.id is null then
      raise notice 'Fant ingen fullt publisert side %, så den omdøpes ikke.', m.gammelt_navn;
    else
      eksisterende := null;
      select i.objekt_id into eksisterende
      from public.infosider i
      where i.tilstand = 'utkast'
        and (lower(i.navn) = lower(m.nytt_navn) or i.slug = m.ny_slug)
        and i.objekt_id <> side.id
      limit 1;

      if eksisterende is not null then
        raise notice '% finnes alt som en annen side, så % omarbeides ikke automatisk.', m.nytt_navn, m.gammelt_navn;
        continue;
      end if;

      status := public.lagre_utkast(
        side.id,
        side.revisjon,
        side.innhold || jsonb_build_object('navn', m.nytt_navn, 'slug', m.ny_slug)
      );
      perform public.publiser_utkast(side.id, status.revisjon);
    end if;

    if m.malt_av is null then
      continue;
    end if;

    -- Stoffsiden, etter nøkkelen: også når den ble omdøpt i en tidligere kjøring.
    stoffside := null;
    select i.objekt_id into stoffside
    from public.infosider i
    where i.tilstand = 'utkast' and i.slug = m.ny_slug and lower(i.navn) = lower(m.nytt_navn);

    analytt := null;
    select
      a.objekt_id as id,
      u.revisjon,
      r.innhold
    into analytt
    from public.laboratorieanalytter a
    join public.objekttilstander u
      on u.objekt_id = a.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p
      on p.objekt_id = a.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r
      on r.objekt_id = a.objekt_id and r.revisjon = u.revisjon
    where a.tilstand = 'utkast' and a.kode = m.malt_av;

    if stoffside is null or analytt.id is null
      or not (analytt.innhold -> 'komponenter') @> jsonb_build_array(stoffside) then
      continue;
    end if;

    komponentside := null;
    select i.objekt_id into komponentside
    from public.infosider i
    where i.tilstand = 'utkast' and lower(i.navn) = lower(m.gammelt_navn);

    if komponentside is null then
      status := public.opprett_utkast('infoside', jsonb_build_object('navn', m.gammelt_navn));
      komponentside := status.id;
      perform public.publiser_utkast(status.id, status.revisjon);
    end if;

    -- Bare stoffsiden byttes ut; andre komponenter og rekkefølgen står.
    status := public.lagre_utkast(
      analytt.id,
      analytt.revisjon,
      analytt.innhold || jsonb_build_object(
        'komponenter',
        (
          select jsonb_agg(
            case when k.id = to_jsonb(stoffside) then to_jsonb(komponentside) else k.id end
            order by k.nr
          )
          from jsonb_array_elements(analytt.innhold -> 'komponenter') with ordinality as k(id, nr)
        )
      )
    );
    perform public.publiser_utkast(analytt.id, status.revisjon);
  end loop;
end
$kanoniske_stoffsider$;
