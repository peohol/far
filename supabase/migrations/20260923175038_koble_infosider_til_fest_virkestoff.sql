
do $$
declare
  admin_id uuid;
  side record;
  element_id uuid;
  gjeldende_revisjon integer;
  status public.objektstatus;
  innhold jsonb;
begin
  select p.id into admin_id
  from public.profiles p
  where p.username = 'peohol' and p.role = 'admin';

  if admin_id is null then
    raise exception 'Fant ikke adminprofilen peohol.';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  for side in
    with kandidater as (
      select
        i.objekt_id as infoside_id,
        i.navn as sidenavn,
        case
          when lower(i.navn) = 'hydroksyrisperidon' then 'Paliperidon'
          when lower(i.navn) = 'o-desmetylvenlafaksin' then 'Desvenlafaksin'
          else btrim(regexp_replace(i.navn, '\s*\([^)]*\)\s*$', ''))
        end as fest_navn
      from public.infosider i
      where i.tilstand = 'publisert'
    )
    select
      k.infoside_id,
      k.sidenavn,
      v.fest_id,
      v.navn as fest_navn
    from kandidater k
    join legemiddeldata.virkestoff v
      on lower(v.navn) = lower(k.fest_navn)
     and v.utgatt_kl is null
    order by k.sidenavn
  loop
    innhold := jsonb_build_object(
      'infoside', side.infoside_id,
      'panel', 'preparater',
      'posisjon', 0,
      'elementtype', 'legemiddelkobling',
      'data', jsonb_build_object(
        'virkestoff', jsonb_build_array(
          jsonb_build_object(
            'fest_id', side.fest_id,
            'navn', side.fest_navn
          )
        )
      )
    );

    select e.objekt_id
      into element_id
    from public.innholdselementer e
    where e.infoside_id = side.infoside_id
      and e.elementtype = 'legemiddelkobling'
      and e.tilstand = 'utkast'
    order by e.posisjon
    limit 1;

    if element_id is null then
      status := public.opprett_utkast('innholdselement'::public.objekttype, innhold);
      element_id := status.id;
    else
      select t.revisjon
        into gjeldende_revisjon
      from public.objekttilstander t
      where t.objekt_id = element_id
        and t.tilstand = 'utkast';

      status := public.lagre_utkast(element_id, gjeldende_revisjon, innhold);
    end if;

    status := public.publiser_utkast(element_id, status.revisjon);
    element_id := null;
    gjeldende_revisjon := null;
  end loop;
end
$$;
