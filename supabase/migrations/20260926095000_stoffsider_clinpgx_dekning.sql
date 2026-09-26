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
      ('Gabapentin', 'ID_A46CFA9C-F01A-4F03-AF5C-28A5579898DB', 'PA449720', 'gabapentin', 0),
      ('Ketobemidon', 'ID_0BFAF9DC-D8E2-4779-AB7E-2EF0473E4099', 'PA166211241', 'ketobemidone', 1),
      ('Levomepromazin', 'ID_B2FB1ECD-1329-4551-9A12-8C145BD12318', 'PA164743234', 'methotrimeprazine', 2),
      ('O-desmetylvenlafaksin', 'ID_DF83C642-14F8-4ACD-84EA-E5C6ED7BC162', 'PA165958374', 'desvenlafaxine', 3),
      ('Alprazolam', null, 'PA448333', 'alprazolam', 4),
      ('Buprenorfin', null, 'PA448685', 'buprenorphine', 5),
      ('Diazepam', null, 'PA449283', 'diazepam', 6),
      ('Fentanyl', null, 'PA449599', 'fentanyl', 7),
      ('Klonazepam', null, 'PA449050', 'clonazepam', 8),
      ('Kodein', null, 'PA449088', 'codeine', 9),
      ('Metadon', null, 'PA450401', 'methadone', 10),
      ('Morfin', null, 'PA450550', 'morphine', 11),
      ('Nitrazepam', null, 'PA10242', 'nitrazepam', 12),
      ('Oksazepam', null, 'PA450731', 'oxazepam', 13),
      ('Oksykodon', null, 'PA450741', 'oxycodone', 14),
      ('Tramadol', null, 'PA451735', 'tramadol', 15),
      ('Zolpidem', null, 'PA451976', 'zolpidem', 16),
      ('Zopiklon', null, 'PA10236', 'zopiclone', 17)
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
      where c.kandidat ->> 'fest_id' is null or exists (
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