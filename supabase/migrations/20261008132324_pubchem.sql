-- Kjemiske grunndata fra PubChem: molekylformelen, molekylvekten, InChIKey og
-- CID for forbindelsene fagsidene handler om og laboratoriene måler.
--
-- Bakgrunnen står i docs/kjemi.md. Kort fortalt:
--
--   * Hvilke forbindelser som finnes, og hvilken CID hver er koblet til, står i
--     src/data/forbindelser.ts og endres bare i en PR, etter kontrollen i
--     scripts/kurer-forbindelser.ts. Synkroniseringen leser koblingene derfra
--     og legger aldri til noen selv. Her ligger bare det PubChem sa om dem sist.
--   * Den ukentlige synkroniseringen henter alle de koblede forbindelsene og
--     bytter dem inn i én transaksjon. En forbindelse der PubChem nå oppgir en
--     annen InChIKey eller formel enn koblingen ble kontrollert mot, eller der
--     svaret mangler eller ikke kan leses, byttes ikke inn: feilen noteres, og
--     det som var der, står.
--   * Endringene logges i datakilder.endringer som for ClinPGx og CPIC. En
--     endring som bare kommer av at OUSFAR leser svaret annerledes (ny
--     parserversjon, samme svar fra PubChem), logges som metadata.
--   * Dataene ligger i skjemaet `pubchem`, som ingen av API-rollene har
--     tilgang til. Fagsidene leser dem med les_kjemi().

create schema pubchem;
revoke all on schema pubchem from public;

comment on schema pubchem is
  'Kjemiske grunndata synkronisert fra PubChem. Ingen av API-rollene har tilgang; se funksjonene pubchem_* og les_kjemi i public.';

-- --- Kjøringene ------------------------------------------------------------

create table pubchem.synkroniseringer (
  id bigint generated always as identity primary key,
  status text not null default 'pagar' check (status in ('pagar', 'fullfort', 'delvis', 'feilet')),
  -- 'cron' for den ukentlige kjøringen, 'manuell' når en administrator ba om den.
  utlost_av text not null default 'cron' check (utlost_av in ('cron', 'manuell')),
  startet_kl timestamptz not null default now(),
  avsluttet_kl timestamptz,
  parserversjon integer,
  -- Hvor mange forbindelser som ble hentet og feilet, og hvilke som er uavklarte.
  antall jsonb,
  feil text
);

create unique index pubchem_synkroniseringer_en_om_gangen_idx
  on pubchem.synkroniseringer ((true))
  where status = 'pagar';

comment on table pubchem.synkroniseringer is
  'Hver synkronisering fra PubChem: når, hvem som ba om den, hva som ble hentet, og feilene.';

-- --- Dataene ---------------------------------------------------------------

create table pubchem.forbindelser (
  cid integer primary key check (cid > 0),
  -- Forbindelsen slik src/kjemi/pubchem.ts leste den. Tom til den er hentet første gang.
  data jsonb check (data is null or jsonb_typeof(data) = 'object'),
  raa jsonb,
  hash text,
  -- Lesingen som ga `data`, så en endring i parseren skilles fra en endring hos PubChem.
  parserversjon integer,
  forst_sett_kl timestamptz not null default now(),
  sist_endret_kl timestamptz,
  -- Når dataene sist ble hentet og byttet inn.
  sist_hentet_kl timestamptz,
  sist_synk bigint references pubchem.synkroniseringer (id),
  -- Siste feil for forbindelsen, og når. Tømmes når den hentes igjen.
  feil text,
  feil_kl timestamptz
);

comment on table pubchem.forbindelser is
  'Forbindelsene i PubChem src/data/forbindelser.ts er koblet til, lest og som de kom, med siste henting og feil.';

-- --- Synkroniseringen ------------------------------------------------------
--
-- Kalles av synkroniseringsjobben på serveren, med den hemmelige nøkkelen.
-- Ingen andre kan kalle dem.

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.pubchem_start_synk(utlost_av text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  update pubchem.synkroniseringer
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where status = 'pagar' and startet_kl < now() - interval '30 minutes';

  begin
    insert into pubchem.synkroniseringer (utlost_av) values (coalesce(pubchem_start_synk.utlost_av, 'cron'))
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra PubChem pågår allerede.' using errcode = 'PT409';
  end;
  return ny;
end;
$$;

-- Kjøringen som skal endres, låst, og bare om den fortsatt pågår.
create function pubchem.pagaende(synk bigint)
returns pubchem.synkroniseringer
language plpgsql
set search_path = ''
as $$
declare
  s pubchem.synkroniseringer;
begin
  select * into s from pubchem.synkroniseringer where id = synk for update;
  if not found then
    raise exception 'Synkroniseringen % finnes ikke.', synk using errcode = 'PT404';
  end if;
  if s.status <> 'pagar' then
    raise exception 'Synkroniseringen % er allerede avsluttet.', synk using errcode = '22023';
  end if;
  return s;
end;
$$;

-- Bytter inn forbindelsene, i én transaksjon: forbindelser = [{cid, data, raa}, ...].
-- Jobben har allerede kontrollert hver mot koblingen; her kontrolleres bare
-- formen, så en feil i jobben aldri gir halve data. Gir antallet som ble
-- byttet inn, og hvor mange av dem som var endret.
create function public.pubchem_lagre(synk bigint, forbindelser jsonb, parserversjon integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  endret integer;
begin
  perform pubchem.pagaende(synk);
  if jsonb_typeof(forbindelser) <> 'array' then
    raise exception 'Forbindelsene skal være en liste.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(forbindelser) f
    where jsonb_typeof(f -> 'cid') <> 'number' or (f ->> 'cid')::numeric <= 0 or (f ->> 'cid')::numeric <> trunc((f ->> 'cid')::numeric)
       or jsonb_typeof(f -> 'data') <> 'object'
       or (f -> 'data' ->> 'cid') is distinct from (f ->> 'cid')
       or coalesce(f -> 'data' ->> 'formel', '') = ''
       or coalesce(f -> 'data' ->> 'molvekt', '') !~ '^[0-9]+(\.[0-9]+)?$'
       or coalesce(f -> 'data' ->> 'inchikey', '') !~ '^[A-Z]{14}-[A-Z]{10}-[A-Z]$'
  ) then
    raise exception 'Forbindelsene har feil form.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct f ->> 'cid') from jsonb_array_elements(forbindelser) f) then
    raise exception 'En forbindelse står to ganger.' using errcode = '22023';
  end if;

  select count(*) into endret
  from jsonb_array_elements(forbindelser) f
  join pubchem.forbindelser p on p.cid = (f ->> 'cid')::integer
  where p.hash is distinct from md5((f -> 'data')::text);

  insert into pubchem.forbindelser as p (cid, data, raa, hash, parserversjon, sist_endret_kl, sist_hentet_kl, sist_synk, feil, feil_kl)
  select (f ->> 'cid')::integer, f -> 'data', coalesce(f -> 'raa', 'null'), md5((f -> 'data')::text),
         pubchem_lagre.parserversjon, now(), now(), synk, null, null
  from jsonb_array_elements(forbindelser) f
  on conflict (cid) do update set
    data = excluded.data,
    raa = excluded.raa,
    hash = excluded.hash,
    parserversjon = excluded.parserversjon,
    sist_endret_kl = case when p.hash is distinct from excluded.hash then now() else p.sist_endret_kl end,
    sist_hentet_kl = now(),
    sist_synk = synk,
    feil = null,
    feil_kl = null;

  return jsonb_build_object('lagret', jsonb_array_length(forbindelser), 'endret', endret);
end;
$$;

-- Forbindelsene som ikke kunne byttes inn: feil = [{cid, feil}, ...]. Feilen
-- noteres, og dataene står som før.
create function public.pubchem_feilet(synk bigint, feil jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pubchem.pagaende(synk);
  if jsonb_typeof(feil) <> 'array' or exists (
    select 1 from jsonb_array_elements(feil) f
    where jsonb_typeof(f -> 'cid') <> 'number' or (f ->> 'cid')::numeric <= 0 or coalesce(f ->> 'feil', '') = ''
  ) then
    raise exception 'Feilene har feil form.' using errcode = '22023';
  end if;
  insert into pubchem.forbindelser as p (cid, sist_synk, feil, feil_kl)
  select distinct on ((f ->> 'cid')::integer) (f ->> 'cid')::integer, synk, left(f ->> 'feil', 2000), now()
  from jsonb_array_elements(feil) f
  order by (f ->> 'cid')::integer
  on conflict (cid) do update set
    sist_synk = synk,
    feil = excluded.feil,
    feil_kl = now();
end;
$$;

-- Kjøringen er ferdig. `resultat` er tellingen jobben gjorde; er noe
-- feilet, er kjøringen «delvis».
create function public.pubchem_fullfor_synk(synk bigint, resultat jsonb, parserversjon integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny text;
begin
  perform pubchem.pagaende(synk);
  ny := case when coalesce((resultat ->> 'feilet')::integer, 0) = 0 then 'fullfort' else 'delvis' end;
  update pubchem.synkroniseringer set
    status = ny,
    avsluttet_kl = now(),
    antall = resultat,
    parserversjon = pubchem_fullfor_synk.parserversjon,
    feil = nullif(left(resultat ->> 'feil', 2000), '')
  where id = synk;
  return ny;
end;
$$;

-- Noe gikk galt før noe kunne byttes inn: kjøringen merkes som feilet, og
-- ingenting er endret.
create function public.pubchem_avbryt_synk(synk bigint, feil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pubchem.pagaende(synk);
  update pubchem.synkroniseringer set
    status = 'feilet',
    avsluttet_kl = now(),
    feil = left(pubchem_avbryt_synk.feil, 2000)
  where id = synk;
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Det fagsidene trenger fra PubChem for disse CID-ene: dataene, når de sist
-- ble hentet og endret, og når en synkronisering sist gikk til ende.
-- Rådataene er ikke med.
create function public.les_kjemi(cider integer[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(cider), 0) > 200 then
    raise exception 'For mange forbindelser.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'kilde', 'PubChem',
    'kontrollert_kl', (
      select max(s.avsluttet_kl) from pubchem.synkroniseringer s where s.status in ('fullfort', 'delvis')),
    'forbindelser', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cid', p.cid,
        'data', p.data,
        'sist_hentet_kl', p.sist_hentet_kl,
        'sist_endret_kl', p.sist_endret_kl) order by p.cid)
      from pubchem.forbindelser p
      where p.cid = any (cider) and p.data is not null), '[]')
  );
end;
$$;

-- --- Endringsloggen ----------------------------------------------------------

alter table datakilder.feltregler drop constraint feltregler_kilde_check;
alter table datakilder.feltregler add constraint feltregler_kilde_check check (kilde in ('clinpgx', 'cpic', 'pubchem'));
alter table datakilder.endringer drop constraint endringer_kilde_check;
alter table datakilder.endringer add constraint endringer_kilde_check check (kilde in ('clinpgx', 'cpic', 'pubchem'));

-- Feltnavnene er OUSFARs (src/kjemi/pubchem.ts). Identiteten og det
-- omregningen bygger på, er kliniske; navnene og den monoisotopiske massen er
-- metadata.
insert into datakilder.feltregler (kilde, type, felt, niva) values
  ('pubchem', 'forbindelse', 'tittel', 'metadata'),
  ('pubchem', 'forbindelse', 'iupac', 'metadata'),
  ('pubchem', 'forbindelse', 'monoisotopisk_masse', 'metadata');

-- pubchem_lagre bytter inn alt med én insert … on conflict. Det som settes
-- inn, og det som får data for første gang, er et grunnlag; det som endres,
-- logges. Er svaret fra PubChem det samme og bare lesingen ny, er endringen
-- metadata, med parserversjonene i sporet.
create function datakilder.pubchem_forbindelse_endret()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk; se datakilder.cpic_etter_bytte.
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from pubchem.synkroniseringer s where s.status = 'pagar');
  forste jsonb;
  antall integer;
begin
  if tg_op = 'INSERT' then
    select jsonb_agg(jsonb_build_object('cid', n.cid, 'tittel', n.data ->> 'tittel') order by n.cid) into forste
    from nye n where n.data is not null;
  else
    select jsonb_agg(jsonb_build_object('cid', n.cid, 'tittel', n.data ->> 'tittel') order by n.cid) into forste
    from nye n join gamle g on g.cid = n.cid
    where n.data is not null and g.data is null;
  end if;
  antall := coalesce(jsonb_array_length(forste), 0);
  if antall = 1 then
    perform datakilder.grunnlag('pubchem', 'forbindelse', synk, forste -> 0 ->> 'cid',
      coalesce(forste -> 0 ->> 'tittel', 'CID ' || (forste -> 0 ->> 'cid')) || ': første henting fra PubChem', null);
  elsif antall > 1 then
    perform datakilder.grunnlag('pubchem', 'forbindelse', synk, 'forbindelser',
      'Første henting fra PubChem: ' || antall || ' forbindelser', antall);
  end if;
  if tg_op = 'INSERT' then
    return null;
  end if;

  -- Nytt svar fra PubChem.
  perform datakilder.logg('pubchem', 'forbindelse', synk, coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.cid::text,
      'foer', g.data,
      'etter', n.data,
      'foer_raa', g.raa,
      'etter_raa', n.raa,
      'spor', jsonb_strip_nulls(jsonb_build_object(
        'parserversjon', case when g.parserversjon is distinct from n.parserversjon
                              then jsonb_build_object('foer', g.parserversjon, 'etter', n.parserversjon) end))))
    from gamle g
    join nye n on n.cid = g.cid
    where g.data is not null and n.data is not null and g.raa is distinct from n.raa), '[]'));

  -- Samme svar, ny lesing.
  insert into datakilder.endringer (kilde, synk_id, type, objekt_id, art, niva, etikett, felt, foer, etter, spor)
  select 'pubchem', synk, 'forbindelse', n.cid::text, 'endret', 'metadata',
         datakilder.etikett('pubchem', 'forbindelse', n.data, n.cid::text),
         array_agg(u.felt order by u.felt), jsonb_object_agg(u.felt, u.foer), jsonb_object_agg(u.felt, u.etter),
         jsonb_build_object('parserversjon', jsonb_build_object('foer', g.parserversjon, 'etter', n.parserversjon))
  from gamle g
  join nye n on n.cid = g.cid
  cross join lateral datakilder.ulike_felt(g.data, n.data) u
  where g.data is not null and n.data is not null and g.raa is not distinct from n.raa and g.hash is distinct from n.hash
  group by n.cid, n.data, g.parserversjon, n.parserversjon;
  return null;
end;
$$;

create trigger datakilder_ny after insert on pubchem.forbindelser referencing new table as nye
  for each statement execute function datakilder.pubchem_forbindelse_endret();
create trigger datakilder_endret after update on pubchem.forbindelser referencing old table as gamle new table as nye
  for each statement execute function datakilder.pubchem_forbindelse_endret();

-- --- Statusen ----------------------------------------------------------------
--
-- Som i *_fest_i_datakilder.sql, med PubChem. Versjonen er parserversjonen.

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
      union all
      select 'pubchem', s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             null::text, s.parserversjon::text, s.antall, s.feil
      from pubchem.synkroniseringer s
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
                      order by v.id desc limit 1),
          -- Også når den er eldre enn de ti kjøringene over.
          'sist_vellykket_kl', (select coalesce(v.avsluttet_kl, v.startet_kl) from kjoringer v
                                where v.kilde = k.kilde and v.status in ('fullfort', 'delvis', 'uendret')
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
  'Endringsloggen for datakildene ClinPGx, CPIC og PubChem. Ingen av API-rollene har tilgang; administratorer leser den og kjøringene fra FEST, ClinPGx, CPIC og PubChem med datakilder_status().';

-- --- Rettigheter -----------------------------------------------------------

revoke all on all tables in schema pubchem from public, anon, authenticated, service_role;
revoke all on all functions in schema pubchem from public, anon, authenticated, service_role;
revoke all on function datakilder.pubchem_forbindelse_endret() from public, anon, authenticated, service_role;

revoke all on function
  public.pubchem_start_synk(text),
  public.pubchem_lagre(bigint, jsonb, integer),
  public.pubchem_feilet(bigint, jsonb),
  public.pubchem_fullfor_synk(bigint, jsonb, integer),
  public.pubchem_avbryt_synk(bigint, text),
  public.les_kjemi(integer[])
from public, anon, authenticated, service_role;

grant execute on function
  public.pubchem_start_synk(text),
  public.pubchem_lagre(bigint, jsonb, integer),
  public.pubchem_feilet(bigint, jsonb),
  public.pubchem_fullfor_synk(bigint, jsonb, integer),
  public.pubchem_avbryt_synk(bigint, text)
to service_role;

grant execute on function public.les_kjemi(integer[]) to authenticated, service_role;

notify pgrst, 'reload schema';
