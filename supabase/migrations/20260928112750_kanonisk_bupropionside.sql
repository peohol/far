-- Laboratorieanalytter kobles til kanoniske stoffsider uten å miste analyttidentiteten.
do $kanoniske_stoffsider$
declare
  administrator uuid;
  m record;
  analytt record;
  side record;
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
    'Kanonisk stoffside: skilt virkestoffets fagsside fra laboratorieanalytten',
    true
  );

  for m in
    select * from (values
      ('HBUP', 'Hydroksybupropion', 'Bupropion', true),
      ('PALI', 'Paliperidon (hydroksyrisperidon)', 'Paliperidon', false)
    ) as t(kode, gammelt_navn, nytt_navn, behold_gammelt_som_komponent)
  loop
    analytt := null;
    select
      a.objekt_id as id,
      u.revisjon,
      r.innhold,
      a.hovedside_id
    into analytt
    from public.laboratorieanalytter a
    join public.objekttilstander u
      on u.objekt_id = a.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p
      on p.objekt_id = a.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r
      on r.objekt_id = a.objekt_id and r.revisjon = u.revisjon
    where a.tilstand = 'utkast' and a.kode = m.kode;

    if analytt.id is null then
      raise notice 'Fant ingen fullt publisert analytt %, så den hoppes over.', m.kode;
      continue;
    end if;

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
    where i.tilstand = 'utkast' and i.objekt_id = analytt.hovedside_id;

    if side.id is null then
      raise notice '% har ingen fullt publisert hovedside, så den hoppes over.', m.kode;
      continue;
    end if;

    if lower(side.innhold ->> 'navn') = lower(m.gammelt_navn) then
      eksisterende := null;
      select i.objekt_id into eksisterende
      from public.infosider i
      where i.tilstand = 'utkast'
        and lower(i.navn) = lower(m.nytt_navn)
        and i.objekt_id <> side.id
      limit 1;

      if eksisterende is not null then
        raise notice '% finnes alt som en annen side, så % omarbeides ikke automatisk.', m.nytt_navn, m.kode;
        continue;
      end if;

      status := public.lagre_utkast(
        side.id,
        side.revisjon,
        side.innhold || jsonb_build_object('navn', m.nytt_navn)
      );
      perform public.publiser_utkast(side.id, status.revisjon);
    elsif lower(side.innhold ->> 'navn') <> lower(m.nytt_navn) then
      raise notice '% har den uventede hovedsiden %, så den hoppes over.', m.kode, side.innhold ->> 'navn';
      continue;
    end if;

    -- HBUP analyserer hydroksybupropion, selv om fagssiden handler om
    -- virkestoffet bupropion. Behold derfor en egen komponentside for det
    -- laboratoriet faktisk måler.
    if m.behold_gammelt_som_komponent then
      komponentside := null;
      select i.objekt_id into komponentside
      from public.infosider i
      where i.tilstand = 'utkast' and lower(i.navn) = lower(m.gammelt_navn)
      limit 1;

      if komponentside is null then
        status := public.opprett_utkast('infoside', jsonb_build_object('navn', m.gammelt_navn));
        komponentside := status.id;
        perform public.publiser_utkast(status.id, status.revisjon);
      end if;

      status := public.lagre_utkast(
        analytt.id,
        analytt.revisjon,
        analytt.innhold || jsonb_build_object('komponenter', jsonb_build_array(komponentside))
      );
      perform public.publiser_utkast(analytt.id, status.revisjon);
    end if;
  end loop;
end
$kanoniske_stoffsider$;