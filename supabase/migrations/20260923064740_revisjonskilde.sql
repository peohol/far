-- Hvor innholdet i en revisjon kom fra, når det ikke ble skrevet i appen.
--
-- Innhold som legges inn fra en kilde — første gang fra Psykofarmaka.pdf og
-- Felleskatalogen — skal kunne spores tilbake dit fra historikken: «Importert
-- fra Psykofarmaka.pdf, side 7». Det står i revisjonen, ved siden av hvem som
-- gjorde endringen, og følger den like uforanderlig.
--
-- Appen setter aldri kilden. Den settes bare av en import som kjører med
-- databasens egne rettigheter, med innstillingen `far.revisjonskilde` for
-- transaksjonen; data-API-et har ingen vei til å sette den. Alt annet går
-- gjennom de vanlige funksjonene, med de samme kontrollene som i appen.
-- Bakgrunnen står i docs/faginnhold.md.

alter table public.objektrevisjoner
  add column kilde text,
  add constraint objektrevisjoner_kilde check (
    kilde is null or (char_length(kilde) between 1 and 300 and kilde = btrim(kilde))
  );

comment on column public.objektrevisjoner.kilde is
  'Hvor innholdet kom fra når det ikke ble skrevet i appen, f.eks. «Importert fra Psykofarmaka.pdf, side 7». Tom for vanlige endringer.';

-- Som før, men med kilden fra transaksjonens innstilling når den er satt.
create or replace function intern.ny_revisjon(
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
    utfort_av, utfort_av_fornavn, utfort_av_etternavn, kilde
  )
  values (
    p_objekt, ny, p_handling, p_innhold, p_gjenopprettet_fra,
    p_forfatter.id, p_forfatter.first_name, p_forfatter.last_name,
    nullif(btrim(current_setting('far.revisjonskilde', true)), '')
  );

  insert into public.objekttilstander (objekt_id, tilstand, revisjon)
  values (p_objekt, 'utkast', ny)
  on conflict on constraint objekttilstander_pkey
  do update set revisjon = excluded.revisjon, endret_kl = now();
end;
$$;

-- --- Kilden der revisjonene leses ------------------------------------------

create or replace view public.objekthistorikk
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
  r.utfort_kl,
  r.kilde
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
  p.utfort_kl,
  null::text
from public.objektpubliseringer p;

create or replace view public.objektutgaver
with (security_invoker = true)
as
select
  t.objekt_id,
  t.tilstand,
  t.revisjon,
  p.revisjon as publisert_revisjon,
  r.innhold,
  r.utfort_av_fornavn as endret_av_fornavn,
  r.utfort_av_etternavn as endret_av_etternavn,
  r.utfort_kl as endret_kl,
  r.kilde
from public.objekttilstander t
join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
left join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert';

-- Kilden står bare med når den finnes, så utgavene fra appen har samme form
-- som før.
create or replace function public.utgave_som_json(u public.objektutgaver)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', u.objekt_id,
    'revisjon', u.revisjon,
    'publisert_revisjon', u.publisert_revisjon,
    'innhold', u.innhold,
    'endret_av_fornavn', u.endret_av_fornavn,
    'endret_av_etternavn', u.endret_av_etternavn,
    'endret_kl', u.endret_kl
  ) || case when u.kilde is null then '{}'::jsonb else jsonb_build_object('kilde', u.kilde) end
$$;
