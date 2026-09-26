-- Strukturerte farmakogenetiske data fra CPIC: OUSFARs egen kopi av CPIC-
-- databasen (legemidler, gener, retningslinjer, gen–legemiddel-par,
-- anbefalinger, genresultater, diplotyper, alleler og publikasjoner).
--
-- Bakgrunnen står i docs/cpic.md. Kort fortalt:
--
--   * CPIC er et eget lag ved siden av ClinPGx-kopien (skjemaet `clinpgx`).
--     Koblingen til ClinPGx og legemiddelidentiteten går gjennom
--     identifikatorene CPIC selv oppgir (ClinPGx-ID, RxNorm, ATC), ikke
--     gjennom fremmednøkler til andre skjemaer.
--   * Hele CPIC-databasen hentes som ett uttrekk, lastes inn i mellomlageret
--     i porsjoner og byttes inn i én transaksjon av `cpic_fullfor_synk`: nye
--     rader legges til, endrede oppdateres, og rader som er borte fra
--     uttrekket, merkes som utgått — de slettes aldri. Avvises én type, eller
--     henger ikke uttrekket sammen, endres ingenting, og siste gyldige
--     datasett står.
--   * En type som er uendret siden sist (samme kontrollsum og samme
--     parserversjon), lastes ikke inn på nytt.
--   * Verdiene er CPICs egne, uoversatt: fenotyper, aktivitetsverdier,
--     allelstatus, anbefalingstekster og klassifiseringer. Bare feltnavnene
--     er OUSFARs.

create schema cpic;
revoke all on schema cpic from public;

comment on schema cpic is
  'Strukturerte farmakogenetiske data synkronisert fra CPIC. Ingen av API-rollene har tilgang; se funksjonene cpic_* og les_cpic i public.';

-- --- Typene som synkroniseres ---------------------------------------------

-- Samme navn som ENTITETER i src/cpic/modell.ts, og som tabellene under.
-- Testen sammenligner dem.
create table cpic.entiteter (
  navn text primary key,
  -- Et nytt uttrekk må ha minst så stor andel av radene som er aktive i dag.
  minste_andel numeric not null default 0.8 check (minste_andel between 0 and 1),
  -- Kontrollsummen og parserversjonen for typen ved siste vellykkede bytte.
  sha256 text,
  parserversjon integer
);

insert into cpic.entiteter (navn) values
  ('legemiddel'),
  ('gen'),
  ('retningslinje'),
  ('par'),
  ('anbefaling'),
  ('genresultat'),
  ('genresultat_oppslag'),
  ('diplotype'),
  ('allel'),
  ('alleldefinisjon'),
  ('publikasjon'),
  ('term'),
  ('endring');

comment on table cpic.entiteter is
  'Typene som synkroniseres fra CPIC, hvor mye mindre et nytt uttrekk kan være før det avvises, og kontrollsummen ved siste bytte.';

-- --- Kjøringene ------------------------------------------------------------

create table cpic.synkroniseringer (
  id bigint generated always as identity primary key,
  status text not null default 'pagar' check (status in ('pagar', 'fullfort', 'uendret', 'feilet')),
  -- 'cron' for den ukentlige kjøringen, 'manuell' når en administrator ba om den.
  utlost_av text not null default 'cron' check (utlost_av in ('cron', 'manuell')),
  startet_kl timestamptz not null default now(),
  avsluttet_kl timestamptz,
  -- Hvilken CPIC-database dataene kom fra: siste publiserte release da de ble
  -- hentet (GitHub, cpicpgx/cpic-data), og skjemaversjonen API-et oppga.
  release text,
  release_dato timestamptz,
  skjemaversjon text,
  skjema_kl timestamptz,
  parserversjon integer,
  -- Per type: rader inn, nye, endrede, utgåtte, forkastet, eller uendret.
  antall jsonb,
  feil text
);

create unique index cpic_synkroniseringer_en_om_gangen_idx
  on cpic.synkroniseringer ((true))
  where status = 'pagar';

comment on table cpic.synkroniseringer is
  'Hver synkronisering fra CPIC: når, hvem som ba om den, hvilken release, hva som ble nytt, endret eller utgått, og feilene.';

create table cpic.innlasting (
  synk_id bigint not null references cpic.synkroniseringer (id) on delete cascade,
  entitet text not null references cpic.entiteter (navn),
  cpic_id text not null check (char_length(cpic_id) between 1 and 200),
  cpic_versjon integer,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  raa jsonb,
  primary key (synk_id, entitet, cpic_id)
);

comment on table cpic.innlasting is
  'Mellomlager for et uttrekk under innlasting. Tømmes når synkroniseringen fullføres eller avbrytes.';

-- --- Dataene ---------------------------------------------------------------

-- Kolonnene alle typene har:
--   cpic_id         CPICs ID for raden, som tekst
--   cpic_versjon    CPICs versjonsnummer for raden (økes når CPIC endrer den)
--   data            raden slik src/cpic/modell.ts leste den
--   raa             raden slik CPIC ga den (ikke for diplotypene)
--   hash            md5 av data og raa, for å se om raden er endret
--   forst_sett_kl, sist_endret_kl, sist_sett_synk, utgatt_kl
--                   når OUSFAR først så den, sist så en endring, i hvilken
--                   synkronisering den sist var med, og når den forsvant
do $$
declare
  e text;
begin
  for e in select navn from cpic.entiteter loop
    execute format(
      $sql$
        create table cpic.%I (
          cpic_id text primary key,
          cpic_versjon integer,
          data jsonb not null check (jsonb_typeof(data) = 'object'),
          raa jsonb,
          hash text not null,
          forst_sett_kl timestamptz not null default now(),
          sist_endret_kl timestamptz not null default now(),
          sist_sett_synk bigint references cpic.synkroniseringer (id),
          utgatt_kl timestamptz
        )
      $sql$, e);
  end loop;
end;
$$;

-- Nøklene oppslagene og sammenhengskontrollen bruker, hentet ut av dataene.
alter table cpic.legemiddel
  add column clinpgx_id text generated always as (data ->> 'clinpgx_id') stored,
  add column retningslinje_id text generated always as (data ->> 'retningslinje_id') stored;
alter table cpic.retningslinje
  add column clinpgx_id text generated always as (data ->> 'clinpgx_id') stored;
alter table cpic.par
  add column gen text generated always as (data ->> 'gen') stored,
  add column legemiddel_id text generated always as (data ->> 'legemiddel_id') stored,
  add column retningslinje_id text generated always as (data ->> 'retningslinje_id') stored;
alter table cpic.anbefaling
  add column legemiddel_id text generated always as (data ->> 'legemiddel_id') stored,
  add column retningslinje_id text generated always as (data ->> 'retningslinje_id') stored;
alter table cpic.genresultat
  add column gen text generated always as (data ->> 'gen') stored;
alter table cpic.genresultat_oppslag
  add column genresultat_id text generated always as (data ->> 'genresultat_id') stored;
alter table cpic.diplotype
  add column oppslag_id text generated always as (data ->> 'oppslag_id') stored,
  add column diplotype text generated always as (data ->> 'diplotype') stored;
alter table cpic.allel
  add column gen text generated always as (data ->> 'gen') stored,
  add column definisjon_id text generated always as (data ->> 'definisjon_id') stored;
alter table cpic.alleldefinisjon
  add column gen text generated always as (data ->> 'gen') stored;
alter table cpic.publikasjon
  add column retningslinje_id text generated always as (data ->> 'retningslinje_id') stored;

create index cpic_legemiddel_clinpgx_idx on cpic.legemiddel (clinpgx_id);
create index cpic_legemiddel_atc_idx on cpic.legemiddel using gin ((data -> 'atc'));
create index cpic_par_legemiddel_idx on cpic.par (legemiddel_id);
create index cpic_anbefaling_legemiddel_idx on cpic.anbefaling (legemiddel_id);
create index cpic_genresultat_gen_idx on cpic.genresultat (gen);
create index cpic_genresultat_oppslag_idx on cpic.genresultat_oppslag (genresultat_id);
create index cpic_diplotype_oppslag_idx on cpic.diplotype (oppslag_id);
create index cpic_allel_gen_idx on cpic.allel (gen);
create index cpic_publikasjon_retningslinje_idx on cpic.publikasjon (retningslinje_id);

comment on table cpic.legemiddel is 'Legemidlene i CPIC, med ClinPGx-ID, RxNorm, DrugBank og ATC.';
comment on table cpic.gen is 'Genene i CPIC, med hvordan et resultat for genet slås opp (fenotype, aktivitetsverdi eller allelstatus).';
comment on table cpic.retningslinje is 'CPICs retningslinjer.';
comment on table cpic.par is 'Gen–legemiddel-parene CPIC har vurdert, med CPIC-nivå, også de som er fjernet.';
comment on table cpic.anbefaling is 'Anbefalingene i retningslinjene: betingelsene per gen, anbefalingen, klassifiseringen, populasjonen og merknadene.';
comment on table cpic.genresultat is 'Mulige resultater (fenotyper eller allelstatus) for hvert gen.';
comment on table cpic.genresultat_oppslag is 'Kombinasjonene av allelfunksjoner eller aktivitetsverdier som gir et genresultat.';
comment on table cpic.diplotype is 'Diplotypene som hører til hver kombinasjon, og dermed til et genresultat.';
comment on table cpic.allel is 'Allelene og funksjonen CPIC har gitt dem.';
comment on table cpic.alleldefinisjon is 'Definisjonene av allelene, med PharmVar-ID.';
comment on table cpic.publikasjon is 'Publikasjonene retningslinjene bygger på.';
comment on table cpic.term is 'CPICs standardiserte termer for farmakogenetiske resultater.';
comment on table cpic.endring is 'CPICs egen endringslogg for dataene.';

-- Hvilke typer som viser til hvilke. Etter et bytte skal hver henvisning fra
-- en aktiv rad treffe en aktiv rad; ellers avvises hele uttrekket.
create table cpic.henvisninger (
  fra text not null references cpic.entiteter (navn),
  kolonne text not null,
  til text not null references cpic.entiteter (navn),
  primary key (fra, kolonne)
);

insert into cpic.henvisninger (fra, kolonne, til) values
  ('legemiddel', 'retningslinje_id', 'retningslinje'),
  ('par', 'gen', 'gen'),
  ('par', 'legemiddel_id', 'legemiddel'),
  ('par', 'retningslinje_id', 'retningslinje'),
  ('anbefaling', 'legemiddel_id', 'legemiddel'),
  ('anbefaling', 'retningslinje_id', 'retningslinje'),
  ('genresultat', 'gen', 'gen'),
  ('genresultat_oppslag', 'genresultat_id', 'genresultat'),
  ('diplotype', 'oppslag_id', 'genresultat_oppslag'),
  ('allel', 'gen', 'gen'),
  ('allel', 'definisjon_id', 'alleldefinisjon'),
  ('alleldefinisjon', 'gen', 'gen'),
  ('publikasjon', 'retningslinje_id', 'retningslinje');

comment on table cpic.henvisninger is
  'Henvisningene mellom typene. cpic_fullfor_synk avviser et uttrekk der en aktiv rad viser til noe som ikke finnes.';

-- Betingelsene for hver anbefaling, én rad per gen: det anbefalingen slås opp
-- på (CPICs oppslagsverdi), og fenotypen, aktivitetsverdien eller
-- allelstatusen den gjelder. Én anbefaling kan ha flere gener.
create view cpic.anbefalingsbetingelser
with (security_invoker = true) as
  select
    a.cpic_id as anbefaling_id,
    a.legemiddel_id,
    a.retningslinje_id,
    b ->> 'gen' as gen,
    b ->> 'oppslagsverdi' as oppslagsverdi,
    b ->> 'fenotype' as fenotype,
    b ->> 'aktivitetsverdi' as aktivitetsverdi,
    b ->> 'allelstatus' as allelstatus
  from cpic.anbefaling a,
       jsonb_array_elements(a.data -> 'betingelser') b
  where a.utgatt_kl is null;

comment on view cpic.anbefalingsbetingelser is
  'Betingelsene for de aktive anbefalingene, én rad per anbefaling og gen.';

-- --- Synkroniseringen ------------------------------------------------------
--
-- Kalles av synkroniseringsjobben på serveren, med den hemmelige nøkkelen.
-- Ingen andre kan kalle dem.

-- Kjøringen som skal endres, låst, og bare om den fortsatt pågår.
create function cpic.pagaende(synk bigint)
returns cpic.synkroniseringer
language plpgsql
set search_path = ''
as $$
declare
  s cpic.synkroniseringer;
begin
  select * into s from cpic.synkroniseringer where id = synk for update;
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
-- inn på nytt: {parserversjon, entiteter: {type: sha256}}.
create function public.cpic_forrige_synk()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'entiteter', coalesce(jsonb_object_agg(e.navn, e.sha256) filter (where e.sha256 is not null), '{}'),
    'parserversjoner', coalesce(jsonb_object_agg(e.navn, e.parserversjon) filter (where e.parserversjon is not null), '{}'))
  from cpic.entiteter e
$$;

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.cpic_start_synk(utlost_av text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  delete from cpic.innlasting i
  using cpic.synkroniseringer s
  where s.id = i.synk_id and s.status = 'pagar' and s.startet_kl < now() - interval '30 minutes';
  update cpic.synkroniseringer
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where status = 'pagar' and startet_kl < now() - interval '30 minutes';

  begin
    insert into cpic.synkroniseringer (utlost_av) values (coalesce(cpic_start_synk.utlost_av, 'cron'))
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra CPIC pågår allerede.' using errcode = 'PT409';
  end;
  return ny;
end;
$$;

-- Én porsjon av uttrekket inn i mellomlageret:
-- rader = [{id, versjon, data, raa}, ...].
create function public.cpic_last_inn(synk bigint, entitet text, rader jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  antall integer;
begin
  perform cpic.pagaende(synk);
  if not exists (select 1 from cpic.entiteter e where e.navn = cpic_last_inn.entitet) then
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

  insert into cpic.innlasting (synk_id, entitet, cpic_id, cpic_versjon, data, raa)
  select synk, cpic_last_inn.entitet, r ->> 'id',
         case when jsonb_typeof(r -> 'versjon') = 'number' then (r ->> 'versjon')::integer end,
         r -> 'data', nullif(r -> 'raa', 'null')
  from jsonb_array_elements(rader) r;
  get diagnostics antall = row_count;
  return antall;
end;
$$;

-- Bytter inn uttrekket. Alt eller ingenting: avvises én type, eller viser en
-- aktiv rad til noe som ikke finnes etter byttet, endres ingenting.
--
-- innhold = {
--   release, release_dato, skjemaversjon, skjema_kl, parserversjon,
--   entiteter: {type: {antall, sha256, lastet, forkastet}}
-- }
-- `lastet` er usann for en type som er uendret siden sist; den må da ha samme
-- kontrollsum og parserversjon som ved siste bytte.
create function public.cpic_fullfor_synk(synk bigint, innhold jsonb)
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
  eksempel text;
  noe_lastet boolean := false;
  ny_status text;
  opptelling jsonb := '{}';
begin
  perform cpic.pagaende(synk);
  if pv is null then
    raise exception 'Parserversjonen mangler.' using errcode = '22023';
  end if;

  for e in select navn, minste_andel, sha256, parserversjon from cpic.entiteter order by navn loop
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

    select count(*) into inn from cpic.innlasting i where i.synk_id = synk and i.entitet = e.navn;
    if inn is distinct from (oppgitt ->> 'antall')::integer then
      raise exception 'Innlastingen av % er ufullstendig: % rader, mot % meldt.', e.navn, inn, oppgitt ->> 'antall'
        using errcode = '22023';
    end if;

    execute format('select count(*) from cpic.%I where utgatt_kl is null', e.navn) into aktive;
    if inn = 0 or inn < ceil(aktive * e.minste_andel) then
      raise exception 'Uttrekket ser ufullstendig ut: % rader av typen %, mot % i dag.', inn, e.navn, aktive
        using errcode = '22023';
    end if;

    execute format(
      $sql$
        select
          count(*) filter (where t.cpic_id is null),
          count(*) filter (where t.cpic_id is not null
                             and (t.hash <> md5(i.data::text || coalesce(i.raa::text, '')) or t.utgatt_kl is not null))
        from cpic.innlasting i
        left join cpic.%I t on t.cpic_id = i.cpic_id
        where i.synk_id = $1 and i.entitet = $2
      $sql$, e.navn)
    into nye, endrede
    using synk, e.navn;

    execute format(
      $sql$
        insert into cpic.%1$I as t
          (cpic_id, cpic_versjon, data, raa, hash, forst_sett_kl, sist_endret_kl, sist_sett_synk)
        select i.cpic_id, i.cpic_versjon, i.data, i.raa, md5(i.data::text || coalesce(i.raa::text, '')), now(), now(), $1
        from cpic.innlasting i
        where i.synk_id = $1 and i.entitet = $2
        on conflict (cpic_id) do update set
          cpic_versjon = excluded.cpic_versjon,
          data = excluded.data,
          raa = excluded.raa,
          hash = excluded.hash,
          sist_endret_kl = case
            when t.hash is distinct from excluded.hash or t.utgatt_kl is not null then now()
            else t.sist_endret_kl
          end,
          sist_sett_synk = $1,
          utgatt_kl = null
      $sql$, e.navn)
    using synk, e.navn;

    execute format(
      'update cpic.%I set utgatt_kl = now(), sist_endret_kl = now()
       where utgatt_kl is null and sist_sett_synk is distinct from $1', e.navn)
    using synk;
    get diagnostics utgatte = row_count;

    update cpic.entiteter set sha256 = oppgitt ->> 'sha256', parserversjon = pv where navn = e.navn;

    opptelling := opptelling || jsonb_build_object(e.navn, jsonb_build_object(
      'inn', inn, 'nye', nye, 'endrede', endrede, 'utgatte', utgatte,
      'forkastet', coalesce((oppgitt ->> 'forkastet')::integer, 0)));
  end loop;

  -- Henger uttrekket sammen? Hver henvisning fra en aktiv rad skal treffe en aktiv rad.
  for h in select fra, kolonne, til from cpic.henvisninger order by fra, kolonne loop
    execute format(
      $sql$
        select count(*), min(f.%2$I)
        from cpic.%1$I f
        where f.utgatt_kl is null and f.%2$I is not null
          and not exists (select 1 from cpic.%3$I t where t.cpic_id = f.%2$I and t.utgatt_kl is null)
      $sql$, h.fra, h.kolonne, h.til)
    into brudd, eksempel;
    if brudd > 0 then
      raise exception 'Uttrekket henger ikke sammen: % rader av typen % viser til % som ikke finnes (f.eks. %).',
        brudd, h.fra, h.til, eksempel using errcode = '22023';
    end if;
  end loop;

  delete from cpic.innlasting where synk_id = synk;

  ny_status := case when noe_lastet then 'fullfort' else 'uendret' end;
  update cpic.synkroniseringer set
    status = ny_status,
    avsluttet_kl = now(),
    release = innhold ->> 'release',
    release_dato = (innhold ->> 'release_dato')::timestamptz,
    skjemaversjon = innhold ->> 'skjemaversjon',
    skjema_kl = (innhold ->> 'skjema_kl')::timestamptz,
    parserversjon = pv,
    antall = opptelling
  where id = synk;

  return jsonb_build_object('status', ny_status, 'antall', opptelling);
end;
$$;

-- Noe gikk galt: kjøringen merkes som feilet, og mellomlageret tømmes.
create function public.cpic_avbryt_synk(synk bigint, feil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cpic.pagaende(synk);
  delete from cpic.innlasting where synk_id = synk;
  update cpic.synkroniseringer set
    status = 'feilet',
    avsluttet_kl = now(),
    feil = left(cpic_avbryt_synk.feil, 2000)
  where id = synk;
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Hvilken CPIC-database som ligger inne: release og skjemaversjon fra siste
-- vellykkede kjøring som fikk dem oppgitt (også en uendret kjøring: releasen
-- kan komme etter dataene), når dataene sist ble byttet inn, og når de sist
-- ble kontrollert mot CPIC.
create function cpic.kilde()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'navn', 'CPIC',
    'release', r.release,
    'release_dato', r.release_dato,
    'skjemaversjon', (
      select s.skjemaversjon from cpic.synkroniseringer s
      where s.status in ('fullfort', 'uendret') and s.skjemaversjon is not null
      order by s.id desc limit 1),
    'endret_kl', (
      select max(s.avsluttet_kl) from cpic.synkroniseringer s where s.status = 'fullfort'),
    'kontrollert_kl', (
      select max(s.avsluttet_kl) from cpic.synkroniseringer s where s.status in ('fullfort', 'uendret')))
  from (select 1) x
  left join lateral (
    select s.release, s.release_dato from cpic.synkroniseringer s
    where s.status in ('fullfort', 'uendret') and s.release is not null
    order by s.id desc limit 1
  ) r on true
$$;

-- Alt CPIC har om legemidlene med disse ClinPGx-ID-ene: legemidlene,
-- gen–legemiddel-parene (også fjernede, merket), retningslinjene med
-- publikasjonene, anbefalingene, genene i parene og de mulige resultatene for
-- dem, og hvilken CPIC-database dataene kommer fra. Rådataene er ikke med.
create function public.les_cpic(clinpgx_ider text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(clinpgx_ider), 0) > 200 then
    raise exception 'For mange legemidler.' using errcode = '22023';
  end if;

  return (
    with legemidler as (
      select l.cpic_id, l.data
      from cpic.legemiddel l
      where l.utgatt_kl is null and l.clinpgx_id = any (clinpgx_ider)
    ),
    par as (
      select p.cpic_id, p.data, p.gen, p.retningslinje_id
      from cpic.par p
      where p.utgatt_kl is null and p.legemiddel_id in (select cpic_id from legemidler)
    ),
    anbefalinger as (
      select a.cpic_id, a.data, a.retningslinje_id
      from cpic.anbefaling a
      where a.utgatt_kl is null and a.legemiddel_id in (select cpic_id from legemidler)
    ),
    retningslinjer as (
      select r.cpic_id, r.data
      from cpic.retningslinje r
      where r.utgatt_kl is null
        and r.cpic_id in (
          select data ->> 'retningslinje_id' from legemidler
          union select retningslinje_id from par
          union select retningslinje_id from anbefalinger)
    ),
    gener as (
      select g.cpic_id, g.data
      from cpic.gen g
      where g.utgatt_kl is null
        and g.cpic_id in (
          select gen from par
          union select b ->> 'gen' from anbefalinger a, jsonb_array_elements(a.data -> 'betingelser') b)
    )
    select jsonb_build_object(
      'kilde', cpic.kilde(),
      'legemidler', coalesce((select jsonb_agg(l.data order by l.cpic_id) from legemidler l), '[]'),
      'par', coalesce((select jsonb_agg(p.data order by p.gen, p.cpic_id) from par p), '[]'),
      'retningslinjer', coalesce((
        select jsonb_agg(r.data || jsonb_build_object('publikasjoner', coalesce((
          select jsonb_agg(pu.data order by pu.cpic_id)
          from cpic.publikasjon pu
          where pu.utgatt_kl is null and pu.retningslinje_id = r.cpic_id), '[]')) order by r.cpic_id)
        from retningslinjer r), '[]'),
      'anbefalinger', coalesce((select jsonb_agg(a.data order by a.cpic_id) from anbefalinger a), '[]'),
      'gener', coalesce((select jsonb_agg(g.data order by g.cpic_id) from gener g), '[]'),
      'genresultater', coalesce((
        select jsonb_agg(gr.data order by gr.gen, gr.cpic_id)
        from cpic.genresultat gr
        where gr.utgatt_kl is null and gr.gen in (select cpic_id from gener)), '[]')
    )
  );
end;
$$;

-- De siste kjøringene, til å se at synkroniseringen går som den skal.
create function public.cpic_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id desc), '[]')
  from (
    select id, status, utlost_av, startet_kl, avsluttet_kl, release, release_dato, skjemaversjon, antall, feil
    from cpic.synkroniseringer
    order by id desc
    limit 20
  ) s
$$;

-- --- Rettigheter -----------------------------------------------------------

revoke all on all tables in schema cpic from public, anon, authenticated, service_role;
revoke all on all functions in schema cpic from public, anon, authenticated, service_role;

revoke all on function
  public.cpic_forrige_synk(),
  public.cpic_start_synk(text),
  public.cpic_last_inn(bigint, text, jsonb),
  public.cpic_fullfor_synk(bigint, jsonb),
  public.cpic_avbryt_synk(bigint, text),
  public.les_cpic(text[]),
  public.cpic_status()
from public, anon, authenticated, service_role;

grant execute on function
  public.cpic_forrige_synk(),
  public.cpic_start_synk(text),
  public.cpic_last_inn(bigint, text, jsonb),
  public.cpic_fullfor_synk(bigint, jsonb),
  public.cpic_avbryt_synk(bigint, text)
to service_role;

grant execute on function
  public.les_cpic(text[]),
  public.cpic_status()
to authenticated, service_role;
