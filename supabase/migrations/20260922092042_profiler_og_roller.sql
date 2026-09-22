-- Brukersystemet i OUSFAR: profiler, roller og reglene for hvem som får endre hva.
--
-- Appen har ingen registrering. Kontoer opprettes av en administrator gjennom
-- Edge-funksjonen «opprett-bruker», som bruker Auth Admin-API-et med en
-- hemmelig nøkkel. Alt annet — nettleseren, den innloggede brukeren, en
-- administrator som skriver rett mot API-et — møter reglene nedenfor.

-- --- Rolle -----------------------------------------------------------------

create type public.brukerrolle as enum ('user', 'admin');

-- --- Brukernavn ------------------------------------------------------------

-- Domenet de interne Auth-adressene bygges av. Supabase Auth krever en
-- e-postadresse for passordinnlogging; OUSFAR samler ikke inn e-post, så
-- adressen utledes av brukernavnet på et domene som aldri kan eksistere.
-- Den er en teknisk nøkkel, ikke en opplysning om brukeren.
-- Samme verdi står i supabase/functions/_delt/brukernavn.ts.
create or replace function public.intern_auth_domene()
returns text
language sql
immutable
set search_path = ''
as $$ select 'auth.ousfar.invalid'::text $$;

comment on function public.intern_auth_domene() is
  'Domenet de interne Auth-adressene bygges av. Vises aldri i grensesnittet.';

create or replace function public.brukernavn_normalisert(raatekst text)
returns text
language sql
immutable
set search_path = ''
as $$ select lower(btrim(coalesce(raatekst, ''))) $$;

-- Samme regler som brukernavnFeil() i supabase/functions/_delt/brukernavn.ts:
-- små bokstaver og tall, der punktum, bindestrek og understrek kan skille
-- bolker. Formen forbyr innledende, avsluttende og doble skilletegn.
create or replace function public.brukernavn_er_gyldig(brukernavn text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select brukernavn is not null
     and char_length(brukernavn) between 3 and 32
     and brukernavn ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
$$;

-- --- Reservasjon: beviset på at kontoen kommer fra adminveien --------------

-- Supabase Auth fyller ut `app_metadata` og bekrefter adressen *etter* at
-- raden er lagt inn, så en trigger kan ikke kjenne igjen adminveien på selve
-- kontoen. I stedet legger adminveien inn en reservasjon på brukernavnet rett
-- før kontoen opprettes, og triggeren bruker den opp. Tabellen har ingen
-- policyer og ingen rettigheter for `anon` eller `authenticated`, så en
-- reservasjon kan bare komme fra en klient med hemmelig nøkkel.
create table public.kontoreservasjoner (
  username text primary key,
  reservert_kl timestamptz not null default now(),
  constraint kontoreservasjoner_username_form check (public.brukernavn_er_gyldig(username))
);

comment on table public.kontoreservasjoner is
  'Kortlivet klarering for å opprette én konto. Legges inn server-side og brukes opp av triggeren på auth.users.';

alter table public.kontoreservasjoner enable row level security;
revoke all on public.kontoreservasjoner from anon, authenticated;

-- --- Profiltabellen --------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  first_name text not null default '',
  last_name text not null default '',
  role public.brukerrolle not null default 'user',
  avatar_path text,
  must_change_password boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_form check (public.brukernavn_er_gyldig(username)),
  constraint profiles_first_name_lengde check (char_length(first_name) <= 60),
  constraint profiles_last_name_lengde check (char_length(last_name) <= 60)
);

comment on table public.profiles is
  'Én rad per Auth-bruker. Brukernavnet er låst etter opprettelsen; rolle og statusfelt kan bare settes av en privilegert klient.';

-- Brukernavnene er alltid små bokstaver, så en vanlig unik indeks gir
-- entydighet uavhengig av store og små bokstaver.
create unique index profiles_username_idx on public.profiles (username);

-- --- Profil opprettes sammen med Auth-brukeren -----------------------------

-- Dette er sperren som holder OUSFAR lukket, uansett hva
-- prosjektinnstillingene måtte si: uten en gyldig reservasjon på et gyldig
-- brukernavn under det interne domenet, blir kontoen aldri til.
create or replace function public.handter_ny_auth_bruker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nytt_brukernavn text;
begin
  if lower(split_part(coalesce(new.email, ''), '@', 2)) <> public.intern_auth_domene() then
    raise exception 'OUSFAR er lukket. Kontoer opprettes bare av en administrator.'
      using errcode = '42501';
  end if;

  nytt_brukernavn := public.brukernavn_normalisert(split_part(new.email, '@', 1));
  if not public.brukernavn_er_gyldig(nytt_brukernavn) then
    raise exception 'Ugyldig brukernavn: %', nytt_brukernavn using errcode = '22023';
  end if;

  -- Gamle reservasjoner som aldri ble brukt, ryddes bort underveis.
  delete from public.kontoreservasjoner
  where reservert_kl < now() - interval '15 minutes';

  delete from public.kontoreservasjoner where username = nytt_brukernavn;
  if not found then
    raise exception 'OUSFAR er lukket. Kontoer opprettes bare av en administrator.'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, username) values (new.id, nytt_brukernavn);
  return new;
end;
$$;

create trigger paa_ny_auth_bruker
after insert on auth.users
for each row execute function public.handter_ny_auth_bruker();

-- --- Feltene brukeren ikke får røre ----------------------------------------

-- Rollene `authenticated` og `anon` er de eneste som nås fra nettleseren.
-- Alt annet — Edge-funksjonene med hemmelig nøkkel, og migrasjoner — er
-- server-side og slipper gjennom.
create or replace function public.profiles_beskytt_felter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
      or new.username is distinct from old.username
      or new.role is distinct from old.role
      or new.must_change_password is distinct from old.must_change_password
      or new.onboarding_completed is distinct from old.onboarding_completed
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Brukernavn, rolle og kontostatus kan bare endres av en administrator.'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_beskytt_felter
before update on public.profiles
for each row execute function public.profiles_beskytt_felter();

-- --- Radsikkerhet ----------------------------------------------------------

alter table public.profiles enable row level security;

-- Alle innloggede ser hverandre: brukerlista er åpen for dem som er inne.
create policy "Innloggede kan lese alle profiler"
on public.profiles for select to authenticated
using (true);

-- Egen rad kan endres — hvilke kolonner, avgjøres av rettighetene under.
create policy "Brukeren kan endre sin egen profil"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Ingen policy for insert eller delete: kontoer opprettes og fjernes
-- server-side, ikke fra nettleseren.

-- Kolonnerettigheter i tillegg til policyene. Nettleseren har dermed ikke
-- skriverett på `role` i det hele tatt, uansett hva den skulle finne på å
-- sende — triggeren over er den andre låsen, ikke den eneste.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, avatar_path) on public.profiles to authenticated;
