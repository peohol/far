-- Idéer: arkivet for «Ikke aktuelt» og Planlagte oppgaver.
--
-- Statusen en administrator ga idéene, erstattes av to veier ut av idélista:
--
-- - «Ikke aktuelt» legger idéen i arkivet. Alle ser den der, en administrator
--   kan gjenopprette den i 60 dager, og etter det slettes den.
-- - «Overfør til planlagte oppgaver» gjør idéen til en oppgave. Der skriver en
--   administrator prompten en språkmodell skal utføre oppgaven etter, og
--   merker den klar til implementering. Claude merker den utført når arbeidet
--   er gjort, med et nummer og versjonen i endringsloggen. En oppgave kan bare
--   forsvinne ved å flyttes tilbake til idéene, og en utført oppgave står for
--   alltid.
--
-- En idé i arkivet eller blant oppgavene er frosset: ingen kan endre den,
-- kommentere eller gi hjerter, men alle kan lese den.

-- --- Arkivet ----------------------------------------------------------------

alter table public.ideer add column arkivert_kl timestamptz;

comment on column public.ideer.arkivert_kl is
  'Når en administrator la idéen i arkivet («Ikke aktuelt»), eller null. Slettes 60 dager etter.';

-- --- Oppgavene ----------------------------------------------------------------

create type public.oppgavestatus as enum ('ikke_paabegynt', 'under_arbeid', 'klar', 'utfort');

create sequence intern.oppgavenummer;

create table public.oppgaver (
  id uuid primary key default gen_random_uuid(),
  -- Idéen kan ikke slettes så lenge den er en oppgave.
  ide_id uuid not null unique references public.ideer (id),
  status public.oppgavestatus not null default 'ikke_paabegynt',
  -- Det en språkmodell skal utføre oppgaven etter, som ren tekst.
  prompt text not null default '',
  -- Nummeret (OPG-001) og versjonen i endringsloggen settes når oppgaven er utført.
  nummer integer unique,
  endringslogg text,
  overfort_kl timestamptz not null default now(),
  endret_kl timestamptz,
  klar_kl timestamptz,
  utfort_kl timestamptz,
  constraint oppgaver_prompt check (char_length(prompt) <= 50000),
  constraint oppgaver_endringslogg check (endringslogg is null or endringslogg ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  constraint oppgaver_utfort check (
    (status = 'utfort') = (nummer is not null and endringslogg is not null and utfort_kl is not null)
  ),
  constraint oppgaver_klar check ((status in ('klar', 'utfort')) = (klar_kl is not null))
);

comment on table public.oppgaver is
  'Idéer en administrator har overført til Planlagte oppgaver, med prompten de skal utføres etter. Endres bare gjennom funksjonene.';

-- --- Statusen blir oppgaver og arkiv ------------------------------------------

-- Idéene som hadde fått status, føres over til den nye ordningen. En idé som var
-- gjennomført, har ingen føring i endringsloggen å peke til, og står derfor som
-- under arbeid til den er merket utført.
insert into public.oppgaver (ide_id, status, overfort_kl)
select i.id,
  case i.status when 'planlagt' then 'ikke_paabegynt' else 'under_arbeid' end::public.oppgavestatus,
  coalesce(i.status_kl, now())
from public.ideer i
where i.status in ('planlagt', 'under_arbeid', 'gjennomfort');

update public.ideer set arkivert_kl = coalesce(status_kl, now()) where status = 'ikke_aktuelt';

drop function public.sett_idestatus(uuid, public.idestatus);
alter table public.ideer drop column status, drop column status_kl;
drop type public.idestatus;

-- Å arkivere er ingen endring av idéen, og gir ikke «endret» på den.
create or replace function intern.ide_merk_endret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - array['endret_kl', 'arkivert_kl'] is distinct from to_jsonb(old) - array['endret_kl', 'arkivert_kl']
    and not coalesce((to_jsonb(new) ->> 'slettet')::boolean, false)
  then
    new.endret_kl := now();
  else
    new.endret_kl := old.endret_kl;
  end if;
  return new;
end;
$$;

-- --- Frysingen -----------------------------------------------------------------

-- Hvor lenge en arkivert idé står før den slettes.
create function intern.arkivfrist()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '60 days' $$;

-- Om idéen står åpen i idélista: ikke arkivert og ikke overført.
create function public.ide_er_apen(ide uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ideer i
    where i.id = ide_er_apen.ide
      and i.arkivert_kl is null
      and not exists (select 1 from public.oppgaver o where o.ide_id = i.id)
  )
$$;

comment on function public.ide_er_apen(uuid) is
  'Sant når idéen står åpen i idélista. En arkivert eller overført idé er frosset.';

-- Kommentarer og hjerter på en frosset idé kan ikke legges til, endres eller tas
-- bort. Det som skjer inni en annen utløser (tømming og rydding i tråden,
-- sletting av idéen), går sin gang.
create function intern.ide_krev_apen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rad record := case when tg_op = 'DELETE' then old else new end;
begin
  if pg_trigger_depth() > 1 then
    return rad;
  end if;
  if exists (select 1 from public.ideer i where i.id = rad.ide_id) and not public.ide_er_apen(rad.ide_id) then
    raise exception 'Idéen er arkivert eller overført, og tråden er frosset.' using errcode = '42501';
  end if;
  return rad;
end;
$$;

create trigger idekommentarer_krev_apen
before insert or update or delete on public.idekommentarer
for each row execute function intern.ide_krev_apen();

create trigger idehjerter_krev_apen
before insert or delete on public.idehjerter
for each row execute function intern.ide_krev_apen();

-- Forfatteren endrer bare en åpen idé. Forfatteren eller en administrator
-- sletter en åpen idé; en administrator sletter også en arkivert. En overført
-- idé kan ingen slette.
drop policy "Forfatteren endrer idéen" on public.ideer;
create policy "Forfatteren endrer idéen" on public.ideer
for update to authenticated
using (forfatter_id = (select auth.uid()) and public.ide_er_apen(id))
with check (forfatter_id = (select auth.uid()));

drop policy "Forfatteren eller en administrator sletter idéen" on public.ideer;
create policy "Forfatteren eller en administrator sletter idéen" on public.ideer
for delete to authenticated
using (
  (public.ide_er_apen(id) and (forfatter_id = (select auth.uid()) or (select public.er_admin())))
  or (arkivert_kl is not null and (select public.er_admin()))
);

-- --- Det en administrator gjør ---------------------------------------------------

create function intern.krev_idevalg_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.er_admin() then
    raise exception 'Bare en administrator kan gjøre dette.' using errcode = '42501';
  end if;
end;
$$;

-- «Ikke aktuelt»: idéen legges i arkivet.
create function public.arkiver_ide(ide uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  if not public.ide_er_apen(arkiver_ide.ide) then
    raise exception 'Idéen er alt arkivert eller overført.' using errcode = '55000';
  end if;
  update public.ideer set arkivert_kl = now() where id = arkiver_ide.ide;
end;
$$;

-- Idéen hentes tilbake fra arkivet, så lenge fristen ikke er ute.
create function public.gjenopprett_ide(ide uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  update public.ideer set arkivert_kl = null
  where id = gjenopprett_ide.ide and arkivert_kl > now() - intern.arkivfrist();
  if not found then
    raise exception 'Idéen står ikke i arkivet.' using errcode = '55000';
  end if;
end;
$$;

-- Idéer som har stått i arkivet lenger enn fristen, slettes. Appen ber om det
-- når idévinduet åpnes; alle innloggede kan be om det, siden det bare fjerner
-- det som uansett er borte fra visningen.
create function public.rydd_idearkiv()
returns integer
language sql
security definer
set search_path = ''
as $$
  with slettet as (
    delete from public.ideer i
    where i.arkivert_kl <= now() - intern.arkivfrist()
    returning 1
  )
  select count(*)::integer from slettet
$$;

-- «Overfør til planlagte oppgaver»: idéen blir en oppgave som ikke er påbegynt.
create function public.overfor_ide(ide uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny uuid;
begin
  perform intern.krev_idevalg_admin();
  if not public.ide_er_apen(overfor_ide.ide) then
    raise exception 'Idéen er alt arkivert eller overført.' using errcode = '55000';
  end if;
  insert into public.oppgaver (ide_id) values (overfor_ide.ide) returning id into ny;
  return ny;
end;
$$;

-- Oppgaven flyttes tilbake til idélista. Det er den eneste måten en oppgave kan
-- fjernes på, og en utført oppgave kan ikke flyttes.
create function public.flytt_oppgave_tilbake(oppgave uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  delete from public.oppgaver o where o.id = flytt_oppgave_tilbake.oppgave and o.status <> 'utfort';
  if not found then
    raise exception 'Oppgaven finnes ikke, eller er utført.' using errcode = '55000';
  end if;
end;
$$;

-- Ny prompt. Den første endringen setter en oppgave som ikke var påbegynt,
-- under arbeid, og en klar oppgave som mister prompten, er ikke klar lenger.
create function public.lagre_oppgaveprompt(oppgave uuid, prompt text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tom boolean := btrim(coalesce(lagre_oppgaveprompt.prompt, '')) = '';
begin
  perform intern.krev_idevalg_admin();
  update public.oppgaver o
  set prompt = coalesce(lagre_oppgaveprompt.prompt, ''),
    endret_kl = now(),
    status = case when o.status = 'klar' and not tom then 'klar' else 'under_arbeid' end::public.oppgavestatus,
    klar_kl = case when o.status = 'klar' and not tom then o.klar_kl end
  where o.id = lagre_oppgaveprompt.oppgave and o.status <> 'utfort';
  if not found then
    raise exception 'Oppgaven finnes ikke, eller er utført.' using errcode = '55000';
  end if;
end;
$$;

-- Klar til implementering, eller tilbake til under arbeid. En oppgave uten
-- prompt kan ikke være klar.
create function public.sett_oppgave_klar(oppgave uuid, klar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  if sett_oppgave_klar.klar and exists (
    select 1 from public.oppgaver o where o.id = sett_oppgave_klar.oppgave and btrim(o.prompt) = ''
  ) then
    raise exception 'Skriv prompten før oppgaven merkes klar.' using errcode = '23514';
  end if;
  update public.oppgaver o
  set status = case when sett_oppgave_klar.klar then 'klar' else 'under_arbeid' end::public.oppgavestatus,
    klar_kl = case when sett_oppgave_klar.klar then coalesce(o.klar_kl, now()) end
  where o.id = sett_oppgave_klar.oppgave and o.status <> 'utfort';
  if not found then
    raise exception 'Oppgaven finnes ikke, eller er utført.' using errcode = '55000';
  end if;
end;
$$;

-- Claude merker oppgaven utført når arbeidet er gjort, med versjonen i
-- endringsloggen der det står hva som ble gjort. Oppgaven får da nummeret sitt.
-- Ingen i appen kan kalle denne: den kjøres som en migrering, etter at en
-- administrator har godkjent den.
create function public.fullfor_oppgave(oppgave uuid, endringslogg text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nr integer;
begin
  update public.oppgaver o
  set status = 'utfort', nummer = nextval('intern.oppgavenummer'), endringslogg = fullfor_oppgave.endringslogg, utfort_kl = now()
  where o.id = fullfor_oppgave.oppgave and o.status = 'klar'
  returning o.nummer into nr;
  if nr is null then
    raise exception 'Oppgaven finnes ikke, eller er ikke klar til implementering.' using errcode = '55000';
  end if;
  return nr;
end;
$$;

comment on function public.arkiver_ide(uuid) is 'Legger idéen i arkivet («Ikke aktuelt»). Bare for administratorer.';
comment on function public.gjenopprett_ide(uuid) is 'Henter idéen tilbake fra arkivet innen 60 dager. Bare for administratorer.';
comment on function public.rydd_idearkiv() is 'Sletter idéer som har stått i arkivet i 60 dager, og gir antallet.';
comment on function public.overfor_ide(uuid) is 'Gjør idéen til en planlagt oppgave og gir ID-en til oppgaven. Bare for administratorer.';
comment on function public.flytt_oppgave_tilbake(uuid) is 'Flytter en oppgave som ikke er utført, tilbake til idélista. Bare for administratorer.';
comment on function public.lagre_oppgaveprompt(uuid, text) is 'Lagrer prompten til en oppgave som ikke er utført. Bare for administratorer.';
comment on function public.sett_oppgave_klar(uuid, boolean) is 'Merker oppgaven klar til implementering, eller tilbake til under arbeid. Bare for administratorer.';
comment on function public.fullfor_oppgave(uuid, text) is 'Merker en klar oppgave utført med versjonen i endringsloggen, og gir nummeret. Kjøres av Claude som migrering.';

-- --- Lesing ----------------------------------------------------------------------

-- Oppgaven slik idélista og idésiden viser den.
create function intern.oppgave_kort(ide uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'status', o.status, 'nummer', o.nummer)
  from public.oppgaver o
  where o.ide_id = oppgave_kort.ide
$$;

create or replace function public.ideoversikt()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with hjerter as (
    select h.ide_id, count(*) as antall, bool_or(h.bruker_id = (select auth.uid())) as mitt
    from public.idehjerter h
    where h.kommentar_id is null
    group by h.ide_id
  ),
  -- Nye er kommentarer fra andre etter at idéen sist ble åpnet, eller alle
  -- fra andre når den aldri er åpnet.
  kommentarer as (
    select
      k.ide_id,
      count(*) as antall,
      count(*) filter (
        where k.forfatter_id is distinct from (select auth.uid())
          and (b.sett_kl is null or k.opprettet_kl > b.sett_kl)
      ) as nye
    from public.idekommentarer k
    left join public.idebesok b on b.ide_id = k.ide_id and b.bruker_id = (select auth.uid())
    where not k.slettet
    group by k.ide_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'forfatter_id', i.forfatter_id,
      'kategori', i.kategori,
      'tittel', i.tittel,
      'arkivert_kl', i.arkivert_kl,
      'oppgave', intern.oppgave_kort(i.id),
      'opprettet_kl', i.opprettet_kl,
      'endret_kl', i.endret_kl,
      'hjerter', coalesce(h.antall, 0),
      'mitt_hjerte', coalesce(h.mitt, false),
      'kommentarer', coalesce(k.antall, 0),
      'nye_kommentarer', coalesce(k.nye, 0)
    ) order by i.opprettet_kl desc, i.id), '[]'::jsonb)
  from public.ideer i
  left join hjerter h on h.ide_id = i.id
  left join kommentarer k on k.ide_id = i.id
  where (select auth.uid()) is not null
    and (i.arkivert_kl is null or i.arkivert_kl > now() - intern.arkivfrist())
$$;

create or replace function public.idetraad(ide uuid)
returns jsonb
language sql
stable
security definer
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
    'arkivert_kl', i.arkivert_kl,
    'oppgave', intern.oppgave_kort(i.id),
    'opprettet_kl', i.opprettet_kl,
    'endret_kl', i.endret_kl,
    'lest_kl', now(),
    'sist_sett', (
      select b.sett_kl from public.idebesok b
      where b.ide_id = i.id and b.bruker_id = (select auth.uid())
    ),
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
    and (select auth.uid()) is not null
    and (i.arkivert_kl is null or i.arkivert_kl > now() - intern.arkivfrist())
$$;

comment on function public.ideoversikt() is
  'Idélista: alle idéene med arkivtid og oppgave, antall hjerter og kommentarer, og hvor mange kommentarer som er nye for den innloggede.';
comment on function public.idetraad(uuid) is
  'Én idé med beskrivelsen, arkivtiden, oppgaven, hjertene og hele kommentartråden, når den innloggede sist åpnet den og når tråden ble lest. Null når idéen ikke finnes.';

-- Oppgavene med idéen de kom fra, uten prompten.
create function public.oppgaveoversikt()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'ide_id', i.id,
      'tittel', i.tittel,
      'kategori', i.kategori,
      'forfatter_id', i.forfatter_id,
      'status', o.status,
      'nummer', o.nummer,
      'endringslogg', o.endringslogg,
      'har_prompt', btrim(o.prompt) <> '',
      'overfort_kl', o.overfort_kl,
      'endret_kl', o.endret_kl,
      'klar_kl', o.klar_kl,
      'utfort_kl', o.utfort_kl
    ) order by o.overfort_kl desc, o.id), '[]'::jsonb)
  from public.oppgaver o
  join public.ideer i on i.id = o.ide_id
  where (select auth.uid()) is not null
$$;

-- Én oppgave med prompten, eller null når den ikke finnes.
create function public.oppgave(oppgave uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
      'id', o.id,
      'ide_id', i.id,
      'tittel', i.tittel,
      'kategori', i.kategori,
      'forfatter_id', i.forfatter_id,
      'status', o.status,
      'nummer', o.nummer,
      'endringslogg', o.endringslogg,
      'har_prompt', btrim(o.prompt) <> '',
      'prompt', o.prompt,
      'overfort_kl', o.overfort_kl,
      'endret_kl', o.endret_kl,
      'klar_kl', o.klar_kl,
      'utfort_kl', o.utfort_kl
    )
  from public.oppgaver o
  join public.ideer i on i.id = o.ide_id
  where o.id = oppgave.oppgave and (select auth.uid()) is not null
$$;

comment on function public.oppgaveoversikt() is 'Planlagte oppgaver: alle oppgavene med idéen de kom fra, uten prompten.';
comment on function public.oppgave(uuid) is 'Én planlagt oppgave med prompten. Null når den ikke finnes.';

-- --- Radsikkerhet og rettigheter --------------------------------------------------

alter table public.oppgaver enable row level security;

create policy "Innloggede leser oppgavene" on public.oppgaver
for select to authenticated using (true);

revoke all on public.oppgaver from anon, authenticated;
grant select on public.oppgaver to authenticated;
revoke all on sequence intern.oppgavenummer from public, anon, authenticated, service_role;

revoke all on function public.ide_er_apen(uuid) from public, anon, authenticated, service_role;
revoke all on function public.arkiver_ide(uuid) from public, anon, authenticated, service_role;
revoke all on function public.gjenopprett_ide(uuid) from public, anon, authenticated, service_role;
revoke all on function public.rydd_idearkiv() from public, anon, authenticated, service_role;
revoke all on function public.overfor_ide(uuid) from public, anon, authenticated, service_role;
revoke all on function public.flytt_oppgave_tilbake(uuid) from public, anon, authenticated, service_role;
revoke all on function public.lagre_oppgaveprompt(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.sett_oppgave_klar(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.fullfor_oppgave(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.oppgaveoversikt() from public, anon, authenticated, service_role;
revoke all on function public.oppgave(uuid) from public, anon, authenticated, service_role;

grant execute on function public.ide_er_apen(uuid) to authenticated;
grant execute on function public.arkiver_ide(uuid) to authenticated;
grant execute on function public.gjenopprett_ide(uuid) to authenticated;
grant execute on function public.rydd_idearkiv() to authenticated;
grant execute on function public.overfor_ide(uuid) to authenticated;
grant execute on function public.flytt_oppgave_tilbake(uuid) to authenticated;
grant execute on function public.lagre_oppgaveprompt(uuid, text) to authenticated;
grant execute on function public.sett_oppgave_klar(uuid, boolean) to authenticated;
grant execute on function public.oppgaveoversikt() to authenticated;
grant execute on function public.oppgave(uuid) to authenticated;
-- fullfor_oppgave får ingen: den kjøres bare som migrering.

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
