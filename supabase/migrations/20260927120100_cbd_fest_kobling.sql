-- Stoffsidene kobles til virkestoffene i FEST
do $kobling$
declare
  administrator uuid;
  k record;
  side uuid;
  virkestoff jsonb;
  status public.objektstatus;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', 'Koblet til virkestoffet i FEST', true);

  for k in
    select t.side, array_agg(t.fest_id order by t.nr) as fest_ider
    from (values
      ('Cannabidiol', 'ID_FFF3536F-BE29-4191-A09A-ABC119C37984', 0)
    ) as t(side, fest_id, nr)
    group by t.side
    order by min(t.nr)
  loop
    side := (select i.objekt_id from public.infosider i where i.tilstand = 'publisert' and i.navn = k.side);
    if side is null then
      raise notice 'Fant ingen publisert side %, så den hoppes over.', k.side;
      continue;
    end if;
    if exists (
      select 1 from public.innholdselementer e
      where e.infoside_id = side and e.elementtype = 'legemiddelkobling' and e.panel <> 'fjernet'
    ) then
      raise notice '% er alt koblet til legemiddeldataene, så den hoppes over.', k.side;
      continue;
    end if;
    virkestoff := (
      select jsonb_agg(jsonb_build_object('fest_id', v.fest_id, 'navn', v.navn) order by array_position(k.fest_ider, v.fest_id))
      from legemiddeldata.virkestoff v where v.fest_id = any(k.fest_ider) and v.utgatt_kl is null
    );
    if coalesce(jsonb_array_length(virkestoff), 0) < cardinality(k.fest_ider) then
      raise notice 'Noen av virkestoffene % for % finnes ikke i FEST.', k.fest_ider, k.side;
    end if;
    if virkestoff is null then
      raise notice 'Ingen av virkestoffene for % finnes i FEST, så siden hoppes over.', k.side;
      continue;
    end if;

    status := public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side,
      'panel', 'preparater',
      'posisjon', 0,
      'elementtype', 'legemiddelkobling',
      'data', jsonb_build_object('virkestoff', virkestoff)
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$kobling$;