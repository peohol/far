-- Interaksjonene i FEST: DMPs vurderinger av legemidler som ikke bør brukes
-- sammen, eller bare med forholdsregler. Bakgrunnen står i
-- docs/legemiddeldata.md.
--
--   * To nye typer i kopien av FEST, med samme form og synkronisering som de
--     andre: `interaksjon` (et par av to substansgrupper, med relevans, klinisk
--     konsekvens, håndtering og referanser) og `interaksjon_ikke_vurdert`
--     (ATC-koder DMP ikke har vurdert ennå).
--   * Stoffene i en interaksjon er angitt med ATC-kode, eller med virkestoffets
--     ID når de ikke har noen. En ATC-kode på et overordnet nivå gjelder alle
--     kodene under den.
--   * `les_interaksjoner` finner interaksjonene for et sett ATC-koder og
--     virkestoff. Hvilke ATC-koder en stoffside har, avgjør appen fra
--     preparatene siden er koblet til; FEST har ingen kobling mellom virkestoff
--     og ATC-kode.

insert into legemiddeldata.entiteter (navn) values
  ('interaksjon'),
  ('interaksjon_ikke_vurdert');

create table legemiddeldata.interaksjon (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  relevans text generated always as (data -> 'relevans' ->> 'kode') stored
);

create table legemiddeldata.interaksjon_ikke_vurdert (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz
);

comment on table legemiddeldata.interaksjon is
  'Interaksjoner fra FEST: to substansgrupper, med relevans, klinisk konsekvens, mekanisme, håndtering og referanser.';
comment on table legemiddeldata.interaksjon_ikke_vurdert is
  'ATC-koder som ikke er vurdert for interaksjoner i FEST.';

-- Interaksjonene som gjelder noen av ATC-kodene eller virkestoffene, og hvilke
-- av ATC-kodene som ikke er vurdert. Utgåtte er ikke med.
create function public.les_interaksjoner(atc_koder text[], virkestoff_ider text[] default '{}')
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

  return jsonb_build_object(
    'interaksjoner', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.fest_id) || i.data order by i.fest_id)
      from legemiddeldata.interaksjon i
      where i.utgatt_kl is null
        and exists (
          select 1
          from jsonb_array_elements(i.data -> 'substansgrupper') g,
               jsonb_array_elements(g -> 'substanser') s
          where s ->> 'virkestoff_id' = any (virkestoff_ider)
             or (s -> 'atc' ->> 'kode' <> ''
                 and exists (
                   select 1 from unnest(atc_koder) a
                   where left(a, length(s -> 'atc' ->> 'kode')) = s -> 'atc' ->> 'kode')))
    ), '[]'),
    'ikke_vurdert', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.fest_id) || v.data order by v.fest_id)
      from legemiddeldata.interaksjon_ikke_vurdert v
      where v.utgatt_kl is null
        and exists (
          select 1
          from jsonb_array_elements(v.data -> 'atc') k, unnest(atc_koder) a
          where k ->> 'kode' <> '' and left(a, length(k ->> 'kode')) = k ->> 'kode')
    ), '[]')
  );
end;
$$;

revoke all on table legemiddeldata.interaksjon, legemiddeldata.interaksjon_ikke_vurdert
  from public, anon, authenticated, service_role;

revoke all on function public.les_interaksjoner(text[], text[]) from public, anon, authenticated, service_role;
grant execute on function public.les_interaksjoner(text[], text[]) to authenticated, service_role;
