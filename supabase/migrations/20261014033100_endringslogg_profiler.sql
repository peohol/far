-- Endringsloggen viser hvem som gjorde endringen med profilbildet
-- (`docs/innholdsendringer.md`): personens egen profil, eller profilen en
-- KI-agent har fått. Kuratorboten (ChatGPT monografkurator) har sin egen
-- brukerprofil, og knyttes til den her.

create table public.agentprofiler (
  agent text primary key references public.endringsagenter (nokkel),
  profil uuid not null unique references public.profiles (id) on delete cascade
);

comment on table public.agentprofiler is
  'Brukerprofilen en agent vises med i endringsloggen: navnet står i endringsagenter, bildet i profilen. Legges inn med en migrasjon.';

alter table public.agentprofiler enable row level security;
revoke all on table public.agentprofiler from anon, authenticated;

-- Profilen kuratorboten bruker når den tester appen. Finnes den ikke (som i
-- en tom database), vises agenten uten bilde.
insert into public.agentprofiler (agent, profil)
select 'chatgpt-monografkurator', p.id from public.profiles p where p.username = 'kuratortest';

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
create or replace function public.les_endringslogg(
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

  -- Revisjonene og publiseringene som angikk siden da de ble gjort
  -- (`intern.sidens_utgaver`).
  with utgaver as materialized (
    select * from intern.sidens_utgaver(rotter, utkast, register)
  ), medlemmer as (
    select coalesce(r.endring_id::text, 'eldre:' || r.utfort_kl::text || ':' || r.utfort_av::text) as nokkel,
      r.objekt_id, r.revisjon, null::integer as forrige, false as publisering,
      r.utfort_kl, r.utfort_av, r.utfort_av_fornavn, r.utfort_av_etternavn, r.kilde, u.delt
    from utgaver u
    join public.objektrevisjoner r on r.objekt_id = u.objekt_id and r.revisjon = u.revisjon
    where u.publisering is null
    union all
    select coalesce(p.endring_id::text, 'eldre:' || p.utfort_kl::text || ':' || p.utfort_av::text),
      p.objekt_id, p.revisjon, p.forrige_revisjon, true,
      p.utfort_kl, p.utfort_av, p.utfort_av_fornavn, p.utfort_av_etternavn,
      (select r.kilde from public.objektrevisjoner r where r.objekt_id = p.objekt_id and r.revisjon = p.revisjon), u.delt
    from utgaver u
    join public.objektpubliseringer p on p.id = u.publisering
  ), samlet as (
    select m.nokkel, m.objekt_id,
      bool_or(m.publisering) as publisert,
      bool_and(m.delt) as delt,
      case when bool_or(not m.publisering) then nullif(min(m.revisjon) filter (where not m.publisering) - 1, 0)
        else (array_agg(m.forrige order by m.revisjon) filter (where m.publisering))[1] end as fra,
      coalesce(max(m.revisjon) filter (where not m.publisering), max(m.revisjon)) as til,
      min(m.utfort_kl) as kl
    from medlemmer m
    group by m.nokkel, m.objekt_id
  ), deler as (
    select s.nokkel, s.kl, o.type, s.publisert, s.delt,
      intern.endringsdel(s.objekt_id, o.type, s.fra, s.til, s.publisert, f.innhold, t.innhold)
        || case when s.delt then '{"delt": true}'::jsonb else '{}'::jsonb end as del
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
      e.id, e.aktor, e.agent, e.art, coalesce(e.utfort_av, l.utfort_av) as utfort_av, e.utfort_av_fornavn, e.utfort_av_etternavn, e.oppsummering, e.rapport,
      e.migrasjon, e.lenker,
      case when e.id is null and l.kilde is not null then 'system' when e.id is null then 'bruker' else e.aktor end as hvem,
      l.fornavn as eldre_fornavn, l.etternavn as eldre_etternavn, l.kilde as eldre_kilde,
      -- Bare endringer i delte referanser og kommentarer: hva endringen ellers
      -- gjaldt (som en kuratering av en annen fagside), hører ikke til siden.
      not exists (select 1 from deler d where d.nokkel = n.nokkel and not d.delt)
        and not exists (select 1 from hendelser h where h.nokkel = n.nokkel) as bare_delt
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
      'art', case when v.bare_delt then 'redigering' else coalesce(v.art, 'redigering') end,
      'delt', case when v.bare_delt then true end,
      'agent', case
        when v.agent is not null then (select jsonb_build_object('nokkel', a.nokkel, 'navn', a.navn, 'art', a.art, 'beskrivelse', a.beskrivelse, 'rutine', a.rutine)
          from public.endringsagenter a where a.nokkel = v.agent)
        when v.id is null and v.eldre_kilde is not null then (select jsonb_build_object('nokkel', a.nokkel, 'navn', a.navn, 'art', a.art, 'beskrivelse', a.beskrivelse, 'rutine', a.rutine)
          from public.endringsagenter a where a.nokkel = 'databasemigrasjon') end,
      -- Profilen og profilbildet: personens, eller agentens egen profil.
      'profil', (select jsonb_build_object('id', p.id, 'username', p.username, 'first_name', p.first_name,
          'last_name', p.last_name, 'avatar_path', p.avatar_path, 'updated_at', p.updated_at)
        from public.profiles p
        where p.id = case
          when v.agent is not null then (select ap.profil from public.agentprofiler ap where ap.agent = v.agent)
          when v.hvem = 'bruker' then v.utfort_av end),
      'person', case when coalesce(v.utfort_av_fornavn, v.eldre_fornavn) is not null then jsonb_build_object(
        'fornavn', coalesce(v.utfort_av_fornavn, v.eldre_fornavn), 'etternavn', coalesce(v.utfort_av_etternavn, v.eldre_etternavn)) end,
      'oppsummering', case when not v.bare_delt then coalesce(v.oppsummering, v.eldre_kilde) end,
      'rapport', case when not v.bare_delt then v.rapport end,
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
