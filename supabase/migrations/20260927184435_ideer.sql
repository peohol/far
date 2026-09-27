-- Idéer: forslag fra brukerne til OUSFAR, med kommentartråder og hjerter.
--
-- Alle innloggede ser alt og kan skrive idéer, kommentarer og hjerter. Den som
-- skrev noe, kan endre og slette det; en administrator kan slette alt.
-- Radsikkerheten og kolonnerettighetene er det som håndhever det — knappene i
-- appen er bare grensesnittet.
--
-- Kommentarene er en tråd med svar i svar. En kommentar som har svar, slettes
-- ikke helt: teksten og forfatteren fjernes, og plassen blir stående så
-- svarene under ikke mister sammenhengen. Når det siste svaret under en slik
-- kommentar forsvinner, ryddes den bort.
--
-- Brukerinnstillinger er et lite lager for valg som følger brukeren fra
-- maskin til maskin, som sorteringen i idélista.

-- --- Idéene ---------------------------------------------------------------

create type public.idekategori as enum ('fag', 'funksjonalitet', 'annet');

create table public.ideer (
  id uuid primary key default gen_random_uuid(),
  forfatter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kategori public.idekategori not null,
  tittel text not null,
  -- Beskrivelsen som riktekst (ProseMirror-JSON), eller null uten beskrivelse.
  tekst jsonb,
  opprettet_kl timestamptz not null default now(),
  endret_kl timestamptz,
  constraint ideer_tittel check (char_length(tittel) between 1 and 140 and tittel = btrim(tittel)),
  constraint ideer_tekst check (
    tekst is null or (jsonb_typeof(tekst) = 'object' and octet_length(tekst::text) <= 100000)
  )
);

comment on table public.ideer is
  'Idéer til OUSFAR fra brukerne. Synlige for alle innloggede; forfatteren endrer, forfatteren eller en administrator sletter.';

-- --- Kommentarene ------------------------------------------------------------

create table public.idekommentarer (
  id uuid primary key default gen_random_uuid(),
  ide_id uuid not null references public.ideer (id) on delete cascade,
  -- Kommentaren dette er et svar på, eller null for et svar rett på idéen.
  forelder_id uuid references public.idekommentarer (id) on delete cascade,
  -- Tekst og forfatter er null når kommentaren er slettet, men står igjen for
  -- svarene under den: da skal heller ikke databasen si hvem som skrev den.
  forfatter_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  tekst jsonb,
  slettet boolean not null default false,
  opprettet_kl timestamptz not null default now(),
  endret_kl timestamptz,
  constraint idekommentarer_tekst check (
    case when slettet then tekst is null and forfatter_id is null
    else forfatter_id is not null and tekst is not null
      and jsonb_typeof(tekst) = 'object' and octet_length(tekst::text) <= 50000 end
  )
);

comment on table public.idekommentarer is
  'Kommentartråden under hver idé, med svar i svar. En slettet kommentar med svar står igjen uten tekst.';

create index idekommentarer_ide_idx on public.idekommentarer (ide_id);
create index idekommentarer_forelder_idx on public.idekommentarer (forelder_id);

-- --- Hjertene ----------------------------------------------------------------

-- Ett hjerte per bruker på en idé (kommentar_id er null) eller på en kommentar.
-- Idéen står på alle, så hele tråden hentes med ett oppslag.
create table public.idehjerter (
  ide_id uuid not null references public.ideer (id) on delete cascade,
  kommentar_id uuid references public.idekommentarer (id) on delete cascade,
  bruker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  gitt_kl timestamptz not null default now()
);

comment on table public.idehjerter is
  'Hjertene på idéene og kommentarene. Ett per bruker på hver.';

create unique index idehjerter_unik on public.idehjerter (
  ide_id,
  coalesce(kommentar_id, '00000000-0000-0000-0000-000000000000'::uuid),
  bruker_id
);
create index idehjerter_kommentar_idx on public.idehjerter (kommentar_id) where kommentar_id is not null;

-- --- Brukerinnstillinger -------------------------------------------------------

create table public.brukerinnstillinger (
  bruker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nokkel text not null,
  verdi jsonb not null,
  endret_kl timestamptz not null default now(),
  primary key (bruker_id, nokkel),
  constraint brukerinnstillinger_nokkel check (nokkel ~ '^[a-z0-9][a-z0-9._-]{0,59}$'),
  constraint brukerinnstillinger_verdi check (octet_length(verdi::text) <= 4000)
);

comment on table public.brukerinnstillinger is
  'Små valg som følger brukeren, som sorteringen i idélista. Hver bruker ser og skriver bare sine egne.';

-- --- Reglene tabellene ikke kan uttrykke selv ----------------------------------

-- Et svar hører til samme idé som kommentaren det svarer på, og det svares ikke
-- på en slettet kommentar. Et hjerte på en kommentar hører til kommentarens idé.
create function intern.idekommentar_kontroller()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.forelder_id is not null and not exists (
    select 1 from public.idekommentarer f
    where f.id = new.forelder_id and f.ide_id = new.ide_id and not f.slettet
  ) then
    raise exception 'Kommentaren det svares på, finnes ikke under denne idéen.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger idekommentarer_kontroller
before insert on public.idekommentarer
for each row execute function intern.idekommentar_kontroller();

create function intern.idehjerte_kontroller()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kommentar_id is not null and not exists (
    select 1 from public.idekommentarer k
    where k.id = new.kommentar_id and k.ide_id = new.ide_id and not k.slettet
  ) then
    raise exception 'Kommentaren finnes ikke under denne idéen.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger idehjerter_kontroller
before insert on public.idehjerter
for each row execute function intern.idehjerte_kontroller();

-- Tidspunktet for siste endring settes av databasen, ikke av nettleseren. Å
-- tømme en slettet kommentar er ingen endring av den.
create function intern.ide_merk_endret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'endret_kl' is distinct from to_jsonb(old) - 'endret_kl'
    and not coalesce((to_jsonb(new) ->> 'slettet')::boolean, false)
  then
    new.endret_kl := now();
  else
    new.endret_kl := old.endret_kl;
  end if;
  return new;
end;
$$;

create trigger ideer_merk_endret
before update on public.ideer
for each row execute function intern.ide_merk_endret();

create trigger idekommentarer_merk_endret
before update on public.idekommentarer
for each row execute function intern.ide_merk_endret();

create function intern.brukerinnstilling_merk_endret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.endret_kl := now();
  return new;
end;
$$;

create trigger brukerinnstillinger_merk_endret
before update on public.brukerinnstillinger
for each row execute function intern.brukerinnstilling_merk_endret();

-- En kommentar med svar tømmes for tekst, forfatter og hjerter i stedet for å
-- slettes, så svarene står igjen.
-- Sletting som følger av at idéen eller en bruker slettes (en utløser inni en
-- utløser), går sin gang.
create function intern.idekommentar_slett()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from public.idekommentarer s where s.forelder_id = old.id) then
    update public.idekommentarer set tekst = null, forfatter_id = null, slettet = true where id = old.id;
    delete from public.idehjerter where kommentar_id = old.id;
    return null;
  end if;
  return old;
end;
$$;

create trigger idekommentarer_slett
before delete on public.idekommentarer
for each row execute function intern.idekommentar_slett();

-- Når det siste svaret under en tømt kommentar forsvinner, har den ingen jobb
-- igjen og ryddes bort — og det samme oppover i tråden.
create function intern.idekommentar_rydd()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.forelder_id is not null then
    delete from public.idekommentarer f
    where f.id = old.forelder_id
      and f.slettet
      and not exists (select 1 from public.idekommentarer s where s.forelder_id = f.id);
  end if;
  return null;
end;
$$;

create trigger idekommentarer_rydd
after delete on public.idekommentarer
for each row execute function intern.idekommentar_rydd();

-- --- Lesing ------------------------------------------------------------------

-- Idélista: alle idéene uten beskrivelse, med hjerter og kommentarer talt opp.
-- Forfatterne slås opp i profiltabellen av appen, som har dem fra før.
create function public.ideoversikt()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with hjerter as (
    select h.ide_id, count(*) as antall, bool_or(h.bruker_id = (select auth.uid())) as mitt
    from public.idehjerter h
    where h.kommentar_id is null
    group by h.ide_id
  ),
  kommentarer as (
    select k.ide_id, count(*) as antall
    from public.idekommentarer k
    where not k.slettet
    group by k.ide_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'forfatter_id', i.forfatter_id,
      'kategori', i.kategori,
      'tittel', i.tittel,
      'opprettet_kl', i.opprettet_kl,
      'endret_kl', i.endret_kl,
      'hjerter', coalesce(h.antall, 0),
      'mitt_hjerte', coalesce(h.mitt, false),
      'kommentarer', coalesce(k.antall, 0)
    ) order by i.opprettet_kl desc, i.id), '[]'::jsonb)
  from public.ideer i
  left join hjerter h on h.ide_id = i.id
  left join kommentarer k on k.ide_id = i.id
$$;

comment on function public.ideoversikt() is
  'Idélista: alle idéene med antall hjerter og kommentarer, og om den innloggede har gitt hjerte.';

-- Én idé med beskrivelsen og hele kommentartråden, eller null når den ikke finnes.
create function public.idetraad(ide uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with hjerter as (
    select h.kommentar_id, count(*) as antall, bool_or(h.bruker_id = (select auth.uid())) as mitt
    from public.idehjerter h
    where h.ide_id = ide
    group by h.kommentar_id
  )
  select jsonb_build_object(
    'id', i.id,
    'forfatter_id', i.forfatter_id,
    'kategori', i.kategori,
    'tittel', i.tittel,
    'tekst', i.tekst,
    'opprettet_kl', i.opprettet_kl,
    'endret_kl', i.endret_kl,
    'hjerter', coalesce((select h.antall from hjerter h where h.kommentar_id is null), 0),
    'mitt_hjerte', coalesce((select h.mitt from hjerter h where h.kommentar_id is null), false),
    'kommentarer', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id,
          'forelder_id', k.forelder_id,
          'forfatter_id', k.forfatter_id,
          'tekst', k.tekst,
          'slettet', k.slettet,
          'opprettet_kl', k.opprettet_kl,
          'endret_kl', k.endret_kl,
          'hjerter', case when k.slettet then 0 else coalesce(h.antall, 0) end,
          'mitt_hjerte', case when k.slettet then false else coalesce(h.mitt, false) end
        ) order by k.opprettet_kl, k.id)
      from public.idekommentarer k
      left join hjerter h on h.kommentar_id = k.id
      where k.ide_id = i.id
    ), '[]'::jsonb)
  )
  from public.ideer i
  where i.id = ide
$$;

comment on function public.idetraad(uuid) is
  'Én idé med beskrivelsen, hjertene og hele kommentartråden. Null når idéen ikke finnes.';

-- --- Radsikkerhet ------------------------------------------------------------

alter table public.ideer enable row level security;
alter table public.idekommentarer enable row level security;
alter table public.idehjerter enable row level security;
alter table public.brukerinnstillinger enable row level security;

create policy "Innloggede leser idéene" on public.ideer
for select to authenticated using (true);
create policy "Innloggede skriver egne idéer" on public.ideer
for insert to authenticated with check (forfatter_id = (select auth.uid()));
create policy "Forfatteren endrer idéen" on public.ideer
for update to authenticated
using (forfatter_id = (select auth.uid()))
with check (forfatter_id = (select auth.uid()));
create policy "Forfatteren eller en administrator sletter idéen" on public.ideer
for delete to authenticated using (forfatter_id = (select auth.uid()) or (select public.er_admin()));

create policy "Innloggede leser kommentarene" on public.idekommentarer
for select to authenticated using (true);
create policy "Innloggede skriver egne kommentarer" on public.idekommentarer
for insert to authenticated with check (forfatter_id = (select auth.uid()) and not slettet);
create policy "Forfatteren endrer kommentaren" on public.idekommentarer
for update to authenticated
using (forfatter_id = (select auth.uid()) and not slettet)
with check (forfatter_id = (select auth.uid()) and not slettet);
create policy "Forfatteren eller en administrator sletter kommentaren" on public.idekommentarer
for delete to authenticated
using ((forfatter_id = (select auth.uid()) and not slettet) or (select public.er_admin()));

create policy "Innloggede ser hjertene" on public.idehjerter
for select to authenticated using (true);
create policy "Innloggede gir egne hjerter" on public.idehjerter
for insert to authenticated with check (bruker_id = (select auth.uid()));
create policy "Innloggede tar tilbake egne hjerter" on public.idehjerter
for delete to authenticated using (bruker_id = (select auth.uid()));

create policy "Brukeren leser egne innstillinger" on public.brukerinnstillinger
for select to authenticated using (bruker_id = (select auth.uid()));
create policy "Brukeren lagrer egne innstillinger" on public.brukerinnstillinger
for insert to authenticated with check (bruker_id = (select auth.uid()));
create policy "Brukeren endrer egne innstillinger" on public.brukerinnstillinger
for update to authenticated
using (bruker_id = (select auth.uid()))
with check (bruker_id = (select auth.uid()));
create policy "Brukeren sletter egne innstillinger" on public.brukerinnstillinger
for delete to authenticated using (bruker_id = (select auth.uid()));

-- Kolonnerettigheter i tillegg: forfatter, idé, forelder, tidspunkt og
-- slettemerket kan ikke settes eller endres fra nettleseren.
revoke all on public.ideer, public.idekommentarer, public.idehjerter, public.brukerinnstillinger
  from anon, authenticated;

grant select, delete on public.ideer to authenticated;
grant insert (kategori, tittel, tekst) on public.ideer to authenticated;
grant update (kategori, tittel, tekst) on public.ideer to authenticated;

grant select, delete on public.idekommentarer to authenticated;
grant insert (ide_id, forelder_id, tekst) on public.idekommentarer to authenticated;
grant update (tekst) on public.idekommentarer to authenticated;

grant select, delete on public.idehjerter to authenticated;
grant insert (ide_id, kommentar_id) on public.idehjerter to authenticated;

grant select, delete on public.brukerinnstillinger to authenticated;
grant insert (nokkel, verdi) on public.brukerinnstillinger to authenticated;
grant update (nokkel, verdi) on public.brukerinnstillinger to authenticated;

revoke all on function public.ideoversikt() from public, anon, authenticated, service_role;
revoke all on function public.idetraad(uuid) from public, anon, authenticated, service_role;
grant execute on function public.ideoversikt() to authenticated;
grant execute on function public.idetraad(uuid) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
