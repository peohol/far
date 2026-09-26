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
      ('Amfetamin', 'ID_94B3D11A-B6E3-4139-8F0E-8FE9B5B12D62', 'PA449269', 'dextroamphetamine', 0),
      ('Amfetamin', 'ID_90176257-5082-40EB-9F18-687F7AC07352', 'PA164748975', 'lisdexamfetamine', 1),
      ('Amisulprid', 'ID_23A8F342-84DC-41FF-B835-B9A45B2F6394', 'PA162565877', 'amisulpride', 2),
      ('Amitriptylin', 'ID_0A1B24EF-A7F8-488B-97B8-8023193E976D', 'PA448385', 'amitriptyline', 3),
      ('Aripiprazol', 'ID_4596EE8B-CD03-43E0-AEA8-CDB60778EA43', 'PA10026', 'aripiprazole', 4),
      ('Atomoksetin', 'ID_C6B0601C-B7F9-49F5-B977-01717103A917', 'PA134688071', 'atomoxetine', 5),
      ('Brekspiprazol', 'ID_68DCFD07-0824-4962-AA56-FD6ED472D9B8', 'PA166160053', 'brexpiprazole', 6),
      ('Citalopram', 'ID_E2B9E074-0D21-4E5E-9867-BC70B8FC2654', 'PA449015', 'citalopram', 7),
      ('Doksepin', 'ID_AF1D3EF5-E7BA-45E4-8C6F-EB410DB3C4AF', 'PA449409', 'doxepin', 8),
      ('Duloksetin', 'ID_D27A3210-135D-42C9-9DB3-8AB8CBEA77E6', 'PA10066', 'duloxetine', 9),
      ('Escitalopram', 'ID_13E05918-25C1-4DAA-A0F5-1266DEC3A75F', 'PA10074', 'escitalopram', 10),
      ('Fenobarbital', 'ID_B5FF582C-3B3D-4EE0-95E5-27C784AF90E4', 'PA450911', 'phenobarbital', 11),
      ('Fenytoin', 'ID_009F9FE6-F548-46A5-89EB-26B4D3CBDF23', 'PA450947', 'phenytoin', 12),
      ('Flunitrazepam', 'ID_101A6BCA-98AF-4D0A-B9EF-1917D86B7227', 'PA164781320', 'flunitrazepam', 13),
      ('Fluoksetin', 'ID_D473FE91-133D-494A-A2B0-C644A8372A8B', 'PA449673', 'fluoxetine', 14),
      ('Flupentiksol', 'ID_9E8C912B-84DB-4AFF-BE91-DB21F945B83E', 'PA10268', 'flupenthixol', 15),
      ('Fluvoksamin', 'ID_A39218DE-5973-4473-A005-FBA8B4E86C62', 'PA449690', 'fluvoxamine', 16),
      ('Haloperidol', 'ID_667FA975-A8EC-4CF8-A89E-96F97808E3AD', 'PA449841', 'haloperidol', 17),
      ('Hydroksyrisperidon', 'ID_82CAEDDE-7CB1-4302-9C30-6A2010DB6D85', 'PA163518919', 'paliperidone', 18),
      ('Karbamazepin', 'ID_8418C9B9-33E9-4757-9224-7D3A76E776B6', 'PA448785', 'carbamazepine', 19),
      ('Kariprazin', 'ID_966A0E9E-10AF-40C1-BA48-3E2E6ECF49C2', 'PA166177476', 'cariprazine', 20),
      ('Klomipramin', 'ID_40E4710B-8115-40CA-986D-E98AE4C2D6B0', 'PA449048', 'clomipramine', 21),
      ('Klorprotiksen', 'ID_9672824E-CE48-45EB-B232-E41DC928D08B', 'PA164781400', 'chlorprothixene', 22),
      ('Klozapin', 'ID_41137AC7-7E5B-47BA-BF41-4CE0672EF755', 'PA449061', 'clozapine', 23),
      ('Kvetiapin', 'ID_61E766DA-E71D-4381-B4DE-2A06C51A2BD8', 'PA451201', 'quetiapine', 24),
      ('Lamotrigin', 'ID_F456CD11-3821-4C60-B36F-DE0C9D51ED22', 'PA450164', 'lamotrigine', 25),
      ('Levetiracetam', 'ID_C0B8977C-98C2-4BAC-8133-49CF59934213', 'PA450206', 'levetiracetam', 26),
      ('Litium', 'ID_36AEA22F-E6BC-4CF0-9A3F-2E9341A7B5F6', 'PA450243', 'lithium', 27),
      ('Lurasidon', 'ID_3B369762-A4B8-49DB-931D-6AC9D901ABAC', 'PA166129557', 'lurasidone', 28),
      ('Metylfenidat', 'ID_6CACB000-6973-4B2F-9C99-4C1A3DD58F25', 'PA450464', 'methylphenidate', 29),
      ('Mianserin', 'ID_09537B03-BA99-4CE5-B1E3-7AE975842EB6', 'PA134687937', 'mianserin', 30),
      ('Mirtazapin', 'ID_0AFFD596-9932-44A7-86E8-F35BBDB1FCAD', 'PA450522', 'mirtazapine', 31),
      ('Nortriptylin', 'ID_829694BA-B839-4173-BE1A-37CD35C17700', 'PA450657', 'nortriptyline', 32),
      ('Okskarbazepin', 'ID_4F71C73E-B25D-404B-9835-3C3DF9D89231', 'PA450732', 'oxcarbazepine', 33),
      ('Olanzapin', 'ID_A86FC555-41CA-4E80-A188-ED521EEC5903', 'PA450688', 'olanzapine', 34),
      ('Paliperidon (hydroksyrisperidon)', 'ID_82CAEDDE-7CB1-4302-9C30-6A2010DB6D85', 'PA163518919', 'paliperidone', 35),
      ('Paroksetin', 'ID_0F9E3AC0-1950-4CF5-8F4F-4008696E85B8', 'PA450801', 'paroxetine', 36),
      ('Perfenazin', 'ID_57F9D9AC-707C-4172-8A52-2C2D944B5FF5', 'PA450882', 'perphenazine', 37),
      ('Petidin', 'ID_512D22D6-CA39-4D2B-B6FC-012A0241529A', 'PA450369', 'meperidine', 38),
      ('Risperidon', 'ID_852F4AC9-FF5C-4C97-999E-03FE3C144223', 'PA451257', 'risperidone', 39),
      ('Sertindol', 'ID_79EE8CA6-168F-444A-9C83-2F6110A42CF0', 'PA164784002', 'sertindole', 40),
      ('Sertralin', 'ID_1C2C9254-987B-4A37-AC48-6349BB671F07', 'PA451333', 'sertraline', 41),
      ('Topiramat', 'ID_A8E3BC2D-A60C-4AA6-B069-5D09BC84ADE0', 'PA451728', 'topiramate', 42),
      ('Trimipramin', 'ID_958415F9-1F66-4665-AB6C-5E8EB61E346A', 'PA451791', 'trimipramine', 43),
      ('Valproat', 'ID_A61E2EDC-D6B4-4E52-89F4-3D10F0E03E38', 'PA451846', 'valproic acid', 44),
      ('Venlafaksin', 'ID_289921F8-A934-43E2-8F86-DB736FA198DF', 'PA451866', 'venlafaxine', 45),
      ('Vortioksetin', 'ID_328991B3-C34B-4D78-AD5C-7D7DDA7B2DCA', 'PA166122595', 'vortioxetine', 46),
      ('Ziprasidon', 'ID_97EEA6F8-10CB-44CC-B37D-9B3DC81A6398', 'PA451974', 'ziprasidone', 47),
      ('Zuklopentiksol', 'ID_31472D31-DAB7-49DF-AB66-A7CDA5A8222B', 'PA452629', 'zuclopenthixol', 48)
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