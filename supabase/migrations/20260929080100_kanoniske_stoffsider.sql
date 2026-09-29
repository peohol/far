-- Bupropion og Paliperidon blir stoffsider under stoffets eget navn og nøkkel.
--
-- To fagsider ble laget med laboratorieanalyttens navn: «Hydroksybupropion»
-- (HBUP) og «Paliperidon (hydroksyrisperidon)» (PALI). Innholdet handler om
-- legemidlene, så sidene får stoffets navn og nøkkel (bupropion,
-- paliperidon) — de samme objektene, med innholdet og historikken de har.
-- Sidene finnes etter navnet, ikke gjennom noen analytt, og ingen analytt
-- endres: koblingen mellom analyttene og stoffene står i stoffregisteret
-- (src/data/stoffregister.json). Hydroksybupropion er et annet navn på
-- stoffet Bupropion der, ikke en egen side.
--
-- Migrasjonen gjør ingenting uten administratoren (som i testdatabasen), med
-- sider som ikke er fullt publisert, når stoffets navn eller nøkkel alt
-- brukes av en annen side, eller når den kjøres igjen. Krever stoffidentitet
-- (nøkkelen på sidene).
do $kanoniske_stoffsider$
declare
  administrator uuid;
  m record;
  side record;
  eksisterende uuid;
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

  for m in
    select * from (values
      ('Hydroksybupropion', 'Bupropion', 'bupropion'),
      ('Paliperidon (hydroksyrisperidon)', 'Paliperidon', 'paliperidon')
    ) as t(gammelt_navn, nytt_navn, ny_slug)
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
      raise notice 'Fant ingen fullt publisert side %, så den hoppes over.', m.gammelt_navn;
      continue;
    end if;

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
  end loop;
end
$kanoniske_stoffsider$;
