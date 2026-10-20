-- Kurateringene per fagside, for alle innloggede: fanen «Kurateringer» i
-- stoffregisteret (docs/kurateringsgrener.md, «Status per fagside»).
--
-- `public.les_kurateringer()` gir hver kurateringsgren som ikke er forkastet,
-- med bare det fanen trenger: siden, arten, statusen og når den startet, fikk
-- statusen sin og ble publisert. Ingen fagtekst, ingen formål, grunner,
-- kommentarer eller agenter. Appen regner ut én status per side av dette, på
-- samme måte som i administratorenes kurateringsmeny
-- (`src/kuratering/sidestatus.ts`).
--
-- Med kommer kurateringene som ble gjort med en migrasjon før
-- kurateringsgrenene fantes (`intern.kuratering_start`), som publiserte
-- kurateringer med tidspunktet i migrasjonens versjon. De står i
-- `kuratering.migrasjonskurateringer`, én rad per migrasjon; en test holder
-- lista i takt med migrasjonene som kaller `intern.kuratering_start`.

create table kuratering.migrasjonskurateringer (
  migrasjon text primary key,
  stoff text not null,
  constraint migrasjonskurateringer_migrasjon check (migrasjon ~ '^[0-9]{14}_[a-z0-9_]+\.sql$')
);

comment on table kuratering.migrasjonskurateringer is
  'Kurateringene som ble publisert med en migrasjon (intern.kuratering_start), før kurateringsgrenene. Én rad per migrasjon.';

insert into kuratering.migrasjonskurateringer (migrasjon, stoff) values
  ('20261004030344_ketamin_monografkuratering.sql', 'ketamin'),
  ('20261004040000_ketamin_monografkuratering_farmakodynamikk.sql', 'ketamin'),
  ('20261004040353_kvetiapin_virkninger_og_avhengighet.sql', 'kvetiapin'),
  ('20261005062206_kvetiapin_monografkuratering_fullforing.sql', 'kvetiapin'),
  ('20261005062456_kvetiapin_monografkuratering_avhengighet_inline.sql', 'kvetiapin'),
  ('20261005165100_kvetiapin_monografkuratering_fersk_kjoring.sql', 'kvetiapin'),
  ('20261005173500_kvetiapin_konsentrasjoner_nmol_l.sql', 'kvetiapin'),
  ('20261006114500_citalopram_monografkuratering.sql', 'citalopram'),
  ('20261007121000_citalopram_monografkuratering_inline_kilder.sql', 'citalopram'),
  ('20261010045100_thc_monografkuratering.sql', 'thc'),
  ('20261010080000_thc_monografkuratering_fullforing.sql', 'thc'),
  ('20261013160000_citalopram_monografkuratering_de_novo_pilot.sql', 'citalopram'),
  ('20261014090100_citalopram_monografkuratering_spc_og_kilder.sql', 'citalopram');

revoke all on kuratering.migrasjonskurateringer from public, anon, authenticated, service_role;

create function public.les_kurateringer()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(k.rad order by k.opprettet_kl, k.stoff), '[]'::jsonb)
  from (
    select g.opprettet_kl, g.stoff, jsonb_strip_nulls(jsonb_build_object(
      'stoff', g.stoff,
      'art', g.art,
      'status', g.status,
      'opprettet_kl', g.opprettet_kl,
      'status_kl', (select max(h.kl) from kuratering.hendelser h where h.gren = g.id and h.til = g.status),
      'publisert_kl', g.publisert_kl
    )) as rad
    from kuratering.grener g
    where g.status <> 'arkivert'
    union all
    select m.kl, m.stoff, jsonb_build_object(
      'stoff', m.stoff,
      'art', 'kuratering',
      'status', 'publisert',
      'opprettet_kl', m.kl,
      'publisert_kl', m.kl
    )
    from (
      select x.stoff, make_timestamptz(
        substr(x.migrasjon, 1, 4)::int, substr(x.migrasjon, 5, 2)::int, substr(x.migrasjon, 7, 2)::int,
        substr(x.migrasjon, 9, 2)::int, substr(x.migrasjon, 11, 2)::int, substr(x.migrasjon, 13, 2)::int, 'UTC'
      ) as kl
      from kuratering.migrasjonskurateringer x
    ) m
  ) k
$$;

comment on function public.les_kurateringer() is
  'Kurateringene av fagsidene uten fagtekst: siden, arten, statusen og tidspunktene. For alle innloggede (fanen «Kurateringer» i stoffregisteret).';

revoke all on function public.les_kurateringer() from public, anon, authenticated, service_role;
grant execute on function public.les_kurateringer() to authenticated;
