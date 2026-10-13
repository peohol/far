-- Endringsloggen for innholdssidene (`docs/innholdsendringer.md`).
--
-- Hver side med redigerbart innhold — fagsidene, stoffregisteret og
-- fortolkningssidene — får en logg over hva som er endret, når, av hvem og
-- hvorfor. Loggen er bygd på revisjonene, publiseringene og historikken som
-- finnes; den er ikke et eget system ved siden av dem:
--
--   * `innholdsendringer` har én rad per endring: én lagring, én publisering,
--     én handling i stoffregisteret eller én kuratering. Raden sier hvem som
--     gjorde den — en person, en navngitt KI-agent eller systemet — og har
--     oppsummeringen, og for en kuratering rapporten.
--   * Revisjonene og publiseringene peker på endringen de hører til
--     (`endring_id`), satt av en trigger når de skrives, i samme transaksjon.
--     Det som ikke har revisjoner — stoffregisteret og bivirkningsimportene —
--     føres som hendelser (`innholdshendelser`).
--   * Endringen opprettes først når noe faktisk skrives. En lagring som ikke
--     endrer noe, gir ingen rad.
--   * Hvilke sider en endring gjelder, avgjøres når loggen leses, fra objektene
--     den endret: et kort hører til fagsiden det står på, en referanse til
--     sidene som siterer den, en kommentar til regelsettet som bruker den.
--     Objektenes ID-er endres aldri, så loggen tåler at en side får nytt navn,
--     arkiveres eller hentes fram.
--
-- Agentene står i `endringsagenter`. En endring fra en agent kan bare komme fra
-- en migrasjon (funksjonene i `intern` når ikke API-et), som oppgir agenten og
-- sitt eget filnavn; utrullingen og CI stopper en migrasjon som endrer
-- innhold uten det (`src/faginnhold/endringserklaring.ts`). En kuratering
-- avsluttes med en rapport som databasen kontrollerer mot det som faktisk ble
-- endret, og ingenting kan endres etter rapporten i samme migrasjon.
--
-- Loggen kan ikke endres eller slettes gjennom appen eller API-et. Den er
-- adskilt fra appens egen endringslogg (versjonene), og de faste
-- synkroniseringene av eksterne data (FEST, ClinPGx, CPIC, PubChem,
-- Farmakologiportalen) skriver ikke i den.

-- --- Agentene --------------------------------------------------------------

create table public.endringsagenter (
  nokkel text primary key,
  navn text not null,
  art text not null,
  beskrivelse text not null,
  -- Rutinene (ryddingen, tjenestene) skjules i loggen til man ber om dem.
  rutine boolean not null default false,
  opprettet_kl timestamptz not null default now(),
  constraint endringsagenter_nokkel check (char_length(nokkel) <= 60 and nokkel ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint endringsagenter_navn check (char_length(navn) between 1 and 80 and navn = btrim(navn)),
  constraint endringsagenter_art check (art in ('ki-agent', 'system')),
  constraint endringsagenter_beskrivelse check (char_length(beskrivelse) between 1 and 500)
);

comment on table public.endringsagenter is
  'Agentene som kan stå for en endring i faginnholdet: KI-agentene og systemets egne. En ny agent legges inn med en migrasjon. Rader endres og slettes aldri.';

insert into public.endringsagenter (nokkel, navn, art, beskrivelse, rutine) values
  ('chatgpt-monografkurator', 'ChatGPT monografkurator', 'ki-agent',
    'Kuraterer fagsidene mot kildene og leverer endringene som datamigrasjoner (docs/monografkuratering.md).', false),
  ('claude-code', 'Claude Code', 'ki-agent',
    'Bygger infrastrukturen og gjør tekniske datamigrasjoner. Publiserer ikke nytt klinisk innhold.', false),
  ('databasemigrasjon', 'Databasemigrasjon', 'system',
    'En migrasjon som endret innhold uten å oppgi agent. Gjelder eldre migrasjoner; nye må oppgi agenten.', false),
  ('tjeneste', 'Tjeneste', 'system',
    'En tjeneste som endret innhold gjennom API-et uten innlogget bruker.', true),
  ('papirkurvrydding', 'Papirkurvrydding', 'system',
    'Sletter fagsider som har ligget i papirkurven i mer enn 30 dager.', true);

-- --- Endringene ------------------------------------------------------------

-- Lenkene en endring kan ha: en PR eller en commit i et GitHub-repo.
create function intern.er_endringslenker(p_lenker text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_lenker), 0) <= 20 and coalesce(bool_and(
    char_length(l) <= 300
    and l ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/(pull/[0-9]+|commit/[0-9a-f]{7,40})$'
  ), true)
  from unnest(p_lenker) l
$$;

create table public.innholdsendringer (
  id uuid primary key default gen_random_uuid(),
  opprettet_kl timestamptz not null default now(),
  -- Transaksjonen som opprettet raden. Bare den kan fylle inn rapporten.
  transaksjon xid8 not null default pg_current_xact_id(),
  aktor text not null,
  agent text references public.endringsagenter (nokkel),
  art text not null default 'redigering',
  utfort_av uuid,
  utfort_av_fornavn text,
  utfort_av_etternavn text,
  oppsummering text,
  rapport jsonb,
  migrasjon text,
  lenker text[] not null default '{}',
  -- Antallet revisjoner, publiseringer og hendelser da rapporten ble skrevet.
  deler_ved_rapport integer,
  constraint innholdsendringer_aktor check (aktor in ('bruker', 'agent', 'system')),
  constraint innholdsendringer_art check (art in ('redigering', 'kuratering')),
  constraint innholdsendringer_bruker check (aktor <> 'bruker' or (agent is null and utfort_av is not null and art = 'redigering')),
  constraint innholdsendringer_oppsummering check (
    oppsummering is null or (char_length(oppsummering) between 1 and 500 and oppsummering = btrim(oppsummering))
  ),
  constraint innholdsendringer_rapport check (
    (rapport is null) = (deler_ved_rapport is null) and (rapport is null or jsonb_typeof(rapport) = 'object')
  ),
  constraint innholdsendringer_migrasjon check (migrasjon is null or migrasjon ~ '^[0-9]{14}_[a-z0-9_]+\.sql$'),
  constraint innholdsendringer_lenker check (intern.er_endringslenker(lenker))
);

create index innholdsendringer_opprettet_idx on public.innholdsendringer (opprettet_kl);

comment on table public.innholdsendringer is
  'Én endring i faginnholdet: hvem (person, agent eller system), når, oppsummeringen og eventuelt rapporten. Revisjonene, publiseringene og hendelsene den består av, peker hit. Kan ikke slettes, og bare fylles ut i transaksjonen som opprettet den.';

alter table public.objektrevisjoner add column endring_id uuid references public.innholdsendringer (id);
alter table public.objektpubliseringer add column endring_id uuid references public.innholdsendringer (id);

create index objektrevisjoner_endring_idx on public.objektrevisjoner (endring_id) where endring_id is not null;
create index objektpubliseringer_endring_idx on public.objektpubliseringer (endring_id) where endring_id is not null;
-- Kortene på en fagside, også dem som er flyttet bort, slås opp på siden i revisjonene.
create index objektrevisjoner_infoside_idx on public.objektrevisjoner ((innhold ->> 'infoside')) where innhold ? 'infoside';

comment on column public.objektrevisjoner.endring_id is
  'Endringen revisjonen hører til (innholdsendringer). Tom for revisjonene fra før endringsloggen.';
comment on column public.objektpubliseringer.endring_id is
  'Endringen publiseringen hører til (innholdsendringer). Tom for publiseringene fra før endringsloggen.';

-- Det i en endring som ikke er revisjoner: stoffregisteret og bivirkningene.
create table public.innholdshendelser (
  id bigint generated always as identity primary key,
  endring_id uuid not null references public.innholdsendringer (id),
  hendelse text not null,
  -- Fagsiden (objektet) hendelsen gjelder, om noen. Uten fremmednøkkel: loggen
  -- skal stå også om siden slettes for godt.
  side uuid,
  -- Om hendelsen hører til stoffregisterets logg.
  stoffregister boolean not null default false,
  data jsonb not null default '{}',
  utfort_kl timestamptz not null default now(),
  constraint innholdshendelser_hendelse check (char_length(hendelse) <= 60 and hendelse ~ '^[a-z][a-z_]*$'),
  constraint innholdshendelser_data check (jsonb_typeof(data) = 'object')
);

create index innholdshendelser_endring_idx on public.innholdshendelser (endring_id);
create index innholdshendelser_side_idx on public.innholdshendelser (side) where side is not null;
create index innholdshendelser_stoffregister_idx on public.innholdshendelser (utfort_kl) where stoffregister;

comment on table public.innholdshendelser is
  'Det i en endring som ikke har revisjoner: handlingene i stoffregisteret og bivirkningsimportene, med navnene slik de var da. Rader endres og slettes aldri.';

-- --- Uforanderlig ----------------------------------------------------------

create trigger endringsagenter_uforanderlig
before update or delete on public.endringsagenter
for each row execute function intern.avvis_endring();

create trigger endringsagenter_ikke_tom
before truncate on public.endringsagenter
for each statement execute function intern.avvis_endring();

create trigger innholdshendelser_uforanderlig
before update or delete on public.innholdshendelser
for each row execute function intern.avvis_endring();

create trigger innholdshendelser_ikke_tom
before truncate on public.innholdshendelser
for each statement execute function intern.avvis_endring();

create trigger innholdsendringer_ikke_slettet
before delete on public.innholdsendringer
for each row execute function intern.avvis_endring();

create trigger innholdsendringer_ikke_tom
before truncate on public.innholdsendringer
for each statement execute function intern.avvis_endring();

-- En endring fylles ut (agent, rapport, lenker) bare i transaksjonen som
-- opprettet den, og hvem, når og hva slags endring står fast.
create function intern.innholdsendring_fylles_ut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transaksjon <> pg_current_xact_id()
    or (new.id, new.opprettet_kl, new.transaksjon, new.aktor, new.art, new.utfort_av, new.utfort_av_fornavn, new.utfort_av_etternavn)
      is distinct from (old.id, old.opprettet_kl, old.transaksjon, old.aktor, old.art, old.utfort_av, old.utfort_av_fornavn, old.utfort_av_etternavn)
    or (old.agent is not null and new.agent is distinct from old.agent)
    or (old.rapport is not null and (new.rapport, new.deler_ved_rapport) is distinct from (old.rapport, old.deler_ved_rapport))
  then
    raise exception 'Endringsloggen kan ikke endres i ettertid.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger innholdsendringer_fylles_ut
before update on public.innholdsendringer
for each row execute function intern.innholdsendring_fylles_ut();

-- --- Den gjeldende endringen -----------------------------------------------

-- Om kallet kom gjennom data-API-et (en innlogget bruker, en anonym eller en
-- tjeneste) og ikke fra en migrasjon. Rollen står også inne i funksjoner som
-- kjører med eierens rettigheter.
create function intern.via_api()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), '') in ('anon', 'authenticated', 'service_role')
    or coalesce(current_setting('request.method', true), '') <> ''
$$;

-- En overskrift i forespørselen til data-API-et, om den finnes.
create function intern.foresporselsfelt(p_navn text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  return nullif(btrim(nullif(current_setting('request.headers', true), '')::jsonb ->> p_navn), '');
exception when others then
  return null;
end;
$$;

-- Oppsummeringen brukeren skrev, sendt som base64 av UTF-8 (en overskrift kan
-- ikke ha æ, ø og å). Ugyldig eller tom gir ingen oppsummering.
create function intern.oppsummering_fra_foresporsel()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  kodet text := intern.foresporselsfelt('x-far-oppsummering');
  tekst text;
begin
  if kodet is null or char_length(kodet) > 3000 then
    return null;
  end if;
  tekst := btrim(regexp_replace(convert_from(decode(kodet, 'base64'), 'UTF8'), '\s+', ' ', 'g'));
  return nullif(left(tekst, 500), '');
exception when others then
  return null;
end;
$$;

-- Endringen det som skrives nå, hører til. Den opprettes ved den første
-- skrivingen i transaksjonen og gjelder resten av den:
--
--   * en agent oppgitt med `intern.endring_start` (bare migrasjoner når den);
--   * en kuratering åpnet med `intern.kuratering_start`, som får agenten og
--     rapporten med `intern.kuratering_rapport` til slutt;
--   * en innlogget bruker gjennom API-et. Flere kall som hører til én handling
--     i appen (`x-far-endring`, en ID appen lager), samles i én endring så
--     lenge de er fra samme bruker og innen en time. Oppsummeringen brukeren
--     skrev, står i `x-far-oppsummering`;
--   * en tjeneste gjennom API-et uten bruker;
--   * ellers en migrasjon som ikke oppga agent.
create function intern.gjeldende_endring()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  endring uuid := nullif(current_setting('far.endring', true), '')::uuid;
  valg jsonb := coalesce(nullif(current_setting('far.endringsvalg', true), ''), '{}')::jsonb;
  kuratering text := nullif(current_setting('far.kuratering', true), '');
  api boolean := intern.via_api();
  bruker uuid := (select auth.uid());
  profil public.profiles;
  v_aktor text;
  v_agent text;
  v_art text := 'redigering';
  v_oppsummering text := valg ->> 'oppsummering';
  operasjon text;
begin
  if endring is not null then
    return endring;
  end if;

  if bruker is not null then
    select p.* into profil from public.profiles p where p.id = bruker;
  end if;
  if kuratering is not null then
    v_art := 'kuratering';
  end if;

  if valg ? 'agent' then
    v_agent := valg ->> 'agent';
    v_aktor := case (select a.art from public.endringsagenter a where a.nokkel = v_agent) when 'ki-agent' then 'agent' else 'system' end;
  elsif kuratering is not null then
    v_aktor := 'agent';
  elsif api and bruker is not null then
    v_aktor := 'bruker';
    v_oppsummering := intern.oppsummering_fra_foresporsel();
    operasjon := intern.foresporselsfelt('x-far-endring');
    if operasjon is not null and operasjon ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      insert into public.innholdsendringer (id, aktor, utfort_av, utfort_av_fornavn, utfort_av_etternavn, oppsummering)
      values (operasjon::uuid, 'bruker', bruker, profil.first_name, profil.last_name, v_oppsummering)
      on conflict (id) do nothing;
      select e.id into endring
      from public.innholdsendringer e
      where e.id = operasjon::uuid and e.aktor = 'bruker' and e.utfort_av = bruker
        and e.opprettet_kl > now() - interval '1 hour';
      -- En ID som tilhører noen andre, eller er gammel, gir en ny endring.
    end if;
  elsif api then
    v_aktor := 'system';
    v_agent := 'tjeneste';
  else
    v_aktor := 'system';
    v_agent := 'databasemigrasjon';
  end if;

  if endring is null then
    insert into public.innholdsendringer (
      aktor, agent, art, utfort_av, utfort_av_fornavn, utfort_av_etternavn, oppsummering, migrasjon, lenker
    )
    values (
      v_aktor, v_agent, v_art, bruker, profil.first_name, profil.last_name, v_oppsummering,
      valg ->> 'migrasjon', coalesce(array(select jsonb_array_elements_text(valg -> 'lenker')), '{}')
    )
    returning id into endring;
  end if;

  perform set_config('far.endring', endring::text, true);
  return endring;
end;
$$;

comment on function intern.gjeldende_endring() is
  'Endringen det som skrives i transaksjonen, hører til; opprettes ved den første skrivingen. Se docs/innholdsendringer.md.';

create function intern.sett_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.endring_id := intern.gjeldende_endring();
  return new;
end;
$$;

create trigger objektrevisjoner_endring
before insert on public.objektrevisjoner
for each row execute function intern.sett_endring();

create trigger objektpubliseringer_endring
before insert on public.objektpubliseringer
for each row execute function intern.sett_endring();

create trigger innholdshendelser_endring
before insert on public.innholdshendelser
for each row execute function intern.sett_endring();

-- Hvor mange revisjoner, publiseringer og hendelser endringen har.
create function intern.antall_deler(p_endring uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select (select count(*) from public.objektrevisjoner r where r.endring_id = p_endring)::integer
    + (select count(*) from public.objektpubliseringer p where p.endring_id = p_endring)::integer
    + (select count(*) from public.innholdshendelser h where h.endring_id = p_endring)::integer
$$;

-- Kontrollen når transaksjonen avsluttes: en endring fra en agent eller
-- systemet har en agent, en kuratering har rapporten fra en KI-agent, og
-- ingenting er endret etter rapporten.
create function intern.kontroller_innholdsendring()
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
    e.rapport is null or e.migrasjon is null
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

create constraint trigger innholdsendringer_kontroll
after insert on public.innholdsendringer
deferrable initially deferred
for each row execute function intern.kontroller_innholdsendring();

-- --- Agentene oppgir seg ---------------------------------------------------

-- Agenten og migrasjonen, kontrollert.
create function intern.krev_agent(p_agent text, p_migrasjon text)
returns public.endringsagenter
language plpgsql
stable
set search_path = ''
as $$
declare
  agent public.endringsagenter;
begin
  select a.* into agent from public.endringsagenter a where a.nokkel = p_agent;
  if not found then
    raise exception 'Agenten «%» er ikke registrert i endringsagenter.', p_agent using errcode = '22023';
  end if;
  if p_migrasjon is null or p_migrasjon !~ '^[0-9]{14}_[a-z0-9_]+\.sql$' then
    raise exception 'Migrasjonen må oppgis med sitt eget filnavn (<14 sifre>_<navn>.sql), ikke «%».', p_migrasjon
      using errcode = '22023';
  end if;
  return agent;
end;
$$;

-- En migrasjon fra en agent begynner med denne, før noe endres: agenten,
-- migrasjonens eget filnavn, en kort oppsummering av hensikten og eventuelt
-- lenker til PR-en eller commiten. Det som endres etterpå i migrasjonen, føres
-- som én endring fra agenten.
create function intern.endring_start(
  p_agent text,
  p_migrasjon text,
  p_oppsummering text,
  p_lenker text[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  oppsummering text := btrim(regexp_replace(coalesce(p_oppsummering, ''), '\s+', ' ', 'g'));
begin
  perform intern.krev_agent(p_agent, p_migrasjon);
  if nullif(current_setting('far.endring', true), '') is not null then
    raise exception 'intern.endring_start må kalles før noe er endret i migrasjonen.' using errcode = '22023';
  end if;
  if char_length(oppsummering) not between 1 and 500 then
    raise exception 'Oppsummeringen må ha mellom 1 og 500 tegn.' using errcode = '22023';
  end if;
  if not intern.er_endringslenker(coalesce(p_lenker, '{}')) then
    raise exception 'Lenkene må være til en PR eller commit på GitHub.' using errcode = '22023';
  end if;
  perform set_config('far.endringsvalg', jsonb_build_object(
    'agent', p_agent, 'migrasjon', p_migrasjon, 'oppsummering', oppsummering, 'lenker', to_jsonb(coalesce(p_lenker, '{}'))
  )::text, true);
end;
$$;

comment on function intern.endring_start(text, text, text, text[]) is
  'Oppgir agenten, migrasjonens filnavn, oppsummeringen og lenkene før en migrasjon endrer innhold. Se docs/innholdsendringer.md.';

-- Systemets egne endringer i funksjonene, som en navngitt systemagent.
create function intern.endring_som_system(p_agent text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.endringsagenter a where a.nokkel = p_agent and a.art = 'system') then
    raise exception '«%» er ikke en systemagent.', p_agent using errcode = '22023';
  end if;
  perform set_config('far.endring', '', true);
  perform set_config('far.endringsvalg', jsonb_build_object('agent', p_agent)::text, true);
end;
$$;

-- --- Hva en endring har endret ---------------------------------------------

-- Det som skiller et objekt fra andre av samme type, uten de store feltene
-- (tekstene og tabellene): nok til å si hva som ble endret.
create function intern.kjennetegn(p_type public.objekttype, p_innhold jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_innhold is null then null
    when p_type = 'innholdselement' then jsonb_strip_nulls(jsonb_build_object(
      'panel', p_innhold -> 'panel', 'elementtype', p_innhold -> 'elementtype', 'posisjon', p_innhold -> 'posisjon',
      'data', case when jsonb_typeof(p_innhold -> 'data') = 'object' then (p_innhold -> 'data') - 'dokument' - 'rader' end))
    when p_type = 'infoside' then jsonb_strip_nulls(jsonb_build_object('navn', p_innhold -> 'navn', 'slug', p_innhold -> 'slug'))
    when p_type = 'referanse' then jsonb_strip_nulls(jsonb_build_object(
      'tittel', p_innhold -> 'tittel', 'aar', p_innhold -> 'aar', 'arkivert', p_innhold -> 'arkivert'))
    when p_type = 'kommentar' then jsonb_strip_nulls(jsonb_build_object('navn', p_innhold -> 'navn'))
    when p_type = 'intervallregelsett' then jsonb_strip_nulls(jsonb_build_object('analyttkode', p_innhold -> 'analyttkode'))
    when p_type = 'scenarioregelsett' then jsonb_strip_nulls(jsonb_build_object('modul', p_innhold -> 'modul'))
    when p_type = 'laboratorieanalytt' then jsonb_strip_nulls(jsonb_build_object('kode', p_innhold -> 'kode'))
    else '{}'::jsonb
  end
$$;

-- Feltene på øverste nivå som er ulike i de to objektene.
create function intern.ulike_felt(p_fra jsonb, p_til jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
  from (
    select jsonb_object_keys(case when jsonb_typeof(p_fra) = 'object' then p_fra else '{}'::jsonb end) k
    union
    select jsonb_object_keys(case when jsonb_typeof(p_til) = 'object' then p_til else '{}'::jsonb end)
  ) felt
  where p_fra -> k is distinct from p_til -> k
$$;

-- Hvor mange ID-er som er lagt til og fjernet i en liste.
create function intern.listeendring(p_fra jsonb, p_til jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with fra as (
    select jsonb_array_elements_text(case when jsonb_typeof(p_fra) = 'array' then p_fra else '[]'::jsonb end) id
  ), til as (
    select jsonb_array_elements_text(case when jsonb_typeof(p_til) = 'array' then p_til else '[]'::jsonb end) id
  )
  select jsonb_build_object(
    'lagt_til', (select count(distinct t.id) from til t where t.id not in (select f.id from fra f)),
    'fjernet', (select count(distinct f.id) from fra f where f.id not in (select t.id from til t)))
$$;

-- Én del av en endring slik loggen viser den: objektet, revisjonene det gikk
-- mellom, kjennetegnene før og etter, og hvilke felt som ble endret.
create function intern.endringsdel(
  p_objekt uuid, p_type public.objekttype, p_fra integer, p_til integer, p_publisert boolean, p_fra_innhold jsonb, p_til_innhold jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'objekt', p_objekt,
    'type', p_type,
    'fra', p_fra,
    'til', p_til,
    'publisert', p_publisert,
    'for', intern.kjennetegn(p_type, p_fra_innhold),
    'etter', intern.kjennetegn(p_type, p_til_innhold),
    'endret', case when p_fra_innhold is not null then intern.ulike_felt(p_fra_innhold, p_til_innhold) end,
    'data_endret', case when p_type = 'innholdselement' and p_fra_innhold is not null
      then intern.ulike_felt(p_fra_innhold -> 'data', p_til_innhold -> 'data') end,
    'referanser', case when p_type = 'innholdselement'
      then intern.listeendring(p_fra_innhold -> 'referanser', p_til_innhold -> 'referanser') end,
    'panelreferanser', case when p_type = 'infoside' then (
      select jsonb_object_agg(panel, intern.listeendring(p_fra_innhold -> 'panelreferanser' -> panel, p_til_innhold -> 'panelreferanser' -> panel))
      from (
        select jsonb_object_keys(coalesce(p_fra_innhold -> 'panelreferanser', '{}'::jsonb)) panel
        union
        select jsonb_object_keys(coalesce(p_til_innhold -> 'panelreferanser', '{}'::jsonb))
      ) p
      where p_fra_innhold -> 'panelreferanser' -> panel is distinct from p_til_innhold -> 'panelreferanser' -> panel) end
  ))
$$;

-- Revisjonene i en endring, samlet per objekt: fra revisjonen før den første
-- til den siste.
create function intern.endringens_objekter(p_endring uuid)
returns table (objekt_id uuid, type public.objekttype, fra integer, til integer, fra_innhold jsonb, til_innhold jsonb)
language sql
stable
set search_path = ''
as $$
  with deler as (
    select r.objekt_id, nullif(min(r.revisjon) - 1, 0) as fra, max(r.revisjon) as til
    from public.objektrevisjoner r
    where r.endring_id = p_endring
    group by r.objekt_id
  )
  select d.objekt_id, o.type, d.fra, d.til, f.innhold, t.innhold
  from deler d
  join public.redigerbare_objekter o on o.id = d.objekt_id
  join public.objektrevisjoner t on t.objekt_id = d.objekt_id and t.revisjon = d.til
  left join public.objektrevisjoner f on f.objekt_id = d.objekt_id and f.revisjon = d.fra
$$;

-- Seksjonene på fagsiden en endring har lagt til, endret eller fjernet noe i.
-- Et kort som flyttes til et annet panel, er fjernet fra det ene og nytt i det
-- andre; et kort som flyttes til «fjernet», er fjernet.
create function intern.endringens_seksjoner(p_endring uuid)
returns table (seksjon text, art text)
language sql
stable
set search_path = ''
as $$
  with elementer as (
    select o.fra_innhold ->> 'panel' as fra, o.til_innhold ->> 'panel' as til,
      o.fra_innhold is distinct from o.til_innhold as ulik
    from intern.endringens_objekter(p_endring) o
    where o.type = 'innholdselement'
  ), sider as (
    select o.fra_innhold, o.til_innhold
    from intern.endringens_objekter(p_endring) o
    where o.type = 'infoside'
  )
  select til, 'nytt' from elementer
  where til <> 'fjernet' and (fra is null or fra = 'fjernet' or fra <> til)
  union
  select fra, 'fjernet' from elementer
  where fra is not null and fra <> 'fjernet' and (til = 'fjernet' or til <> fra)
  union
  select til, 'endret' from elementer
  where fra = til and til <> 'fjernet' and ulik
  union
  select p.panel, 'endret' from sider s
  cross join lateral (
    select jsonb_object_keys(coalesce(s.fra_innhold -> 'panelreferanser', '{}'::jsonb)) panel
    union
    select jsonb_object_keys(coalesce(s.til_innhold -> 'panelreferanser', '{}'::jsonb))
  ) p
  where s.fra_innhold -> 'panelreferanser' -> p.panel is distinct from s.til_innhold -> 'panelreferanser' -> p.panel
  union
  select 'identitet', 'endret' from sider s
  where s.fra_innhold is not null and s.fra_innhold ->> 'navn' is distinct from s.til_innhold ->> 'navn'
  union
  select 'bivirkninger', case when h.hendelse = 'bivirkning_trukket' then 'fjernet'
    when (h.data ->> 'erstatter')::boolean then 'endret' else 'nytt' end
  from public.innholdshendelser h
  where h.endring_id = p_endring and h.hendelse in ('bivirkning_importert', 'bivirkning_trukket')
$$;

-- --- Rapporten -------------------------------------------------------------

-- En liste med korte tekster i rapporten, kontrollert.
create function intern.rapportliste(p_rapport jsonb, p_felt text, p_sti text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  liste jsonb := p_rapport -> p_felt;
  verdi jsonb;
  ut jsonb := '[]'::jsonb;
begin
  if liste is null or liste = 'null'::jsonb then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(liste) <> 'array' or jsonb_array_length(liste) > 50 then
    raise exception 'Rapporten: % må være en liste med høyst 50 tekster.', p_sti || p_felt using errcode = '22023';
  end if;
  for verdi in select jsonb_array_elements(liste) loop
    if jsonb_typeof(verdi) <> 'string' or char_length(btrim(verdi #>> '{}')) not between 1 and 1000 then
      raise exception 'Rapporten: hver tekst i % må ha mellom 1 og 1000 tegn.', p_sti || p_felt using errcode = '22023';
    end if;
    ut := ut || to_jsonb(btrim(verdi #>> '{}'));
  end loop;
  return ut;
end;
$$;

-- Kontrollerer rapporten mot det endringen faktisk har gjort, og gir den
-- tilbake ryddet. Rapporten skal nevne hver seksjon og hver art (nytt, endret,
-- fjernet) som er endret, og ingen andre; nye kilder skal stå i kildegrunnlaget.
create function intern.kontroller_rapport(p_endring uuid, p_rapport jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  ukjent text;
  oppsummering text;
  seksjon jsonb;
  navn text;
  seksjoner jsonb := '[]'::jsonb;
  oppgitt text[] := '{}';
  faktisk text[];
  mangler text;
  ekstra text;
  ut jsonb;
  art text;
  liste jsonb;
  ny_seksjon jsonb;
begin
  if p_rapport is null or jsonb_typeof(p_rapport) <> 'object' then
    raise exception 'Rapporten må være et JSON-objekt.' using errcode = '22023';
  end if;
  select string_agg(k, ', ') into ukjent from jsonb_object_keys(p_rapport) k
  where k not in ('oppsummering', 'seksjoner', 'nye_opplysninger', 'korrigeringer', 'kildegrunnlag', 'mangler', 'lenker');
  if ukjent is not null then
    raise exception 'Rapporten har ukjente felt: %.', ukjent using errcode = '22023';
  end if;

  oppsummering := btrim(regexp_replace(coalesce(p_rapport ->> 'oppsummering', ''), '\s+', ' ', 'g'));
  if jsonb_typeof(p_rapport -> 'oppsummering') is distinct from 'string' or char_length(oppsummering) not between 1 and 500 then
    raise exception 'Rapporten må ha en oppsummering på mellom 1 og 500 tegn.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rapport -> 'seksjoner') is distinct from 'array' then
    raise exception 'Rapporten må ha seksjoner: en liste med det som er nytt, endret og fjernet i hver seksjon.' using errcode = '22023';
  end if;
  for seksjon in select jsonb_array_elements(p_rapport -> 'seksjoner') loop
    if jsonb_typeof(seksjon) <> 'object' then
      raise exception 'Rapporten: hver seksjon må være et objekt.' using errcode = '22023';
    end if;
    select string_agg(k, ', ') into ukjent from jsonb_object_keys(seksjon) k where k not in ('seksjon', 'nytt', 'endret', 'fjernet');
    if ukjent is not null then
      raise exception 'Rapporten: en seksjon har ukjente felt: %.', ukjent using errcode = '22023';
    end if;
    navn := seksjon ->> 'seksjon';
    if navn is null or navn !~ '^[a-z][a-z0-9_]*$' or char_length(navn) > 60 then
      raise exception 'Rapporten: «seksjon» må være nøkkelen til et panel på fagsiden, ikke «%».', navn using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(seksjoner) s where s ->> 'seksjon' = navn) then
      raise exception 'Rapporten: seksjonen % står flere ganger.', navn using errcode = '22023';
    end if;
    ny_seksjon := jsonb_build_object('seksjon', navn);
    foreach art in array array['nytt', 'endret', 'fjernet'] loop
      liste := intern.rapportliste(seksjon, art, 'seksjoner.' || navn || '.');
      if jsonb_array_length(liste) > 0 then
        ny_seksjon := ny_seksjon || jsonb_build_object(art, liste);
        oppgitt := oppgitt || (navn || ' (' || art || ')');
      end if;
    end loop;
    if ny_seksjon = jsonb_build_object('seksjon', navn) then
      raise exception 'Rapporten: seksjonen % sier ikke hva som er nytt, endret eller fjernet.', navn using errcode = '22023';
    end if;
    seksjoner := seksjoner || ny_seksjon;
  end loop;

  select coalesce(array_agg(s.seksjon || ' (' || s.art || ')' order by s.seksjon, s.art), '{}') into faktisk
  from intern.endringens_seksjoner(p_endring) s;
  select string_agg(x, ', ' order by x) into mangler from unnest(faktisk) x where x <> all (oppgitt);
  select string_agg(x, ', ' order by x) into ekstra from unnest(oppgitt) x where x <> all (faktisk);
  if mangler is not null then
    raise exception 'Rapporten nevner ikke alt som er endret: %.', mangler using errcode = '22023';
  end if;
  if ekstra is not null then
    raise exception 'Rapporten oppgir endringer som ikke er gjort: %.', ekstra using errcode = '22023';
  end if;

  ut := jsonb_build_object('oppsummering', oppsummering, 'seksjoner', seksjoner);
  foreach art in array array['nye_opplysninger', 'korrigeringer', 'kildegrunnlag', 'mangler'] loop
    liste := intern.rapportliste(p_rapport, art, '');
    if jsonb_array_length(liste) > 0 then
      ut := ut || jsonb_build_object(art, liste);
    end if;
  end loop;
  if exists (select 1 from intern.endringens_objekter(p_endring) o where o.type = 'referanse' and o.fra is null)
    and not ut ? 'kildegrunnlag' then
    raise exception 'Kurateringen har lagt til nye kilder; de skal stå i rapportens kildegrunnlag.' using errcode = '22023';
  end if;

  liste := intern.rapportliste(p_rapport, 'lenker', '');
  if not intern.er_endringslenker(array(select jsonb_array_elements_text(liste))) then
    raise exception 'Rapporten: lenkene må være til en PR eller commit på GitHub.' using errcode = '22023';
  end if;
  if jsonb_array_length(liste) > 0 then
    ut := ut || jsonb_build_object('lenker', liste);
  end if;
  return ut;
end;
$$;

-- Avslutter en endring fra en agent med rapporten, når alt er endret. Gir
-- endringen, eller null når ingenting ble endret (en kuratering som alt er
-- gjort). Etter rapporten kan ingenting mer endres i migrasjonen.
create function intern.endring_rapport(p_agent text, p_migrasjon text, p_rapport jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  agent public.endringsagenter := intern.krev_agent(p_agent, p_migrasjon);
  endring uuid := nullif(current_setting('far.endring', true), '')::uuid;
  e public.innholdsendringer;
  ryddet jsonb;
begin
  if agent.art <> 'ki-agent' then
    raise exception 'Bare en KI-agent leverer rapporter, ikke «%».', p_agent using errcode = '22023';
  end if;
  if endring is null then
    raise notice 'Ingenting ble endret, så det føres ingen endring i loggen.';
    return null;
  end if;
  select * into e from public.innholdsendringer x where x.id = endring;
  if e.aktor = 'bruker' then
    raise exception 'Endringen er gjort av en bruker, ikke en agent.' using errcode = '22023';
  end if;
  if e.agent is not null and e.agent <> p_agent then
    raise exception 'Endringen er ført på «%», ikke «%». En agent oppgir seg med intern.endring_start før noe endres.', e.agent, p_agent
      using errcode = '22023';
  end if;
  if e.rapport is not null then
    raise exception 'Endringen har alt en rapport.' using errcode = '22023';
  end if;
  if e.migrasjon is not null and e.migrasjon <> p_migrasjon then
    raise exception 'Endringen hører til migrasjonen %, ikke %.', e.migrasjon, p_migrasjon using errcode = '22023';
  end if;

  ryddet := intern.kontroller_rapport(endring, p_rapport);
  update public.innholdsendringer x
  set agent = p_agent,
      migrasjon = p_migrasjon,
      oppsummering = ryddet ->> 'oppsummering',
      rapport = ryddet - 'oppsummering' - 'lenker',
      lenker = array(select distinct l from unnest(x.lenker || array(select jsonb_array_elements_text(coalesce(ryddet -> 'lenker', '[]'::jsonb)))) l order by l),
      deler_ved_rapport = intern.antall_deler(endring)
  where x.id = endring;
  return endring;
end;
$$;

comment on function intern.endring_rapport(text, text, jsonb) is
  'Avslutter endringen fra en KI-agent med rapporten, kontrollert mot det som faktisk ble endret. Se docs/innholdsendringer.md.';

-- Det samme for en kuratering, som må være åpnet med intern.kuratering_start.
create function intern.kuratering_rapport(p_agent text, p_migrasjon text, p_rapport jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  endring uuid := nullif(current_setting('far.endring', true), '')::uuid;
begin
  if endring is not null and not exists (
    select 1 from public.innholdsendringer e where e.id = endring and e.art = 'kuratering'
  ) then
    raise exception 'Kurateringsrapporten hører til en kuratering som er åpnet med intern.kuratering_start.' using errcode = '22023';
  end if;
  return intern.endring_rapport(p_agent, p_migrasjon, p_rapport);
end;
$$;

comment on function intern.kuratering_rapport(text, text, jsonb) is
  'Det siste en monografkuratering gjør: rapporten om hva som er nytt, endret og fjernet per seksjon, kontrollert mot endringene. Påkrevd; uten den stopper migrasjonen.';

-- Kurateringen merkes, så endringen den gjør, krever rapporten.
create or replace function intern.kuratering_start(p_slug text, p_kurator text default 'peohol')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  kurator uuid;
  side uuid;
begin
  select p.id into kurator from public.profiles p where p.username = p_kurator and p.role = 'admin';
  select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = p_slug;

  if kurator is null then
    if side is not null and exists (select 1 from public.profiles) then
      raise exception 'Stoffsiden «%» finnes, men ikke administratoren %, som kurateringen føres på.', p_slug, p_kurator;
    end if;
    raise notice 'Fant ingen administrator %, så kurateringen av «%» hoppes over.', p_kurator, p_slug;
    return null;
  end if;
  if side is null then
    raise exception 'Fant ingen publisert stoffside med nøkkelen «%».', p_slug;
  end if;

  -- Ingen andre kan legge til, endre eller fjerne elementer eller referanser
  -- før kurateringen er ferdig, så det preflighten fant, står til den er
  -- skrevet. Lesing går som før.
  lock table public.innholdselementer, public.referanser in share row exclusive mode;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', kurator, 'role', 'authenticated')::text, true);
  -- Det kurateringen endrer, føres som én kuratering, som må avsluttes med
  -- intern.kuratering_rapport (docs/innholdsendringer.md).
  perform set_config('far.kuratering', p_slug, true);
  return side;
end;
$$;

comment on function intern.kuratering_start(text, text) is
  'Logger inn som kuratoren, låser elementene og referansene mot andre endringer til migrasjonen er ferdig, merker endringene som en kuratering og gir den publiserte stoffsiden med nøkkelen. Null uten kuratorprofil; feil om siden finnes og andre profiler finnes, men ikke kuratoren.';

-- --- Hendelsene: stoffregisteret og bivirkningene --------------------------

-- Fagsiden (objektet) med nøkkelen, også om den er slettet for godt.
create function intern.stoffets_side(p_stoff text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.objekt_id from public.infosider s where s.slug = p_stoff order by s.tilstand = 'publisert' desc limit 1),
    (select d.objekt_id from public.slettede_stoffsider d where d.stoff = p_stoff order by d.slettet_kl desc limit 1))
$$;

-- Navnet på stoffet og om fagsiden var publisert, slik de var da.
create function intern.stoffdata(p_stoff text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stoff', p_stoff,
    'stoffnavn', coalesce(
      (select s.navn from public.infosider s where s.slug = p_stoff order by s.tilstand = 'publisert' desc limit 1),
      (select d.navn from public.slettede_stoffsider d where d.stoff = p_stoff order by d.slettet_kl desc limit 1),
      p_stoff),
    'publisert', exists (select 1 from public.infosider s where s.slug = p_stoff and s.tilstand = 'publisert'))
$$;

create function intern.kategorinavn(p_kategori uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select k.navn from public.stoffkategorier k where k.id = p_kategori
$$;

create function intern.ny_hendelse(p_hendelse text, p_side uuid, p_stoffregister boolean, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.innholdshendelser (hendelse, side, stoffregister, data)
  values (p_hendelse, p_side, p_stoffregister, jsonb_strip_nulls(p_data))
$$;

-- Det som skjer følge av noe annet — plasseringene som følger en ny nøkkel,
-- underkategoriene som slettes med kategorien — føres ikke for seg; det står
-- i hendelsen som førte til det.
create function intern.logg_stoffkategori()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  kategori jsonb;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    perform intern.ny_hendelse('kategori_opprettet', null, true, jsonb_build_object(
      'kategori', new.id, 'navn', new.navn, 'forelder', intern.kategorinavn(new.forelder_id)));
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform intern.ny_hendelse('kategori_slettet', null, true, jsonb_build_object(
      'kategori', old.id, 'navn', old.navn, 'forelder', intern.kategorinavn(old.forelder_id),
      'underkategorier', (select jsonb_agg(u.navn order by u.posisjon) from public.stoffkategorier u where u.forelder_id = old.id),
      'stoffer', (select count(distinct p.stoff) from public.stoffplasseringer p
        join public.stoffkategorier k on k.id = p.kategori_id where k.id = old.id or k.forelder_id = old.id)));
    return old;
  end if;

  kategori := jsonb_build_object('kategori', new.id, 'navn', new.navn);
  if new.navn is distinct from old.navn then
    perform intern.ny_hendelse('kategori_omdopt', null, true, kategori || jsonb_build_object('fra', old.navn));
  end if;
  if new.forelder_id is distinct from old.forelder_id then
    perform intern.ny_hendelse('kategori_flyttet', null, true, kategori || jsonb_build_object(
      'fra', intern.kategorinavn(old.forelder_id), 'til', intern.kategorinavn(new.forelder_id)));
  end if;
  if (new.arkivert_kl is null) <> (old.arkivert_kl is null) then
    perform intern.ny_hendelse(
      case when new.arkivert_kl is null then 'kategori_hentet' else 'kategori_arkivert' end, null, true, kategori);
  end if;
  if new.ikon is distinct from old.ikon then
    perform intern.ny_hendelse('kategori_ikon', null, true, kategori || jsonb_build_object('fra', old.ikon, 'til', new.ikon));
  end if;
  return new;
end;
$$;

-- Når en kategori slettes, gjøres det før raden går, så underkategoriene og stoffene i den kan telles.
create trigger stoffkategorier_logg_slettet
before delete on public.stoffkategorier
for each row execute function intern.logg_stoffkategori();

create trigger stoffkategorier_logg
after insert or update on public.stoffkategorier
for each row execute function intern.logg_stoffkategori();

-- Rekkefølgen søsknene står i, uten de arkiverte.
create function intern.kategorirekke(p_forelder uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(k.id order by k.posisjon, k.opprettet_kl, k.id), '{}')
  from public.stoffkategorier k
  where k.forelder_id is not distinct from p_forelder and k.arkivert_kl is null
$$;

-- Som før, og en flytting opp eller ned blant søsknene føres som én hendelse
-- med plassen før og etter. Omnummereringen av de andre er en følge av den og
-- føres ikke for seg; en flytting til en annen forelder føres av triggeren.
create or replace function public.flytt_stoffkategori(kategori uuid, forelder uuid, indeks integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
  for_rekke uuid[];
  etter_rekke uuid[];
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(flytt_stoffkategori.kategori);
  if rad.arkivert_kl is not null then
    raise exception 'Kategorien er arkivert. Hent den tilbake før den flyttes.' using errcode = '22023';
  end if;
  if rad.forelder_id is distinct from flytt_stoffkategori.forelder then
    perform intern.krev_kategoriforelder(flytt_stoffkategori.forelder);
    perform intern.krev_ledig_kategorinavn(flytt_stoffkategori.forelder, rad.navn, rad.id);
    update public.stoffkategorier k set forelder_id = flytt_stoffkategori.forelder where k.id = rad.id;
    perform intern.ordne_stoffkategorier(rad.forelder_id);
    perform intern.ordne_stoffkategorier(flytt_stoffkategori.forelder, rad.id, flytt_stoffkategori.indeks);
    return;
  end if;
  for_rekke := intern.kategorirekke(rad.forelder_id);
  perform intern.ordne_stoffkategorier(flytt_stoffkategori.forelder, rad.id, flytt_stoffkategori.indeks);
  etter_rekke := intern.kategorirekke(rad.forelder_id);
  if array_position(for_rekke, rad.id) is distinct from array_position(etter_rekke, rad.id) then
    perform intern.ny_hendelse('kategori_omordnet', null, true, jsonb_build_object(
      'kategori', rad.id, 'navn', rad.navn, 'forelder', intern.kategorinavn(rad.forelder_id),
      'fra', array_position(for_rekke, rad.id), 'til', array_position(etter_rekke, rad.id),
      'antall', cardinality(etter_rekke)));
  end if;
end;
$$;

create function intern.logg_stoffplassering()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rad public.stoffplasseringer := case when tg_op = 'DELETE' then old else new end;
  kategori public.stoffkategorier;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  select k.* into kategori from public.stoffkategorier k where k.id = rad.kategori_id;
  perform intern.ny_hendelse(
    case when tg_op = 'DELETE' then 'stoff_tatt_ut' else 'stoff_plassert' end,
    intern.stoffets_side(rad.stoff),
    true,
    intern.stoffdata(rad.stoff) || jsonb_build_object(
      'kategori', rad.kategori_id, 'kategorinavn', kategori.navn, 'forelder', intern.kategorinavn(kategori.forelder_id)));
  return null;
end;
$$;

create trigger stoffplasseringer_logg
after insert or delete on public.stoffplasseringer
for each row execute function intern.logg_stoffplassering();

create function intern.logg_stoffstatus()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hendelse text;
  stoff text := coalesce(new.stoff, old.stoff);
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'DELETE' then
    hendelse := case old.status when 'arkivert' then 'stoff_hentet_fra_arkivet' when 'papirkurv' then 'stoff_gjenopprettet' end;
  elsif tg_op = 'INSERT' or new.status is distinct from old.status then
    hendelse := case new.status when 'arkivert' then 'stoff_arkivert' when 'papirkurv' then 'stoff_slettet'
      when 'fjernet' then 'stoff_slettet_for_godt' end;
  end if;
  if hendelse is not null then
    perform intern.ny_hendelse(hendelse, intern.stoffets_side(stoff), true, intern.stoffdata(stoff));
  end if;
  return null;
end;
$$;

create trigger stoffstatus_logg
after insert or update or delete on public.stoffstatus
for each row execute function intern.logg_stoffstatus();

create function intern.logg_bivirkningskilde()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  data jsonb := jsonb_build_object(
    'kilde', new.id, 'nokkel', new.nokkel, 'tittel', new.tittel, 'preparat', new.preparat,
    'publisert', exists (select 1 from public.infosider s where s.objekt_id = new.infoside and s.tilstand = 'publisert'));
begin
  if tg_op = 'INSERT' then
    perform intern.ny_hendelse('bivirkning_importert', new.infoside, false, data || jsonb_build_object(
      'erstatter', exists (select 1 from bivirkninger.kilder k where k.erstattet_av = new.id)));
  elsif new.trukket_kl is not null and old.trukket_kl is null then
    perform intern.ny_hendelse('bivirkning_trukket', new.infoside, false, data || jsonb_build_object(
      'begrunnelse', new.trukket_begrunnelse));
  end if;
  return null;
end;
$$;

create trigger kilder_logg
after insert or update of trukket_kl on bivirkninger.kilder
for each row execute function intern.logg_bivirkningskilde();

-- Ryddingen av papirkurven føres som systemets, ikke som brukeren som åpnet registeret.
create or replace function public.rydd_stoffpapirkurven()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_registerbruker();
  perform intern.endring_som_system('papirkurvrydding');
  return intern.tom_papirkurv(interval '30 days', null);
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Objektene siden står for: fagsiden selv, regelsettene i fortolkningen eller
-- (for stoffregisteret) alle fagsidene.
create function intern.endringsrotter(p_side jsonb, p_admin boolean)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select s.objekt_id from public.infosider s
  where p_side ? 'stoff' and s.slug = p_side ->> 'stoff' and (p_admin or s.tilstand = 'publisert')
  union
  select s.objekt_id from public.infosider s
  where (p_side ->> 'stoffregister')::boolean is true and (p_admin or s.tilstand = 'publisert')
  union
  select r.objekt_id from public.intervallregelsett r
  where r.analyttkode in (select jsonb_array_elements_text(coalesce(p_side -> 'analyttkoder', '[]'::jsonb)))
    and (p_admin or r.tilstand = 'publisert')
  union
  select a.objekt_id from public.laboratorieanalytter a
  where a.kode in (select jsonb_array_elements_text(coalesce(p_side -> 'analyttkoder', '[]'::jsonb)))
    and (p_admin or a.tilstand = 'publisert')
  union
  select r.objekt_id from public.scenarioregelsett r
  where r.modul in (select jsonb_array_elements_text(coalesce(p_side -> 'moduler', '[]'::jsonb)))
    and (p_admin or r.tilstand = 'publisert')
  union
  select r.objekt_id from public.thc_regelsett r
  where (p_side ->> 'thc')::boolean is true and (p_admin or r.tilstand = 'publisert')
$$;

-- Alle objektene som hører til siden: røttene, kortene som har stått på en av
-- dem, og referansene og kommentarene noen av dem har pekt på.
--
-- Uten utkastene (alltid for andre enn administratorer) gjelder bare de
-- publiserte utgavene: et kort som bare i et utkast er flyttet til siden, eller
-- en referanse som bare er sitert i et utkast, hører ikke til siden — ellers
-- ville loggen røpet koblingen før den er publisert.
create function intern.sidens_objekter(p_rotter uuid[], p_utkast boolean)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with utgaver as (
    select r.objekt_id, r.innhold from public.objektrevisjoner r
    where p_utkast or exists (
      select 1 from public.objektpubliseringer p where p.objekt_id = r.objekt_id and p.revisjon = r.revisjon)
  ), egne as (
    select unnest(p_rotter) as id
    union
    select r.objekt_id from utgaver r
    where r.innhold ? 'infoside' and (r.innhold ->> 'infoside') = any (select unnest(p_rotter)::text)
  ), nevnte as (
    select distinct m[1]::uuid as id
    from utgaver r
    cross join lateral regexp_matches(r.innhold::text, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'g') m
    where r.objekt_id in (select id from egne)
  )
  select id from egne
  union
  select o.id from public.redigerbare_objekter o
  where o.id in (select id from nevnte) and o.type in ('referanse', 'kommentar')
$$;

-- Endringsloggen for én side, nyeste først (`docs/innholdsendringer.md`).
--
--   side: {"stoff": "<nøkkel>"}, {"stoffregister": true} eller
--         {"analyttkoder": [...], "moduler": [...], "thc": true|false}
--   med_utkast: administratorer ser også endringer som ikke er publisert
--   med_rutiner: med rutinene — ryddingen og tjenestene (skjult ellers)
--   etter: {"kl": ..., "id": ...} fra siste endring i forrige side av loggen
--
-- Alle innloggede kan lese. Andre enn administratorer ser bare det som er
-- publisert: publiseringene, ikke utkastene, og ingenting om sider som ikke er
-- publisert. Endringene fra før loggen fantes, settes sammen av revisjonene og
-- publiseringene etter tidspunkt og person.
create function public.les_endringslogg(
  side jsonb,
  med_utkast boolean default false,
  med_rutiner boolean default false,
  etter jsonb default null,
  antall integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  admin boolean := public.er_admin();
  utkast boolean := admin and coalesce(les_endringslogg.med_utkast, false);
  register boolean := (les_endringslogg.side ->> 'stoffregister')::boolean is true;
  rotter uuid[];
  objekter uuid[];
  grense integer := least(greatest(coalesce(les_endringslogg.antall, 30), 1), 100);
  etter_kl timestamptz := (les_endringslogg.etter ->> 'kl')::timestamptz;
  etter_id text := coalesce(les_endringslogg.etter ->> 'id', '');
  resultat jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Logg inn for å lese endringsloggen.' using errcode = '42501';
  end if;
  if les_endringslogg.side is null or jsonb_typeof(les_endringslogg.side) <> 'object' then
    raise exception 'Siden mangler.' using errcode = '22023';
  end if;

  rotter := array(select intern.endringsrotter(les_endringslogg.side, admin));
  objekter := case when register then rotter else array(select intern.sidens_objekter(rotter, utkast)) end;

  with medlemmer as (
    select coalesce(r.endring_id::text, 'eldre:' || r.utfort_kl::text || ':' || r.utfort_av::text) as nokkel,
      r.objekt_id, r.revisjon, null::integer as forrige, false as publisering,
      r.utfort_kl, r.utfort_av, r.utfort_av_fornavn, r.utfort_av_etternavn, r.kilde
    from public.objektrevisjoner r
    where utkast and r.objekt_id = any (objekter)
    union all
    select coalesce(p.endring_id::text, 'eldre:' || p.utfort_kl::text || ':' || p.utfort_av::text),
      p.objekt_id, p.revisjon, p.forrige_revisjon, true,
      p.utfort_kl, p.utfort_av, p.utfort_av_fornavn, p.utfort_av_etternavn,
      (select r.kilde from public.objektrevisjoner r where r.objekt_id = p.objekt_id and r.revisjon = p.revisjon)
    from public.objektpubliseringer p
    where p.objekt_id = any (objekter)
  ), samlet as (
    select m.nokkel, m.objekt_id,
      bool_or(m.publisering) as publisert,
      case when bool_or(not m.publisering) then nullif(min(m.revisjon) filter (where not m.publisering) - 1, 0)
        else (array_agg(m.forrige order by m.revisjon) filter (where m.publisering))[1] end as fra,
      coalesce(max(m.revisjon) filter (where not m.publisering), max(m.revisjon)) as til,
      min(m.utfort_kl) as kl
    from medlemmer m
    group by m.nokkel, m.objekt_id
  ), deler as (
    select s.nokkel, s.kl, o.type, s.publisert,
      intern.endringsdel(s.objekt_id, o.type, s.fra, s.til, s.publisert, f.innhold, t.innhold) as del
    from samlet s
    join public.redigerbare_objekter o on o.id = s.objekt_id
    join public.objektrevisjoner t on t.objekt_id = s.objekt_id and t.revisjon = s.til
    left join public.objektrevisjoner f on f.objekt_id = s.objekt_id and f.revisjon = s.fra
    -- Stoffregisteret viser bare at fagsider er opprettet eller har fått nytt navn.
    where not register or (o.type = 'infoside' and (f.innhold is null
      or f.innhold ->> 'navn' is distinct from t.innhold ->> 'navn'))
  ), hendelser as (
    select h.endring_id::text as nokkel, h.utfort_kl as kl, h.id,
      jsonb_build_object('hendelse', h.hendelse, 'kl', h.utfort_kl, 'data', h.data - 'publisert') as hendelse
    from public.innholdshendelser h
    where ((register and h.stoffregister) or (not register and h.side = any (rotter)))
      and (utkast or (h.data ->> 'publisert')::boolean is not false)
  ), eldre as (
    select m.nokkel,
      (array_agg(m.utfort_av))[1] as utfort_av,
      (array_agg(m.utfort_av_fornavn))[1] as fornavn,
      (array_agg(m.utfort_av_etternavn))[1] as etternavn,
      max(m.kilde) as kilde
    from medlemmer m
    where m.nokkel like 'eldre:%'
    group by m.nokkel
  ), nokler as (
    select x.nokkel, min(x.kl) as kl
    from (select d.nokkel, d.kl from deler d union all select h.nokkel, h.kl from hendelser h) x
    group by x.nokkel
  ), endringer as (
    select n.nokkel,
      coalesce(e.opprettet_kl, n.kl) as kl,
      e.id, e.aktor, e.agent, e.art, e.utfort_av_fornavn, e.utfort_av_etternavn, e.oppsummering, e.rapport,
      e.migrasjon, e.lenker,
      case when e.id is null and l.kilde is not null then 'system' when e.id is null then 'bruker' else e.aktor end as hvem,
      l.fornavn as eldre_fornavn, l.etternavn as eldre_etternavn, l.kilde as eldre_kilde
    from nokler n
    left join public.innholdsendringer e on e.id::text = n.nokkel
    left join eldre l on l.nokkel = n.nokkel
  ), valgte as (
    select * from endringer x
    where (les_endringslogg.med_rutiner or not coalesce(
        (select a.rutine from public.endringsagenter a where a.nokkel = x.agent), false))
      and (etter_kl is null or (x.kl, x.nokkel) < (etter_kl, etter_id))
    order by x.kl desc, x.nokkel desc
    limit grense + 1
  )
  select jsonb_build_object(
    'endringer', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', v.nokkel,
      'kl', v.kl,
      'aktor', v.hvem,
      'eldre', v.id is null,
      'art', coalesce(v.art, 'redigering'),
      'agent', case
        when v.agent is not null then (select jsonb_build_object('nokkel', a.nokkel, 'navn', a.navn, 'art', a.art, 'beskrivelse', a.beskrivelse, 'rutine', a.rutine)
          from public.endringsagenter a where a.nokkel = v.agent)
        when v.id is null and v.eldre_kilde is not null then (select jsonb_build_object('nokkel', a.nokkel, 'navn', a.navn, 'art', a.art, 'beskrivelse', a.beskrivelse, 'rutine', a.rutine)
          from public.endringsagenter a where a.nokkel = 'databasemigrasjon') end,
      'person', case when coalesce(v.utfort_av_fornavn, v.eldre_fornavn) is not null then jsonb_build_object(
        'fornavn', coalesce(v.utfort_av_fornavn, v.eldre_fornavn), 'etternavn', coalesce(v.utfort_av_etternavn, v.eldre_etternavn)) end,
      'oppsummering', coalesce(v.oppsummering, v.eldre_kilde),
      'rapport', v.rapport,
      'migrasjon', v.migrasjon,
      -- Migrasjonen er kjørt og registrert i databasens migrasjonshistorikk.
      'verifisert', case when v.migrasjon is not null then exists (
        select 1 from supabase_migrations.schema_migrations s where s.version || '_' || s.name || '.sql' = v.migrasjon) end,
      'lenker', case when cardinality(v.lenker) > 0 then to_jsonb(v.lenker) end,
      'deler', (select jsonb_agg(d.del order by d.type, d.del ->> 'objekt') from deler d where d.nokkel = v.nokkel),
      'hendelser', (select jsonb_agg(h.hendelse order by h.id) from hendelser h where h.nokkel = v.nokkel),
      'utkast', not exists (select 1 from deler d where d.nokkel = v.nokkel and d.publisert)
        and not exists (select 1 from hendelser h where h.nokkel = v.nokkel)
    )) order by v.kl desc, v.nokkel desc) filter (where v.rad <= grense), '[]'::jsonb),
    'flere', count(*) > grense
  ) into resultat
  from (select x.*, row_number() over (order by x.kl desc, x.nokkel desc) as rad from valgte x) v;

  return resultat;
end;
$$;

comment on function public.les_endringslogg(jsonb, boolean, boolean, jsonb, integer) is
  'Endringsloggen for én side (fagside, stoffregisteret eller en fortolkning), nyeste først. Andre enn administratorer ser bare det publiserte. Se docs/innholdsendringer.md.';

-- --- Radsikkerhet og rettigheter -------------------------------------------

alter table public.endringsagenter enable row level security;
alter table public.innholdsendringer enable row level security;
alter table public.innholdshendelser enable row level security;

create policy "Innloggede ser agentene"
on public.endringsagenter for select to authenticated
using (true);

-- Andre enn administratorer leser loggen gjennom les_endringslogg, som bare
-- gir det publiserte.
create policy "Administratorer ser endringene"
on public.innholdsendringer for select to authenticated
using ((select public.er_admin()));

create policy "Administratorer ser hendelsene"
on public.innholdshendelser for select to authenticated
using ((select public.er_admin()));

revoke all on table public.endringsagenter, public.innholdsendringer, public.innholdshendelser
from anon, authenticated, service_role;
grant select on table public.endringsagenter, public.innholdsendringer, public.innholdshendelser to authenticated;

revoke all on function public.les_endringslogg(jsonb, boolean, boolean, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.les_endringslogg(jsonb, boolean, boolean, jsonb, integer) to authenticated;
revoke all on function public.rydd_stoffpapirkurven() from public, anon, service_role;
grant execute on function public.rydd_stoffpapirkurven() to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
