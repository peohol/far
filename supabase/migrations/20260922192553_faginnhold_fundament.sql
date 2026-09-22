-- Fundamentet for redigerbart faginnhold: informasjonssider,
-- laboratorieanalytter med komponenter, og innholdselementer — med full
-- revisjonshistorikk, utkast og publisering.
--
-- Ingenting her legger inn innhold. Tabellene er tomme til noen fyller dem, og
-- appens fortolkning bruker fortsatt bare de statiske dataene sine.
--
-- Bakgrunnen og reglene står i docs/faginnhold.md. Kort fortalt:
--
--   * Hvert redigerbart objekt har én rad i `redigerbare_objekter`, og hver
--     endring av innholdet blir en ny, uforanderlig rad i `objektrevisjoner`
--     med et komplett øyeblikksbilde, hvem som gjorde det og hva de het da.
--   * `objekttilstander` sier hvilken revisjon som er utkastet (arbeids-
--     versjonen) og hvilken som er publisert. Innholdet i begge tilstandene
--     ligger som vanlige, validerte rader i tabellene for hver objekttype.
--   * Alt som endrer noe, går gjennom fire funksjoner — opprett, lagre,
--     gjenopprett og publiser — som krever administrator, avviser en lagring
--     mot en utdatert revisjon, og gjør hele endringen i én transaksjon.
--     Nettleseren har ingen skriverett på tabellene selv.

-- --- Et skjema for det som bare skal kalles innenfra ----------------------

-- Skjemaet er ikke eksponert i data-API-et, og ingen av API-rollene har
-- tilgang til det. Hjelpefunksjonene her kan derfor ikke kalles utenfra, også
-- om noen skulle glemme å stenge en av dem.
create schema intern;
revoke all on schema intern from public;

comment on schema intern is
  'Hjelpefunksjoner for faginnholdet. Ingen av API-rollene har tilgang til skjemaet.';

-- --- Typene ----------------------------------------------------------------

-- Samme verdier som OBJEKTTYPER, TILSTANDER og HANDLINGER i
-- src/faginnhold/modell.ts. Testen sammenligner dem.
create type public.objekttype as enum ('infoside', 'laboratorieanalytt', 'innholdselement');
create type public.objekttilstand as enum ('utkast', 'publisert');
create type public.innholdshandling as enum ('opprettet', 'endret', 'gjenopprettet', 'publisert');

-- --- Identitet og historikk ------------------------------------------------

create table public.redigerbare_objekter (
  id uuid primary key default gen_random_uuid(),
  type public.objekttype not null,
  opprettet_kl timestamptz not null default now()
);

comment on table public.redigerbare_objekter is
  'Ett redigerbart objekt med stabil ID. Typen avgjør hvilken tabell innholdet ligger i. Rader endres og slettes aldri.';

create table public.objektrevisjoner (
  objekt_id uuid not null references public.redigerbare_objekter (id),
  revisjon integer not null,
  handling public.innholdshandling not null,
  innhold jsonb not null,
  gjenopprettet_fra integer,
  utfort_av uuid not null,
  utfort_av_fornavn text not null,
  utfort_av_etternavn text not null,
  utfort_kl timestamptz not null default now(),
  constraint objektrevisjoner_pkey primary key (objekt_id, revisjon),
  constraint objektrevisjoner_gjenopprettet_fra_fkey
    foreign key (objekt_id, gjenopprettet_fra)
    references public.objektrevisjoner (objekt_id, revisjon),
  constraint objektrevisjoner_revisjon_positiv check (revisjon >= 1),
  -- Publisering lager ingen ny revisjon; den peker på en som finnes.
  constraint objektrevisjoner_handling check (handling <> 'publisert'),
  constraint objektrevisjoner_opprettet_forst check ((handling = 'opprettet') = (revisjon = 1)),
  constraint objektrevisjoner_gjenopprettet_fra check (
    (handling = 'gjenopprettet') = (gjenopprettet_fra is not null)
    and (gjenopprettet_fra is null or gjenopprettet_fra < revisjon)
  ),
  constraint objektrevisjoner_innhold_objekt check (jsonb_typeof(innhold) = 'object')
);

create index objektrevisjoner_gjenopprettet_fra_idx
  on public.objektrevisjoner (objekt_id, gjenopprettet_fra);

comment on table public.objektrevisjoner is
  'Én rad per endring av innholdet: et komplett øyeblikksbilde, hvem som gjorde endringen og hva personen het da. Rader endres og slettes aldri.';
comment on column public.objektrevisjoner.innhold is
  'Hele objektet slik det ble lagret, på samme form som lagre_utkast tar imot.';
comment on column public.objektrevisjoner.utfort_av is
  'Brukerens ID. Bevisst uten fremmednøkkel: historikken skal stå også om kontoen fjernes.';
comment on column public.objektrevisjoner.utfort_av_fornavn is
  'Fornavnet slik det sto i profilen da endringen ble gjort. Endres ikke om profilen endres senere.';

create table public.objekttilstander (
  objekt_id uuid not null references public.redigerbare_objekter (id),
  tilstand public.objekttilstand not null,
  revisjon integer not null,
  endret_kl timestamptz not null default now(),
  constraint objekttilstander_pkey primary key (objekt_id, tilstand),
  -- Utsatt kontroll: når et objekt opprettes, må utkastet finnes før
  -- revisjonen kan lages av det.
  constraint objekttilstander_revisjon_fkey
    foreign key (objekt_id, revisjon)
    references public.objektrevisjoner (objekt_id, revisjon)
    deferrable initially deferred
);

create index objekttilstander_revisjon_idx on public.objekttilstander (objekt_id, revisjon);

comment on table public.objekttilstander is
  'Hvilken revisjon som er utkastet (arbeidsversjonen), og hvilken som er publisert.';

create table public.objektpubliseringer (
  id bigint generated always as identity primary key,
  objekt_id uuid not null references public.redigerbare_objekter (id),
  revisjon integer not null,
  forrige_revisjon integer,
  utfort_av uuid not null,
  utfort_av_fornavn text not null,
  utfort_av_etternavn text not null,
  utfort_kl timestamptz not null default now(),
  constraint objektpubliseringer_revisjon_fkey
    foreign key (objekt_id, revisjon)
    references public.objektrevisjoner (objekt_id, revisjon),
  constraint objektpubliseringer_forrige_revisjon_fkey
    foreign key (objekt_id, forrige_revisjon)
    references public.objektrevisjoner (objekt_id, revisjon),
  constraint objektpubliseringer_rekkefolge check (forrige_revisjon is null or forrige_revisjon < revisjon)
);

create index objektpubliseringer_revisjon_idx on public.objektpubliseringer (objekt_id, revisjon);
create index objektpubliseringer_forrige_revisjon_idx
  on public.objektpubliseringer (objekt_id, forrige_revisjon);

comment on table public.objektpubliseringer is
  'Én rad per publisering: hvilken revisjon som ble publisert, hvilken den erstattet, og av hvem. Rader endres og slettes aldri.';

-- --- Innholdet, per objekttype ---------------------------------------------

-- Hver tabell har én rad per objekt og tilstand: utkastet alltid, og den
-- publiserte utgaven når objektet er publisert. Radene skrives bare av
-- funksjonene nederst, fra øyeblikksbildet i revisjonen tilstanden peker på.

create table public.infosider (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  navn text not null,
  constraint infosider_pkey primary key (objekt_id, tilstand),
  constraint infosider_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint infosider_navn check (char_length(navn) between 1 and 200 and navn = btrim(navn))
);

create unique index infosider_navn_idx on public.infosider (tilstand, lower(navn));

comment on table public.infosider is
  'Informasjonssiden for et virkestoff, f.eks. Amitriptylin. Innholdet på siden ligger i innholdselementer.';

create table public.laboratorieanalytter (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  kode text not null,
  hovedside_id uuid not null references public.redigerbare_objekter (id),
  constraint laboratorieanalytter_pkey primary key (objekt_id, tilstand),
  constraint laboratorieanalytter_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint laboratorieanalytter_kode_entydig unique (tilstand, kode),
  constraint laboratorieanalytter_kode check (
    char_length(kode) <= 32 and kode ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
  )
);

create index laboratorieanalytter_hovedside_idx on public.laboratorieanalytter (hovedside_id);

comment on table public.laboratorieanalytter is
  'Analyttkoden laboratoriet rapporterer, f.eks. AMTNORSUM, med én hovedside. Hva analysen omfatter, står i analyttkomponenter.';

create table public.analyttkomponenter (
  analytt_id uuid not null,
  tilstand public.objekttilstand not null,
  posisjon integer not null,
  infoside_id uuid not null references public.redigerbare_objekter (id),
  constraint analyttkomponenter_pkey primary key (analytt_id, tilstand, posisjon),
  constraint analyttkomponenter_analytt_fkey
    foreign key (analytt_id, tilstand)
    references public.laboratorieanalytter (objekt_id, tilstand) on delete cascade,
  constraint analyttkomponenter_entydig unique (analytt_id, tilstand, infoside_id),
  constraint analyttkomponenter_posisjon check (posisjon >= 1)
);

create index analyttkomponenter_infoside_idx on public.analyttkomponenter (infoside_id);

comment on table public.analyttkomponenter is
  'Stoffene en laboratorieanalytt omfatter, i rekkefølge. AMTNORSUM omfatter amitriptylin og nortriptylin, selv om hovedsiden er Amitriptylin.';

create table public.innholdselementer (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  infoside_id uuid not null references public.redigerbare_objekter (id),
  panel text not null,
  posisjon integer not null,
  elementtype text not null,
  data jsonb not null,
  constraint innholdselementer_pkey primary key (objekt_id, tilstand),
  constraint innholdselementer_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint innholdselementer_panel check (char_length(panel) <= 60 and panel ~ '^[a-z][a-z0-9_]*$'),
  constraint innholdselementer_elementtype check (
    char_length(elementtype) <= 60 and elementtype ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint innholdselementer_posisjon check (posisjon >= 0),
  constraint innholdselementer_data check (jsonb_typeof(data) = 'object')
);

create index innholdselementer_infoside_idx on public.innholdselementer (infoside_id, tilstand, panel, posisjon);

comment on table public.innholdselementer is
  'Et kort, felt eller tekststykke på en informasjonsside. Panel og elementtype er nøkler; formen på data avgjøres av elementtypen.';

-- --- Vakter i databasen ----------------------------------------------------

-- Historikken er append-only for alle, også for server-side klienter og
-- migrasjoner. Gjenoppretting lager en ny revisjon i stedet for å endre noe.
create function intern.avvis_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Historikken for faginnholdet kan ikke endres eller slettes.'
    using errcode = '42501';
end;
$$;

create trigger redigerbare_objekter_uforanderlig
before update or delete on public.redigerbare_objekter
for each row execute function intern.avvis_endring();

create trigger redigerbare_objekter_ikke_tom
before truncate on public.redigerbare_objekter
for each statement execute function intern.avvis_endring();

create trigger objektrevisjoner_uforanderlig
before update or delete on public.objektrevisjoner
for each row execute function intern.avvis_endring();

create trigger objektrevisjoner_ikke_tom
before truncate on public.objektrevisjoner
for each statement execute function intern.avvis_endring();

create trigger objektpubliseringer_uforanderlig
before update or delete on public.objektpubliseringer
for each row execute function intern.avvis_endring();

create trigger objektpubliseringer_ikke_tom
before truncate on public.objektpubliseringer
for each statement execute function intern.avvis_endring();

-- Revisjonene nummereres fortløpende per objekt, uten hull.
create function intern.fortlopende_revisjon()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revisjon <> coalesce(
    (select max(r.revisjon) from public.objektrevisjoner r where r.objekt_id = new.objekt_id),
    0
  ) + 1 then
    raise exception 'Revisjonene skal nummereres fortløpende.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger objektrevisjoner_fortlopende
before insert on public.objektrevisjoner
for each row execute function intern.fortlopende_revisjon();

-- Koblinger til redigerbare objekter skal peke på riktig type: en hovedside
-- er en informasjonsside, ikke en laboratorieanalytt. Argumentene er par av
-- kolonnenavn og forventet type.
create function intern.krev_objekttype()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rad jsonb := to_jsonb(new);
  nr integer := 0;
  forventet public.objekttype;
  faktisk public.objekttype;
begin
  while nr < tg_nargs loop
    forventet := tg_argv[nr + 1]::public.objekttype;
    select o.type into faktisk
    from public.redigerbare_objekter o
    where o.id = (rad ->> tg_argv[nr])::uuid;
    if faktisk is distinct from forventet then
      raise exception 'Koblingen % må peke på et objekt av typen %.', tg_argv[nr], forventet
        using errcode = '22023';
    end if;
    nr := nr + 2;
  end loop;
  return new;
end;
$$;

create trigger infosider_objekttype
before insert or update on public.infosider
for each row execute function intern.krev_objekttype('objekt_id', 'infoside');

create trigger laboratorieanalytter_objekttype
before insert or update on public.laboratorieanalytter
for each row execute function intern.krev_objekttype(
  'objekt_id', 'laboratorieanalytt', 'hovedside_id', 'infoside'
);

create trigger analyttkomponenter_objekttype
before insert or update on public.analyttkomponenter
for each row execute function intern.krev_objekttype('infoside_id', 'infoside');

create trigger innholdselementer_objekttype
before insert or update on public.innholdselementer
for each row execute function intern.krev_objekttype(
  'objekt_id', 'innholdselement', 'infoside_id', 'infoside'
);

-- --- Tilgang ---------------------------------------------------------------

-- Rollen slås opp i profiltabellen, der nettleseren ikke kan skrive den —
-- samme kilde som Edge-funksjonene bruker.
create function public.er_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;

comment on function public.er_admin() is
  'Sant når den innloggede er administrator. Brukes av radsikkerheten.';

-- Administratoren som gjør endringen, med navnet slik det står i profilen nå.
create function intern.krev_admin()
returns public.profiles
language plpgsql
stable
set search_path = ''
as $$
declare
  innlogget public.profiles;
begin
  select p.* into innlogget
  from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'admin';
  if not found then
    raise exception 'Bare administratorer kan endre faginnholdet.' using errcode = '42501';
  end if;
  return innlogget;
end;
$$;

-- --- Lesing av det som sendes inn ------------------------------------------

-- Alle feil i innholdet gis med koden for ugyldig verdi, slik at appen kan
-- skille dem fra konflikter og manglende rettigheter.

-- Krever et objekt med nøyaktig disse feltene. Et ukjent felt avvises i
-- stedet for å bli oversett, så en skrivefeil i appen ikke går tapt i stillhet.
create function intern.krev_felt(p_innhold jsonb, p_felt text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  avvik text;
begin
  if p_innhold is null or jsonb_typeof(p_innhold) <> 'object' then
    raise exception 'Innholdet må være et objekt.' using errcode = '22023';
  end if;

  select string_agg(k, ', ' order by k) into avvik
  from jsonb_object_keys(p_innhold) k
  where k <> all (p_felt);
  if avvik is not null then
    raise exception 'Ukjente felt: %.', avvik using errcode = '22023';
  end if;

  select string_agg(k, ', ' order by k) into avvik
  from unnest(p_felt) k
  where not p_innhold ? k;
  if avvik is not null then
    raise exception 'Mangler felt: %.', avvik using errcode = '22023';
  end if;
end;
$$;

create function intern.tekst(p_innhold jsonb, p_felt text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'string' then
    raise exception 'Feltet % må være tekst.', p_felt using errcode = '22023';
  end if;
  return btrim(p_innhold ->> p_felt);
end;
$$;

create function intern.heltall(p_innhold jsonb, p_felt text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'number'
    or (p_innhold ->> p_felt)::numeric <> trunc((p_innhold ->> p_felt)::numeric)
  then
    raise exception 'Feltet % må være et heltall.', p_felt using errcode = '22023';
  end if;
  return (p_innhold ->> p_felt)::integer;
end;
$$;

create function intern.objekt(p_innhold jsonb, p_felt text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'object' then
    raise exception 'Feltet % må være et objekt.', p_felt using errcode = '22023';
  end if;
  return p_innhold -> p_felt;
end;
$$;

-- Én ID, gitt som JSON-verdi, slik at både enkeltfelt og lister kan bruke den.
create function intern.id_verdi(p_verdi jsonb, p_felt text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_verdi) is distinct from 'string'
    or (p_verdi #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    raise exception 'Feltet % må inneholde ID-er.', p_felt using errcode = '22023';
  end if;
  return (p_verdi #>> '{}')::uuid;
end;
$$;

create function intern.id(p_innhold jsonb, p_felt text)
returns uuid
language sql
immutable
set search_path = ''
as $$ select intern.id_verdi(p_innhold -> p_felt, p_felt) $$;

-- En liste med ID-er i den rekkefølgen de ble sendt, uten gjentakelser.
create function intern.id_liste(p_innhold jsonb, p_felt text)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  liste uuid[];
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'array' then
    raise exception 'Feltet % må være en liste.', p_felt using errcode = '22023';
  end if;
  liste := array(
    select intern.id_verdi(e.verdi, p_felt)
    from jsonb_array_elements(p_innhold -> p_felt) with ordinality as e(verdi, nr)
    order by e.nr
  );
  if cardinality(liste) <> (select count(distinct x) from unnest(liste) x) then
    raise exception 'Feltet % har samme ID flere ganger.', p_felt using errcode = '22023';
  end if;
  return liste;
end;
$$;

-- --- Skriving og lesing, per objekttype ------------------------------------

-- For hver type finnes et par: skriv_<type> legger et øyeblikksbilde inn som
-- rader for én tilstand, og les_<type> gir øyeblikksbildet tilbake fra dem.
-- Det som lagres i historikken, er alltid det les_<type> gir, slik at
-- revisjonen er nøyaktig det som faktisk ble lagret.
--
-- En ny objekttype får en ny verdi i `objekttype` og et nytt slikt par; resten
-- av maskineriet finner dem på navnet. Kommer det nye felt på en type senere,
-- må skriv_<type> tåle at de mangler i eldre revisjoner. Ellers kan de ikke
-- gjenopprettes.

create function intern.skriv_infoside(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  nytt_navn text;
begin
  perform intern.krev_felt(p_innhold, array['navn']);
  nytt_navn := intern.tekst(p_innhold, 'navn');

  if exists (
    select 1 from public.infosider s
    where s.tilstand = p_tilstand and lower(s.navn) = lower(nytt_navn) and s.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt en informasjonsside som heter %.', nytt_navn
      using errcode = '22023';
  end if;

  insert into public.infosider (objekt_id, tilstand, navn)
  values (p_objekt, p_tilstand, nytt_navn)
  on conflict on constraint infosider_pkey do update set navn = excluded.navn;
end;
$$;

create function intern.les_infoside(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('navn', s.navn)
  from public.infosider s
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand
$$;

create function intern.skriv_laboratorieanalytt(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  ny_kode text;
  komponenter uuid[];
begin
  perform intern.krev_felt(p_innhold, array['kode', 'hovedside', 'komponenter']);
  ny_kode := intern.tekst(p_innhold, 'kode');
  komponenter := intern.id_liste(p_innhold, 'komponenter');

  if cardinality(komponenter) = 0 then
    raise exception 'En laboratorieanalytt må omfatte minst én komponent.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.laboratorieanalytter a
    where a.tilstand = p_tilstand and a.kode = ny_kode and a.objekt_id <> p_objekt
  ) then
    raise exception 'Analyttkoden % er alt i bruk.', ny_kode using errcode = '22023';
  end if;

  insert into public.laboratorieanalytter (objekt_id, tilstand, kode, hovedside_id)
  values (p_objekt, p_tilstand, ny_kode, intern.id(p_innhold, 'hovedside'))
  on conflict on constraint laboratorieanalytter_pkey
  do update set kode = excluded.kode, hovedside_id = excluded.hovedside_id;

  delete from public.analyttkomponenter k
  where k.analytt_id = p_objekt and k.tilstand = p_tilstand;

  insert into public.analyttkomponenter (analytt_id, tilstand, posisjon, infoside_id)
  select p_objekt, p_tilstand, k.nr, k.infoside
  from unnest(komponenter) with ordinality as k(infoside, nr);
end;
$$;

create function intern.les_laboratorieanalytt(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kode', a.kode,
    'hovedside', a.hovedside_id,
    'komponenter', coalesce(
      (
        select jsonb_agg(k.infoside_id order by k.posisjon)
        from public.analyttkomponenter k
        where k.analytt_id = a.objekt_id and k.tilstand = a.tilstand
      ),
      '[]'::jsonb
    )
  )
  from public.laboratorieanalytter a
  where a.objekt_id = p_objekt and a.tilstand = p_tilstand
$$;

create function intern.skriv_innholdselement(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform intern.krev_felt(p_innhold, array['infoside', 'panel', 'posisjon', 'elementtype', 'data']);

  insert into public.innholdselementer (
    objekt_id, tilstand, infoside_id, panel, posisjon, elementtype, data
  )
  values (
    p_objekt,
    p_tilstand,
    intern.id(p_innhold, 'infoside'),
    intern.tekst(p_innhold, 'panel'),
    intern.heltall(p_innhold, 'posisjon'),
    intern.tekst(p_innhold, 'elementtype'),
    intern.objekt(p_innhold, 'data')
  )
  on conflict on constraint innholdselementer_pkey do update set
    infoside_id = excluded.infoside_id,
    panel = excluded.panel,
    posisjon = excluded.posisjon,
    elementtype = excluded.elementtype,
    data = excluded.data;
end;
$$;

create function intern.les_innholdselement(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'infoside', e.infoside_id,
    'panel', e.panel,
    'posisjon', e.posisjon,
    'elementtype', e.elementtype,
    'data', e.data
  )
  from public.innholdselementer e
  where e.objekt_id = p_objekt and e.tilstand = p_tilstand
$$;

-- Øyeblikksbildet av én tilstand, uansett type.
create function intern.les(
  p_type public.objekttype, p_objekt uuid, p_tilstand public.objekttilstand
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  innhold jsonb;
begin
  execute format('select intern.%I($1, $2)', 'les_' || p_type::text)
    into innhold
    using p_objekt, p_tilstand;
  return innhold;
end;
$$;

-- Legger inn innholdet for én tilstand og gir øyeblikksbildet tilbake slik det
-- faktisk ble lagret.
create function intern.skriv(
  p_type public.objekttype, p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  execute format('select intern.%I($1, $2, $3)', 'skriv_' || p_type::text)
    using p_objekt, p_tilstand, p_innhold;
  return intern.les(p_type, p_objekt, p_tilstand);
end;
$$;

-- --- Status og historikk ---------------------------------------------------

-- Radsikkerheten gjelder gjennom visningene. En vanlig bruker ser derfor bare
-- publiserte objekter her, og aldri revisjonsnummeret til et utkast.
create view public.objektstatus
with (security_invoker = true)
as
select
  o.id,
  o.type,
  u.revisjon,
  u.endret_kl,
  p.revisjon as publisert_revisjon,
  p.endret_kl as publisert_kl
from public.redigerbare_objekter o
left join public.objekttilstander u on u.objekt_id = o.id and u.tilstand = 'utkast'
left join public.objekttilstander p on p.objekt_id = o.id and p.tilstand = 'publisert';

comment on view public.objektstatus is
  'Gjeldende revisjon (utkastet) og publisert revisjon per objekt. Har utkastet høyere revisjon enn den publiserte, finnes det upubliserte endringer.';

-- Alle handlingene på ett sted: endringene fra revisjonene og publiseringene
-- ved siden av dem. Det som publiseres, er alltid utkastet slik det står, så
-- rekkefølgen er entydig uten tidspunktene: sorter på revisjon, og la
-- publiseringen av en revisjon komme etter at den ble til.
create view public.objekthistorikk
with (security_invoker = true)
as
select
  r.objekt_id,
  r.handling,
  r.revisjon,
  r.gjenopprettet_fra,
  null::integer as forrige_revisjon,
  r.utfort_av,
  r.utfort_av_fornavn,
  r.utfort_av_etternavn,
  r.utfort_kl
from public.objektrevisjoner r
union all
select
  p.objekt_id,
  'publisert'::public.innholdshandling,
  p.revisjon,
  null::integer,
  p.forrige_revisjon,
  p.utfort_av,
  p.utfort_av_fornavn,
  p.utfort_av_etternavn,
  p.utfort_kl
from public.objektpubliseringer p;

comment on view public.objekthistorikk is
  'Tidslinjen for et objekt: opprettet, endret, gjenopprettet og publisert, med hvem og når. Sorteres på revisjon, med publiseringen etter revisjonen den gjelder.';

create function intern.status(p_objekt uuid)
returns public.objektstatus
language sql
stable
set search_path = ''
as $$
  select s.* from public.objektstatus s where s.id = p_objekt
$$;

-- --- Samtidighetskontrollen ------------------------------------------------

-- Låser utkastet og kontrollerer at klienten har sett den gjeldende
-- revisjonen. En annen lagring av samme objekt venter på låsen og ser deretter
-- den nye revisjonen — og avvises, i stedet for å skrive over den.
--
-- Konflikten gis med SQLSTATE PT409, som data-API-et svarer på med HTTP 409.
-- Samme kode står som KONFLIKT i src/faginnhold/modell.ts.
create function intern.laas_utkast(p_objekt uuid, p_forventet_revisjon integer)
returns public.objektrevisjoner
language plpgsql
set search_path = ''
as $$
declare
  gjeldende integer;
  revisjonen public.objektrevisjoner;
begin
  if p_forventet_revisjon is null then
    raise exception 'Revisjonen som ble åpnet, mangler.' using errcode = '22023';
  end if;

  select t.revisjon into gjeldende
  from public.objekttilstander t
  where t.objekt_id = p_objekt and t.tilstand = 'utkast'
  for update;
  if not found then
    raise exception 'Fant ikke objektet.' using errcode = 'PT404';
  end if;

  if gjeldende <> p_forventet_revisjon then
    raise exception 'Innholdet er endret av noen andre siden det ble åpnet.'
      using
        errcode = 'PT409',
        detail = jsonb_build_object(
          'gjeldende_revisjon', gjeldende,
          'forventet_revisjon', p_forventet_revisjon
        )::text;
  end if;

  select r.* into strict revisjonen
  from public.objektrevisjoner r
  where r.objekt_id = p_objekt and r.revisjon = gjeldende;
  return revisjonen;
end;
$$;

-- Ny revisjon av utkastet, med den innloggede som forfatter.
create function intern.ny_revisjon(
  p_objekt uuid,
  p_handling public.innholdshandling,
  p_innhold jsonb,
  p_forfatter public.profiles,
  p_gjenopprettet_fra integer default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  ny integer;
begin
  ny := coalesce(
    (select max(r.revisjon) from public.objektrevisjoner r where r.objekt_id = p_objekt),
    0
  ) + 1;

  insert into public.objektrevisjoner (
    objekt_id, revisjon, handling, innhold, gjenopprettet_fra,
    utfort_av, utfort_av_fornavn, utfort_av_etternavn
  )
  values (
    p_objekt, ny, p_handling, p_innhold, p_gjenopprettet_fra,
    p_forfatter.id, p_forfatter.first_name, p_forfatter.last_name
  );

  insert into public.objekttilstander (objekt_id, tilstand, revisjon)
  values (p_objekt, 'utkast', ny)
  on conflict on constraint objekttilstander_pkey
  do update set revisjon = excluded.revisjon, endret_kl = now();
end;
$$;

-- --- Operasjonene appen kaller ---------------------------------------------

-- Alle fire kjører med eierens rettigheter, siden nettleseren ikke har
-- skriverett på tabellene. Derfor krever hver av dem administrator før noe
-- annet skjer, og alle gir tilbake objektets nye status.

create function public.opprett_utkast(objekttype public.objekttype, innhold jsonb)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
  objekt uuid;
begin
  if objekttype is null then
    raise exception 'Objekttypen mangler.' using errcode = '22023';
  end if;

  insert into public.redigerbare_objekter (type)
  values (objekttype)
  returning id into objekt;

  -- Utkastet må finnes før innholdet kan legges inn i det. Koblingen til
  -- revisjonen kontrolleres først når transaksjonen er ferdig.
  insert into public.objekttilstander (objekt_id, tilstand, revisjon)
  values (objekt, 'utkast', 1);

  perform intern.ny_revisjon(
    objekt,
    'opprettet',
    intern.skriv(objekttype, objekt, 'utkast', innhold),
    forfatter
  );
  return intern.status(objekt);
end;
$$;

comment on function public.opprett_utkast(public.objekttype, jsonb) is
  'Oppretter et nytt objekt med utkastet som revisjon 1. Krever administrator.';

create function public.lagre_utkast(objekt uuid, forventet_revisjon integer, innhold jsonb)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
  gjeldende public.objektrevisjoner := intern.laas_utkast(objekt, forventet_revisjon);
  lagret jsonb;
begin
  lagret := intern.skriv(
    (select o.type from public.redigerbare_objekter o where o.id = objekt),
    objekt,
    'utkast',
    innhold
  );

  -- Uendret innhold gir ingen ny revisjon.
  if lagret is distinct from gjeldende.innhold then
    perform intern.ny_revisjon(objekt, 'endret', lagret, forfatter);
  end if;
  return intern.status(objekt);
end;
$$;

comment on function public.lagre_utkast(uuid, integer, jsonb) is
  'Lagrer utkastet som en ny revisjon. Avvises med PT409 hvis forventet_revisjon ikke lenger er den gjeldende. Krever administrator.';

create function public.gjenopprett_revisjon(objekt uuid, forventet_revisjon integer, fra_revisjon integer)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
  gjeldende public.objektrevisjoner := intern.laas_utkast(objekt, forventet_revisjon);
  kilde jsonb;
begin
  if fra_revisjon is null or fra_revisjon >= gjeldende.revisjon then
    raise exception 'Bare en tidligere revisjon kan gjenopprettes.' using errcode = '22023';
  end if;

  select r.innhold into kilde
  from public.objektrevisjoner r
  where r.objekt_id = objekt and r.revisjon = fra_revisjon;
  if not found then
    raise exception 'Fant ikke revisjon %.', fra_revisjon using errcode = '22023';
  end if;

  perform intern.ny_revisjon(
    objekt,
    'gjenopprettet',
    intern.skriv(
      (select o.type from public.redigerbare_objekter o where o.id = objekt),
      objekt,
      'utkast',
      kilde
    ),
    forfatter,
    fra_revisjon
  );
  return intern.status(objekt);
end;
$$;

comment on function public.gjenopprett_revisjon(uuid, integer, integer) is
  'Lager en ny revisjon med innholdet fra en tidligere. Senere revisjoner blir stående. Krever administrator.';

create function public.publiser_utkast(objekt uuid, forventet_revisjon integer)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
  gjeldende public.objektrevisjoner := intern.laas_utkast(objekt, forventet_revisjon);
  publisert integer;
begin
  select t.revisjon into publisert
  from public.objekttilstander t
  where t.objekt_id = objekt and t.tilstand = 'publisert'
  for update;

  if publisert is distinct from gjeldende.revisjon then
    insert into public.objekttilstander (objekt_id, tilstand, revisjon)
    values (objekt, 'publisert', gjeldende.revisjon)
    on conflict on constraint objekttilstander_pkey
    do update set revisjon = excluded.revisjon, endret_kl = now();

    perform intern.skriv(
      (select o.type from public.redigerbare_objekter o where o.id = objekt),
      objekt,
      'publisert',
      gjeldende.innhold
    );

    insert into public.objektpubliseringer (
      objekt_id, revisjon, forrige_revisjon,
      utfort_av, utfort_av_fornavn, utfort_av_etternavn
    )
    values (
      objekt, gjeldende.revisjon, publisert,
      forfatter.id, forfatter.first_name, forfatter.last_name
    );
  end if;
  return intern.status(objekt);
end;
$$;

comment on function public.publiser_utkast(uuid, integer) is
  'Publiserer den gjeldende revisjonen av utkastet. Avvises med PT409 hvis forventet_revisjon ikke lenger er den gjeldende. Krever administrator.';

-- --- Radsikkerhet ----------------------------------------------------------

-- Alle innloggede leser det som er publisert. Administratorer leser i tillegg
-- utkastene og hele historikken. Ingen skriver direkte: det finnes ingen
-- policy for insert, update eller delete, og ingen rettigheter til det heller.

alter table public.redigerbare_objekter enable row level security;
alter table public.objektrevisjoner enable row level security;
alter table public.objekttilstander enable row level security;
alter table public.objektpubliseringer enable row level security;
alter table public.infosider enable row level security;
alter table public.laboratorieanalytter enable row level security;
alter table public.analyttkomponenter enable row level security;
alter table public.innholdselementer enable row level security;

create policy "Innloggede ser publiserte objekter, administratorer alle"
on public.redigerbare_objekter for select to authenticated
using (
  (select public.er_admin())
  or exists (
    select 1 from public.objekttilstander t
    where t.objekt_id = redigerbare_objekter.id and t.tilstand = 'publisert'
  )
);

-- En revisjon er synlig for alle når den er blitt publisert en gang. Utkast
-- som aldri ble publisert, ser bare administratorer.
create policy "Innloggede ser publiserte revisjoner, administratorer alle"
on public.objektrevisjoner for select to authenticated
using (
  (select public.er_admin())
  or exists (
    select 1 from public.objektpubliseringer p
    where p.objekt_id = objektrevisjoner.objekt_id and p.revisjon = objektrevisjoner.revisjon
  )
);

create policy "Innloggede ser publiseringene"
on public.objektpubliseringer for select to authenticated
using (true);

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.objekttilstander for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.infosider for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.laboratorieanalytter for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.analyttkomponenter for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.innholdselementer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

-- --- Rettigheter -----------------------------------------------------------

-- Supabase gir nye tabeller og funksjoner i public full tilgang for alle
-- API-rollene. Her tas alt bort, og bare lesing gis tilbake. Også den
-- hemmelige nøkkelen er uten skriverett, slik at ingen kan endre innholdet
-- utenom funksjonene som fører historikken.
revoke all on table
  public.redigerbare_objekter,
  public.objektrevisjoner,
  public.objekttilstander,
  public.objektpubliseringer,
  public.infosider,
  public.laboratorieanalytter,
  public.analyttkomponenter,
  public.innholdselementer,
  public.objektstatus,
  public.objekthistorikk
from anon, authenticated, service_role;

grant select on table
  public.redigerbare_objekter,
  public.objektrevisjoner,
  public.objekttilstander,
  public.objektpubliseringer,
  public.infosider,
  public.laboratorieanalytter,
  public.analyttkomponenter,
  public.innholdselementer,
  public.objektstatus,
  public.objekthistorikk
to authenticated, service_role;

revoke all on sequence public.objektpubliseringer_id_seq from anon, authenticated, service_role;

revoke all on function
  public.er_admin(),
  public.opprett_utkast(public.objekttype, jsonb),
  public.lagre_utkast(uuid, integer, jsonb),
  public.gjenopprett_revisjon(uuid, integer, integer),
  public.publiser_utkast(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.er_admin(),
  public.opprett_utkast(public.objekttype, jsonb),
  public.lagre_utkast(uuid, integer, jsonb),
  public.gjenopprett_revisjon(uuid, integer, integer),
  public.publiser_utkast(uuid, integer)
to authenticated;

-- Skjemaet er stengt allerede; dette er den andre låsen.
revoke all on all functions in schema intern from public, anon, authenticated, service_role;
