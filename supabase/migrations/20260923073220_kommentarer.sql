-- Fortolkningskommentarene: teksten som limes inn i pasientsvaret, som egne
-- redigerbare objekter med utkast, publisering, revisjoner og gjenoppretting.
--
-- Kommentar og regel er ulike objekter (docs/analyttsider-og-redigering.md,
-- avsnitt 10). En kommentar er teksten; reglene i hver regeltype peker på den
-- med ID-en, i en koblingskolonne med intern.krev_objekttype for 'kommentar'.
-- Den samme kontrollen gjør at et regelsett ikke kan publiseres før
-- kommentarene det peker på er publisert. Samme kommentar kan brukes av flere
-- regler og regelsett, og en tekst rettes ett sted.
--
-- Plassholderne er de navngitte hullene en regeltype fyller inn når
-- kommentaren settes sammen, for eksempel {nivå}. Teksten må bruke nøyaktig
-- de plassholderne kommentaren oppgir, og de kan ikke endres etter at
-- kommentaren er opprettet. En regeltype som har godtatt en kommentar, kan
-- derfor stole på den også etter senere endringer av teksten. Vanlige
-- kommentarer har ingen.
--
-- De samme reglene står i src/domain/kommentarobjekt.ts, slik at redigeringen
-- kan si fra før lagring. Bakgrunnen står i docs/faginnhold.md.

-- --- Tabellen --------------------------------------------------------------

create table public.kommentarer (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  navn text not null,
  tekst text not null,
  plassholdere text[] not null,
  constraint kommentarer_pkey primary key (objekt_id, tilstand),
  constraint kommentarer_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint kommentarer_navn check (char_length(navn) between 1 and 200 and navn = btrim(navn)),
  constraint kommentarer_tekst check (
    char_length(tekst) between 1 and 4000 and tekst = btrim(tekst) and tekst !~ '[\r\n]'
  )
);

comment on table public.kommentarer is
  'Fortolkningskommentarene: ren tekst på én linje, som den limes inn i laboratoriesystemet. Reglene peker på dem med objekt-ID-en.';
comment on column public.kommentarer.navn is
  'Hva kommentaren er, slik redigeringen viser den. Følger ikke med i pasientsvaret.';
comment on column public.kommentarer.plassholdere is
  'Plassholderne teksten bruker, som {nivå}, sortert. Nøyaktig de som står i teksten, og de samme i alle revisjoner.';

create trigger kommentarer_objekttype
before insert or update on public.kommentarer
for each row execute function intern.krev_objekttype('objekt_id', 'kommentar');

-- --- Skriving og lesing -----------------------------------------------------

-- Plassholderne i en tekst: alt mellom { og }, uten gjentakelser, sortert.
create function intern.plassholdere_i(p_tekst text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct m[1] collate "C" order by m[1] collate "C"), array[]::text[])
  from regexp_matches(p_tekst, '(\{[^{}]*\})', 'g') as m
$$;

create function intern.skriv_kommentar(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  navn text;
  tekst text;
  oppgitt jsonb;
  plassholdere text[];
  brukte text[];
  tidligere text[];
  avvik text;
begin
  perform intern.krev_felt(p_innhold, array['navn', 'tekst', 'plassholdere']);

  navn := intern.tekst(p_innhold, 'navn');
  if navn = '' then
    raise exception 'Kommentaren mangler navn.' using errcode = '22023';
  end if;
  if char_length(navn) > 200 then
    raise exception 'Navnet på kommentaren kan ha høyst 200 tegn.' using errcode = '22023';
  end if;

  -- Teksten lagres slik den står: den limes inn som den er.
  if jsonb_typeof(p_innhold -> 'tekst') is distinct from 'string' then
    raise exception 'Feltet tekst må være tekst.' using errcode = '22023';
  end if;
  tekst := p_innhold ->> 'tekst';
  if btrim(tekst) = '' then
    raise exception 'Kommentaren mangler tekst.' using errcode = '22023';
  end if;
  if tekst <> btrim(tekst) then
    raise exception 'Kommentarteksten begynner eller slutter med mellomrom.' using errcode = '22023';
  end if;
  if tekst ~ '[\r\n]' then
    raise exception 'Kommentarteksten må stå på én linje.' using errcode = '22023';
  end if;
  if char_length(tekst) > 4000 then
    raise exception 'Kommentarteksten kan ha høyst 4000 tegn.' using errcode = '22023';
  end if;

  oppgitt := p_innhold -> 'plassholdere';
  if jsonb_typeof(oppgitt) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(oppgitt) e where jsonb_typeof(e) <> 'string')
  then
    raise exception 'Feltet plassholdere må være en liste med tekst.' using errcode = '22023';
  end if;
  plassholdere := array(select jsonb_array_elements_text(oppgitt));
  if exists (select 1 from unnest(plassholdere) p where p !~ '^\{[^{}\s]([^{}]*[^{}\s])?\}$') then
    raise exception 'En plassholder skrives som et navn i krøllparenteser, for eksempel {nivå}.'
      using errcode = '22023';
  end if;
  if cardinality(plassholdere) <> (select count(distinct p) from unnest(plassholdere) p) then
    raise exception 'Samme plassholder er oppgitt flere ganger.' using errcode = '22023';
  end if;
  plassholdere := array(select p from unnest(plassholdere) p order by p collate "C");

  brukte := intern.plassholdere_i(tekst);
  select string_agg(p, ', ' order by p collate "C") into avvik
  from unnest(brukte) p where p <> all (plassholdere);
  if avvik is not null then
    raise exception 'Kommentarteksten har plassholdere som ikke er oppgitt: %.', avvik using errcode = '22023';
  end if;
  select string_agg(p, ', ' order by p collate "C") into avvik
  from unnest(plassholdere) p where p <> all (brukte);
  if avvik is not null then
    raise exception 'Kommentarteksten mangler plassholderne den oppgir: %.', avvik using errcode = '22023';
  end if;
  if regexp_replace(tekst, '\{[^{}]*\}', '', 'g') ~ '[{}]' then
    raise exception 'Kommentarteksten har en krøllparentes som ikke hører til en plassholder.'
      using errcode = '22023';
  end if;

  -- Plassholderne er de samme i alle revisjoner. Utkastet finnes alltid når
  -- kommentaren først er opprettet, så det holder å se på radene.
  select k.plassholdere into tidligere
  from public.kommentarer k
  where k.objekt_id = p_objekt
  limit 1;
  if found and tidligere is distinct from plassholdere then
    raise exception 'Plassholderne i en kommentar kan ikke endres. Lag en ny kommentar i stedet.'
      using errcode = '22023';
  end if;

  insert into public.kommentarer (objekt_id, tilstand, navn, tekst, plassholdere)
  values (p_objekt, p_tilstand, navn, tekst, plassholdere)
  on conflict on constraint kommentarer_pkey do update set
    navn = excluded.navn,
    tekst = excluded.tekst,
    plassholdere = excluded.plassholdere;
end;
$$;

-- Øyeblikksbildet, på samme form som Kommentarinnhold i
-- src/domain/kommentarobjekt.ts.
create function intern.les_kommentar(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('navn', k.navn, 'tekst', k.tekst, 'plassholdere', to_jsonb(k.plassholdere))
  from public.kommentarer k
  where k.objekt_id = p_objekt and k.tilstand = p_tilstand
$$;

-- --- Lesingen appen gjør ---------------------------------------------------

create function public.les_kommentarer(kommentartilstand public.objekttilstand, ider uuid[] default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.utgave_som_json(u) order by u.objekt_id), '[]'::jsonb)
  from public.objektutgaver u
  join public.redigerbare_objekter o on o.id = u.objekt_id
  where o.type = 'kommentar'
    and u.tilstand = kommentartilstand
    and (ider is null or u.objekt_id = any (ider))
$$;

comment on function public.les_kommentarer(public.objekttilstand, uuid[]) is
  'Kommentarene i én tilstand — alle, eller bare de med disse ID-ene — med revisjonene de står på. Radsikkerheten gjelder.';

-- --- Radsikkerhet og rettigheter -------------------------------------------

alter table public.kommentarer enable row level security;

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.kommentarer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

revoke all on table public.kommentarer from anon, authenticated, service_role;
grant select on table public.kommentarer to authenticated, service_role;

revoke all on function public.les_kommentarer(public.objekttilstand, uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.les_kommentarer(public.objekttilstand, uuid[]) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;