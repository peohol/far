-- Kurateringsgrener (fase B2 i docs/kurateringsgrener-fremdrift.md).
--
-- En kurateringsgren er en isolert arbeidsversjon av én fagside. Den bygger på
-- en hel sideversjon (`public.sideversjoner`), lagrer endringene som egne,
-- uforanderlige revisjoner i skjemaet `kuratering`, og publiseres samlet i én
-- transaksjon gjennom den vanlige skriveveien (`intern.skriv`, revisjonene og
-- publiseringene), etter en uavhengig faglig godkjenning av nøyaktig den
-- revisjonen og en bestått prøvepublisering. Hverken den publiserte siden
-- eller noens utkast endres før det.
--
-- Agentene (Claude som kurator, ChatGPT som kontrollør) har egne identiteter
-- med roller og en nøkkel som bare lagres som SHA-256. De når grenene gjennom
-- serveren (`public.kuratering_agent`, bare for tjenesterollen), og
-- administratorene gjennom appen (`public.kuratering_admin`). Skjemaet
-- `kuratering` er ikke tilgjengelig for noen API-rolle.

-- --- Den felles skriveveien -----------------------------------------------------

-- Lagringen, publiseringen og opprettelsen med en oppgitt forfatter, så en
-- publisering fra en gren kan føre agenten som forfatter av revisjonene og den
-- som publiserte som utgiver. De offentlige operasjonene er de samme som før,
-- med den innloggede administratoren som forfatter.

create function intern.lagre_objekt(p_objekt uuid, p_forventet integer, p_innhold jsonb, p_forfatter public.profiles)
returns public.objektstatus
language plpgsql
set search_path = ''
as $$
declare
  gjeldende public.objektrevisjoner := intern.laas_utkast(p_objekt, p_forventet);
  lagret jsonb;
begin
  lagret := intern.skriv(
    (select o.type from public.redigerbare_objekter o where o.id = p_objekt),
    p_objekt,
    'utkast',
    p_innhold
  );

  -- Uendret innhold gir ingen ny revisjon.
  if lagret is distinct from gjeldende.innhold then
    perform intern.ny_revisjon(p_objekt, 'endret', lagret, p_forfatter);
  end if;
  return intern.status(p_objekt);
end;
$$;

create function intern.publiser_objekt(p_objekt uuid, p_forventet integer, p_forfatter public.profiles)
returns public.objektstatus
language plpgsql
set search_path = ''
as $$
declare
  gjeldende public.objektrevisjoner := intern.laas_utkast(p_objekt, p_forventet);
  objekttype public.objekttype;
  utkastet jsonb;
  publisert integer;
begin
  select o.type into objekttype from public.redigerbare_objekter o where o.id = p_objekt;

  select t.revisjon into publisert
  from public.objekttilstander t
  where t.objekt_id = p_objekt and t.tilstand = 'publisert'
  for update;

  if publisert is distinct from gjeldende.revisjon then
    insert into public.objekttilstander (objekt_id, tilstand, revisjon)
    values (p_objekt, 'publisert', gjeldende.revisjon)
    on conflict on constraint objekttilstander_pkey
    do update set revisjon = excluded.revisjon, endret_kl = now();

    -- Det publiserte skrives av utkastet slik det står, gjennom den samme
    -- veien som all annen lagring, og skal bli nøyaktig likt det.
    utkastet := intern.les(objekttype, p_objekt, 'utkast');
    if intern.skriv(objekttype, p_objekt, 'publisert', utkastet) is distinct from utkastet then
      raise exception 'Det publiserte ble ikke likt utkastet. Ingenting er publisert.';
    end if;

    insert into public.objektpubliseringer (
      objekt_id, revisjon, forrige_revisjon,
      utfort_av, utfort_av_fornavn, utfort_av_etternavn
    )
    values (
      p_objekt, gjeldende.revisjon, publisert,
      p_forfatter.id, p_forfatter.first_name, p_forfatter.last_name
    );
  end if;
  return intern.status(p_objekt);
end;
$$;

create function intern.opprett_objekt_som(p_type public.objekttype, p_objekt uuid, p_innhold jsonb, p_forfatter public.profiles)
returns public.objektstatus
language plpgsql
set search_path = ''
as $$
begin
  if p_type is null then
    raise exception 'Objekttypen mangler.' using errcode = '22023';
  end if;
  if p_objekt is null then
    raise exception 'ID-en til det nye objektet mangler.' using errcode = '22023';
  end if;
  if exists (select 1 from public.redigerbare_objekter o where o.id = p_objekt) then
    raise exception 'Det finnes alt et objekt med ID-en %.', p_objekt using errcode = '22023';
  end if;

  insert into public.redigerbare_objekter (id, type)
  values (p_objekt, p_type);

  -- Utkastet må finnes før innholdet kan legges inn i det. Koblingen til
  -- revisjonen kontrolleres først når transaksjonen er ferdig.
  insert into public.objekttilstander (objekt_id, tilstand, revisjon)
  values (p_objekt, 'utkast', 1);

  perform intern.ny_revisjon(
    p_objekt,
    'opprettet',
    intern.skriv(p_type, p_objekt, 'utkast', p_innhold),
    p_forfatter
  );
  return intern.status(p_objekt);
end;
$$;

create or replace function intern.opprett_objekt(p_type public.objekttype, p_objekt uuid, p_innhold jsonb)
returns public.objektstatus
language plpgsql
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
begin
  return intern.opprett_objekt_som(p_type, p_objekt, p_innhold, forfatter);
end;
$$;

create or replace function public.lagre_utkast(objekt uuid, forventet_revisjon integer, innhold jsonb)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
begin
  return intern.lagre_objekt(lagre_utkast.objekt, lagre_utkast.forventet_revisjon, lagre_utkast.innhold, forfatter);
end;
$$;

create or replace function public.publiser_utkast(objekt uuid, forventet_revisjon integer)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
begin
  return intern.publiser_objekt(publiser_utkast.objekt, publiser_utkast.forventet_revisjon, forfatter);
end;
$$;

-- --- Endringsloggen kjenner grenene ------------------------------------------------

alter table public.innholdsendringer add column gren uuid;

comment on column public.innholdsendringer.gren is
  'Kurateringsgrenen endringen ble publisert fra (kuratering.grener). En kuratering har enten denne eller migrasjonen.';

-- Som før, men en kuratering kan komme fra en gren i stedet for en migrasjon.
create or replace function intern.kontroller_innholdsendring()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  e public.innholdsendringer;
begin
  select * into e from public.innholdsendringer x where x.id = new.id;
  if e.aktor <> 'bruker' and e.agent is null then
    raise exception 'En kuratering må avsluttes med intern.kuratering_rapport(agent, migrasjon, rapport), som oppgir agenten (docs/innholdsendringer.md).'
      using errcode = '23514';
  end if;
  if e.art = 'kuratering' and (
    e.rapport is null or (e.migrasjon is null and e.gren is null)
    or not exists (select 1 from public.endringsagenter a where a.nokkel = e.agent and a.art = 'ki-agent')
  ) then
    raise exception 'En kuratering må avsluttes med en rapport fra en registrert KI-agent: intern.kuratering_rapport(agent, migrasjon, rapport) (docs/innholdsendringer.md).'
      using errcode = '23514';
  end if;
  if e.rapport is not null and intern.antall_deler(e.id) <> e.deler_ved_rapport then
    raise exception 'Faginnholdet ble endret etter at rapporten ble skrevet. Rapporten skal være det siste i migrasjonen.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

insert into public.endringsagenter (nokkel, navn, art, beskrivelse) values
  ('claude-monografkurator', 'Claude monografkurator', 'ki-agent',
    'Kuraterer fagsidene i kurateringsgrener etter kuratorprotokollen (docs/kuratorprotokoll/). Publiserer bare det en uavhengig kontrollør har godkjent.');

-- --- Skjemaet ------------------------------------------------------------------------

create schema kuratering;

comment on schema kuratering is
  'Kurateringsgrenene (docs/kurateringsgrener-fremdrift.md). Ingen API-rolle har tilgang; alt går gjennom public.kuratering_agent og public.kuratering_admin.';

revoke all on schema kuratering from public, anon, authenticated, service_role;

-- Agentene og rollene deres. Nøkkelen lagres bare som SHA-256 (heksadesimalt).
create table kuratering.agenter (
  id uuid primary key default gen_random_uuid(),
  agent text not null unique references public.endringsagenter (nokkel),
  roller text[] not null,
  nokkel_sha256 text unique,
  aktiv boolean not null default true,
  opprettet_kl timestamptz not null default now(),
  nokkel_kl timestamptz,
  sist_sett_kl timestamptz,
  constraint agenter_roller check (cardinality(roller) >= 1 and roller <@ array['kurator', 'kontrollor']),
  constraint agenter_nokkel check (nokkel_sha256 is null or nokkel_sha256 ~ '^[0-9a-f]{64}$')
);

comment on table kuratering.agenter is
  'KI-agentene som kan arbeide i grenene, med rollene kurator og kontrollor. En agent godkjenner aldri en gren den selv kuraterer.';

insert into kuratering.agenter (agent, roller) values
  ('claude-monografkurator', array['kurator']),
  ('chatgpt-monografkurator', array['kontrollor']);

create table kuratering.grener (
  id uuid primary key default gen_random_uuid(),
  infoside uuid not null references public.redigerbare_objekter (id) on delete cascade,
  stoff text not null,
  art text not null,
  formaal text not null,
  kurator uuid references kuratering.agenter (id),
  opprettet_av uuid,
  opprettet_av_navn text,
  grunnversjon bigint not null references public.sideversjoner (id) on delete cascade,
  status text not null default 'arbeid',
  status_grunn text,
  runde integer not null default 0,
  revisjon integer not null default 0,
  blindfase boolean not null default false,
  aktivitet jsonb,
  opprettet_kl timestamptz not null default now(),
  oppdatert_kl timestamptz not null default now(),
  publisert_kl timestamptz,
  publisert_versjon bigint references public.sideversjoner (id) on delete cascade,
  endring_id uuid references public.innholdsendringer (id),
  constraint grener_art check (art in ('kuratering', 'de_novo', 'gjenoppretting')),
  constraint grener_kurator check ((art = 'gjenoppretting') = (kurator is null)),
  constraint grener_formaal check (char_length(formaal) between 1 and 500 and formaal = btrim(formaal)),
  constraint grener_status check (status in (
    'arbeid', 'klar', 'tilbakemelding', 'retting', 'godkjent', 'publisert', 'stanset', 'blokkert', 'arkivert'
  )),
  constraint grener_publisert check ((status = 'publisert') = (publisert_kl is not null))
);

comment on table kuratering.grener is
  'Kurateringsgrenene: én isolert arbeidsversjon av en fagside, bygd på en hel sideversjon. Høyst én aktiv per side.';

create unique index grener_en_aktiv_per_side on kuratering.grener (infoside)
  where status not in ('publisert', 'arkivert');
create index grener_status_idx on kuratering.grener (status, oppdatert_kl desc);

-- Hver lagring i grenen: hele tilstanden (objektene den endrer, bivirknings-
-- importene og rapporten), grunnversjonen den gjelder, fingeravtrykket som
-- godkjenningen bindes til, og resultatet av prøvepubliseringen med
-- forhåndsvisningen slik siden ville blitt.
create table kuratering.grenrevisjoner (
  gren uuid not null references kuratering.grener (id) on delete cascade,
  infoside uuid not null,
  revisjon integer not null,
  innhold jsonb not null,
  grunnversjon bigint not null,
  fingeravtrykk text not null,
  melding text,
  agent uuid references kuratering.agenter (id),
  profil uuid,
  profil_navn text,
  teknisk jsonb not null,
  forhandsvisning jsonb,
  opprettet_kl timestamptz not null default now(),
  primary key (gren, revisjon),
  constraint grenrevisjoner_revisjon check (revisjon >= 1),
  constraint grenrevisjoner_melding check (melding is null or char_length(melding) <= 1000),
  constraint grenrevisjoner_storrelse check (pg_column_size(innhold) <= 5000000)
);

create table kuratering.vurderinger (
  id bigint generated always as identity primary key,
  gren uuid not null references kuratering.grener (id) on delete cascade,
  infoside uuid not null,
  revisjon integer not null,
  fingeravtrykk text not null,
  beslutning text not null,
  begrunnelse text not null,
  agent uuid references kuratering.agenter (id),
  profil uuid,
  profil_navn text,
  opprettet_kl timestamptz not null default now(),
  constraint vurderinger_beslutning check (beslutning in ('godkjent', 'endringer')),
  constraint vurderinger_begrunnelse check (char_length(begrunnelse) between 1 and 4000),
  constraint vurderinger_hvem check ((agent is null) <> (profil is null))
);

create index vurderinger_gren_idx on kuratering.vurderinger (gren, revisjon);

create table kuratering.hendelser (
  id bigint generated always as identity primary key,
  gren uuid not null references kuratering.grener (id) on delete cascade,
  infoside uuid not null,
  hendelse text not null,
  fra text,
  til text,
  revisjon integer,
  agent uuid references kuratering.agenter (id),
  profil uuid,
  profil_navn text,
  data jsonb not null default '{}',
  kl timestamptz not null default now(),
  constraint hendelser_hendelse check (hendelse ~ '^[a-z][a-z_]*$' and char_length(hendelse) <= 60)
);

create index hendelser_gren_idx on kuratering.hendelser (gren, id desc);

-- Kuratorens arbeidsdokumenter: kildeplanen, evidensjournalen,
-- dekningsmatrisen, blindprotokollen og selvtesten. Hver lagring er en ny
-- versjon.
create table kuratering.dokumenter (
  id bigint generated always as identity primary key,
  gren uuid not null references kuratering.grener (id) on delete cascade,
  infoside uuid not null,
  art text not null,
  versjon integer not null,
  innhold jsonb not null,
  agent uuid references kuratering.agenter (id),
  opprettet_kl timestamptz not null default now(),
  unique (gren, art, versjon),
  constraint dokumenter_art check (art in ('kildeplan', 'evidensjournal', 'dekningsmatrise', 'blindprotokoll', 'selvtest', 'notat')),
  constraint dokumenter_innhold check (jsonb_typeof(innhold) = 'object' and pg_column_size(innhold) <= 2000000)
);

-- Historikken i grenene kan ikke endres eller slettes, unntatt sammen med
-- fagsiden når den slettes for godt (`fjern_stoff`).
create function kuratering.avvis_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and old.infoside::text = any (string_to_array(nullif(current_setting('intern.sletter_stoffside', true), ''), ','))
  then
    return old;
  end if;
  raise exception 'Historikken i kurateringsgrenene kan ikke endres eller slettes.' using errcode = '42501';
end;
$$;

create trigger grener_ikke_slettet before delete on kuratering.grener
for each row execute function kuratering.avvis_endring();
create trigger grenrevisjoner_uforanderlig before update or delete on kuratering.grenrevisjoner
for each row execute function kuratering.avvis_endring();
create trigger vurderinger_uforanderlig before update or delete on kuratering.vurderinger
for each row execute function kuratering.avvis_endring();
create trigger hendelser_uforanderlig before update or delete on kuratering.hendelser
for each row execute function kuratering.avvis_endring();
create trigger dokumenter_uforanderlig before update or delete on kuratering.dokumenter
for each row execute function kuratering.avvis_endring();

create trigger grener_ikke_tom before truncate on kuratering.grener
for each statement execute function intern.avvis_endring();
create trigger grenrevisjoner_ikke_tom before truncate on kuratering.grenrevisjoner
for each statement execute function intern.avvis_endring();
create trigger vurderinger_ikke_tom before truncate on kuratering.vurderinger
for each statement execute function intern.avvis_endring();
create trigger hendelser_ikke_tom before truncate on kuratering.hendelser
for each statement execute function intern.avvis_endring();
create trigger dokumenter_ikke_tom before truncate on kuratering.dokumenter
for each statement execute function intern.avvis_endring();

alter table kuratering.agenter enable row level security;
alter table kuratering.grener enable row level security;
alter table kuratering.grenrevisjoner enable row level security;
alter table kuratering.vurderinger enable row level security;
alter table kuratering.hendelser enable row level security;
alter table kuratering.dokumenter enable row level security;

-- --- Hvem som handler ---------------------------------------------------------------

-- Den som handler: en agent med rollene sine, eller en administrator.
create type kuratering.aktor as (
  agent uuid,
  agentnokkel text,
  roller text[],
  profil public.profiles,
  admin boolean
);

-- Agenten med nøkkelen. Ukjent, deaktivert eller ugyldig nøkkel avvises likt.
create function kuratering.agent_med_nokkel(p_nokkel text)
returns kuratering.aktor
language plpgsql
set search_path = ''
as $$
declare
  a kuratering.agenter;
  ut kuratering.aktor;
begin
  if p_nokkel is not null and char_length(p_nokkel) between 32 and 200 then
    select x.* into a
    from kuratering.agenter x
    where x.aktiv and x.nokkel_sha256 = encode(sha256(convert_to(p_nokkel, 'UTF8')), 'hex');
  end if;
  if a.id is null then
    raise exception 'Agentnøkkelen er ukjent eller ikke lenger gyldig.' using errcode = '42501';
  end if;
  update kuratering.agenter x set sist_sett_kl = now() where x.id = a.id;
  ut.agent := a.id;
  ut.agentnokkel := a.agent;
  ut.roller := a.roller;
  ut.profil := kuratering.agentprofil(a.id);
  ut.admin := false;
  return ut;
end;
$$;

-- Profilen en agent føres med i revisjonene og publiseringene: brukerprofilen
-- den har fått (`agentprofiler`), ellers navnet fra endringsagentene med
-- agentens egen ID.
create function kuratering.agentprofil(p_agent uuid)
returns public.profiles
language plpgsql
stable
set search_path = ''
as $$
declare
  a kuratering.agenter;
  navn text;
  p public.profiles;
begin
  select x.* into a from kuratering.agenter x where x.id = p_agent;
  select p2.* into p
  from public.agentprofiler ap
  join public.profiles p2 on p2.username = ap.brukernavn
  where ap.agent = a.agent;
  if p.id is not null then
    return p;
  end if;
  select e.navn into navn from public.endringsagenter e where e.nokkel = a.agent;
  p.id := a.id;
  p.first_name := split_part(navn, ' ', 1);
  p.last_name := coalesce(nullif(btrim(substr(navn, char_length(split_part(navn, ' ', 1)) + 1)), ''), '');
  return p;
end;
$$;

create function kuratering.admin_aktor()
returns kuratering.aktor
language plpgsql
stable
set search_path = ''
as $$
declare
  ut kuratering.aktor;
begin
  ut.profil := intern.krev_admin();
  ut.admin := true;
  ut.roller := '{}';
  return ut;
end;
$$;

create function kuratering.aktornavn(p_aktor kuratering.aktor)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(coalesce((p_aktor.profil).first_name, '') || ' ' || coalesce((p_aktor.profil).last_name, ''))
$$;

-- --- Hjelperne ------------------------------------------------------------------------

create function kuratering.siste_versjon(p_side uuid)
returns public.sideversjoner
language sql
stable
set search_path = ''
as $$
  select v.* from public.sideversjoner v where v.infoside = p_side order by v.nr desc limit 1
$$;

create function kuratering.tom_tilstand()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"objekter": {}, "bivirkninger": {"importer": [], "trekk": []}, "rapport": null}'::jsonb
$$;

create function kuratering.revisjonen(p_gren uuid, p_revisjon integer)
returns kuratering.grenrevisjoner
language sql
stable
set search_path = ''
as $$
  select r.* from kuratering.grenrevisjoner r where r.gren = p_gren and r.revisjon = p_revisjon
$$;

create function kuratering.tilstand(p_gren kuratering.grener)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce((kuratering.revisjonen(p_gren.id, p_gren.revisjon)).innhold, kuratering.tom_tilstand())
$$;

create function kuratering.fingeravtrykk(p_innhold jsonb, p_grunnversjon bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(p_grunnversjon::text || ':' || p_innhold::text)
$$;

-- Grenen, låst for endring. Feil når den ikke finnes.
create function kuratering.grenen(p_gren uuid)
returns kuratering.grener
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  select x.* into g from kuratering.grener x where x.id = p_gren for update;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  return g;
end;
$$;

create function kuratering.er_aktiv(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status not in ('publisert', 'arkivert')
$$;

create function kuratering.ny_hendelse(
  p_gren kuratering.grener, p_hendelse text, p_aktor kuratering.aktor,
  p_fra text default null, p_til text default null, p_data jsonb default '{}'
)
returns void
language sql
set search_path = ''
as $$
  insert into kuratering.hendelser (gren, infoside, hendelse, fra, til, revisjon, agent, profil, profil_navn, data)
  values (
    p_gren.id, p_gren.infoside, p_hendelse, p_fra, p_til, p_gren.revisjon,
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end,
    kuratering.aktornavn(p_aktor), coalesce(p_data, '{}')
  )
$$;

create function kuratering.sett_status(
  p_gren kuratering.grener, p_status text, p_aktor kuratering.aktor, p_hendelse text,
  p_grunn text default null, p_data jsonb default '{}'
)
returns kuratering.grener
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  update kuratering.grener x
  set status = p_status, status_grunn = p_grunn, oppdatert_kl = now()
  where x.id = p_gren.id
  returning x.* into g;
  perform kuratering.ny_hendelse(g, p_hendelse, p_aktor, p_gren.status, p_status,
    coalesce(p_data, '{}') || case when p_grunn is null then '{}'::jsonb else jsonb_build_object('grunn', p_grunn) end);
  return g;
end;
$$;

-- Statusen grenen går tilbake til når kuratoren arbeider igjen.
create function kuratering.arbeidsstatus(p_gren kuratering.grener)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_gren.runde > 0 then 'retting' else 'arbeid' end
$$;

-- Det som sperrer en godkjenning eller publisering av grenen. Fase D legger
-- de åpne, sperrende kommentarene til her.
create function kuratering.sperrer(p_gren kuratering.grener)
returns text[]
language sql
stable
set search_path = ''
as $$
  select '{}'::text[]
$$;

-- Dokumentene grenen må ha før den sendes til kontroll.
create function kuratering.pakrevde_dokumenter(p_art text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_art
    when 'de_novo' then array['blindprotokoll', 'dekningsmatrise', 'evidensjournal', 'selvtest']
    when 'kuratering' then array['dekningsmatrise', 'evidensjournal', 'selvtest']
    else '{}'::text[]
  end
$$;

create function kuratering.manglende_dokumenter(p_gren kuratering.grener)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(a order by a), '{}')
  from unnest(kuratering.pakrevde_dokumenter(p_gren.art)) a
  where not exists (select 1 from kuratering.dokumenter d where d.gren = p_gren.id and d.art = a)
$$;

-- Revisjonen et objekt hadde i en sideversjon, eller null.
create function kuratering.revisjon_i_versjon(p_versjon public.sideversjoner, p_objekt uuid)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_versjon.manifest -> 'infoside' ->> 'id')::uuid = p_objekt then (p_versjon.manifest -> 'infoside' ->> 'revisjon')::integer
    else (
      select (e ->> 'revisjon')::integer
      from jsonb_array_elements(p_versjon.manifest -> 'elementer') e
      where (e ->> 'id')::uuid = p_objekt
    )
  end
$$;

-- Revisjonen et objekt i grenen bygger på: den i sideversjonen, eller den som
-- står i tilstanden for et objekt utenfor sideversjonen (et fjernet kort en
-- gjenoppretting tar tilbake).
create function kuratering.forventet_revisjon(p_versjon public.sideversjoner, p_objekt uuid, p_objektet jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(kuratering.revisjon_i_versjon(p_versjon, p_objekt), (p_objektet ->> 'grunnrevisjon')::integer)
$$;

-- --- Endringene i en gren -----------------------------------------------------------

-- Tar endringene kuratoren sender, i rekkefølge, og gir den nye tilstanden og
-- ID-ene til de nye objektene. Grenen endrer bare sin egen side: siden selv,
-- kortene på den og nye referanser. En referanse som finnes, brukes uendret.
--
--   {"sett": "<id>", "innhold": {...}}   endre siden, et kort eller noe nytt
--   {"ny": "innholdselement" | "referanse", "id"?: "<id>", "innhold": {...}}
--   {"fjern": "<id>"}                    fjerne et kort (eller noe nytt)
--   {"tilbakestill": "<id>"}             la objektet stå som i grunnversjonen
--   {"bivirkninger": {"importer": [...], "trekk": [{"nokkel", "begrunnelse"}]}}
--   {"rapport": {...} | null}            rapporten til endringsloggen
create function kuratering.anvend(p_gren kuratering.grener, p_tilstand jsonb, p_endringer jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  grunnlag public.sideversjoner;
  tilstand jsonb := p_tilstand;
  e jsonb;
  v_id uuid;
  typen public.objekttype;
  innhold jsonb;
  forrige jsonb;
  nye jsonb := '[]'::jsonb;
  imp jsonb;
  feil text[];
  treff uuid;
  n integer := 0;
begin
  select v.* into strict grunnlag from public.sideversjoner v where v.id = p_gren.grunnversjon;
  if jsonb_typeof(p_endringer) is distinct from 'array' or jsonb_array_length(p_endringer) not between 1 and 500 then
    raise exception 'Endringene må være en liste med 1 til 500 endringer.' using errcode = '22023';
  end if;

  for e in select x from jsonb_array_elements(p_endringer) x loop
    n := n + 1;
    if jsonb_typeof(e) <> 'object' then
      raise exception 'Endring %: må være et objekt.', n using errcode = '22023';
    end if;

    if e ? 'sett' or e ? 'ny' then
      innhold := e -> 'innhold';
      if jsonb_typeof(innhold) is distinct from 'object' then
        raise exception 'Endring %: innholdet mangler.', n using errcode = '22023';
      end if;
    end if;

    if e ? 'sett' then
      v_id := (e ->> 'sett')::uuid;
      if tilstand -> 'objekter' ? v_id::text then
        typen := (tilstand -> 'objekter' -> v_id::text ->> 'type')::public.objekttype;
      elsif kuratering.revisjon_i_versjon(grunnlag, v_id) is not null then
        select o.type into typen from public.redigerbare_objekter o where o.id = v_id;
      elsif exists (select 1 from public.redigerbare_objekter o where o.id = v_id and o.type = 'referanse') then
        raise exception 'Endring %: en referanse som finnes, deles med andre sider og kan ikke endres i en gren. Lag en ny referanse.', n
          using errcode = '22023';
      else
        raise exception 'Endring %: objektet % hører ikke til fagsiden.', n, v_id using errcode = '22023';
      end if;

      if typen = 'infoside' then
        select r.innhold into forrige
        from public.objektrevisjoner r
        where r.objekt_id = v_id and r.revisjon = kuratering.revisjon_i_versjon(grunnlag, v_id);
        if innhold ->> 'slug' is distinct from p_gren.stoff or innhold ->> 'navn' is distinct from forrige ->> 'navn' then
          raise exception 'Endring %: navnet og nøkkelen til fagsiden endres ikke i en gren.', n using errcode = '22023';
        end if;
      elsif typen = 'innholdselement' and innhold ->> 'infoside' is distinct from p_gren.infoside::text then
        raise exception 'Endring %: kortet må stå på fagsiden grenen gjelder.', n using errcode = '22023';
      end if;
      tilstand := jsonb_set(tilstand, array['objekter', v_id::text], jsonb_build_object(
        'type', typen,
        'ny', coalesce((tilstand -> 'objekter' -> v_id::text ->> 'ny')::boolean, false),
        'innhold', innhold));

    elsif e ? 'ny' then
      if e ->> 'ny' not in ('innholdselement', 'referanse') then
        raise exception 'Endring %: en gren kan lage nye kort (innholdselement) og referanser, ikke «%».', n, e ->> 'ny'
          using errcode = '22023';
      end if;
      typen := (e ->> 'ny')::public.objekttype;
      v_id := coalesce((e ->> 'id')::uuid, gen_random_uuid());
      if tilstand -> 'objekter' ? v_id::text or exists (select 1 from public.redigerbare_objekter o where o.id = v_id) then
        raise exception 'Endring %: ID-en % er alt i bruk.', n, v_id using errcode = '22023';
      end if;
      if typen = 'innholdselement' and innhold ->> 'infoside' is distinct from p_gren.infoside::text then
        raise exception 'Endring %: kortet må stå på fagsiden grenen gjelder.', n using errcode = '22023';
      end if;
      if typen = 'referanse' then
        if coalesce(btrim(innhold ->> 'lenke'), '') = '' then
          raise exception 'Endring %: en ny referanse må ha en lenke.', n using errcode = '22023';
        end if;
        select r.objekt_id into treff
        from public.referanser r
        where r.lenke = innhold ->> 'lenke' and not r.arkivert
        limit 1;
        if treff is not null then
          raise exception 'Endring %: lenken står alt på referansen %. Bruk den.', n, treff using errcode = '22023';
        end if;
        if exists (
          select 1 from jsonb_each(tilstand -> 'objekter') o
          where o.value ->> 'type' = 'referanse' and o.value -> 'innhold' ->> 'lenke' = innhold ->> 'lenke'
        ) then
          raise exception 'Endring %: grenen har alt en ny referanse med lenken.', n using errcode = '22023';
        end if;
      end if;
      tilstand := jsonb_set(tilstand, array['objekter', v_id::text], jsonb_build_object('type', typen, 'ny', true, 'innhold', innhold));
      nye := nye || to_jsonb(v_id);

    elsif e ? 'fjern' then
      v_id := (e ->> 'fjern')::uuid;
      if (tilstand -> 'objekter' -> v_id::text ->> 'ny')::boolean then
        tilstand := tilstand #- array['objekter', v_id::text];
      elsif kuratering.revisjon_i_versjon(grunnlag, v_id) is not null
        and v_id <> p_gren.infoside
      then
        forrige := coalesce(
          tilstand -> 'objekter' -> v_id::text -> 'innhold',
          (select r.innhold from public.objektrevisjoner r where r.objekt_id = v_id and r.revisjon = kuratering.revisjon_i_versjon(grunnlag, v_id))
        );
        tilstand := jsonb_set(tilstand, array['objekter', v_id::text], jsonb_build_object(
          'type', 'innholdselement', 'ny', false, 'innhold', forrige || '{"panel": "fjernet"}'));
      else
        raise exception 'Endring %: bare kort på fagsiden kan fjernes.', n using errcode = '22023';
      end if;

    elsif e ? 'tilbakestill' then
      tilstand := tilstand #- array['objekter', (e ->> 'tilbakestill')::uuid::text];

    elsif e ? 'bivirkninger' then
      if jsonb_typeof(e -> 'bivirkninger') <> 'object' then
        raise exception 'Endring %: bivirkningene må være {"importer": [...], "trekk": [...]}.', n using errcode = '22023';
      end if;
      for imp in select x from jsonb_array_elements(coalesce(e -> 'bivirkninger' -> 'importer', '[]')) x loop
        if imp ->> 'stoff' is distinct from p_gren.stoff then
          raise exception 'Endring %: bivirkningsimporten gjelder «%», ikke fagsiden «%».', n, imp ->> 'stoff', p_gren.stoff
            using errcode = '22023';
        end if;
        feil := bivirkninger.importfeil(imp);
        if cardinality(feil) > 0 then
          raise exception 'Endring %: bivirkningsimporten har feil: %', n, array_to_string(feil, ' ') using errcode = '22023';
        end if;
      end loop;
      for imp in select x from jsonb_array_elements(coalesce(e -> 'bivirkninger' -> 'trekk', '[]')) x loop
        if coalesce(imp ->> 'nokkel', '') = '' or coalesce(btrim(imp ->> 'begrunnelse'), '') = '' then
          raise exception 'Endring %: hver tilbaketrekking må ha nøkkelen og en begrunnelse.', n using errcode = '22023';
        end if;
      end loop;
      tilstand := jsonb_set(tilstand, '{bivirkninger}', jsonb_build_object(
        'importer', coalesce(e -> 'bivirkninger' -> 'importer', '[]'),
        'trekk', coalesce(e -> 'bivirkninger' -> 'trekk', '[]')));

    elsif e ? 'rapport' then
      if jsonb_typeof(e -> 'rapport') not in ('object', 'null') then
        raise exception 'Endring %: rapporten må være et objekt.', n using errcode = '22023';
      end if;
      tilstand := jsonb_set(tilstand, '{rapport}', e -> 'rapport');

    else
      raise exception 'Endring %: ukjent endring. Bruk sett, ny, fjern, tilbakestill, bivirkninger eller rapport.', n
        using errcode = '22023';
    end if;
  end loop;

  return jsonb_build_object('tilstand', tilstand, 'nye', nye);
end;
$$;

-- --- Publiseringen ----------------------------------------------------------------

-- Sideversjonen fra en gren eller en gjenoppretting får det opphavet
-- (`far.sideversjonsopphav`, satt av kuratering.utfor for transaksjonen).
create or replace function intern.registrer_sideversjon(p_side uuid, p_opphav text default 'publisering')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  manifestet jsonb;
  fingeravtrykket text;
  forrige public.sideversjoner;
  ny bigint;
begin
  if p_side is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sideversjon:' || p_side::text, 0));

  manifestet := intern.sidemanifest(p_side);
  if manifestet is null then
    return null;
  end if;
  fingeravtrykket := md5(manifestet::text);

  select v.* into forrige
  from public.sideversjoner v
  where v.infoside = p_side
  order by v.nr desc
  limit 1;
  if found and forrige.fingeravtrykk = fingeravtrykket then
    return null;
  end if;

  insert into public.sideversjoner (infoside, nr, opphav, manifest, fingeravtrykk, endring_id)
  values (
    p_side,
    coalesce(forrige.nr, 0) + 1,
    coalesce(nullif(current_setting('far.sideversjonsopphav', true), ''), p_opphav),
    manifestet,
    fingeravtrykket,
    (
      select e.id from public.innholdsendringer e
      where e.id = nullif(current_setting('far.endring', true), '')::uuid
    )
  )
  returning id into ny;
  return ny;
end;
$$;

-- Forfatteren revisjonene fra grenen føres med: kuratoren, eller
-- administratoren som laget en gjenopprettingsgren.
create function kuratering.forfatter(p_gren kuratering.grener)
returns public.profiles
language plpgsql
stable
set search_path = ''
as $$
declare
  p public.profiles;
begin
  if p_gren.kurator is not null then
    return kuratering.agentprofil(p_gren.kurator);
  end if;
  select x.* into p from public.profiles x where x.id = p_gren.opprettet_av;
  if p.id is null then
    p.id := p_gren.opprettet_av;
    p.first_name := split_part(coalesce(p_gren.opprettet_av_navn, ''), ' ', 1);
    p.last_name := '';
  end if;
  return p;
end;
$$;

-- Skriver hele grenen inn gjennom den vanlige veien og publiserer den, i
-- rekkefølgen databasen krever: nye referanser, siden, kortene som fjernes, de
-- som endres og de nye, og bivirkningene. En kuratering avsluttes med
-- rapporten, kontrollert mot det som faktisk ble endret.
--
-- Stopper med PT409 når siden er publisert på nytt etter grunnversjonen, eller
-- når noe grenen endrer har et upublisert utkast fra vanlig redigering; det
-- utkastet skal ikke overtas eller overskrives i stillhet.
--
-- Med p_prov = true (prøvepubliseringen) stopper en feil i rapporten ikke
-- publiseringen, men gis tilbake, så resten kan prøves.
create function kuratering.utfor(
  p_gren kuratering.grener, p_tilstand jsonb, p_publiserer public.profiles, p_prov boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  side uuid := p_gren.infoside;
  siste public.sideversjoner;
  forfatter public.profiles := kuratering.forfatter(p_gren);
  o record;
  t public.objekttilstander;
  utkast integer;
  publisert integer;
  status public.objektstatus;
  imp jsonb;
  endring uuid;
  ryddet jsonb;
  rapportfeil text;
  agentnokkel text;
begin
  perform pg_advisory_xact_lock(hashtextextended('sideversjon:' || side::text, 0));
  siste := kuratering.siste_versjon(side);
  if siste.id is distinct from p_gren.grunnversjon then
    raise exception 'Fagsiden er publisert på nytt etter at grenen ble laget. Grenen må oppdateres til den nye versjonen og kontrolleres på nytt.'
      using errcode = 'PT409', detail = jsonb_build_object('grunnversjon', p_gren.grunnversjon, 'gjeldende', siste.id)::text;
  end if;

  for o in
    select (x.key)::uuid as id, x.value as v
    from jsonb_each(p_tilstand -> 'objekter') x
    where not (x.value ->> 'ny')::boolean
  loop
    select s.revisjon, s.publisert_revisjon into utkast, publisert
    from public.objektstatus s where s.id = o.id;
    if publisert is distinct from kuratering.forventet_revisjon(siste, o.id, o.v) then
      raise exception 'Objektet % er publisert på nytt etter grunnversjonen.', o.id using errcode = 'PT409';
    end if;
    if utkast is distinct from publisert then
      raise exception 'Objektet % har et upublisert utkast fra vanlig redigering. Det må publiseres eller tilbakestilles i appen før grenen kan publiseres.', o.id
        using errcode = 'PT409';
    end if;
  end loop;

  if p_gren.kurator is not null then
    select a.agent into agentnokkel from kuratering.agenter a where a.id = p_gren.kurator;
    perform set_config('far.kuratering', p_gren.stoff, true);
    perform set_config('far.endring', '', true);
    perform set_config('far.endringsvalg', jsonb_build_object('agent', agentnokkel)::text, true);
  end if;
  perform set_config('far.revisjonskilde', left('Kurateringsgren: ' || p_gren.formaal, 300) || ' (grenrevisjon ' || p_gren.revisjon || ')', true);
  perform set_config('far.sideversjonsopphav', case when p_gren.art = 'gjenoppretting' then 'gjenoppretting' else 'gren' end, true);

  -- Nye referanser først, så kortene kan sitere dem; deretter siden, og
  -- kortene som fjernes før de som endres og de nye, så et kort som erstatter
  -- et annet på en fast plass, får plassen.
  for o in
    select (x.key)::uuid as id, x.value as v,
      case
        when x.value ->> 'type' = 'referanse' then 0
        when x.value ->> 'type' = 'infoside' then 1
        when x.value -> 'innhold' ->> 'panel' = 'fjernet' then 2
        when not (x.value ->> 'ny')::boolean then 3
        else 4
      end as rekke
    from jsonb_each(p_tilstand -> 'objekter') x
    order by 3, 1
  loop
    if (o.v ->> 'ny')::boolean then
      perform intern.opprett_objekt_som((o.v ->> 'type')::public.objekttype, o.id, o.v -> 'innhold', forfatter);
      status := intern.publiser_objekt(o.id, 1, p_publiserer);
    else
      select x.* into t from public.objekttilstander x where x.objekt_id = o.id and x.tilstand = 'utkast';
      status := intern.lagre_objekt(o.id, t.revisjon, o.v -> 'innhold', forfatter);
      status := intern.publiser_objekt(o.id, status.revisjon, p_publiserer);
    end if;
  end loop;

  for imp in select x from jsonb_array_elements(coalesce(p_tilstand -> 'bivirkninger' -> 'trekk', '[]')) x loop
    perform bivirkninger.trekk_tilbake(p_gren.stoff, imp ->> 'nokkel', imp ->> 'begrunnelse');
  end loop;
  for imp in select x from jsonb_array_elements(coalesce(p_tilstand -> 'bivirkninger' -> 'importer', '[]')) x loop
    perform bivirkninger.importer(imp);
  end loop;

  endring := nullif(current_setting('far.endring', true), '')::uuid;
  if endring is null then
    raise exception 'Grenen endrer ingenting på fagsiden.' using errcode = '22023';
  end if;

  if p_gren.kurator is not null then
    begin
      ryddet := intern.kontroller_rapport(endring, p_tilstand -> 'rapport');
    exception when others then
      if not p_prov then
        raise;
      end if;
      get stacked diagnostics rapportfeil = message_text;
    end;
    update public.innholdsendringer x
    set agent = agentnokkel,
        oppsummering = coalesce(ryddet ->> 'oppsummering', left(p_gren.formaal, 500)),
        rapport = coalesce(ryddet - 'oppsummering' - 'lenker', '{}'::jsonb),
        lenker = array(
          select distinct l
          from unnest(x.lenker || array(select jsonb_array_elements_text(coalesce(ryddet -> 'lenker', '[]'::jsonb)))) l
          order by l),
        gren = p_gren.id,
        deler_ved_rapport = intern.antall_deler(endring)
    where x.id = endring;
  else
    update public.innholdsendringer x
    set gren = p_gren.id, oppsummering = coalesce(x.oppsummering, left(p_gren.formaal, 500))
    where x.id = endring;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'endring', endring,
    'seksjoner', (
      select coalesce(jsonb_agg(jsonb_build_object('seksjon', s.seksjon, 'art', s.art) order by s.seksjon, s.art), '[]'::jsonb)
      from intern.endringens_seksjoner(endring) s
    ),
    'rapport_ok', p_gren.kurator is null or rapportfeil is null,
    'rapportfeil', rapportfeil
  ));
end;
$$;

-- Prøvepubliseringen: den samme publiseringen, med alle databasens kontroller
-- (også de som ellers venter til transaksjonen er ferdig), mot produksjonen
-- slik den er nå, og så rullet tilbake. Gir resultatet og forhåndsvisningen:
-- fagsiden og bivirkningene nøyaktig slik de ville blitt publisert, lest med
-- de samme funksjonene appen leser med.
create function kuratering.prov(p_gren kuratering.grener, p_tilstand jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  resultat jsonb;
  visning jsonb;
  ok boolean := false;
  feil text;
  kode text;
  detalj text;
begin
  begin
    resultat := kuratering.utfor(p_gren, p_tilstand, kuratering.forfatter(p_gren), true);
    set constraints all immediate;
    visning := jsonb_build_object(
      'stoff', public.les_stoff(p_gren.stoff, 'publisert'),
      'bivirkninger', public.les_bivirkninger(p_gren.stoff));
    raise exception 'prøvepublisering' using errcode = 'KU000';
  exception
    when sqlstate 'KU000' then
      ok := true;
    when others then
      get stacked diagnostics feil = message_text, kode = returned_sqlstate, detalj = pg_exception_detail;
  end;

  return jsonb_build_object(
    'teknisk', jsonb_strip_nulls(jsonb_build_object(
      'ok', ok,
      'feil', feil,
      'kode', kode,
      'detalj', nullif(detalj, ''),
      'seksjoner', resultat -> 'seksjoner',
      'rapport_ok', coalesce((resultat ->> 'rapport_ok')::boolean, false),
      'rapportfeil', resultat ->> 'rapportfeil',
      'kontrollert_kl', now()
    )),
    'forhandsvisning', visning
  );
end;
$$;

-- En ny revisjon av grenen med tilstanden, prøvepublisert.
create function kuratering.ny_revisjon(
  p_gren kuratering.grener, p_tilstand jsonb, p_grunnversjon bigint, p_aktor kuratering.aktor, p_melding text
)
returns kuratering.grener
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener;
  provd jsonb;
begin
  update kuratering.grener x
  set revisjon = x.revisjon + 1, grunnversjon = p_grunnversjon, oppdatert_kl = now()
  where x.id = p_gren.id
  returning x.* into g;

  provd := kuratering.prov(g, p_tilstand);
  insert into kuratering.grenrevisjoner (
    gren, infoside, revisjon, innhold, grunnversjon, fingeravtrykk, melding,
    agent, profil, profil_navn, teknisk, forhandsvisning
  )
  values (
    g.id, g.infoside, g.revisjon, p_tilstand, p_grunnversjon, kuratering.fingeravtrykk(p_tilstand, p_grunnversjon),
    nullif(btrim(p_melding), ''),
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end, kuratering.aktornavn(p_aktor),
    provd -> 'teknisk', provd -> 'forhandsvisning'
  );
  return g;
end;
$$;

create function kuratering.konflikthindring()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Fagsiden er publisert på nytt etter grunnversjonen; grenen må oppdateres.'::text
$$;

-- Det som hindrer publisering av grenen nå, som tekster. Tom når den kan
-- publiseres.
create function kuratering.hindringer(p_gren kuratering.grener)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  r kuratering.grenrevisjoner := kuratering.revisjonen(p_gren.id, p_gren.revisjon);
  v kuratering.vurderinger;
  ut text[] := '{}';
begin
  if r.revisjon is null then
    return array['Grenen har ingen endringer.'];
  end if;
  if not coalesce((r.teknisk ->> 'ok')::boolean, false) then
    ut := ut || ('Prøvepubliseringen feilet: ' || coalesce(r.teknisk ->> 'feil', 'ukjent feil'));
  end if;
  if p_gren.kurator is not null and not coalesce((r.teknisk ->> 'rapport_ok')::boolean, false) then
    ut := ut || ('Rapporten stemmer ikke med endringene: ' || coalesce(r.teknisk ->> 'rapportfeil', 'rapporten mangler'));
  end if;
  if (kuratering.siste_versjon(p_gren.infoside)).id is distinct from p_gren.grunnversjon then
    ut := ut || kuratering.konflikthindring();
  end if;
  if p_gren.kurator is not null then
    select x.* into v from kuratering.vurderinger x
    where x.gren = p_gren.id and x.revisjon = p_gren.revisjon
    order by x.id desc limit 1;
    if v.id is null or v.beslutning <> 'godkjent' or v.fingeravtrykk <> r.fingeravtrykk then
      ut := ut || ('Revisjon ' || p_gren.revisjon || ' er ikke faglig godkjent.');
    end if;
  end if;
  return ut || kuratering.sperrer(p_gren);
end;
$$;

create function kuratering.publiser(p_gren kuratering.grener, p_aktor kuratering.aktor)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := p_gren;
  hindret text[];
  resultat jsonb;
  feil text;
  kode text;
  versjon public.sideversjoner;
begin
  -- En gjenoppretting tar tilbake noe som alt har vært publisert, og
  -- publiseres av en administrator uten en ny faglig vurdering.
  if g.status <> 'godkjent' and not (g.art = 'gjenoppretting' and g.status = 'arbeid' and p_aktor.admin) then
    raise exception 'Bare en godkjent gren kan publiseres; denne er «%».', g.status using errcode = '22023';
  end if;
  -- En konflikt med hovedversjonen oppdages også under publiseringen, og
  -- blokkerer da grenen med grunnen.
  hindret := array_remove(kuratering.hindringer(g), kuratering.konflikthindring());
  if cardinality(hindret) > 0 then
    raise exception 'Grenen kan ikke publiseres: %', array_to_string(hindret, ' ') using errcode = '22023';
  end if;

  begin
    resultat := kuratering.utfor(g, kuratering.tilstand(g), p_aktor.profil, false);
    set constraints all immediate;
  exception when others then
    get stacked diagnostics feil = message_text, kode = returned_sqlstate;
    g := kuratering.sett_status(g, 'blokkert', p_aktor, 'publisering_feilet',
      case when kode = 'PT409' then 'Konflikt: ' else 'Teknisk feil: ' end || feil,
      jsonb_build_object('kode', kode));
    return jsonb_build_object('ok', false, 'status', g.status, 'feil', feil, 'kode', kode);
  end;

  versjon := kuratering.siste_versjon(g.infoside);
  update kuratering.grener x
  set status = 'publisert', status_grunn = null, publisert_kl = now(), publisert_versjon = versjon.id,
      endring_id = (resultat ->> 'endring')::uuid, oppdatert_kl = now(), aktivitet = null
  where x.id = g.id;
  perform kuratering.ny_hendelse(g, 'publisert', p_aktor, g.status, 'publisert',
    jsonb_build_object('versjon', versjon.nr, 'endring', resultat ->> 'endring'));
  return jsonb_build_object('ok', true, 'status', 'publisert', 'versjon', versjon.nr);
end;
$$;

-- --- Lesingen ---------------------------------------------------------------------

-- Grenen kort: status, revisjon, grunnversjon og om siden er publisert på nytt
-- siden. Ingen fagtekst.
create function kuratering.sammendrag(p_gren kuratering.grener)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_gren.id,
    'stoff', p_gren.stoff,
    'navn', (select s.navn from public.infosider s where s.objekt_id = p_gren.infoside and s.tilstand = 'publisert'),
    'art', p_gren.art,
    'formaal', p_gren.formaal,
    'status', p_gren.status,
    'status_grunn', p_gren.status_grunn,
    'runde', p_gren.runde,
    'revisjon', p_gren.revisjon,
    'blindfase', p_gren.blindfase,
    'kurator', (select e.navn from kuratering.agenter a join public.endringsagenter e on e.nokkel = a.agent where a.id = p_gren.kurator),
    'opprettet_av', p_gren.opprettet_av_navn,
    'grunnversjon', (select v.nr from public.sideversjoner v where v.id = p_gren.grunnversjon),
    'konflikt', kuratering.er_aktiv(p_gren.status) and (kuratering.siste_versjon(p_gren.infoside)).id is distinct from p_gren.grunnversjon,
    'teknisk_ok', (select (r.teknisk ->> 'ok')::boolean and coalesce((r.teknisk ->> 'rapport_ok')::boolean, p_gren.kurator is null)
      from kuratering.grenrevisjoner r where r.gren = p_gren.id and r.revisjon = p_gren.revisjon),
    'aktivitet', p_gren.aktivitet,
    'opprettet_kl', p_gren.opprettet_kl,
    'oppdatert_kl', p_gren.oppdatert_kl,
    'publisert_kl', p_gren.publisert_kl,
    'publisert_versjon', (select v.nr from public.sideversjoner v where v.id = p_gren.publisert_versjon)
  ))
$$;

-- Fagsiden slik grunnversjonen var, bare oppbygningen: siden, panelene og
-- kortenes plass og type, uten fagteksten. Det kuratoren ser i blindfasen.
create function kuratering.oppbygning(p_versjon public.sideversjoner)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'infoside', (
      select jsonb_build_object('id', r.objekt_id, 'navn', r.innhold ->> 'navn', 'slug', r.innhold ->> 'slug')
      from public.objektrevisjoner r
      where r.objekt_id = (p_versjon.manifest -> 'infoside' ->> 'id')::uuid
        and r.revisjon = (p_versjon.manifest -> 'infoside' ->> 'revisjon')::integer
    ),
    'elementer', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.objekt_id, 'panel', r.innhold ->> 'panel', 'posisjon', (r.innhold ->> 'posisjon')::integer,
        'elementtype', r.innhold ->> 'elementtype')
        order by r.innhold ->> 'panel', (r.innhold ->> 'posisjon')::integer, r.objekt_id)
      from jsonb_array_elements(p_versjon.manifest -> 'elementer') e
      join public.objektrevisjoner r on r.objekt_id = (e ->> 'id')::uuid and r.revisjon = (e ->> 'revisjon')::integer
    ), '[]'::jsonb)
  )
$$;

-- Grenen i sin helhet for den som skal arbeide med eller kontrollere den: en
-- revisjon (den siste når ingen er oppgitt) med tilstanden, prøvepubliseringen
-- og forhåndsvisningen, grunnversjonen, vurderingene, hendelsene og
-- dokumentene. Kuratoren ser i blindfasen bare oppbygningen av grunnversjonen
-- og ingen forhåndsvisning.
create function kuratering.detaljer(p_gren kuratering.grener, p_revisjon integer, p_blind boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  r kuratering.grenrevisjoner := kuratering.revisjonen(p_gren.id, coalesce(p_revisjon, p_gren.revisjon));
  grunnlag public.sideversjoner;
begin
  if p_revisjon is not null and r.revisjon is null then
    raise exception 'Grenen har ingen revisjon %.', p_revisjon using errcode = 'PT404';
  end if;
  select v.* into grunnlag from public.sideversjoner v where v.id = coalesce(r.grunnversjon, p_gren.grunnversjon);
  return kuratering.sammendrag(p_gren) || jsonb_build_object(
    'grenrevisjon', case when r.revisjon is null then null else jsonb_strip_nulls(jsonb_build_object(
      'revisjon', r.revisjon,
      'fingeravtrykk', r.fingeravtrykk,
      'melding', r.melding,
      'av', r.profil_navn,
      'kl', r.opprettet_kl,
      'tilstand', r.innhold,
      'teknisk', r.teknisk,
      'forhandsvisning', case when p_blind then null else r.forhandsvisning end
    )) end,
    'grunnlag', case
      when p_blind then kuratering.oppbygning(grunnlag)
      else public.les_sideversjon(p_gren.stoff, grunnlag.nr)
    end,
    'vurderinger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'revisjon', v.revisjon, 'beslutning', v.beslutning, 'begrunnelse', v.begrunnelse,
        'av', v.profil_navn, 'kl', v.opprettet_kl, 'gjelder_denne', v.fingeravtrykk = r.fingeravtrykk)
        order by v.id)
      from kuratering.vurderinger v where v.gren = p_gren.id
    ), '[]'::jsonb),
    'hendelser', coalesce((
      select jsonb_agg(h.j order by h.id desc)
      from (
        select x.id, jsonb_strip_nulls(jsonb_build_object(
          'hendelse', x.hendelse, 'fra', x.fra, 'til', x.til, 'revisjon', x.revisjon,
          'av', x.profil_navn, 'data', nullif(x.data, '{}'::jsonb), 'kl', x.kl)) as j
        from kuratering.hendelser x where x.gren = p_gren.id
        order by x.id desc limit 100
      ) h
    ), '[]'::jsonb),
    'dokumenter', coalesce((
      select jsonb_agg(jsonb_build_object('art', d.art, 'versjon', d.versjon, 'kl', d.opprettet_kl) order by d.art, d.versjon)
      from kuratering.dokumenter d where d.gren = p_gren.id
        and d.versjon = (select max(d2.versjon) from kuratering.dokumenter d2 where d2.gren = d.gren and d2.art = d.art)
    ), '[]'::jsonb),
    'hindringer', to_jsonb(kuratering.hindringer(p_gren)),
    'manglende_dokumenter', to_jsonb(kuratering.manglende_dokumenter(p_gren))
  );
end;
$$;

-- --- Handlingene ------------------------------------------------------------------

-- Hver handling tar den som handler og argumentene, kontrollerer rollen og
-- statusen, og gir svaret som JSON. Statusovergangene:
--
--   arbeid / retting  -> klar             kuratoren sender til kontroll
--   klar              -> arbeid / retting kuratoren trekker den tilbake
--   klar              -> godkjent         en uavhengig kontrollør godkjenner
--   klar              -> tilbakemelding   kontrolløren ber om endringer
--   tilbakemelding / godkjent / blokkert -> retting (arbeid)  ny lagring
--   godkjent          -> publisert        publiseringen lykkes
--   godkjent          -> blokkert         publiseringen stopper (konflikt, teknisk feil)
--   aktiv             -> stanset          en administrator stanser den
--   stanset           -> retting (arbeid) en administrator gjenopptar den
--   aktiv             -> arkivert         forkastet; siden er uendret

create function kuratering.krev_rolle(p_aktor kuratering.aktor, p_rolle text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not p_aktor.admin and not (p_rolle = any (p_aktor.roller)) then
    raise exception 'Agenten har ikke rollen %.', p_rolle using errcode = '42501';
  end if;
end;
$$;

-- Kuratoren av grenen (ingen andre agenter skriver i den).
create function kuratering.krev_kurator(p_aktor kuratering.aktor, p_gren kuratering.grener)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_aktor.agent is null or p_aktor.agent is distinct from p_gren.kurator then
    raise exception 'Bare kuratoren av grenen kan gjøre dette.' using errcode = '42501';
  end if;
end;
$$;

create function kuratering.krev_status(p_gren kuratering.grener, p_tillatt text[], p_hva text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not (p_gren.status = any (p_tillatt)) then
    raise exception 'Grenen er «%», så den kan ikke %.', p_gren.status, p_hva using errcode = '22023';
  end if;
end;
$$;

create function kuratering.gren_fra(p_data jsonb)
returns kuratering.grener
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(p_data ->> 'gren', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Grenen mangler.' using errcode = '22023';
  end if;
  return kuratering.grenen((p_data ->> 'gren')::uuid);
end;
$$;

create function kuratering.h_oversikt(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(kuratering.sammendrag(g) order by g.oppdatert_kl desc), '[]'::jsonb)
  from kuratering.grener g
  where (coalesce((p_data ->> 'alle')::boolean, false) or kuratering.er_aktiv(g.status) or g.oppdatert_kl > now() - interval '30 days')
    and (p_data ->> 'stoff' is null or g.stoff = p_data ->> 'stoff')
    and (p_aktor.admin or 'kontrollor' = any (p_aktor.roller) or g.kurator = p_aktor.agent)
$$;

create function kuratering.h_apne(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  side uuid;
  versjon public.sideversjoner;
  art text := coalesce(p_data ->> 'art', 'kuratering');
  g kuratering.grener;
begin
  perform kuratering.krev_rolle(p_aktor, 'kurator');
  if p_aktor.agent is null then
    raise exception 'Bare en kurator åpner en kurateringsgren.' using errcode = '42501';
  end if;
  if art not in ('kuratering', 'de_novo') then
    raise exception 'Arten må være kuratering eller de_novo.' using errcode = '22023';
  end if;
  select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = btrim(p_data ->> 'stoff');
  if side is null then
    raise exception 'Fant ingen publisert fagside «%».', p_data ->> 'stoff' using errcode = 'PT404';
  end if;
  versjon := kuratering.siste_versjon(side);
  if versjon.id is null then
    raise exception 'Fagsiden har ingen sideversjon.' using errcode = '22023';
  end if;
  if exists (select 1 from kuratering.grener x where x.infoside = side and kuratering.er_aktiv(x.status)) then
    raise exception 'Fagsiden har alt en aktiv kurateringsgren.' using errcode = 'PT409';
  end if;

  insert into kuratering.grener (infoside, stoff, art, formaal, kurator, grunnversjon, blindfase)
  values (side, btrim(p_data ->> 'stoff'), art, btrim(coalesce(p_data ->> 'formaal', '')), p_aktor.agent, versjon.id, art = 'de_novo')
  returning * into g;
  perform kuratering.ny_hendelse(g, 'apnet', p_aktor, null, 'arbeid', jsonb_build_object('grunnversjon', versjon.nr, 'art', art));
  return kuratering.sammendrag(g);
end;
$$;

-- Kontrolløren og administratorene ser alt; kuratoren sin egen gren, uten
-- fagteksten fra før så lenge blindfasen varer.
create function kuratering.h_les(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  select x.* into g from kuratering.grener x where x.id = (p_data ->> 'gren')::uuid;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  if not p_aktor.admin and not ('kontrollor' = any (p_aktor.roller)) then
    perform kuratering.krev_kurator(p_aktor, g);
  end if;
  return kuratering.detaljer(g, (p_data ->> 'revisjon')::integer, g.blindfase and p_aktor.agent is not distinct from g.kurator);
end;
$$;

create function kuratering.h_skriv(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  anvendt jsonb;
  ny_status text;
  r kuratering.grenrevisjoner;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['arbeid', 'retting', 'tilbakemelding', 'godkjent', 'blokkert'], 'endres');
  if (p_data ->> 'forventet_revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'forventet_revisjon'
      using errcode = 'PT409', detail = jsonb_build_object('gjeldende_revisjon', g.revisjon)::text;
  end if;

  anvendt := kuratering.anvend(g, kuratering.tilstand(g), p_data -> 'endringer');
  g := kuratering.ny_revisjon(g, anvendt -> 'tilstand', g.grunnversjon, p_aktor, p_data ->> 'melding');

  ny_status := case when g.status = 'arbeid' then 'arbeid' else kuratering.arbeidsstatus(g) end;
  if ny_status <> g.status then
    g := kuratering.sett_status(g, ny_status, p_aktor, 'arbeid_gjenopptatt');
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  return jsonb_build_object('revisjon', g.revisjon, 'status', g.status, 'nye', anvendt -> 'nye', 'teknisk', r.teknisk);
end;
$$;

create function kuratering.h_aktivitet(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  v_aktivitet jsonb;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  if not kuratering.er_aktiv(g.status) then
    raise exception 'Grenen er ikke aktiv.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_data ->> 'tekst', ''))) not between 1 and 300 then
    raise exception 'Aktiviteten må ha en tekst på 1 til 300 tegn.' using errcode = '22023';
  end if;
  v_aktivitet := jsonb_strip_nulls(jsonb_build_object(
    'tekst', btrim(p_data ->> 'tekst'),
    'seksjon', nullif(btrim(p_data ->> 'seksjon'), ''),
    'objekt', (p_data ->> 'objekt')::uuid,
    'kl', now()));
  update kuratering.grener x set aktivitet = v_aktivitet, oppdatert_kl = now() where x.id = g.id;
  perform kuratering.ny_hendelse(g, 'aktivitet', p_aktor, null, null, v_aktivitet - 'kl');
  return v_aktivitet;
end;
$$;

create function kuratering.h_dokument(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  versjon integer;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['arbeid', 'retting', 'tilbakemelding', 'godkjent', 'blokkert'], 'få nye dokumenter');
  if g.art = 'de_novo' and not g.blindfase and p_data ->> 'art' = 'blindprotokoll' then
    raise exception 'Blindprotokollen er avsluttet og kan ikke endres.' using errcode = '22023';
  end if;
  select coalesce(max(d.versjon), 0) + 1 into versjon
  from kuratering.dokumenter d where d.gren = g.id and d.art = p_data ->> 'art';
  insert into kuratering.dokumenter (gren, infoside, art, versjon, innhold, agent)
  values (g.id, g.infoside, p_data ->> 'art', versjon, p_data -> 'innhold', p_aktor.agent);
  perform kuratering.ny_hendelse(g, 'dokument', p_aktor, null, null, jsonb_build_object('art', p_data ->> 'art', 'versjon', versjon));
  return jsonb_build_object('art', p_data ->> 'art', 'versjon', versjon);
end;
$$;

create function kuratering.h_les_dokument(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  g kuratering.grener;
  d kuratering.dokumenter;
begin
  select x.* into g from kuratering.grener x where x.id = (p_data ->> 'gren')::uuid;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  if not p_aktor.admin and not ('kontrollor' = any (p_aktor.roller)) then
    perform kuratering.krev_kurator(p_aktor, g);
  end if;
  select x.* into d from kuratering.dokumenter x
  where x.gren = g.id and x.art = p_data ->> 'art'
    and (p_data ->> 'versjon' is null or x.versjon = (p_data ->> 'versjon')::integer)
  order by x.versjon desc limit 1;
  if d.id is null then
    raise exception 'Grenen har ikke dokumentet.' using errcode = 'PT404';
  end if;
  return jsonb_build_object('art', d.art, 'versjon', d.versjon, 'kl', d.opprettet_kl, 'innhold', d.innhold);
end;
$$;

-- Blindfasen i en de novo-kuratering varer til kuratoren har lagret
-- blindprotokollen og evidensjournalen fra sitt eget kildesøk. Først da ser
-- den fagteksten som sto der fra før.
create function kuratering.h_avslutt_blindfase(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  mangler text[];
begin
  perform kuratering.krev_kurator(p_aktor, g);
  if not g.blindfase then
    raise exception 'Grenen er ikke i blindfasen.' using errcode = '22023';
  end if;
  select coalesce(array_agg(a order by a), '{}') into mangler
  from unnest(array['blindprotokoll', 'evidensjournal']) a
  where not exists (select 1 from kuratering.dokumenter d where d.gren = g.id and d.art = a);
  if cardinality(mangler) > 0 then
    raise exception 'Blindfasen kan ikke avsluttes før grenen har %.', array_to_string(mangler, ' og ') using errcode = '22023';
  end if;
  update kuratering.grener x set blindfase = false, oppdatert_kl = now() where x.id = g.id returning x.* into g;
  perform kuratering.ny_hendelse(g, 'blindfase_avsluttet', p_aktor);
  return kuratering.sammendrag(g);
end;
$$;

create function kuratering.h_til_kontroll(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  r kuratering.grenrevisjoner;
  mangler text[];
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['arbeid', 'retting'], 'sendes til kontroll');
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if g.blindfase then
    raise exception 'Blindfasen må avsluttes før grenen sendes til kontroll.' using errcode = '22023';
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  if r.revisjon is null then
    raise exception 'Grenen har ingen endringer.' using errcode = '22023';
  end if;
  if not coalesce((r.teknisk ->> 'ok')::boolean, false) or not coalesce((r.teknisk ->> 'rapport_ok')::boolean, false) then
    raise exception 'Prøvepubliseringen må bestå, med en rapport som stemmer, før grenen sendes til kontroll: %',
      coalesce(r.teknisk ->> 'feil', r.teknisk ->> 'rapportfeil', 'ukjent feil') using errcode = '22023';
  end if;
  if (kuratering.siste_versjon(g.infoside)).id is distinct from g.grunnversjon then
    raise exception 'Fagsiden er publisert på nytt; oppdater grenen til den nye versjonen først.' using errcode = 'PT409';
  end if;
  mangler := kuratering.manglende_dokumenter(g);
  if cardinality(mangler) > 0 then
    raise exception 'Grenen mangler dokumentene %.', array_to_string(mangler, ', ') using errcode = '22023';
  end if;
  update kuratering.grener x set runde = x.runde + 1 where x.id = g.id returning x.* into g;
  g := kuratering.sett_status(g, 'klar', p_aktor, 'til_kontroll', null, jsonb_build_object('runde', g.runde));
  return kuratering.sammendrag(g);
end;
$$;

create function kuratering.h_trekk_fra_kontroll(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['klar'], 'trekkes fra kontroll');
  update kuratering.grener x set runde = x.runde - 1 where x.id = g.id returning x.* into g;
  g := kuratering.sett_status(g, kuratering.arbeidsstatus(g), p_aktor, 'trukket_fra_kontroll');
  return kuratering.sammendrag(g);
end;
$$;

-- Den faglige vurderingen av nøyaktig én revisjon, fra en kontrollør som ikke
-- er kuratoren, eller en administrator.
create function kuratering.h_vurder(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  r kuratering.grenrevisjoner;
  beslutning text := p_data ->> 'beslutning';
  hindret text[];
begin
  perform kuratering.krev_rolle(p_aktor, 'kontrollor');
  if p_aktor.agent is not null and p_aktor.agent = g.kurator then
    raise exception 'En agent kan ikke vurdere sin egen kuratering.' using errcode = '42501';
  end if;
  perform kuratering.krev_status(g, array['klar'], 'vurderes');
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %. Vurder den siste.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if beslutning not in ('godkjent', 'endringer') then
    raise exception 'Beslutningen må være godkjent eller endringer.' using errcode = '22023';
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  if beslutning = 'godkjent' then
    hindret := array(
      select h from unnest(kuratering.hindringer(g)) h
      where h <> 'Revisjon ' || g.revisjon || ' er ikke faglig godkjent.'
    );
    if cardinality(hindret) > 0 then
      raise exception 'Revisjonen kan ikke godkjennes: %', array_to_string(hindret, ' ') using errcode = '22023';
    end if;
  end if;

  insert into kuratering.vurderinger (gren, infoside, revisjon, fingeravtrykk, beslutning, begrunnelse, agent, profil, profil_navn)
  values (g.id, g.infoside, g.revisjon, r.fingeravtrykk, beslutning, btrim(coalesce(p_data ->> 'begrunnelse', '')),
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end, kuratering.aktornavn(p_aktor));
  g := kuratering.sett_status(g, case beslutning when 'godkjent' then 'godkjent' else 'tilbakemelding' end,
    p_aktor, 'vurdert', null, jsonb_build_object('beslutning', beslutning));
  return kuratering.sammendrag(g);
end;
$$;

-- Grenen flyttes til den nye versjonen av siden. Det blir en ny revisjon, så
-- en godkjenning faller bort, og kuratoren får vite hvilke av objektene den
-- endrer som er publisert på nytt i mellomtiden.
create function kuratering.h_oppdater_grunnlag(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  gammel public.sideversjoner;
  ny public.sideversjoner;
  tilstand jsonb;
  endret jsonb;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['arbeid', 'retting', 'tilbakemelding', 'godkjent', 'blokkert', 'klar'], 'oppdateres');
  select v.* into strict gammel from public.sideversjoner v where v.id = g.grunnversjon;
  ny := kuratering.siste_versjon(g.infoside);
  if ny.id = gammel.id then
    raise exception 'Grenen bygger alt på den siste versjonen av fagsiden.' using errcode = '22023';
  end if;
  tilstand := kuratering.tilstand(g);
  select coalesce(jsonb_agg(x.key order by x.key), '[]'::jsonb) into endret
  from jsonb_each(tilstand -> 'objekter') x
  where not (x.value ->> 'ny')::boolean
    and kuratering.revisjon_i_versjon(gammel, x.key::uuid) is distinct from kuratering.revisjon_i_versjon(ny, x.key::uuid);

  g := kuratering.ny_revisjon(g, tilstand, ny.id, p_aktor, 'Oppdatert til versjon ' || ny.nr || ' av fagsiden');
  if g.status <> kuratering.arbeidsstatus(g) then
    g := kuratering.sett_status(g, kuratering.arbeidsstatus(g), p_aktor, 'grunnlag_oppdatert', null,
      jsonb_build_object('fra', gammel.nr, 'til', ny.nr));
  else
    perform kuratering.ny_hendelse(g, 'grunnlag_oppdatert', p_aktor, null, null, jsonb_build_object('fra', gammel.nr, 'til', ny.nr));
  end if;
  return kuratering.sammendrag(g) || jsonb_build_object('endret_i_hovedversjonen', endret);
end;
$$;

create function kuratering.h_publiser(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  if not p_aktor.admin then
    perform kuratering.krev_kurator(p_aktor, g);
  end if;
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  return kuratering.publiser(g, p_aktor);
end;
$$;

create function kuratering.h_stans(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  perform kuratering.krev_status(g, array['arbeid', 'klar', 'tilbakemelding', 'retting', 'godkjent', 'blokkert'], 'stanses');
  g := kuratering.sett_status(g, 'stanset', p_aktor, 'stanset', nullif(btrim(p_data ->> 'grunn'), ''));
  return kuratering.sammendrag(g);
end;
$$;

create function kuratering.h_gjenoppta(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  perform kuratering.krev_status(g, array['stanset'], 'gjenopptas');
  g := kuratering.sett_status(g, kuratering.arbeidsstatus(g), p_aktor, 'gjenopptatt');
  return kuratering.sammendrag(g);
end;
$$;

create function kuratering.h_forkast(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  if not p_aktor.admin then
    perform kuratering.krev_kurator(p_aktor, g);
  end if;
  if not kuratering.er_aktiv(g.status) then
    raise exception 'Grenen er alt avsluttet.' using errcode = '22023';
  end if;
  g := kuratering.sett_status(g, 'arkivert', p_aktor, 'forkastet', nullif(btrim(p_data ->> 'grunn'), ''));
  return kuratering.sammendrag(g);
end;
$$;

-- En ny nøkkel til en agent. Den gamle slutter å virke med en gang, og den nye
-- vises bare denne ene gangen.
create function kuratering.h_ny_agentnokkel(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  nokkel text := 'far_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  a kuratering.agenter;
begin
  update kuratering.agenter x
  set nokkel_sha256 = encode(sha256(convert_to(nokkel, 'UTF8')), 'hex'), nokkel_kl = now(), aktiv = true
  where x.agent = p_data ->> 'agent'
  returning x.* into a;
  if a.id is null then
    raise exception 'Fant ingen agent «%».', p_data ->> 'agent' using errcode = 'PT404';
  end if;
  return jsonb_build_object('agent', a.agent, 'nokkel', nokkel);
end;
$$;

create function kuratering.h_agenter(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'agent', a.agent, 'navn', e.navn, 'roller', a.roller, 'aktiv', a.aktiv,
    'har_nokkel', a.nokkel_sha256 is not null, 'nokkel_kl', a.nokkel_kl, 'sist_sett_kl', a.sist_sett_kl))
    order by a.agent), '[]'::jsonb)
  from kuratering.agenter a
  join public.endringsagenter e on e.nokkel = a.agent
$$;

-- --- Inngangene -------------------------------------------------------------------

-- Hvilke handlinger agentene og administratorene har. Rollene og statusene
-- kontrolleres i handlingene.
create function kuratering.handlinger(p_admin boolean)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when p_admin
    then array['oversikt', 'les', 'les_dokument', 'vurder', 'publiser', 'stans', 'gjenoppta', 'forkast', 'agenter', 'ny_agentnokkel']
    else array['oversikt', 'apne', 'les', 'skriv', 'aktivitet', 'dokument', 'les_dokument', 'avslutt_blindfase',
      'til_kontroll', 'trekk_fra_kontroll', 'vurder', 'oppdater_grunnlag', 'publiser', 'forkast']
  end
$$;

create function kuratering.utfor_handling(p_aktor kuratering.aktor, p_handling text, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ut jsonb;
begin
  if p_handling is null or not (p_handling = any (kuratering.handlinger(p_aktor.admin))) then
    raise exception 'Ukjent handling «%».', p_handling using errcode = '22023';
  end if;
  if p_data is not null and jsonb_typeof(p_data) <> 'object' then
    raise exception 'Argumentene må være et JSON-objekt.' using errcode = '22023';
  end if;
  execute format('select kuratering.%I($1, $2)', 'h_' || p_handling) into ut using p_aktor, coalesce(p_data, '{}'::jsonb);
  return ut;
end;
$$;

-- Agentene, gjennom serveren (`api/kuratering.ts`), med nøkkelen fra
-- forespørselen. Bare tjenesterollen kan kalle den.
create function public.kuratering_agent(nokkel text, handling text, data jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return kuratering.utfor_handling(kuratering.agent_med_nokkel(nokkel), handling, data);
end;
$$;

comment on function public.kuratering_agent(text, text, jsonb) is
  'Kurateringsgrenene for KI-agentene, med agentnøkkelen. Bare for serveren (docs/kurateringsgrener.md).';

-- Administratorene, fra appen.
create function public.kuratering_admin(handling text, data jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return kuratering.utfor_handling(kuratering.admin_aktor(), handling, data);
end;
$$;

comment on function public.kuratering_admin(text, jsonb) is
  'Kurateringsgrenene for administratorene: lese, vurdere, publisere, stanse og forkaste (docs/kurateringsgrener.md).';

-- --- Tilgangen --------------------------------------------------------------------

revoke all on all tables in schema kuratering from public, anon, authenticated, service_role;
revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
revoke all on function public.kuratering_agent(text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.kuratering_admin(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.kuratering_agent(text, text, jsonb) to service_role;
grant execute on function public.kuratering_admin(text, jsonb) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
