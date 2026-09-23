-- Lesingen analyttsidene bygger på: hele siden for en analyttkode i ett kall,
-- referansebasen, og informasjonssidene med gitte navn.
--
-- Alt her kjører med rettighetene til den som leser (security invoker), så
-- radsikkerheten gjelder som ellers: en vanlig bruker får bare det publiserte,
-- og ber hen om utkastet, får hen ingenting. Ingenting her skriver; endringene
-- går fortsatt bare gjennom funksjonene i fundamentet.
--
-- Hvert objekt kommer tilbake på samme form: ID-en, revisjonen tilstanden
-- peker på, øyeblikksbildet i den revisjonen (`innhold`, samme form som
-- lagre_utkast tar imot), den publiserte revisjonen, og hvem som gjorde
-- endringen og når. Bakgrunnen står i docs/faginnhold.md.

-- --- Utgavene --------------------------------------------------------------

-- Hvert objekt i hver tilstand det har, med øyeblikksbildet tilstanden peker
-- på. Visningen er grunnlaget for funksjonene under, og kan leses direkte.
create view public.objektutgaver
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
  r.utfort_kl as endret_kl
from public.objekttilstander t
join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
left join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert';

comment on view public.objektutgaver is
  'Hvert objekt i hver tilstand, med øyeblikksbildet tilstanden peker på og hvem som laget det. Radsikkerheten gjelder.';

-- Én utgave som JSON, slik funksjonene under gir den tilbake.
create function public.utgave_som_json(u public.objektutgaver)
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
  )
$$;

-- --- Analyttsiden ----------------------------------------------------------

-- Hele analyttsiden for en analyttkode: laboratorieanalytten, hovedsiden,
-- innholdselementene på den, komponentsidene med kodene som har dem som
-- hovedside, og referansene siden siterer. `null` når koden ikke har noen
-- side i den tilstanden.
create function public.les_analyttside(analyttkode text, sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with utgaver as (
    select u.objekt_id, public.utgave_som_json(u) as json
    from public.objektutgaver u
    where u.tilstand = sidetilstand
  ),
  analytt as (
    select a.objekt_id, a.hovedside_id
    from public.laboratorieanalytter a
    where a.kode = analyttkode and a.tilstand = sidetilstand
  ),
  elementer as (
    select e.objekt_id
    from public.innholdselementer e
    join analytt on e.infoside_id = analytt.hovedside_id
    where e.tilstand = sidetilstand
  ),
  komponenter as (
    select k.infoside_id, k.posisjon
    from public.analyttkomponenter k
    join analytt on k.analytt_id = analytt.objekt_id
    where k.tilstand = sidetilstand
  ),
  referanser as (
    select distinct k.referanse_id
    from public.referansekoblinger k
    where k.tilstand = sidetilstand
      and k.objekt_id in (
        select hovedside_id from analytt
        union all
        select objekt_id from elementer
      )
  )
  select jsonb_build_object(
    'analytt', (select u.json from utgaver u where u.objekt_id = analytt.objekt_id),
    'infoside', (select u.json from utgaver u where u.objekt_id = analytt.hovedside_id),
    'elementer', coalesce(
      (
        select jsonb_agg(u.json order by u.objekt_id)
        from elementer e
        join utgaver u on u.objekt_id = e.objekt_id
      ),
      '[]'::jsonb
    ),
    'komponenter', coalesce(
      (
        select jsonb_agg(
          u.json || jsonb_build_object(
            'koder', coalesce(
              (
                select jsonb_agg(a.kode order by a.kode)
                from public.laboratorieanalytter a
                where a.hovedside_id = k.infoside_id and a.tilstand = sidetilstand
              ),
              '[]'::jsonb
            )
          )
          order by k.posisjon
        )
        from komponenter k
        join utgaver u on u.objekt_id = k.infoside_id
      ),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(u.json order by u.objekt_id)
        from referanser r
        join utgaver u on u.objekt_id = r.referanse_id
      ),
      '[]'::jsonb
    )
  )
  from analytt
$$;

comment on function public.les_analyttside(text, public.objekttilstand) is
  'Hele analyttsiden for en analyttkode i én tilstand, med revisjonene objektene står på. Radsikkerheten gjelder.';

-- --- Referansebasen --------------------------------------------------------

-- Hele referansebasen i én tilstand, til å velge kilder fra. Arkiverte
-- referanser er med; appen avgjør hva den viser.
create function public.les_referanser(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.utgave_som_json(u) order by u.objekt_id), '[]'::jsonb)
  from public.objektutgaver u
  join public.redigerbare_objekter o on o.id = u.objekt_id
  where u.tilstand = sidetilstand and o.type = 'referanse'
$$;

comment on function public.les_referanser(public.objekttilstand) is
  'Alle referansene i én tilstand, med revisjonene de står på. Radsikkerheten gjelder.';

-- --- Informasjonssider etter navn ------------------------------------------

-- Informasjonssidene med disse navnene, uten hensyn til store og små
-- bokstaver. Brukes når en side opprettes, så en side som alt finnes — for
-- eksempel som komponent i en sumanalyse — gjenbrukes i stedet for å lages
-- på nytt.
create function public.finn_infosider(navn text[], sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.utgave_som_json(u) order by s.navn), '[]'::jsonb)
  from public.infosider s
  join public.objektutgaver u on u.objekt_id = s.objekt_id and u.tilstand = s.tilstand
  where s.tilstand = sidetilstand
    and lower(s.navn) in (select lower(n) from unnest(finn_infosider.navn) n)
$$;

comment on function public.finn_infosider(text[], public.objekttilstand) is
  'Informasjonssidene med de oppgitte navnene i én tilstand. Radsikkerheten gjelder.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on table public.objektutgaver from anon, authenticated, service_role;
grant select on table public.objektutgaver to authenticated, service_role;

revoke all on function
  public.utgave_som_json(public.objektutgaver),
  public.les_analyttside(text, public.objekttilstand),
  public.les_referanser(public.objekttilstand),
  public.finn_infosider(text[], public.objekttilstand)
from public, anon, authenticated, service_role;

grant execute on function
  public.utgave_som_json(public.objektutgaver),
  public.les_analyttside(text, public.objekttilstand),
  public.les_referanser(public.objekttilstand),
  public.finn_infosider(text[], public.objekttilstand)
to authenticated;
