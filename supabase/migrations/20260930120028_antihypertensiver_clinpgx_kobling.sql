-- Stoffsidene kobles til kjemikaliene i ClinPGx
do $kobling$
declare
  administrator uuid;
  k record;
  side uuid;
  kjemikalier jsonb;
  status public.objektstatus;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', 'Koblet til kjemikaliet i ClinPGx', true);

  for k in
    select t.side,
           jsonb_agg(jsonb_build_object('fest_id', t.fest_id, 'clinpgx_id', t.clinpgx_id, 'navn', t.navn) order by t.nr) as kandidater
    from (values
      ('Amlodipin', 'ID_7747F0C0-30CC-438E-B66F-68C2C14E710F', 'PA448388', 'amlodipine', 0),
      ('Atenolol', 'ID_B7952198-5997-46EB-B182-785CBD0D7007', 'PA448499', 'atenolol', 1),
      ('Bendroflumetiazid', 'ID_02AE4CD3-BCA2-487C-974D-20E65AED89B2', 'PA448563', 'bendroflumethiazide', 2),
      ('Bisoprolol', 'ID_BED4501F-4CD5-4EE4-98FA-2FB1096EAEF1', 'PA448641', 'bisoprolol', 3),
      ('Bumetanid', 'ID_987C2CCC-48D6-4DEB-A68B-0082BF25876A', 'PA448682', 'bumetanide', 4),
      ('Diltiazem', 'ID_F337071D-AA12-4D72-9DA5-CB3AD91D2759', 'PA449334', 'diltiazem', 5),
      ('Doksazosin', 'ID_42781DEA-BCA0-48B5-8DD8-1269B99F2910', 'PA449407', 'doxazosin', 6),
      ('Enalapril', 'ID_5A4991C1-1D06-46A2-9B95-D7C72864CD0E', 'PA449456', 'enalapril', 7),
      ('Eplerenon', 'ID_D76A9CFA-D219-430B-AD5F-255A9BB6949A', 'PA164749044', 'eplerenone', 8),
      ('Furosemid', 'ID_966A96B7-BC79-4152-A555-4C76A2391920', 'PA449719', 'furosemide', 9),
      ('Hydroklortiazid', 'ID_605B1311-43E9-45BC-83D7-828D4F53C523', 'PA449899', 'hydrochlorothiazide', 10),
      ('Irbesartan', 'ID_BBC7FCDA-3571-4325-B576-645784F29DC1', 'PA450084', 'irbesartan', 11),
      ('Kandesartan', 'ID_05B987BF-55BC-4935-9578-9A5AA725B430', 'PA448765', 'candesartan', 12),
      ('Karvedilol', 'ID_646B1EE5-9372-48A6-8E68-2B7C290289CD', 'PA448817', 'carvedilol', 13),
      ('Labetalol', 'ID_1AAC4109-128E-4D4C-B251-23E462DD1B7D', 'PA164743150', 'labetalol', 14),
      ('Lerkanidipin', 'ID_A164C4B8-7BD0-4408-97AE-16E10A14250C', 'PA164769058', 'lercanidipine', 15),
      ('Lisinopril', 'ID_DCB94A58-2AD7-40B6-A515-7EE19E299F09', 'PA450242', 'lisinopril', 16),
      ('Losartan', 'ID_A3ED2C34-50C9-46E7-9482-5E5B55E2BBC0', 'PA450268', 'losartan', 17),
      ('Metoprolol', 'ID_F1A5819E-781F-4ADA-92F6-B009B48750A5', 'PA450480', 'metoprolol', 18),
      ('Nifedipin', 'ID_D2B69C47-BEFE-4345-B4E7-D59049EF41DD', 'PA450631', 'nifedipine', 19),
      ('Ramipril', 'ID_C9D2BF2D-A0F8-46EC-9861-FE58536C8A41', 'PA451223', 'ramipril', 20),
      ('Spironolakton', 'ID_6F33B108-8842-4D25-9746-6397759275CA', 'PA451483', 'spironolactone', 21),
      ('Telmisartan', 'ID_D4F3353B-CA8D-442D-86DF-C3052BFB4C7F', 'PA451605', 'telmisartan', 22),
      ('Valsartan', 'ID_90CC1E37-24DD-496F-A7F5-D9B8B816E900', 'PA451848', 'valsartan', 23),
      ('Verapamil', 'ID_DB91861C-E102-47D6-8ED7-F0C118195F67', 'PA451868', 'verapamil', 24)
    ) as t(side, fest_id, clinpgx_id, navn, nr)
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
      where e.infoside_id = side and e.elementtype = 'clinpgxkobling' and e.panel <> 'fjernet'
    ) then
      raise notice '% er alt koblet til ClinPGx, så den hoppes over.', k.side;
      continue;
    end if;
    kjemikalier := (
      select jsonb_agg(jsonb_build_object('clinpgx_id', c.kandidat ->> 'clinpgx_id', 'navn', c.kandidat ->> 'navn') order by c.nr)
      from jsonb_array_elements(k.kandidater) with ordinality as c(kandidat, nr)
      where exists (
        select 1
        from public.innholdselementer e,
             jsonb_array_elements(case when jsonb_typeof(e.data -> 'virkestoff') = 'array' then e.data -> 'virkestoff' else '[]' end) v
        where e.infoside_id = side
          and e.tilstand = 'publisert'
          and e.elementtype = 'legemiddelkobling'
          and e.panel <> 'fjernet'
          and v ->> 'fest_id' = c.kandidat ->> 'fest_id'
      )
    );
    if coalesce(jsonb_array_length(kjemikalier), 0) < jsonb_array_length(k.kandidater) then
      raise notice '% er ikke koblet til alle virkestoffene % i FEST.', k.side, k.kandidater;
    end if;
    if kjemikalier is null then
      raise notice '% er ikke koblet til noen av virkestoffene i FEST, så den hoppes over.', k.side;
      continue;
    end if;

    status := public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side,
      'panel', 'farmakogenetikk',
      'posisjon', 0,
      'elementtype', 'clinpgxkobling',
      'data', jsonb_build_object('kjemikalier', kjemikalier)
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$kobling$;