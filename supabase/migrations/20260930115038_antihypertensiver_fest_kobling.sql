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
      ('Amlodipin', 'ID_7747F0C0-30CC-438E-B66F-68C2C14E710F', 0),
      ('Atenolol', 'ID_B7952198-5997-46EB-B182-785CBD0D7007', 1),
      ('Bendroflumetiazid', 'ID_02AE4CD3-BCA2-487C-974D-20E65AED89B2', 2),
      ('Bisoprolol', 'ID_BED4501F-4CD5-4EE4-98FA-2FB1096EAEF1', 3),
      ('Bumetanid', 'ID_987C2CCC-48D6-4DEB-A68B-0082BF25876A', 4),
      ('Diltiazem', 'ID_F337071D-AA12-4D72-9DA5-CB3AD91D2759', 5),
      ('Doksazosin', 'ID_42781DEA-BCA0-48B5-8DD8-1269B99F2910', 6),
      ('Enalapril', 'ID_5A4991C1-1D06-46A2-9B95-D7C72864CD0E', 7),
      ('Eplerenon', 'ID_D76A9CFA-D219-430B-AD5F-255A9BB6949A', 8),
      ('Furosemid', 'ID_966A96B7-BC79-4152-A555-4C76A2391920', 9),
      ('Hydroklortiazid', 'ID_605B1311-43E9-45BC-83D7-828D4F53C523', 10),
      ('Irbesartan', 'ID_BBC7FCDA-3571-4325-B576-645784F29DC1', 11),
      ('Kandesartan', 'ID_05B987BF-55BC-4935-9578-9A5AA725B430', 12),
      ('Karvedilol', 'ID_646B1EE5-9372-48A6-8E68-2B7C290289CD', 13),
      ('Labetalol', 'ID_1AAC4109-128E-4D4C-B251-23E462DD1B7D', 14),
      ('Lerkanidipin', 'ID_A164C4B8-7BD0-4408-97AE-16E10A14250C', 15),
      ('Lisinopril', 'ID_DCB94A58-2AD7-40B6-A515-7EE19E299F09', 16),
      ('Losartan', 'ID_A3ED2C34-50C9-46E7-9482-5E5B55E2BBC0', 17),
      ('Metoprolol', 'ID_F1A5819E-781F-4ADA-92F6-B009B48750A5', 18),
      ('Nifedipin', 'ID_D2B69C47-BEFE-4345-B4E7-D59049EF41DD', 19),
      ('Ramipril', 'ID_C9D2BF2D-A0F8-46EC-9861-FE58536C8A41', 20),
      ('Spironolakton', 'ID_6F33B108-8842-4D25-9746-6397759275CA', 21),
      ('Telmisartan', 'ID_D4F3353B-CA8D-442D-86DF-C3052BFB4C7F', 22),
      ('Valsartan', 'ID_90CC1E37-24DD-496F-A7F5-D9B8B816E900', 23),
      ('Verapamil', 'ID_DB91861C-E102-47D6-8ED7-F0C118195F67', 24)
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