-- Kursendringen: preparatnavnene og datoen for kontroll mot Felleskatalogen tas bort
do $kursendring$
declare
  administrator uuid;
  e record;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  for e in
    select u.objekt_id, u.revisjon, r.innhold
    from public.objekttilstander u
    join public.objekttilstander p on p.objekt_id = u.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = u.objekt_id and r.revisjon = u.revisjon
    join public.objektrevisjoner forste on forste.objekt_id = u.objekt_id and forste.revisjon = 1
    join public.redigerbare_objekter o on o.id = u.objekt_id and o.type = 'innholdselement'
    where u.tilstand = 'utkast'
      and u.revisjon = 1
      and forste.kilde like 'Hentet fra Felleskatalogen %'
      and r.innhold->>'panel' <> 'fjernet'
    order by u.objekt_id
  loop
    if e.innhold->>'elementtype' = 'preparater' then
      perform set_config('far.revisjonskilde', 'Tatt bort: preparatnavnene skal hentes fra offentlige legemiddeldata', true);
      perform public.lagre_utkast(e.objekt_id, e.revisjon, jsonb_set(e.innhold, '{panel}', '"fjernet"'));
    elsif e.innhold->'data' ? 'kontrollert' then
      perform set_config('far.revisjonskilde', 'Tatt bort: datoen for kontroll mot Felleskatalogen', true);
      perform public.lagre_utkast(e.objekt_id, e.revisjon, e.innhold #- '{data,kontrollert}');
    else
      continue;
    end if;
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$kursendring$;