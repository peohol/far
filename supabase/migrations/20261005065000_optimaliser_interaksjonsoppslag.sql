-- Gjør FEST-interaksjonsoppslag indeksbaserte.
-- Den opprinnelige funksjonen utvidet JSON for alle aktive interaksjoner ved hvert kall
-- og kunne derfor passere PostgRESTs statement_timeout etter at FEST-kopien vokste.
-- GIN-indeksene gjør eksakte JSONB-containment-oppslag; ATC-hierarkiet bevares ved
-- at alle prefikser av sidens ATC-koder slås opp.
create index interaksjon_data_aktive_gin
  on legemiddeldata.interaksjon
  using gin (data jsonb_path_ops)
  where utgatt_kl is null;

create index interaksjon_ikke_vurdert_data_aktive_gin
  on legemiddeldata.interaksjon_ikke_vurdert
  using gin (data jsonb_path_ops)
  where utgatt_kl is null;

create or replace function public.les_interaksjoner(atc_koder text[], virkestoff_ider text[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(atc_koder), 0) > 100 or coalesce(cardinality(virkestoff_ider), 0) > 100 then
    raise exception 'For mange ATC-koder eller virkestoff.' using errcode = '22023';
  end if;

  return (
    with
    sok_atc as (
      select distinct left(a.kode, n.n) as kode
      from unnest(coalesce(atc_koder, '{}'::text[])) as a(kode)
      cross join lateral generate_series(1, length(a.kode)) as n(n)
      where a.kode is not null and a.kode <> ''
    ),
    sok_virkestoff as (
      select distinct v.id
      from unnest(coalesce(virkestoff_ider, '{}'::text[])) as v(id)
      where v.id is not null and v.id <> ''
    ),
    interaksjons_ider as (
      select i.fest_id
      from sok_virkestoff v
      cross join lateral (
        select x.fest_id
        from legemiddeldata.interaksjon x
        where x.utgatt_kl is null
          and x.data @> jsonb_build_object(
            'substansgrupper',
            jsonb_build_array(
              jsonb_build_object(
                'substanser',
                jsonb_build_array(jsonb_build_object('virkestoff_id', v.id))
              )
            )
          )
      ) i
      union
      select i.fest_id
      from sok_atc a
      cross join lateral (
        select x.fest_id
        from legemiddeldata.interaksjon x
        where x.utgatt_kl is null
          and x.data @> jsonb_build_object(
            'substansgrupper',
            jsonb_build_array(
              jsonb_build_object(
                'substanser',
                jsonb_build_array(
                  jsonb_build_object('atc', jsonb_build_object('kode', a.kode))
                )
              )
            )
          )
      ) i
    ),
    ikke_vurdert_ider as (
      select v.fest_id
      from sok_atc a
      cross join lateral (
        select x.fest_id
        from legemiddeldata.interaksjon_ikke_vurdert x
        where x.utgatt_kl is null
          and x.data @> jsonb_build_object(
            'atc',
            jsonb_build_array(jsonb_build_object('kode', a.kode))
          )
      ) v
    )
    select jsonb_build_object(
      'interaksjoner', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.fest_id) || i.data order by i.fest_id)
        from legemiddeldata.interaksjon i
        join interaksjons_ider f on f.fest_id = i.fest_id
      ), '[]'::jsonb),
      'ikke_vurdert', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.fest_id) || v.data order by v.fest_id)
        from legemiddeldata.interaksjon_ikke_vurdert v
        join ikke_vurdert_ider f on f.fest_id = v.fest_id
      ), '[]'::jsonb)
    )
  );
end;
$$;