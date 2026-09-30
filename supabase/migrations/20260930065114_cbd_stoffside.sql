-- Cannabidiolsiden heter «CBD», med nøkkelen «cbd», som THC-siden.
--
-- Siden ble laget som «Cannabidiol» (cannabidiol) av indikasjonsimporten.
-- Stoffregisteret (src/data/stoffregister.json) har nå stoffet under navnet
-- CBD, med «cannabidiol» som alias, så gamle adresser og søk fører hit. Siden
-- beholder objektet, innholdet og historikken; bare navnet og nøkkelen byttes.
-- Favorittene følger nøkkelen av seg selv (intern.stoffavoritter_folg_nokkel).
--
-- Migrasjonen gjør ingenting uten administratoren (som i testdatabasen), når
-- siden ikke er fullt publisert, når navnet eller nøkkelen alt brukes av en
-- annen side, eller når den kjøres igjen. Krever stoffidentitet (nøkkelen på
-- sidene).
do $cbd_stoffside$
declare
  administrator uuid;
  m record;
  side record;
  status public.objektstatus;
begin
  select p.id into administrator
  from public.profiles p
  where p.username = 'peohol' and p.role = 'admin';

  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så omdøpingen hoppes over.', 'peohol';
    return;
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', administrator, 'role', 'authenticated')::text,
    true
  );
  perform set_config('far.revisjonskilde', 'Stoffside: fagsiden fikk stoffets navn og nøkkel fra stoffregisteret', true);

  for m in
    select * from (values
      ('Cannabidiol', 'CBD', 'cbd')
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
      raise notice 'Fant ingen fullt publisert side %, så den omdøpes ikke.', m.gammelt_navn;
      continue;
    end if;

    if exists (
      select 1 from public.infosider i
      where i.tilstand = 'utkast'
        and (lower(i.navn) = lower(m.nytt_navn) or i.slug = m.ny_slug)
        and i.objekt_id <> side.id
    ) then
      raise notice '% finnes alt som en annen side, så % omdøpes ikke automatisk.', m.nytt_navn, m.gammelt_navn;
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
$cbd_stoffside$;