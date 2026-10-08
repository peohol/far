-- Laboratorieanalysene i Farmakologiportalen: hvilke norske laboratorier som
-- analyserer hva, i hvilket prøvemateriale, med hvilken metode og hvilket
-- måleområde.
--
-- Bakgrunnen står i docs/farmakologiportalen.md. Kort fortalt:
--
--   * Portalens JSON-API gir hver type som én liste: enheter, prøvematerialer,
--     institusjoner, laboratorier, komponenter og analyser. Den daglige
--     synkroniseringen henter alle seks, laster dem inn i mellomlageret i
--     porsjoner og bytter dem inn i én transaksjon av fp_fullfor_synk: nye rader
--     legges til, endrede oppdateres, og rader som er borte, merkes som
--     utgått — de slettes aldri. Avvises én type, endres ingenting, og siste
--     gyldige datasett står.
--   * En type som er uendret siden sist (samme kontrollsum og samme
--     parserversjon), lastes ikke inn på nytt.
--   * Hver rad lagres som OUSFAR leste den (`data`) og som portalen ga den
--     (`raa`), så en endring hos portalen skilles fra en endring i lesingen:
--     er rådataene de samme, logges endringen som metadata, med
--     parserversjonene i sporet.
--   * Hvilken komponent en forbindelse på fagsiden svarer til, står i
--     src/data/forbindelser.ts og endres bare i en PR. Synkroniseringen kobler
--     aldri noe selv; den melder det som ikke stemmer (antall.merknader).
--   * Henvisninger som ikke treffer (en analyse av en komponent portalen ikke
--     har), avviser ikke uttrekket — portalen har slike selv — men telles og
--     meldes.
--   * Dataene ligger i skjemaet `farmakologiportalen`, som ingen av API-rollene
--     har tilgang til. Fagsidene leser dem med les_laboratorieanalyser().

create schema farmakologiportalen;
revoke all on schema farmakologiportalen from public;

comment on schema farmakologiportalen is
  'Laboratorieanalysene synkronisert fra Farmakologiportalen. Ingen av API-rollene har tilgang; se funksjonene fp_* og les_laboratorieanalyser i public.';

-- --- Typene som synkroniseres ---------------------------------------------

-- Samme navn som ENTITETNAVN i src/farmakologiportalen/modell.ts, og som
-- tabellene under. Testen sammenligner dem.
create table farmakologiportalen.entiteter (
  navn text primary key,
  -- Et nytt uttrekk må ha minst så stor andel av radene som er aktive i dag.
  minste_andel numeric not null default 0.8 check (minste_andel between 0 and 1),
  -- Kontrollsummen og parserversjonen for typen ved siste vellykkede bytte.
  sha256 text,
  parserversjon integer
);

insert into farmakologiportalen.entiteter (navn, minste_andel) values
  ('enhet', 0.8),
  ('provemateriale', 0.8),
  ('institusjon', 0.8),
  ('laboratorium', 0.8),
  ('komponent', 0.9),
  ('analyse', 0.9);

comment on table farmakologiportalen.entiteter is
  'Typene som synkroniseres fra Farmakologiportalen, hvor mye mindre et nytt uttrekk kan være før det avvises, og kontrollsummen ved siste bytte.';

-- --- Kjøringene ------------------------------------------------------------

create table farmakologiportalen.synkroniseringer (
  id bigint generated always as identity primary key,
  status text not null default 'pagar' check (status in ('pagar', 'fullfort', 'uendret', 'feilet')),
  -- 'cron' for den daglige kjøringen, 'manuell' når en administrator ba om den.
  utlost_av text not null default 'cron' check (utlost_av in ('cron', 'manuell')),
  startet_kl timestamptz not null default now(),
  avsluttet_kl timestamptz,
  parserversjon integer,
  -- Per type: rader inn, nye, endrede, utgåtte, forkastet, eller uendret; og
  -- det som bør vurderes (uavklarte, merknader, brudd).
  antall jsonb,
  feil text
);

create unique index farmakologiportalen_synkroniseringer_en_om_gangen_idx
  on farmakologiportalen.synkroniseringer ((true))
  where status = 'pagar';

comment on table farmakologiportalen.synkroniseringer is
  'Hver synkronisering fra Farmakologiportalen: når, hvem som ba om den, hva som ble nytt, endret eller utgått, hva som bør vurderes, og feilene.';

create table farmakologiportalen.innlasting (
  synk_id bigint not null references farmakologiportalen.synkroniseringer (id) on delete cascade,
  entitet text not null references farmakologiportalen.entiteter (navn),
  fp_id text not null check (char_length(fp_id) between 1 and 40),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  raa jsonb,
  primary key (synk_id, entitet, fp_id)
);

comment on table farmakologiportalen.innlasting is
  'Mellomlager for et uttrekk under innlasting. Tømmes når synkroniseringen fullføres eller avbrytes.';

-- --- Dataene ---------------------------------------------------------------

-- Kolonnene alle typene har:
--   fp_id           portalens ID for raden, som tekst
--   data            raden slik src/farmakologiportalen/modell.ts leste den
--   raa             raden slik portalen ga den (uten bilder)
--   hash            md5 av data og raa, for å se om raden er endret
--   parserversjon   lesingen som ga `data`
--   forst_sett_kl, sist_endret_kl, sist_sett_synk, utgatt_kl
--                   når OUSFAR først så den, sist så en endring, i hvilken
--                   synkronisering den sist var med, og når den forsvant
do $$
declare
  e text;
begin
  for e in select navn from farmakologiportalen.entiteter loop
    execute format(
      $sql$
        create table farmakologiportalen.%I (
          fp_id text primary key,
          data jsonb not null check (jsonb_typeof(data) = 'object'),
          raa jsonb,
          hash text not null,
          parserversjon integer,
          forst_sett_kl timestamptz not null default now(),
          sist_endret_kl timestamptz not null default now(),
          sist_sett_synk bigint references farmakologiportalen.synkroniseringer (id),
          utgatt_kl timestamptz
        )
      $sql$, e);
  end loop;
end;
$$;

-- Nøklene oppslagene og sammenhengskontrollen bruker, hentet ut av dataene.
alter table farmakologiportalen.analyse
  add column komponent_id text generated always as (data ->> 'komponent_id') stored,
  add column laboratorium_id text generated always as (data ->> 'laboratorium_id') stored;
alter table farmakologiportalen.laboratorium
  add column institusjon_id text generated always as (data ->> 'institusjon_id') stored;

create index farmakologiportalen_analyse_komponent_idx on farmakologiportalen.analyse (komponent_id);
create index farmakologiportalen_komponent_gruppe_idx on farmakologiportalen.komponent using gin ((data -> 'gruppe'));

comment on table farmakologiportalen.enhet is 'Enhetene portalen bruker; et måleområde kan oppgi enheten med ID-en.';
comment on table farmakologiportalen.provemateriale is 'Prøvematerialene i portalen.';
comment on table farmakologiportalen.institusjon is 'Institusjonene laboratoriene hører til.';
comment on table farmakologiportalen.laboratorium is 'Laboratoriene i portalen.';
comment on table farmakologiportalen.komponent is 'Komponentene (analyttene) i portalen, med CAS-nummer, molekylvekt og hvilke komponenter en gruppe- eller sumanalyse dekker.';
comment on table farmakologiportalen.analyse is 'Analysene laboratoriene tilbyr: komponent, laboratorium, prøvemateriale, metode, måleområde og enhet, som portalen oppgir dem og som OUSFAR leste dem.';

-- Hvilke typer som viser til hvilke. Henvisninger som ikke treffer, telles og
-- meldes etter et bytte, men avviser det ikke.
create table farmakologiportalen.henvisninger (
  fra text not null references farmakologiportalen.entiteter (navn),
  kolonne text not null,
  til text not null references farmakologiportalen.entiteter (navn),
  primary key (fra, kolonne)
);

insert into farmakologiportalen.henvisninger (fra, kolonne, til) values
  ('analyse', 'komponent_id', 'komponent'),
  ('analyse', 'laboratorium_id', 'laboratorium'),
  ('laboratorium', 'institusjon_id', 'institusjon');

comment on table farmakologiportalen.henvisninger is
  'Henvisningene mellom typene. fp_fullfor_synk teller dem som ikke treffer en aktiv rad.';

-- --- Synkroniseringen ------------------------------------------------------
--
-- Kalles av synkroniseringsjobben på serveren, med den hemmelige nøkkelen.
-- Ingen andre kan kalle dem.

-- Kjøringen som skal endres, låst, og bare om den fortsatt pågår.
create function farmakologiportalen.pagaende(synk bigint)
returns farmakologiportalen.synkroniseringer
language plpgsql
set search_path = ''
as $$
declare
  s farmakologiportalen.synkroniseringer;
begin
  select * into s from farmakologiportalen.synkroniseringer where id = synk for update;
  if not found then
    raise exception 'Synkroniseringen % finnes ikke.', synk using errcode = 'PT404';
  end if;
  if s.status <> 'pagar' then
    raise exception 'Synkroniseringen % er allerede avsluttet.', synk using errcode = '22023';
  end if;
  return s;
end;
$$;

-- Kontrollsummene fra siste vellykkede bytte, så en uendret type ikke lastes
-- inn på nytt: {entiteter: {type: sha256}, parserversjoner: {type: versjon}}.
create function public.fp_forrige_synk()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entiteter', coalesce(jsonb_object_agg(e.navn, e.sha256) filter (where e.sha256 is not null), '{}'),
    'parserversjoner', coalesce(jsonb_object_agg(e.navn, e.parserversjon) filter (where e.parserversjon is not null), '{}'))
  from farmakologiportalen.entiteter e
$$;

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.fp_start_synk(utlost_av text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  delete from farmakologiportalen.innlasting i
  using farmakologiportalen.synkroniseringer s
  where s.id = i.synk_id and s.status = 'pagar' and s.startet_kl < now() - interval '30 minutes';
  update farmakologiportalen.synkroniseringer
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where status = 'pagar' and startet_kl < now() - interval '30 minutes';

  begin
    insert into farmakologiportalen.synkroniseringer (utlost_av) values (coalesce(fp_start_synk.utlost_av, 'cron'))
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra Farmakologiportalen pågår allerede.' using errcode = 'PT409';
  end;
  return ny;
end;
$$;

-- Én porsjon av uttrekket inn i mellomlageret: rader = [{id, data, raa}, ...].
create function public.fp_last_inn(synk bigint, entitet text, rader jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  antall integer;
begin
  perform farmakologiportalen.pagaende(synk);
  if not exists (select 1 from farmakologiportalen.entiteter e where e.navn = fp_last_inn.entitet) then
    raise exception 'Ukjent type: %.', entitet using errcode = '22023';
  end if;
  if jsonb_typeof(rader) <> 'array' then
    raise exception 'Radene skal være en liste.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(rader) r
    where coalesce(r ->> 'id', '') = '' or jsonb_typeof(r -> 'data') is distinct from 'object'
  ) then
    raise exception 'Radene av typen % har feil form.', entitet using errcode = '22023';
  end if;

  insert into farmakologiportalen.innlasting (synk_id, entitet, fp_id, data, raa)
  select synk, fp_last_inn.entitet, r ->> 'id', r -> 'data', nullif(r -> 'raa', 'null')
  from jsonb_array_elements(rader) r;
  get diagnostics antall = row_count;
  return antall;
end;
$$;

-- Bytter inn uttrekket. Alt eller ingenting: avvises én type, endres ingenting.
--
-- innhold = {
--   parserversjon,
--   entiteter: {type: {antall, sha256, lastet, forkastet}},
--   rapport: {uavklarte: [...], merknader: [...]}
-- }
-- `lastet` er usann for en type som er uendret siden sist; den må da ha samme
-- kontrollsum og parserversjon som ved siste bytte. `rapport` er det jobben
-- fant som bør vurderes; henvisningene som ikke treffer, legges til her.
create function public.fp_fullfor_synk(synk bigint, innhold jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  h record;
  oppgitt jsonb;
  pv integer := (innhold ->> 'parserversjon')::integer;
  inn integer;
  aktive integer;
  nye integer;
  endrede integer;
  utgatte integer;
  brudd integer;
  eksempler jsonb;
  noe_lastet boolean := false;
  ny_status text;
  opptelling jsonb := '{}';
  bruddliste jsonb := '[]';
  rapport jsonb := case when jsonb_typeof(innhold -> 'rapport') = 'object' then innhold -> 'rapport' else '{}' end;
begin
  perform farmakologiportalen.pagaende(synk);
  if pv is null then
    raise exception 'Parserversjonen mangler.' using errcode = '22023';
  end if;

  for e in select navn, minste_andel, sha256, parserversjon from farmakologiportalen.entiteter order by navn loop
    oppgitt := innhold -> 'entiteter' -> e.navn;
    if oppgitt is null or oppgitt ->> 'sha256' is null then
      raise exception 'Uttrekket mangler typen %.', e.navn using errcode = '22023';
    end if;

    if not coalesce((oppgitt ->> 'lastet')::boolean, true) then
      if e.sha256 is distinct from oppgitt ->> 'sha256' or e.parserversjon is distinct from pv then
        raise exception 'Typen % er meldt uendret, men kontrollsummen stemmer ikke med siste bytte.', e.navn
          using errcode = '22023';
      end if;
      opptelling := opptelling || jsonb_build_object(e.navn, jsonb_build_object(
        'uendret', true, 'inn', (oppgitt ->> 'antall')::integer,
        'forkastet', coalesce((oppgitt ->> 'forkastet')::integer, 0)));
      continue;
    end if;
    noe_lastet := true;

    select count(*) into inn from farmakologiportalen.innlasting i where i.synk_id = synk and i.entitet = e.navn;
    if inn is distinct from (oppgitt ->> 'antall')::integer then
      raise exception 'Innlastingen av % er ufullstendig: % rader, mot % meldt.', e.navn, inn, oppgitt ->> 'antall'
        using errcode = '22023';
    end if;

    execute format('select count(*) from farmakologiportalen.%I where utgatt_kl is null', e.navn) into aktive;
    if inn = 0 or inn < ceil(aktive * e.minste_andel) then
      raise exception 'Uttrekket ser ufullstendig ut: % rader av typen %, mot % i dag.', inn, e.navn, aktive
        using errcode = '22023';
    end if;

    execute format(
      $sql$
        select
          count(*) filter (where t.fp_id is null),
          count(*) filter (where t.fp_id is not null
                             and (t.hash <> md5(i.data::text || coalesce(i.raa::text, '')) or t.utgatt_kl is not null))
        from farmakologiportalen.innlasting i
        left join farmakologiportalen.%I t on t.fp_id = i.fp_id
        where i.synk_id = $1 and i.entitet = $2
      $sql$, e.navn)
    into nye, endrede
    using synk, e.navn;

    execute format(
      $sql$
        insert into farmakologiportalen.%1$I as t
          (fp_id, data, raa, hash, parserversjon, forst_sett_kl, sist_endret_kl, sist_sett_synk)
        select i.fp_id, i.data, i.raa, md5(i.data::text || coalesce(i.raa::text, '')), $3, now(), now(), $1
        from farmakologiportalen.innlasting i
        where i.synk_id = $1 and i.entitet = $2
        on conflict (fp_id) do update set
          data = excluded.data,
          raa = excluded.raa,
          hash = excluded.hash,
          parserversjon = excluded.parserversjon,
          sist_endret_kl = case
            when t.hash is distinct from excluded.hash or t.utgatt_kl is not null then now()
            else t.sist_endret_kl
          end,
          sist_sett_synk = $1,
          utgatt_kl = null
      $sql$, e.navn)
    using synk, e.navn, pv;

    execute format(
      'update farmakologiportalen.%I set utgatt_kl = now(), sist_endret_kl = now()
       where utgatt_kl is null and sist_sett_synk is distinct from $1', e.navn)
    using synk;
    get diagnostics utgatte = row_count;

    update farmakologiportalen.entiteter set sha256 = oppgitt ->> 'sha256', parserversjon = pv where navn = e.navn;

    opptelling := opptelling || jsonb_build_object(e.navn, jsonb_build_object(
      'inn', inn, 'nye', nye, 'endrede', endrede, 'utgatte', utgatte,
      'forkastet', coalesce((oppgitt ->> 'forkastet')::integer, 0)));
  end loop;

  -- Henvisninger fra en aktiv rad som ikke treffer en aktiv rad: meldes, avviser ikke.
  for h in select fra, kolonne, til from farmakologiportalen.henvisninger order by fra, kolonne loop
    execute format(
      $sql$
        select count(*), coalesce(jsonb_agg(x.id order by x.id) filter (where x.nr <= 5), '[]')
        from (
          select f.fp_id as id, row_number() over (order by f.fp_id) as nr
          from farmakologiportalen.%1$I f
          where f.utgatt_kl is null and f.%2$I is not null
            and not exists (select 1 from farmakologiportalen.%3$I t where t.fp_id = f.%2$I and t.utgatt_kl is null)
        ) x
      $sql$, h.fra, h.kolonne, h.til)
    into brudd, eksempler;
    if brudd > 0 then
      bruddliste := bruddliste || jsonb_build_array(jsonb_build_object(
        'fra', h.fra, 'til', h.til, 'antall', brudd, 'eksempler', eksempler));
    end if;
  end loop;

  delete from farmakologiportalen.innlasting where synk_id = synk;

  ny_status := case when noe_lastet then 'fullfort' else 'uendret' end;
  opptelling := opptelling || jsonb_build_object(
    'uavklarte', case when jsonb_typeof(rapport -> 'uavklarte') = 'array' then rapport -> 'uavklarte' else '[]' end,
    'merknader', case when jsonb_typeof(rapport -> 'merknader') = 'array' then rapport -> 'merknader' else '[]' end,
    'brudd', bruddliste);
  update farmakologiportalen.synkroniseringer set
    status = ny_status,
    avsluttet_kl = now(),
    parserversjon = pv,
    antall = opptelling
  where id = synk;

  return jsonb_build_object('status', ny_status, 'antall', opptelling);
end;
$$;

-- Noe gikk galt: kjøringen merkes som feilet, og mellomlageret tømmes.
create function public.fp_avbryt_synk(synk bigint, feil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform farmakologiportalen.pagaende(synk);
  delete from farmakologiportalen.innlasting where synk_id = synk;
  update farmakologiportalen.synkroniseringer set
    status = 'feilet',
    avsluttet_kl = now(),
    feil = left(fp_avbryt_synk.feil, 2000)
  where id = synk;
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Det fagsidene trenger fra Farmakologiportalen for disse komponentene:
-- komponentene selv, gruppe- og sumanalysene som dekker dem, analysene av
-- alle disse, laboratoriene og institusjonene analysene er fra, og når
-- dataene sist ble kontrollert og endret. Rådataene er ikke med. Hvilke
-- analyser som vises, avgjøres av appen (status og synlighet er med).
create function public.les_laboratorieanalyser(komponenter text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(komponenter), 0) > 200 then
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
      'kilde', jsonb_build_object(
        'navn', 'Farmakologiportalen',
        'endret_kl', (select max(s.avsluttet_kl) from farmakologiportalen.synkroniseringer s where s.status = 'fullfort'),
        'kontrollert_kl', (select max(s.avsluttet_kl) from farmakologiportalen.synkroniseringer s where s.status in ('fullfort', 'uendret'))),
      'komponenter', coalesce((select jsonb_agg(jsonb_build_object('id', v.fp_id, 'data', v.data) order by v.fp_id) from valgte v), '[]'),
      'analyser', coalesce((select jsonb_agg(jsonb_build_object('id', a.fp_id, 'data', a.data) order by a.fp_id) from analyser a), '[]'),
      'laboratorier', coalesce((select jsonb_agg(jsonb_build_object('id', l.fp_id, 'data', l.data) order by l.fp_id) from laboratorier l), '[]'),
      'institusjoner', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.fp_id, 'data', i.data) order by i.fp_id)
        from farmakologiportalen.institusjon i
        where i.utgatt_kl is null and i.fp_id in (select institusjon_id from laboratorier)), '[]')
    )
  );
end;
$$;

-- --- Endringsloggen ----------------------------------------------------------

alter table datakilder.feltregler drop constraint feltregler_kilde_check;
alter table datakilder.feltregler add constraint feltregler_kilde_check
  check (kilde in ('clinpgx', 'cpic', 'pubchem', 'farmakologiportalen'));
alter table datakilder.endringer drop constraint endringer_kilde_check;
alter table datakilder.endringer add constraint endringer_kilde_check
  check (kilde in ('clinpgx', 'cpic', 'pubchem', 'farmakologiportalen'));

-- Feltnavnene er OUSFARs (src/farmakologiportalen/modell.ts). For analysene
-- er alt klinisk som avgjør hva fagsiden viser; navnene, kodene og
-- akkrediteringen er metadata. For komponentene er det molekylvekten
-- (omregningen), CAS-nummeret (koblingen) og hva en sumanalyse dekker.
-- Oppslagstypene er metadata.
insert into datakilder.feltregler (kilde, type, felt, niva) values
  ('farmakologiportalen', 'enhet', '*', 'metadata'),
  ('farmakologiportalen', 'provemateriale', '*', 'metadata'),
  ('farmakologiportalen', 'institusjon', '*', 'metadata'),
  ('farmakologiportalen', 'laboratorium', '*', 'metadata'),
  ('farmakologiportalen', 'komponent', '*', 'metadata'),
  ('farmakologiportalen', 'komponent', 'molvekt', 'klinisk'),
  ('farmakologiportalen', 'komponent', 'cas', 'klinisk'),
  ('farmakologiportalen', 'komponent', 'gruppe', 'klinisk'),
  ('farmakologiportalen', 'analyse', 'navn', 'metadata'),
  ('farmakologiportalen', 'analyse', 'kode', 'metadata'),
  ('farmakologiportalen', 'analyse', 'akkreditert', 'metadata'),
  ('farmakologiportalen', 'analyse', 'laboratorium', 'metadata'),
  ('farmakologiportalen', 'analyse', 'institusjon', 'metadata');

-- Hva et objekt er, i klartekst: som før, og for en analyse i
-- Farmakologiportalen komponenten, laboratoriet og prøvematerialet.
create or replace function datakilder.etikett(kilde text, type text, data jsonb, objekt_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select left(coalesce(nullif(
    case
      when $1 = 'cpic' and $2 in ('anbefaling', 'par') then concat_ws(' · ',
        (select l.data ->> 'navn' from cpic.legemiddel l where l.cpic_id = $3 ->> 'legemiddel_id'),
        case when $2 = 'par' then $3 ->> 'gen' end,
        (select string_agg(e.key || ' ' || e.value, ', ' order by e.key)
         from jsonb_each_text(case when jsonb_typeof($3 -> 'oppslagsnokkel') = 'object' then $3 -> 'oppslagsnokkel' else '{}' end) e),
        $3 ->> 'populasjon')
      when $1 = 'cpic' and $2 = 'genresultat' then concat_ws(' ', $3 ->> 'gen', $3 ->> 'resultat')
      when $1 = 'cpic' and $2 = 'genresultat_oppslag' then $3 ->> 'beskrivelse'
      when $1 = 'cpic' and $2 = 'diplotype' then concat_ws(' ',
        (select string_agg(g, '/' order by g)
         from jsonb_object_keys(case when jsonb_typeof($3 -> 'nokkel') = 'object' then $3 -> 'nokkel' else '{}' end) g),
        $3 ->> 'diplotype')
      when $1 = 'cpic' and $2 in ('allel', 'alleldefinisjon') then concat_ws(' ', $3 ->> 'gen', $3 ->> 'navn')
      when $1 = 'clinpgx' and $2 = 'klinisk' then concat_ws(' · ',
        (select string_agg(g ->> 'symbol', ', ')
         from jsonb_array_elements(case when jsonb_typeof($3 -> 'gener') = 'array' then $3 -> 'gener' else '[]' end) g),
        $3 ->> 'variant',
        'nivå ' || ($3 ->> 'niva'),
        (select string_agg(k ->> 'navn', ', ')
         from jsonb_array_elements(case when jsonb_typeof($3 -> 'legemidler') = 'array' then $3 -> 'legemidler' else '[]' end) k))
      when $1 = 'farmakologiportalen' and $2 = 'analyse' then concat_ws(' · ',
        $3 ->> 'navn', $3 ->> 'laboratorium', $3 -> 'provemateriale' ->> 'original')
      else coalesce($3 ->> 'navn', $3 ->> 'symbol', $3 ->> 'tittel', $3 ->> 'term', $3 ->> 'merknad')
    end, ''), $4), 300)
$$;

-- fp_fullfor_synk bytter inn en type med én insert … on conflict og én update
-- for det som er borte. En type som aldri er byttet inn før, er et grunnlag.
-- Er rådataene de samme og bare lesingen ny, er endringen metadata, med
-- parserversjonene i sporet; ellers logges den etter feltreglene.
create function datakilder.fp_etter_bytte()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk; se datakilder.cpic_etter_bytte.
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from farmakologiportalen.synkroniseringer s where s.status = 'pagar');
  grunnlag boolean := (select e.sha256 is null from farmakologiportalen.entiteter e where e.navn = tg_table_name);
  antall integer;
begin
  if tg_op = 'INSERT' then
    if grunnlag then
      select count(*) into antall from nye;
      if antall > 0 then
        perform datakilder.grunnlag('farmakologiportalen', tg_table_name, synk, tg_table_name,
          'Første innlasting fra Farmakologiportalen', antall);
      end if;
      return null;
    end if;
    perform datakilder.logg('farmakologiportalen', tg_table_name, synk, coalesce((
      select jsonb_agg(jsonb_build_object('id', n.fp_id, 'etter', n.data)) from nye n), '[]'));
    return null;
  end if;

  -- Borte, tilbake, eller nytt svar fra portalen.
  perform datakilder.logg('farmakologiportalen', tg_table_name, synk, coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.fp_id,
      'foer', case when g.utgatt_kl is null then g.data end,
      'etter', case when n.utgatt_kl is null then n.data end,
      'foer_raa', g.raa,
      'etter_raa', n.raa,
      'spor', jsonb_strip_nulls(jsonb_build_object(
        'tilbake', case when g.utgatt_kl is not null and n.utgatt_kl is null then true end,
        'parserversjon', case when g.parserversjon is distinct from n.parserversjon
                              then jsonb_build_object('foer', g.parserversjon, 'etter', n.parserversjon) end))))
    from gamle g
    join nye n on n.fp_id = g.fp_id
    where (g.utgatt_kl is null) is distinct from (n.utgatt_kl is null)
       or (n.utgatt_kl is null and g.raa is distinct from n.raa)), '[]'));

  -- Samme svar, ny lesing.
  insert into datakilder.endringer (kilde, synk_id, type, objekt_id, art, niva, etikett, felt, foer, etter, spor)
  select 'farmakologiportalen', synk, tg_table_name, n.fp_id, 'endret', 'metadata',
         datakilder.etikett('farmakologiportalen', tg_table_name, n.data, n.fp_id),
         array_agg(u.felt order by u.felt), jsonb_object_agg(u.felt, u.foer), jsonb_object_agg(u.felt, u.etter),
         jsonb_build_object('parserversjon', jsonb_build_object('foer', g.parserversjon, 'etter', n.parserversjon))
  from gamle g
  join nye n on n.fp_id = g.fp_id
  cross join lateral datakilder.ulike_felt(g.data, n.data) u
  where g.utgatt_kl is null and n.utgatt_kl is null
    and g.raa is not distinct from n.raa and g.hash is distinct from n.hash
  group by n.fp_id, n.data, g.parserversjon, n.parserversjon;
  return null;
end;
$$;

do $$
declare
  e text;
begin
  for e in select navn from farmakologiportalen.entiteter loop
    execute format(
      'create trigger datakilder_ny after insert on farmakologiportalen.%I referencing new table as nye
         for each statement execute function datakilder.fp_etter_bytte()', e);
    execute format(
      'create trigger datakilder_endret after update on farmakologiportalen.%I referencing old table as gamle new table as nye
         for each statement execute function datakilder.fp_etter_bytte()', e);
  end loop;
end;
$$;

-- --- Statusen ----------------------------------------------------------------
--
-- Som i *_pubchem.sql, med Farmakologiportalen. Versjonen er parserversjonen.

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
      union all
      select 'farmakologiportalen', s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             null::text, s.parserversjon::text, s.antall, s.feil
      from farmakologiportalen.synkroniseringer s
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
  'Endringsloggen for datakildene ClinPGx, CPIC, PubChem og Farmakologiportalen. Ingen av API-rollene har tilgang; administratorer leser den og kjøringene fra FEST, ClinPGx, CPIC, PubChem og Farmakologiportalen med datakilder_status().';

-- --- Rettigheter -----------------------------------------------------------

revoke all on all tables in schema farmakologiportalen from public, anon, authenticated, service_role;
revoke all on all functions in schema farmakologiportalen from public, anon, authenticated, service_role;
revoke all on function datakilder.fp_etter_bytte() from public, anon, authenticated, service_role;

revoke all on function
  public.fp_forrige_synk(),
  public.fp_start_synk(text),
  public.fp_last_inn(bigint, text, jsonb),
  public.fp_fullfor_synk(bigint, jsonb),
  public.fp_avbryt_synk(bigint, text),
  public.les_laboratorieanalyser(text[])
from public, anon, authenticated, service_role;

grant execute on function
  public.fp_forrige_synk(),
  public.fp_start_synk(text),
  public.fp_last_inn(bigint, text, jsonb),
  public.fp_fullfor_synk(bigint, jsonb),
  public.fp_avbryt_synk(bigint, text)
to service_role;

grant execute on function public.les_laboratorieanalyser(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
