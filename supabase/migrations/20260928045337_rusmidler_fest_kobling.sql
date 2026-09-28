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
      ('Alprazolam', 'ID_0C2B08A1-B726-4C1C-988F-D1DDD0DAACEC', 0),
      ('Buprenorfin', 'ID_F5C79CF4-0293-448F-92E1-B8136F3A138F', 1),
      ('Diazepam', 'ID_30219EB4-5E5B-486A-BC91-3FFC69096ED5', 2),
      ('Fentanyl', 'ID_2EC14444-4ECE-442A-BCBA-40A2173750B3', 3),
      ('Hydroksybupropion', 'ID_4FE84EA2-FC1B-44A6-8D70-2A118B211697', 4),
      ('Klonazepam', 'ID_76C0CD6C-AFB4-4346-8387-09573B2CDBDD', 5),
      ('Kodein', 'ID_82E89E1B-9C06-4E57-BB4D-AB3DA8B33FD4', 6),
      ('Metadon', 'ID_335943E0-9530-4E09-9A5C-116D9BA35468', 7),
      ('Metadon', 'ID_7A7394E3-2826-4CDE-8AB1-538BB8DB1AD5', 8),
      ('Morfin', 'ID_3EAD2C2E-9707-44CF-99A0-1FB6BE599975', 9),
      ('Nitrazepam', 'ID_130EEA0C-93B8-41C6-8938-A7DC9AEDEBCF', 10),
      ('Oksazepam', 'ID_68C8AD1D-5261-42DE-9DBE-E8103D4D7E44', 11),
      ('Oksykodon', 'ID_A6032CF1-3E82-48B3-9D92-937838527447', 12),
      ('Tapentadol', 'ID_54B6DB98-E83E-43AB-A259-BCFE879BBC46', 13),
      ('Tramadol', 'ID_9A7618F7-90F5-44EE-89E8-29BF06A684EA', 14),
      ('Zolpidem', 'ID_9EAED86D-1D9F-458A-B626-DB9EEA5A7731', 15),
      ('Zopiklon', 'ID_8B254174-7197-4AF9-8A78-739A805012BE', 16)
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