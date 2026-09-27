-- Idéer: status satt av en administrator, og hva som er nytt siden sist.
--
-- En administrator gir en idé status (planlagt, under arbeid, gjennomført
-- eller ikke aktuelt), så brukerne ser at idéene blir fulgt opp. Statusen
-- settes bare gjennom `sett_idestatus`, som sjekker at den innloggede er
-- administrator; forfatteren kan ikke sette den selv.
--
-- Databasen husker når hver bruker sist åpnet hver idé. Kommentarer fra andre
-- etter det er nye, og lista viser dem med en prikk.

-- --- Statusen ----------------------------------------------------------------

create type public.idestatus as enum ('planlagt', 'under_arbeid', 'gjennomfort', 'ikke_aktuelt');

alter table public.ideer
  add column status public.idestatus,
  add column status_kl timestamptz;

comment on column public.ideer.status is
  'Statusen en administrator har gitt idéen, eller null uten status. Settes med sett_idestatus().';

-- Å gi en status er ingen endring av idéen, og gir ikke «endret» på den.
create or replace function intern.ide_merk_endret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - array['endret_kl', 'status', 'status_kl'] is distinct from to_jsonb(old) - array['endret_kl', 'status', 'status_kl']
    and not coalesce((to_jsonb(new) ->> 'slettet')::boolean, false)
  then
    new.endret_kl := now();
  else
    new.endret_kl := old.endret_kl;
  end if;
  return new;
end;
$$;

create function public.sett_idestatus(ide uuid, status public.idestatus)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.er_admin() then
    raise exception 'Bare en administrator kan gi en idé status.' using errcode = '42501';
  end if;
  update public.ideer i
  set status = sett_idestatus.status, status_kl = now()
  where i.id = sett_idestatus.ide and i.status is distinct from sett_idestatus.status;
end;
$$;

comment on function public.sett_idestatus(uuid, public.idestatus) is
  'Gir en idé status, eller fjerner den med null. Bare for administratorer.';

-- --- Sist åpnet ----------------------------------------------------------------

create table public.idebesok (
  bruker_id uuid not null references public.profiles (id) on delete cascade,
  ide_id uuid not null references public.ideer (id) on delete cascade,
  sett_kl timestamptz not null default now(),
  primary key (bruker_id, ide_id)
);

comment on table public.idebesok is
  'Når hver bruker sist åpnet hver idé. Kommentarer fra andre etter det er nye for brukeren.';

create index idebesok_ide_idx on public.idebesok (ide_id);

alter table public.idebesok enable row level security;

create policy "Brukeren ser egne besøk" on public.idebesok
for select to authenticated using (bruker_id = (select auth.uid()));

revoke all on public.idebesok from anon, authenticated;
grant select on public.idebesok to authenticated;

-- Tidspunktet settes av databasen, så det bare kan flyttes til nå.
create function public.merk_ide_sett(ide uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.idebesok (bruker_id, ide_id)
  select (select auth.uid()), i.id
  from public.ideer i
  where i.id = merk_ide_sett.ide and (select auth.uid()) is not null
  on conflict (bruker_id, ide_id) do update set sett_kl = now()
$$;

comment on function public.merk_ide_sett(uuid) is
  'Merker at den innloggede har åpnet idéen nå.';

-- --- Lesing, med status og det nye ---------------------------------------------

create or replace function public.ideoversikt()
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
      'status', i.status,
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
$$;

create or replace function public.idetraad(ide uuid)
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
    'status', i.status,
    'opprettet_kl', i.opprettet_kl,
    'endret_kl', i.endret_kl,
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
$$;

-- Antall idéer med nye kommentarer, til prikken i kontomenyen.
create function public.ideer_med_nytt()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from jsonb_array_elements(public.ideoversikt()) i
  where (i ->> 'nye_kommentarer')::integer > 0
$$;

comment on function public.ideer_med_nytt() is
  'Hvor mange idéer som har kommentarer den innloggede ikke har sett.';

comment on function public.ideoversikt() is
  'Idélista: alle idéene med status, antall hjerter og kommentarer, og hvor mange kommentarer som er nye for den innloggede.';
comment on function public.idetraad(uuid) is
  'Én idé med beskrivelsen, statusen, hjertene og hele kommentartråden, og når den innloggede sist åpnet den. Null når idéen ikke finnes.';

-- --- Rettigheter ----------------------------------------------------------------

revoke all on function public.sett_idestatus(uuid, public.idestatus) from public, anon, authenticated, service_role;
revoke all on function public.merk_ide_sett(uuid) from public, anon, authenticated, service_role;
revoke all on function public.ideer_med_nytt() from public, anon, authenticated, service_role;
grant execute on function public.sett_idestatus(uuid, public.idestatus) to authenticated;
grant execute on function public.merk_ide_sett(uuid) to authenticated;
grant execute on function public.ideer_med_nytt() to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
