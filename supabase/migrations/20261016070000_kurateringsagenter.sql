-- Fase E av kurateringsgrenene (docs/kurateringsgrener.md, «Agentene» og
-- «Følg agenten»):
--
-- * Handlingene står i en tabell, så en ny handling er én rad og ikke en ny
--   utgave av hele lista.
-- * `status`: den lille statusen appen spør etter når «Følg agenten» er på —
--   revisjonen, statusen og hva agenten holder på med, uten fagtekst.
-- * Claude-monografkuratoren får nøkkelen sin. Bare SHA-256 av den står her;
--   selve nøkkelen ligger utenfor repoet, hos Claude-øktene i prosjektet. En
--   administrator lager en ny med `ny_agentnokkel` (Kurateringer → Agentene)
--   hvis den kan ha kommet på avveie.

create table kuratering.handlingsliste (
  handling text primary key,
  admin boolean not null,
  agent boolean not null,
  constraint handlingsliste_navn check (handling ~ '^[a-z_]{2,40}$'),
  constraint handlingsliste_noen check (admin or agent)
);

comment on table kuratering.handlingsliste is
  'Handlingene i kurateringsgrenene og hvem som har dem: administratorene, agentene eller begge. Hver har funksjonen kuratering.h_<handling>.';

insert into kuratering.handlingsliste (handling, admin, agent)
select h, h = any (kuratering.handlinger(true)), h = any (kuratering.handlinger(false))
from unnest(kuratering.handlinger(true) || kuratering.handlinger(false)) h
group by h;

insert into kuratering.handlingsliste (handling, admin, agent) values ('status', true, true);

create or replace function kuratering.handlinger(p_admin boolean)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(h.handling order by h.handling), '{}')
  from kuratering.handlingsliste h
  where case when p_admin then h.admin else h.agent end
$$;

-- Statusen til en gren ({gren}), for den som kan lese den. Ingen fagtekst:
-- bare det appen trenger for å vite om noe er nytt, og hva agenten gjør.
create function kuratering.h_status(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  if coalesce(p_data ->> 'gren', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Grenen mangler.' using errcode = '22023';
  end if;
  select x.* into g from kuratering.grener x where x.id = (p_data ->> 'gren')::uuid;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  perform kuratering.krev_leser(p_aktor, g);
  return jsonb_strip_nulls(jsonb_build_object(
    'id', g.id,
    'status', g.status,
    'revisjon', g.revisjon,
    'runde', g.runde,
    'blindfase', g.blindfase,
    'aktivitet', g.aktivitet,
    'oppdatert_kl', g.oppdatert_kl,
    -- Sist kuratoren gjorde noe i nettopp denne grenen (en revisjon, en
    -- kommentar, et dokument, en aktivitet), ikke i en annen gren den har.
    'kurator_sist_kl', greatest(
      (select max(h.kl) from kuratering.hendelser h where h.gren = g.id and h.agent = g.kurator),
      (select max(r.opprettet_kl) from kuratering.grenrevisjoner r where r.gren = g.id and r.agent = g.kurator)
    ),
    'apne_sperrer', (
      select count(*) from jsonb_array_elements(kuratering.traader(g)) t
      where t ->> 'status' = 'apen' and t ->> 'art' = 'sperrende'
    )
  ));
end;
$$;

update kuratering.agenter
set nokkel_sha256 = '6d0b142b8564d7b7b7222b5aaa8e93f431b2d157ef63070c42fc36f0779ace5f', nokkel_kl = now(), aktiv = true
where agent = 'claude-monografkurator';

revoke all on all tables in schema kuratering from public, anon, authenticated, service_role;
revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
