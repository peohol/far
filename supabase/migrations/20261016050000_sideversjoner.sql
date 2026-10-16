-- Sideversjoner: ett uforanderlig manifest over hele den redaksjonelle
-- fagsiden hver gang det en side viser, publiseres
-- (docs/kurateringsgrener-visjon.md §7, docs/kurateringsgrener-fremdrift.md).
--
-- Manifestet lister de eksakte revisjonene av siden, kortene på den og
-- referansene den siterer, og de gjeldende bivirkningsimportene. Revisjonene er
-- uforanderlige fra før, så ingenting kopieres. Manifestet lages ved slutten av
-- transaksjonen som publiserte, for hver side publiseringen gjaldt — også når
-- en delt referanse publiseres fra en annen side — og bare når det er endret.
-- Sidene som er publisert når denne migrasjonen kjøres, får en basisversjon.
-- Eldre versjoner fabrikeres ikke.

create table public.sideversjoner (
  id bigint generated always as identity primary key,
  -- Slettes med siden når den slettes for godt fra papirkurven, som resten av
  -- historikken (intern.fjern_stoff).
  infoside uuid not null references public.redigerbare_objekter (id) on delete cascade,
  nr integer not null check (nr >= 1),
  -- basis: dagens publiserte side da sideversjonene kom til. publisering: en
  -- vanlig publisering. gren og gjenoppretting: en kurateringsgren eller en
  -- gjenoppretting av en eldre versjon, publisert samlet.
  opphav text not null check (opphav in ('basis', 'publisering', 'gren', 'gjenoppretting')),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  -- md5 av manifestet. Samme innhold gir samme fingeravtrykk.
  fingeravtrykk text not null check (fingeravtrykk ~ '^[0-9a-f]{32}$'),
  endring_id uuid references public.innholdsendringer (id),
  transaksjon xid8 not null default pg_current_xact_id(),
  opprettet_kl timestamptz not null default now(),
  unique (infoside, nr)
);

create index sideversjoner_endring_idx on public.sideversjoner (endring_id) where endring_id is not null;

comment on table public.sideversjoner is
  'Hver publiserte utgave av en hel fagside som et manifest over de eksakte revisjonene. Kan ikke endres eller slettes.';

-- Uforanderlige, med samme unntak som revisjonene: en fagside som slettes for
-- godt fra papirkurven, tar versjonene sine med seg.
create function intern.avvis_sideversjonsendring()
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
  raise exception 'Sideversjonene kan ikke endres eller slettes.' using errcode = '42501';
end;
$$;

create trigger sideversjoner_uforanderlige
before update or delete on public.sideversjoner
for each row execute function intern.avvis_sideversjonsendring();

create trigger sideversjoner_ikke_tomme
before truncate on public.sideversjoner
for each statement execute function intern.avvis_endring();

-- --- Manifestet --------------------------------------------------------------

-- Hele den publiserte redaksjonelle siden slik den står nå: siden, kortene som
-- står på den (ikke de fjernede), referansene siden og kortene siterer, og de
-- gjeldende bivirkningsimportene. `null` når siden ikke er publisert.
create function intern.sidemanifest(p_side uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with side as (
    select t.revisjon
    from public.objekttilstander t
    join public.infosider s on s.objekt_id = t.objekt_id and s.tilstand = 'publisert'
    where t.objekt_id = p_side and t.tilstand = 'publisert'
  ),
  elementer as (
    select e.objekt_id, t.revisjon
    from public.innholdselementer e
    join public.objekttilstander t on t.objekt_id = e.objekt_id and t.tilstand = 'publisert'
    where e.infoside_id = p_side and e.tilstand = 'publisert' and e.panel <> 'fjernet'
  ),
  referanser as (
    select distinct k.referanse_id as objekt_id
    from public.referansekoblinger k
    where k.tilstand = 'publisert'
      and (k.objekt_id = p_side or k.objekt_id in (select objekt_id from elementer))
  )
  select case when exists (select 1 from side) then jsonb_build_object(
    'infoside', jsonb_build_object('id', p_side, 'revisjon', (select revisjon from side)),
    'elementer', coalesce(
      (select jsonb_agg(jsonb_build_object('id', e.objekt_id, 'revisjon', e.revisjon) order by e.objekt_id) from elementer e),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', r.objekt_id, 'revisjon', t.revisjon) order by r.objekt_id)
        from referanser r
        join public.objekttilstander t on t.objekt_id = r.objekt_id and t.tilstand = 'publisert'
      ),
      '[]'::jsonb
    ),
    'bivirkninger', coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', k.id, 'nokkel', k.nokkel) order by k.nokkel, k.id)
        from bivirkninger.kilder k
        where k.infoside = p_side and k.erstattet_av is null and k.trukket_kl is null
      ),
      '[]'::jsonb
    )
  ) end
$$;

comment on function intern.sidemanifest(uuid) is
  'Manifestet over den publiserte fagsiden slik den står nå: revisjonene av siden, kortene og referansene, og de gjeldende bivirkningsimportene.';

-- Ny sideversjon når manifestet er endret siden forrige. Låser siden, så to
-- transaksjoner som publiserer samtidig, får hvert sitt nummer i rekkefølge.
create function intern.registrer_sideversjon(p_side uuid, p_opphav text default 'publisering')
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
    p_opphav,
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

-- Sidene en publisering av objektet gjelder: siden selv, siden kortet står på
-- nå og sto på i revisjonen før, og sidene som siterer referansen.
create function intern.sider_for_publisering(p_objekt uuid, p_forrige_revisjon integer)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with typen as (
    select o.type from public.redigerbare_objekter o where o.id = p_objekt
  )
  select p_objekt where (select type from typen) = 'infoside'
  union
  select e.infoside_id
  from public.innholdselementer e
  where (select type from typen) = 'innholdselement' and e.objekt_id = p_objekt and e.tilstand = 'publisert'
  union
  select (r.innhold ->> 'infoside')::uuid
  from public.objektrevisjoner r
  where (select type from typen) = 'innholdselement'
    and r.objekt_id = p_objekt and r.revisjon = p_forrige_revisjon
    and r.innhold ? 'infoside'
  union
  select coalesce(e.infoside_id, k.objekt_id)
  from public.referansekoblinger k
  left join public.innholdselementer e on e.objekt_id = k.objekt_id and e.tilstand = 'publisert'
  where (select type from typen) = 'referanse' and k.referanse_id = p_objekt and k.tilstand = 'publisert'
$$;

create function intern.sideversjon_etter_publisering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  side uuid;
begin
  for side in select s from intern.sider_for_publisering(new.objekt_id, new.forrige_revisjon) s where s is not null loop
    if exists (select 1 from public.infosider i where i.objekt_id = side and i.tilstand = 'publisert') then
      perform intern.registrer_sideversjon(side);
    end if;
  end loop;
  return null;
end;
$$;

-- Ved slutten av transaksjonen, så en side som publiseres i flere steg i samme
-- transaksjon (siden, kortene, referansene), får én versjon med alt.
create constraint trigger objektpubliseringer_sideversjon
after insert on public.objektpubliseringer
deferrable initially deferred
for each row execute function intern.sideversjon_etter_publisering();

create function intern.sideversjon_etter_bivirkningsimport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.registrer_sideversjon(new.infoside);
  return null;
end;
$$;

create constraint trigger bivirkningskilder_sideversjon
after insert or update on bivirkninger.kilder
deferrable initially deferred
for each row execute function intern.sideversjon_etter_bivirkningsimport();

-- --- Basisversjonene -----------------------------------------------------------

insert into public.sideversjoner (infoside, nr, opphav, manifest, fingeravtrykk)
select s.objekt_id, 1, 'basis', m.manifest, md5(m.manifest::text)
from public.infosider s
cross join lateral (select intern.sidemanifest(s.objekt_id) as manifest) m
where s.tilstand = 'publisert' and m.manifest is not null
order by s.objekt_id;

-- --- Lesingen --------------------------------------------------------------------

-- En revisjon i samme form som utgavene `les_stoff` gir, slik den var publisert.
create function intern.revisjon_som_utgave(p_objekt uuid, p_revisjon integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.objekt_id,
    'revisjon', r.revisjon,
    'publisert_revisjon', r.revisjon,
    'innhold', r.innhold,
    'endret_av_fornavn', r.utfort_av_fornavn,
    'endret_av_etternavn', r.utfort_av_etternavn,
    'endret_kl', r.utfort_kl
  ) || case when r.kilde is null then '{}'::jsonb else jsonb_build_object('kilde', r.kilde) end
  from public.objektrevisjoner r
  where r.objekt_id = p_objekt and r.revisjon = p_revisjon
$$;

-- Hvem som sto for endringen en versjon kom fra, slik endringsloggen viser det
-- for det som er publisert.
create function intern.sideversjon_endring(p_endring uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'aktor', e.aktor,
    'art', e.art,
    'agent', a.navn,
    'fornavn', e.utfort_av_fornavn,
    'etternavn', e.utfort_av_etternavn,
    'oppsummering', e.oppsummering
  ))
  from public.innholdsendringer e
  left join public.endringsagenter a on a.nokkel = e.agent
  where e.id = p_endring
$$;

-- Versjonene av fagsiden for stoffet, nyeste først: nummeret, opphavet, når,
-- hvem og hvor mye den har. Alle innloggede kan lese dem, siden hver versjon
-- er noe som har vært publisert. Lesefunksjonene kjører med eierens
-- rettigheter fordi hjelperne står i `intern`; de gir bare revisjoner som
-- står i et manifest, og de har alle vært publisert.
create function public.les_sideversjoner(stoff text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'nr', v.nr,
      'opphav', v.opphav,
      'opprettet_kl', v.opprettet_kl,
      'fingeravtrykk', v.fingeravtrykk,
      'endring', intern.sideversjon_endring(v.endring_id),
      'antall', jsonb_build_object(
        'elementer', jsonb_array_length(v.manifest -> 'elementer'),
        'referanser', jsonb_array_length(v.manifest -> 'referanser'),
        'bivirkninger', jsonb_array_length(v.manifest -> 'bivirkninger')
      )
    ))
    order by v.nr desc
  ), '[]'::jsonb)
  from public.sideversjoner v
  join public.infosider s on s.objekt_id = v.infoside and s.tilstand = 'publisert'
  where s.slug = btrim(les_sideversjoner.stoff)
$$;

comment on function public.les_sideversjoner(text) is
  'Versjonene av fagsiden, nyeste først, uten innholdet. For alle innloggede.';

-- Én versjon av fagsiden i samme form som `les_stoff`, med innholdet slik det
-- var publisert, og hvilken versjon og hvilke bivirkningsimporter det gjelder.
-- `null` når versjonen ikke finnes.
create function public.les_sideversjon(stoff text, nr integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  versjonen public.sideversjoner;
  side_id uuid;
begin
  select s.objekt_id into side_id
  from public.infosider s
  where s.tilstand = 'publisert' and s.slug = btrim(les_sideversjon.stoff);
  if side_id is null then
    return null;
  end if;

  select v.* into versjonen
  from public.sideversjoner v
  where v.infoside = side_id and v.nr = les_sideversjon.nr;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'versjon', jsonb_strip_nulls(jsonb_build_object(
      'nr', versjonen.nr,
      'opphav', versjonen.opphav,
      'opprettet_kl', versjonen.opprettet_kl,
      'fingeravtrykk', versjonen.fingeravtrykk,
      'endring', intern.sideversjon_endring(versjonen.endring_id)
    )),
    'stoff', (
      select jsonb_build_object('id', side_id, 'slug', btrim(les_sideversjon.stoff), 'navn', r.innhold ->> 'navn')
      from public.objektrevisjoner r
      where r.objekt_id = side_id
        and r.revisjon = (versjonen.manifest -> 'infoside' ->> 'revisjon')::integer
    ),
    'infoside', intern.revisjon_som_utgave(side_id, (versjonen.manifest -> 'infoside' ->> 'revisjon')::integer),
    'elementer', coalesce(
      (
        select jsonb_agg(intern.revisjon_som_utgave((e ->> 'id')::uuid, (e ->> 'revisjon')::integer) order by e ->> 'id')
        from jsonb_array_elements(versjonen.manifest -> 'elementer') e
      ),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(intern.revisjon_som_utgave((r ->> 'id')::uuid, (r ->> 'revisjon')::integer) order by r ->> 'id')
        from jsonb_array_elements(versjonen.manifest -> 'referanser') r
      ),
      '[]'::jsonb
    ),
    'bivirkninger', versjonen.manifest -> 'bivirkninger'
  );
end;
$$;

comment on function public.les_sideversjon(text, integer) is
  'Én versjon av fagsiden i samme form som les_stoff, slik den var publisert. For alle innloggede; gir bare revisjoner som har vært publisert.';

-- --- Tilgangen -------------------------------------------------------------------

alter table public.sideversjoner enable row level security;

create policy "Innloggede leser sideversjonene"
on public.sideversjoner
for select
to authenticated
using (true);

revoke all on table public.sideversjoner from anon, authenticated, service_role;
grant select on table public.sideversjoner to authenticated, service_role;

revoke all on function public.les_sideversjoner(text) from public, anon, authenticated, service_role;
revoke all on function public.les_sideversjon(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.les_sideversjoner(text) to authenticated;
grant execute on function public.les_sideversjon(text, integer) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
