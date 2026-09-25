-- Stoffsider uten analyttkode: en informasjonsside (monografi) om et stoff
-- laboratoriet ikke har noen kode for ennå.
--
-- Databasen har alltid tillatt en informasjonsside uten laboratorieanalytt;
-- det er appen som til nå bare har funnet sidene gjennom koden. Her kommer
-- lesingen av sidene etter navn: én side, alle sidene til søket i hele
-- kunnskapsbasen, og navnene til sidemenyen. Får stoffet en kode senere, blir
-- siden hovedside for den og leses gjennom koden som de andre.
--
-- En stoffside uten kode er en informasjonsside som verken er hovedside eller
-- komponent for noen analytt. Komponentsidene (metabolittene i sumanalysene)
-- hører til analysen de står i, og listes ikke for seg.
--
-- Alt her kjører med rettighetene til den som leser (security invoker), som
-- les_analyttside: en vanlig bruker får bare det publiserte, og ber hen om
-- utkastet, får hen ingenting. Ingenting her skriver. Bakgrunnen står i
-- docs/faginnhold.md.

create view public.stoffsider_uten_kode
with (security_invoker = true)
as
select s.objekt_id, s.tilstand, s.navn
from public.infosider s
where not exists (
    select 1 from public.laboratorieanalytter a
    where a.hovedside_id = s.objekt_id and a.tilstand = s.tilstand
  )
  and not exists (
    select 1 from public.analyttkomponenter k
    where k.infoside_id = s.objekt_id and k.tilstand = s.tilstand
  );

comment on view public.stoffsider_uten_kode is
  'Informasjonssidene som verken er hovedside eller komponent for noen analytt: stoffsidene uten kode. Radsikkerheten gjelder.';

-- Sidene med disse ID-ene, på samme form som les_analyttsider: `analytt` er
-- `null` og `komponenter` tom, og referansene står én gang, i `referanser`.
create function public.stoffsider_som_json(sider uuid[], sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with utgaver as (
    select u.objekt_id, public.utgave_som_json(u) as json
    from public.objektutgaver u
    where u.tilstand = sidetilstand
  ),
  valgte as (
    select s.objekt_id, s.navn
    from public.infosider s
    where s.tilstand = sidetilstand and s.objekt_id = any (stoffsider_som_json.sider)
  ),
  elementer as (
    select e.infoside_id, e.objekt_id
    from valgte v
    join public.innholdselementer e on e.infoside_id = v.objekt_id and e.tilstand = sidetilstand
  ),
  -- Referansene siden siterer: fra panelene (på siden), kortene og teksten.
  siteringer as (
    select v.objekt_id as infoside_id, k.referanse_id
    from valgte v
    join public.referansekoblinger k on k.objekt_id = v.objekt_id and k.tilstand = sidetilstand
    union
    select e.infoside_id, k.referanse_id
    from elementer e
    join public.referansekoblinger k on k.objekt_id = e.objekt_id and k.tilstand = sidetilstand
  ),
  elementer_per_side as (
    select e.infoside_id, jsonb_agg(u.json order by u.objekt_id) as elementer
    from elementer e
    join utgaver u on u.objekt_id = e.objekt_id
    group by e.infoside_id
  ),
  referanser_per_side as (
    select s.infoside_id, jsonb_agg(s.referanse_id order by s.referanse_id) as referanser
    from siteringer s
    group by s.infoside_id
  )
  select jsonb_build_object(
    'sider', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'analytt', null,
            'infoside', ui.json,
            'elementer', coalesce(e.elementer, '[]'::jsonb),
            'komponenter', '[]'::jsonb,
            'referanser', coalesce(r.referanser, '[]'::jsonb)
          )
          order by lower(v.navn)
        )
        from valgte v
        join utgaver ui on ui.objekt_id = v.objekt_id
        left join elementer_per_side e on e.infoside_id = v.objekt_id
        left join referanser_per_side r on r.infoside_id = v.objekt_id
      ),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(u.json order by u.objekt_id)
        from utgaver u
        where u.objekt_id in (select referanse_id from siteringer)
      ),
      '[]'::jsonb
    )
  )
$$;

comment on function public.stoffsider_som_json(uuid[], public.objekttilstand) is
  'Informasjonssidene med disse ID-ene, uten analytt, på samme form som les_analyttsider. Radsikkerheten gjelder.';

-- Informasjonssiden med dette navnet, uten hensyn til store og små bokstaver,
-- på samme form som les_analyttside. Er siden hovedside for en analytt, er det
-- analyttsiden som kommer tilbake, så appen kan gå til koden. `null` når
-- ingen side har navnet i den tilstanden.
create function public.les_stoffside(sidenavn text, sidetilstand public.objekttilstand)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  side_id uuid;
  sidekode text;
  sider jsonb;
begin
  select s.objekt_id into side_id
  from public.infosider s
  where s.tilstand = sidetilstand and lower(s.navn) = lower(btrim(sidenavn));
  if side_id is null then
    return null;
  end if;

  select a.kode into sidekode
  from public.laboratorieanalytter a
  where a.hovedside_id = side_id and a.tilstand = sidetilstand
  order by a.kode
  limit 1;
  if sidekode is not null then
    return public.les_analyttside(sidekode, sidetilstand);
  end if;

  sider := public.stoffsider_som_json(array[side_id], sidetilstand);
  return (sider -> 'sider' -> 0) || jsonb_build_object('referanser', sider -> 'referanser');
end
$$;

comment on function public.les_stoffside(text, public.objekttilstand) is
  'Informasjonssiden med et gitt navn i én tilstand, på samme form som les_analyttside; analyttsiden når siden har en kode. Radsikkerheten gjelder.';

-- Alle stoffsidene uten kode, til søket i hele kunnskapsbasen.
create function public.les_stoffsider(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.stoffsider_som_json(
    coalesce(array_agg(v.objekt_id), '{}'),
    sidetilstand
  )
  from public.stoffsider_uten_kode v
  where v.tilstand = sidetilstand
$$;

comment on function public.les_stoffsider(public.objekttilstand) is
  'Alle stoffsidene uten kode i én tilstand, på samme form som les_analyttsider. Radsikkerheten gjelder.';

-- Navnene på stoffsidene uten kode, alfabetisk, til sidemenyen.
create function public.les_stoffsidenavn(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(v.navn order by lower(v.navn)), '[]'::jsonb)
  from public.stoffsider_uten_kode v
  where v.tilstand = sidetilstand
$$;

comment on function public.les_stoffsidenavn(public.objekttilstand) is
  'Navnene på stoffsidene uten kode i én tilstand, alfabetisk. Radsikkerheten gjelder.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on table public.stoffsider_uten_kode from anon, authenticated, service_role;
grant select on table public.stoffsider_uten_kode to authenticated, service_role;

revoke all on function
  public.stoffsider_som_json(uuid[], public.objekttilstand),
  public.les_stoffside(text, public.objekttilstand),
  public.les_stoffsider(public.objekttilstand),
  public.les_stoffsidenavn(public.objekttilstand)
from public, anon, authenticated, service_role;

grant execute on function
  public.stoffsider_som_json(uuid[], public.objekttilstand),
  public.les_stoffside(text, public.objekttilstand),
  public.les_stoffsider(public.objekttilstand),
  public.les_stoffsidenavn(public.objekttilstand)
to authenticated;
