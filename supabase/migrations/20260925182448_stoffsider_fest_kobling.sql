-- Stoffsidene kobles til virkestoffene i FEST
do $kobling$
declare
  administrator uuid;
  k record;
  side uuid;
  virkestoff text;
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
    select * from (values
      ('Atomoksetin', 'ID_C6B0601C-B7F9-49F5-B977-01717103A917'),
      ('Fenobarbital', 'ID_B5FF582C-3B3D-4EE0-95E5-27C784AF90E4'),
      ('Fenytoin', 'ID_009F9FE6-F548-46A5-89EB-26B4D3CBDF23'),
      ('Flunitrazepam', 'ID_101A6BCA-98AF-4D0A-B9EF-1917D86B7227'),
      ('Gabapentin', 'ID_A46CFA9C-F01A-4F03-AF5C-28A5579898DB'),
      ('Karbamazepin', 'ID_8418C9B9-33E9-4757-9224-7D3A76E776B6'),
      ('Ketobemidon', 'ID_0BFAF9DC-D8E2-4779-AB7E-2EF0473E4099'),
      ('Levetiracetam', 'ID_C0B8977C-98C2-4BAC-8133-49CF59934213'),
      ('Litium', 'ID_36AEA22F-E6BC-4CF0-9A3F-2E9341A7B5F6'),
      ('Metylfenidat', 'ID_6CACB000-6973-4B2F-9C99-4C1A3DD58F25'),
      ('Okskarbazepin', 'ID_4F71C73E-B25D-404B-9835-3C3DF9D89231'),
      ('Petidin', 'ID_512D22D6-CA39-4D2B-B6FC-012A0241529A'),
      ('Sertindol', 'ID_79EE8CA6-168F-444A-9C83-2F6110A42CF0'),
      ('Topiramat', 'ID_A8E3BC2D-A60C-4AA6-B069-5D09BC84ADE0'),
      ('Valproat', 'ID_A61E2EDC-D6B4-4E52-89F4-3D10F0E03E38')
    ) as t(side, fest_id)
  loop
    side := (select i.objekt_id from public.infosider i where i.tilstand = 'publisert' and i.navn = k.side);
    if side is null then
      raise notice 'Fant ingen publisert side %, så den hoppes over.', k.side;
      continue;
    end if;
    virkestoff := (select v.navn from legemiddeldata.virkestoff v where v.fest_id = k.fest_id and v.utgatt_kl is null);
    if virkestoff is null then
      raise notice 'Virkestoffet % for % finnes ikke i FEST, så siden hoppes over.', k.fest_id, k.side;
      continue;
    end if;
    if exists (
      select 1 from public.innholdselementer e
      where e.infoside_id = side and e.elementtype = 'legemiddelkobling' and e.panel <> 'fjernet'
    ) then
      raise notice '% er alt koblet til legemiddeldataene, så den hoppes over.', k.side;
      continue;
    end if;

    status := public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side,
      'panel', 'preparater',
      'posisjon', 0,
      'elementtype', 'legemiddelkobling',
      'data', jsonb_build_object('virkestoff', jsonb_build_array(jsonb_build_object('fest_id', k.fest_id, 'navn', virkestoff)))
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$kobling$;