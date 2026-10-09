-- Laboratorieanalysene fra Farmakologiportalen i det globale fagsøket.
--
-- les_laboratoriesok(komponenter) gir det samme utvalget som
-- les_laboratorieanalyser — komponentene, gruppe- og sumanalysene som dekker
-- dem, analysene og laboratoriene — men bare feltene søket trenger: navnene,
-- metodene og det som avgjør om en analyse vises (status, synlighet, om
-- laboratoriet er i drift). Måleområder, enheter og rådata er ikke med, så
-- svaret for alle koblede komponenter er en brøkdel av det fulle. Analysens
-- egne laboratorie- og institusjonsnavn sendes bare når laboratoriet ikke
-- finnes i kopien; ellers brukes laboratoriets.
--
-- sokedata_versjoner() får nøkkelen «laboratorier»: siste fullførte henting,
-- som er den eneste som endrer kopien. Appen leser laboratoriedataene på nytt
-- bare når den er endret.

create function public.les_laboratoriesok(komponenter text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(komponenter), 0) > 1000 then
    raise exception 'For mange komponenter.' using errcode = '22023';
  end if;

  return (
    with valgte as (
      select k.fp_id, k.data
      from farmakologiportalen.komponent k
      where k.utgatt_kl is null
        and (k.fp_id = any (komponenter) or (k.data -> 'gruppe') ?| coalesce(komponenter, '{}'))
    ),
    analyser as (
      select a.fp_id, a.data, a.laboratorium_id
      from farmakologiportalen.analyse a
      where a.utgatt_kl is null and a.komponent_id in (select fp_id from valgte)
    ),
    laboratorier as (
      select l.fp_id, l.data, l.institusjon_id
      from farmakologiportalen.laboratorium l
      where l.utgatt_kl is null and l.fp_id in (select laboratorium_id from analyser)
    )
    select jsonb_build_object(
      'komponenter', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.fp_id, 'data', jsonb_build_object(
          'navn', v.data -> 'navn', 'gruppe', coalesce(v.data -> 'gruppe', '[]'))) order by v.fp_id)
        from valgte v), '[]'),
      'analyser', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.fp_id, 'data', jsonb_strip_nulls(jsonb_build_object(
          'komponent_id', a.data -> 'komponent_id',
          'laboratorium_id', a.data -> 'laboratorium_id',
          'metode', a.data -> 'metode',
          'status', a.data -> 'status',
          'synlighet', a.data -> 'synlighet',
          'laboratorium', case when l.fp_id is null then a.data -> 'laboratorium' end,
          'institusjon', case when l.fp_id is null then a.data -> 'institusjon' end))) order by a.fp_id)
        from analyser a
        left join laboratorier l on l.fp_id = a.laboratorium_id), '[]'),
      'laboratorier', coalesce((
        select jsonb_agg(jsonb_build_object('id', l.fp_id, 'data', jsonb_strip_nulls(jsonb_build_object(
          'navn', l.data -> 'navn',
          'institusjon_id', l.data -> 'institusjon_id',
          'institusjon', l.data -> 'institusjon',
          'aktiv', l.data -> 'aktiv'))) order by l.fp_id)
        from laboratorier l), '[]'),
      'institusjoner', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.fp_id, 'data', jsonb_build_object('navn', i.data -> 'navn')) order by i.fp_id)
        from farmakologiportalen.institusjon i
        where i.utgatt_kl is null and i.fp_id in (select institusjon_id from laboratorier)), '[]')
    )
  );
end;
$$;

create or replace function public.sokedata_versjoner()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sider', (select v.last_value::text from intern.publisert_innhold_versjon v) || ':' || current_date::text,
    'fest', coalesce((
      select max(s.id)::text from legemiddeldata.synkroniseringer s
      where s.kilde = 'FEST' and s.status = 'fullfort'), '0'),
    'clinpgx', coalesce((
      select max(s.id)::text from clinpgx.synkroniseringer s where s.status in ('fullfort', 'delvis')), '0')
      || ':' || coalesce((select max(k.sist_hentet_kl)::text from clinpgx.kjemikalier k), ''),
    'cpic', coalesce(cpic.kilde() ->> 'endret_kl', ''),
    'laboratorier', coalesce((
      select max(s.id)::text from farmakologiportalen.synkroniseringer s where s.status = 'fullfort'), '0')
  )
$$;

revoke all on function public.les_laboratoriesok(text[]) from public, anon, authenticated, service_role;
grant execute on function public.les_laboratoriesok(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
