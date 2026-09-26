-- FEST i administratorpanelet «Datakilder», ved siden av ClinPGx og CPIC.
--
-- Bakgrunnen står i docs/datakilder.md og docs/legemiddeldata.md. Kort fortalt:
--
--   * En FEST-kjøring vet nå om den ble utløst av den nattlige jobben eller av
--     en administrator («Hent nå»), som i ClinPGx og CPIC.
--   * `datakilder_status()` gir også de ti siste FEST-kjøringene, med datoen
--     DMP laget uttrekket som versjon. FEST har ingen endringslogg i
--     `datakilder.endringer`; antallet nye, endrede og utgåtte rader per type
--     står i `antall` på kjøringen.
--   * Synkroniseringen og dataene er ellers uendret. Den nattlige jobben
--     kaller `legemiddeldata_start_synk` uten `utlost_av`, som før.

alter table legemiddeldata.synkroniseringer
  add column utlost_av text not null default 'cron' check (utlost_av in ('cron', 'manuell'));

-- --- Starten ---------------------------------------------------------------

drop function public.legemiddeldata_start_synk(text);

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.legemiddeldata_start_synk(kilde text, utlost_av text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  update legemiddeldata.synkroniseringer s
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where s.kilde = legemiddeldata_start_synk.kilde
    and s.status = 'pagar'
    and s.startet_kl < now() - interval '30 minutes';

  delete from legemiddeldata.innlasting i
  using legemiddeldata.synkroniseringer s
  where i.synk_id = s.id and s.status <> 'pagar';

  begin
    insert into legemiddeldata.synkroniseringer (kilde, utlost_av)
    values (legemiddeldata_start_synk.kilde, coalesce(legemiddeldata_start_synk.utlost_av, 'cron'))
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra % pågår allerede.', legemiddeldata_start_synk.kilde
      using errcode = 'PT409';
  end;
  return ny;
end;
$$;

revoke all on function public.legemiddeldata_start_synk(text, text) from public, anon, authenticated, service_role;
grant execute on function public.legemiddeldata_start_synk(text, text) to service_role;

-- --- Statusen ----------------------------------------------------------------

create or replace function public.datakilder_status(antall integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.er_admin() then
    raise exception 'Bare for administratorer.' using errcode = '42501';
  end if;

  return (
    with kjoringer as (
      -- FEST: versjonen er når DMP laget uttrekket (`HentetDato`).
      select 'fest' as kilde, s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             null::text as release, to_char(s.kildedato, 'YYYY-MM-DD"T"HH24:MI:SS') as versjon, s.antall, s.feil
      from legemiddeldata.synkroniseringer s
      where s.kilde = 'FEST'
      union all
      select 'clinpgx', s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             null::text, s.parserversjon::text, s.antall, s.feil
      from clinpgx.synkroniseringer s
      union all
      select 'cpic', s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             s.release, s.skjemaversjon, s.antall, s.feil
      from cpic.synkroniseringer s
    ),
    siste as (
      select k.*, row_number() over (partition by k.kilde order by k.id desc) as nr
      from kjoringer k
    ),
    opptalt as (
      select e.kilde, e.synk_id,
             jsonb_build_object(
               'klinisk', count(*) filter (where e.niva = 'klinisk' and e.art <> 'grunnlag'),
               'metadata', count(*) filter (where e.niva = 'metadata' and e.art <> 'grunnlag'),
               'grunnlag', count(*) filter (where e.art = 'grunnlag')) as endringer
      from datakilder.endringer e
      where e.synk_id is not null
      group by e.kilde, e.synk_id
    )
    select jsonb_build_object(
      'kjoringer', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kilde', s.kilde, 'id', s.id, 'status', s.status, 'utlost_av', s.utlost_av,
          'startet_kl', s.startet_kl, 'avsluttet_kl', s.avsluttet_kl, 'release', s.release,
          'versjon', s.versjon, 'antall', s.antall, 'feil', s.feil,
          'endringer', coalesce(o.endringer, '{"klinisk": 0, "metadata": 0, "grunnlag": 0}'))
          order by s.kilde, s.id desc)
        from siste s
        left join opptalt o on o.kilde = s.kilde and o.synk_id = s.id
        where s.nr <= 10), '[]'),
      -- Det siste som er kjent om hver kilde, også når siste kjøring ikke
      -- fikk oppgitt release eller versjon (CPIC-releasen er valgfri).
      'kilder', coalesce((
        select jsonb_object_agg(k.kilde, jsonb_build_object(
          'release', (select v.release from kjoringer v
                      where v.kilde = k.kilde and v.status not in ('pagar', 'feilet') and v.release is not null
                      order by v.id desc limit 1),
          'versjon', (select v.versjon from kjoringer v
                      where v.kilde = k.kilde and v.status not in ('pagar', 'feilet') and v.versjon is not null
                      order by v.id desc limit 1)))
        from (select distinct kilde from kjoringer) k), '{}'),
      -- Grensen gjelder hver kilde for seg, så en stor release i den ene ikke
      -- skyver den andre ut.
      'endringer', coalesce((
        select jsonb_agg(to_jsonb(e) - 'txid' - 'nr' order by e.registrert_kl desc, e.id desc)
        from (
          select e.*, row_number() over (partition by e.kilde order by e.registrert_kl desc, e.id desc) as nr
          from datakilder.endringer e
        ) e
        where e.nr <= least(greatest(coalesce(datakilder_status.antall, 200), 1), 1000)), '[]')
    )
  );
end;
$$;

comment on schema datakilder is
  'Endringsloggen for datakildene ClinPGx og CPIC. Ingen av API-rollene har tilgang; administratorer leser den og kjøringene fra FEST, ClinPGx og CPIC med datakilder_status().';

notify pgrst, 'reload schema';
