-- Scenarioregelsett: fortolkningsreglene for analytter som vurderes samlet,
-- som diazepam, N-desmetyldiazepam og oksazepam.
--
-- Bygger på fundamentet for redigerbart faginnhold og på kommentarene. Et
-- regelsett er ett objekt, med utkast, publisering, revisjoner og
-- gjenoppretting som alt annet faginnhold. Hele regelsettet står i hvert
-- øyeblikksbilde, så en gjenoppretting gjenoppretter alle reglene på én gang.
--
-- Modellen og reglene står i docs/scenarioregler.md, og er de samme som i
-- src/domain/scenario.ts. Kort fortalt:
--
--   * Regelsettet gjelder en fortolkningsmodul og dens analyttkoder. En kode
--     hører til høyst ett regelsett.
--   * Et scenario sier nøyaktig hvilke analytter som er påvist, hvilke
--     forholdstall som må ligge over eller under hvilke grenser, og utfallet:
--     kommentarer plassert på bestemte koder, eller en manuell vurdering.
--   * Grensene er navngitte parametere, så en grense mellom to scenarier er
--     ett tall.
--   * Kommentarene er egne objekter (public.kommentarer). Scenariene peker på
--     dem med objekt-ID-en og eier ikke tekstene: kommentar og regel er
--     separate objekter. Scenarioreglene limer inn teksten slik den står, og
--     godtar ikke kommentarer med plassholdere. Et publisert regelsett kan
--     bare peke på publiserte kommentarer.
--   * Valideringen gjøres her, før noe lagres, og avviser et regelsett som har
--     hull eller overlapp: hver kombinasjon av påviste analytter og
--     forholdstall skal gi nøyaktig ett scenario. Meldingene er de samme som
--     appen viser.

-- --- Tabellene -------------------------------------------------------------

create table public.scenarioregelsett (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  modul text not null,
  verdihjelp text not null,
  constraint scenarioregelsett_pkey primary key (objekt_id, tilstand),
  constraint scenarioregelsett_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint scenarioregelsett_modul check (
    char_length(modul) <= 60 and modul ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint scenarioregelsett_verdihjelp check (
    char_length(verdihjelp) <= 2000 and verdihjelp = btrim(verdihjelp)
  )
);

create unique index scenarioregelsett_modul_idx on public.scenarioregelsett (tilstand, modul);

comment on table public.scenarioregelsett is
  'Fortolkningsreglene for en modul der analyttene vurderes samlet. Delene står i tabellene som begynner på scenario.';

create table public.scenarioanalytter (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  kode text not null,
  posisjon integer not null,
  constraint scenarioanalytter_pkey primary key (objekt_id, tilstand, kode),
  constraint scenarioanalytter_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.scenarioregelsett (objekt_id, tilstand) on delete cascade,
  constraint scenarioanalytter_posisjon unique (objekt_id, tilstand, posisjon),
  constraint scenarioanalytter_kode check (
    char_length(kode) <= 32 and kode ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
  )
);

-- En analyttkode fortolkes av høyst ett regelsett.
create unique index scenarioanalytter_kode_idx on public.scenarioanalytter (tilstand, kode);

comment on table public.scenarioanalytter is
  'Analyttkodene regelsettet gjelder, i den rekkefølgen de vises. En kode hører til høyst ett regelsett.';

create table public.scenarioforhold (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nokkel text not null,
  posisjon integer not null,
  nullmelding text not null,
  constraint scenarioforhold_pkey primary key (objekt_id, tilstand, nokkel),
  constraint scenarioforhold_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.scenarioregelsett (objekt_id, tilstand) on delete cascade,
  constraint scenarioforhold_posisjon unique (objekt_id, tilstand, posisjon),
  constraint scenarioforhold_nokkel check (nokkel ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  constraint scenarioforhold_nullmelding check (
    char_length(nullmelding) between 1 and 2000 and nullmelding = btrim(nullmelding)
  )
);

comment on table public.scenarioforhold is
  'Et forholdstall: summen av konsentrasjonene i telleren delt på summen i nevneren. Nullmeldingen vises når nevneren er 0.';

create table public.scenarioforholdsledd (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  forhold text not null,
  kode text not null,
  del text not null,
  posisjon integer not null,
  -- Én kode står bare ett sted i et forhold: i telleren eller i nevneren.
  constraint scenarioforholdsledd_pkey primary key (objekt_id, tilstand, forhold, kode),
  constraint scenarioforholdsledd_forhold_fkey
    foreign key (objekt_id, tilstand, forhold)
    references public.scenarioforhold (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenarioforholdsledd_kode_fkey
    foreign key (objekt_id, tilstand, kode)
    references public.scenarioanalytter (objekt_id, tilstand, kode) on delete cascade,
  constraint scenarioforholdsledd_posisjon unique (objekt_id, tilstand, forhold, del, posisjon),
  constraint scenarioforholdsledd_del check (del in ('teller', 'nevner'))
);

create table public.scenarioparametere (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nokkel text not null,
  posisjon integer not null,
  navn text not null,
  verdi numeric not null,
  constraint scenarioparametere_pkey primary key (objekt_id, tilstand, nokkel),
  constraint scenarioparametere_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.scenarioregelsett (objekt_id, tilstand) on delete cascade,
  constraint scenarioparametere_posisjon unique (objekt_id, tilstand, posisjon),
  constraint scenarioparametere_nokkel check (nokkel ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  constraint scenarioparametere_navn check (char_length(navn) between 1 and 200 and navn = btrim(navn)),
  constraint scenarioparametere_verdi check (verdi > 0 and verdi < 1000000)
);

comment on table public.scenarioparametere is
  'En navngitt grense for et forholdstall, som andel: 0.1 er 10 %. Tekstene i regelsettet viser den med {nøkkel}.';

create table public.scenarier (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nokkel text not null,
  posisjon integer not null,
  utfall text not null,
  melding text,
  constraint scenarier_pkey primary key (objekt_id, tilstand, nokkel),
  constraint scenarier_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.scenarioregelsett (objekt_id, tilstand) on delete cascade,
  constraint scenarier_posisjon unique (objekt_id, tilstand, posisjon),
  constraint scenarier_nokkel check (nokkel ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  constraint scenarier_utfall check (utfall in ('kommentarer', 'manuell')),
  -- En manuell vurdering har en melding og ingen kommentarer.
  constraint scenarier_melding check (
    (utfall = 'manuell') = (melding is not null)
    and (melding is null or (char_length(melding) between 1 and 2000 and melding = btrim(melding)))
  )
);

comment on table public.scenarier is
  'Ett scenario: nøyaktig de påviste analyttene, vilkårene på forholdstallene og utfallet.';

create table public.scenariopavist (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  scenario text not null,
  kode text not null,
  constraint scenariopavist_pkey primary key (objekt_id, tilstand, scenario, kode),
  constraint scenariopavist_scenario_fkey
    foreign key (objekt_id, tilstand, scenario)
    references public.scenarier (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenariopavist_kode_fkey
    foreign key (objekt_id, tilstand, kode)
    references public.scenarioanalytter (objekt_id, tilstand, kode) on delete cascade
);

comment on table public.scenariopavist is
  'De påviste analyttene i et scenario. Modulens andre analytter er ikke påvist.';

create table public.scenariovilkar (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  scenario text not null,
  posisjon integer not null,
  forhold text not null,
  operator text not null,
  parameter text not null,
  constraint scenariovilkar_pkey primary key (objekt_id, tilstand, scenario, posisjon),
  constraint scenariovilkar_scenario_fkey
    foreign key (objekt_id, tilstand, scenario)
    references public.scenarier (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenariovilkar_forhold_fkey
    foreign key (objekt_id, tilstand, forhold)
    references public.scenarioforhold (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenariovilkar_parameter_fkey
    foreign key (objekt_id, tilstand, parameter)
    references public.scenarioparametere (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenariovilkar_operator check (operator in ('<', '<=', '>', '>='))
);

comment on table public.scenariovilkar is
  'Et vilkår i et scenario: forholdstallet sammenlignet med en grense. Alle vilkårene må holde.';

create table public.scenarioplasseringer (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  scenario text not null,
  posisjon integer not null,
  rolle text not null,
  merke text not null,
  kommentar_id uuid not null,
  constraint scenarioplasseringer_pkey primary key (objekt_id, tilstand, scenario, posisjon),
  constraint scenarioplasseringer_scenario_fkey
    foreign key (objekt_id, tilstand, scenario)
    references public.scenarier (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenarioplasseringer_kommentar_fkey
    foreign key (kommentar_id) references public.redigerbare_objekter (id),
  constraint scenarioplasseringer_merke_entydig unique (objekt_id, tilstand, scenario, merke),
  constraint scenarioplasseringer_rolle check (rolle in ('hoved', 'tillegg')),
  constraint scenarioplasseringer_merke check (char_length(merke) between 1 and 200 and merke = btrim(merke))
);

create index scenarioplasseringer_kommentar_idx
  on public.scenarioplasseringer (kommentar_id);

-- Kommentaren er en kommentar, og det publiserte regelsettet peker bare på
-- publiserte kommentarer: kommentarene publiseres før regelsettet.
create trigger scenarioplasseringer_kommentar
before insert or update on public.scenarioplasseringer
for each row execute function intern.krev_objekttype('kommentar_id', 'kommentar');

comment on table public.scenarioplasseringer is
  'En kommentar i et scenarios utfall: hovedkommentar eller tilleggskommentar, med merket som vises og kommentaren som kopieres.';

create table public.scenarioplasseringskoder (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  scenario text not null,
  plassering integer not null,
  posisjon integer not null,
  kode text not null,
  -- Hver påvist analytt får høyst én kommentar i et scenario, og bare de
  -- påviste får noen.
  constraint scenarioplasseringskoder_pkey primary key (objekt_id, tilstand, scenario, kode),
  constraint scenarioplasseringskoder_plassering_fkey
    foreign key (objekt_id, tilstand, scenario, plassering)
    references public.scenarioplasseringer (objekt_id, tilstand, scenario, posisjon) on delete cascade,
  constraint scenarioplasseringskoder_pavist_fkey
    foreign key (objekt_id, tilstand, scenario, kode)
    references public.scenariopavist (objekt_id, tilstand, scenario, kode) on delete cascade,
  constraint scenarioplasseringskoder_posisjon unique (objekt_id, tilstand, scenario, plassering, posisjon)
);

comment on table public.scenarioplasseringskoder is
  'Analyttkodene en kommentar limes inn på, i rekkefølge.';

create table public.scenariotekster (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  scenario text not null,
  art text not null,
  posisjon integer not null,
  tekst text not null,
  constraint scenariotekster_pkey primary key (objekt_id, tilstand, scenario, art, posisjon),
  constraint scenariotekster_scenario_fkey
    foreign key (objekt_id, tilstand, scenario)
    references public.scenarier (objekt_id, tilstand, nokkel) on delete cascade,
  constraint scenariotekster_art check (art in ('notis', 'veiledning')),
  constraint scenariotekster_tekst check (char_length(tekst) between 1 and 4000 and tekst = btrim(tekst))
);

comment on table public.scenariotekster is
  'Notisene som vises over kommentarene, og veiledningen ved en manuell vurdering. Kopieres ikke.';

-- --- Vakter ----------------------------------------------------------------

create trigger scenarioregelsett_objekttype
before insert or update on public.scenarioregelsett
for each row execute function intern.krev_objekttype('objekt_id', 'scenarioregelsett');

-- --- Lesing av det som sendes inn ------------------------------------------

-- intern.liste og intern.tall er felles lesehjelpere som regelsettene for
-- konsentrasjonsbånd og THC-syre også definerer, med nøyaktig samme innhold.
-- De skrives derfor med «or replace», så rekkefølgen migrasjonene kjøres i
-- ikke spiller noen rolle.

-- En liste fra innholdet, som JSON.
create or replace function intern.liste(p_innhold jsonb, p_felt text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'array' then
    raise exception 'Feltet % må være en liste.', p_felt using errcode = '22023';
  end if;
  return p_innhold -> p_felt;
end;
$$;

-- En liste med tekster, i rekkefølge. Gjentakelser og tomme tekster tas med,
-- så valideringen kan melde fra om dem.
create function intern.tekstliste(p_innhold jsonb, p_felt text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  liste jsonb := intern.liste(p_innhold, p_felt);
begin
  if exists (select 1 from jsonb_array_elements(liste) e where jsonb_typeof(e) <> 'string') then
    raise exception 'Feltet % må være en liste med tekster.', p_felt using errcode = '22023';
  end if;
  return array(select e from jsonb_array_elements_text(liste) with ordinality as x(e, nr) order by nr);
end;
$$;

-- Teksten slik den ble sendt, uten å trimme den — valideringen avviser
-- mellomrom i endene i stedet for å fjerne dem i stillhet.
create function intern.ra_tekst(p_innhold jsonb, p_felt text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'string' then
    raise exception 'Feltet % må være tekst.', p_felt using errcode = '22023';
  end if;
  return p_innhold ->> p_felt;
end;
$$;

-- Et tall fra innholdet, uten etterfølgende nuller.
create or replace function intern.tall(p_innhold jsonb, p_felt text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'number' then
    raise exception 'Feltet % må være et tall.', p_felt using errcode = '22023';
  end if;
  return trim_scale((p_innhold ->> p_felt)::numeric);
end;
$$;

-- En andel som prosenttall med desimalkomma: 0.1 blir «10», 0.125 «12,5».
-- Samme som somProsent i src/domain/scenario.ts.
create function intern.som_prosent(p_andel numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select replace(trim_scale(p_andel * 100)::text, '.', ',') $$;

-- --- Valideringen ----------------------------------------------------------

-- Tekstkravene: ikke tom, ingen mellomrom i endene, og bare {nøkkel} for
-- grenser som finnes.
create function intern.scenariotekstfeil(p_tekst text, p_hva text, p_parametere text[])
returns setof text
language sql
immutable
set search_path = ''
as $$
  select p_hva || ' mangler eller har mellomrom i endene.'
  where btrim(p_tekst) = '' or p_tekst <> btrim(p_tekst)
  union all
  select format('%s viser til ukjent grense {%s}.', p_hva, m[1])
  from regexp_matches(p_tekst, '\{([a-z0-9_]+)\}', 'g') as m
  where m[1] <> all (p_parametere)
$$;

-- Stedene på tallinjen der et forholdstall kan gi et annet utfall: 0, hver
-- grense, et punkt mellom grensene og ett over den høyeste. Samme som
-- provepunkter i src/domain/scenario.ts.
create function intern.provepunkter(p_grenser numeric[])
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  punkter numeric[] := array[0::numeric];
  forrige numeric := 0;
  grense numeric;
begin
  for grense in select distinct g from unnest(p_grenser) g order by g loop
    if grense > forrige then
      punkter := punkter || ((forrige + grense) / 2);
    end if;
    punkter := punkter || grense;
    forrige := grense;
  end loop;
  punkter := punkter || (case when forrige > 0 then forrige * 2 else 1 end);
  return array(select distinct p from unnest(punkter) p order by p);
end;
$$;

-- Sant når scenariets vilkår holder for forholdstallene, gitt som
-- forhold → verdi.
create function intern.scenario_treffer(p_scenario jsonb, p_parametere jsonb, p_verdier jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
    case v ->> 'operator'
      when '<' then (p_verdier ->> (v ->> 'forhold'))::numeric < (p_parametere ->> (v ->> 'parameter'))::numeric
      when '<=' then (p_verdier ->> (v ->> 'forhold'))::numeric <= (p_parametere ->> (v ->> 'parameter'))::numeric
      when '>' then (p_verdier ->> (v ->> 'forhold'))::numeric > (p_parametere ->> (v ->> 'parameter'))::numeric
      when '>=' then (p_verdier ->> (v ->> 'forhold'))::numeric >= (p_parametere ->> (v ->> 'parameter'))::numeric
    end
  ), true)
  from jsonb_array_elements(p_scenario -> 'vilkar') v
$$;

-- At hver kombinasjon av påviste analytter og forholdstall gir nøyaktig ett
-- scenario. Forutsetter at regelsettet ellers er gyldig.
create function intern.scenariodekning(p_innhold jsonb)
returns setof text
language plpgsql
immutable
set search_path = ''
as $$
declare
  analytter text[] := intern.tekstliste(p_innhold, 'analytter');
  -- Grensene, som nøkkel → verdi.
  grenser jsonb := coalesce(
    (select jsonb_object_agg(p ->> 'nokkel', p -> 'verdi') from jsonb_array_elements(p_innhold -> 'parametere') p),
    '{}'
  );
  maske integer;
  pavist text[];
  navn text;
  kandidater jsonb;
  forhold text[];
  f text;
  kombinasjoner jsonb;
  verdier jsonb;
  treff text[];
  hvor text;
begin
  for maske in 1 .. (1 << cardinality(analytter)) - 1 loop
    pavist := array(
      select a from unnest(analytter) with ordinality as x(a, nr)
      where maske & (1 << (nr::integer - 1)) <> 0 order by nr
    );
    navn := array_to_string(pavist, ' + ');

    select coalesce(jsonb_agg(s order by nr), '[]') into kandidater
    from jsonb_array_elements(p_innhold -> 'scenarier') with ordinality as x(s, nr)
    where (select array_agg(k order by k) from jsonb_array_elements_text(s -> 'pavist') k)
      = (select array_agg(k order by k) from unnest(pavist) k);

    if jsonb_array_length(kandidater) = 0 then
      return next format('Ingen scenarier gjelder når %s er påvist.', navn);
      continue;
    end if;

    -- Forholdene scenariene bruker, i regelsettets rekkefølge.
    forhold := array(
      select fo ->> 'nokkel'
      from jsonb_array_elements(p_innhold -> 'forhold') with ordinality as x(fo, nr)
      where exists (
        select 1 from jsonb_array_elements(kandidater) s, jsonb_array_elements(s -> 'vilkar') v
        where v ->> 'forhold' = fo ->> 'nokkel'
      )
      order by nr
    );

    kombinasjoner := '[{}]';
    foreach f in array forhold loop
      select jsonb_agg(k || jsonb_build_object(f, p) order by kn, pn) into kombinasjoner
      from jsonb_array_elements(kombinasjoner) with ordinality as x(k, kn),
        unnest(intern.provepunkter(array(
          select (grenser ->> (v ->> 'parameter'))::numeric
          from jsonb_array_elements(kandidater) s, jsonb_array_elements(s -> 'vilkar') v
          where v ->> 'forhold' = f
        ))) with ordinality as y(p, pn);
    end loop;

    for verdier in select k from jsonb_array_elements(kombinasjoner) k loop
      treff := array(
        select s ->> 'nokkel'
        from jsonb_array_elements(kandidater) with ordinality as x(s, nr)
        where intern.scenario_treffer(s, grenser, verdier)
        order by nr
      );
      hvor := case when cardinality(forhold) = 0 then '' else ' og ' || (
        select string_agg(format('%s = %s %%', fo, intern.som_prosent((verdier ->> fo)::numeric)), ', ' order by nr)
        from unnest(forhold) with ordinality as x(fo, nr)
      ) end;
      if cardinality(treff) = 0 then
        return next format('Ingen scenarier gjelder når %s er påvist%s.', navn, hvor);
      elsif cardinality(treff) > 1 then
        return next format('Scenariene %s overlapper når %s er påvist%s.', array_to_string(treff, ' og '), navn, hvor);
      end if;
    end loop;
  end loop;
end;
$$;

-- Alle feilene i et regelsett, med samme meldinger som
-- validerScenarioregelsett i src/domain/scenario.ts. Formen — feltene og
-- typene — er alt kontrollert.
create function intern.scenariofeil(p_innhold jsonb)
returns setof text
language plpgsql
immutable
set search_path = ''
as $$
declare
  modul text := p_innhold ->> 'modul';
  analytter text[] := intern.tekstliste(p_innhold, 'analytter');
  parametere text[] := array(select p ->> 'nokkel' from jsonb_array_elements(p_innhold -> 'parametere') p);
  feil text[] := '{}';
  fo jsonb;
  p jsonb;
  s jsonb;
  v jsonb;
  pl jsonb;
  teller text[];
  nevner text[];
  pavist text[];
  koder text[];
  dekket text[];
  hva text;
  forholdet jsonb;
  kommentaren public.kommentarer;
begin
  if modul !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    feil := feil || format('Ugyldig modulnøkkel «%s».', modul);
  end if;
  if cardinality(analytter) = 0 then
    feil := feil || 'Regelsettet må gjelde minst én analytt.'::text;
  end if;
  if cardinality(analytter) > 6 then
    feil := feil || 'Regelsettet kan gjelde høyst seks analytter.'::text;
  end if;
  feil := feil || array(
    select format('Ugyldig analyttkode «%s».', a) from unnest(analytter) a
    where a !~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
  );
  if cardinality(analytter) <> (select count(distinct a) from unnest(analytter) a) then
    feil := feil || 'En analyttkode står to ganger.'::text;
  end if;

  if p_innhold ->> 'verdihjelp' <> '' then
    feil := feil || array(select intern.scenariotekstfeil(p_innhold ->> 'verdihjelp', 'Hjelpeteksten', parametere));
  end if;

  -- Nøklene.
  feil := feil || array(
    select format('Ugyldig nøkkel for %s: «%s».', hvilke, e ->> 'nokkel')
    from (values ('forhold', 'forhold'), ('parametere', 'grenser'), ('scenarier', 'scenarier')) as x(felt, hvilke),
      jsonb_array_elements(p_innhold -> x.felt) e
    where e ->> 'nokkel' !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
  );
  feil := feil || array(
    select format('To %s har samme nøkkel.', hvilke)
    from (values ('forhold', 'forhold'), ('parametere', 'grenser'), ('scenarier', 'scenarier')) as x(felt, hvilke)
    where (select count(*) from jsonb_array_elements(p_innhold -> x.felt))
      <> (select count(distinct e ->> 'nokkel') from jsonb_array_elements(p_innhold -> x.felt) e)
  );

  for fo in select e from jsonb_array_elements(p_innhold -> 'forhold') e loop
    hva := 'Forholdet ' || (fo ->> 'nokkel');
    teller := intern.tekstliste(fo, 'teller');
    nevner := intern.tekstliste(fo, 'nevner');
    if cardinality(teller) = 0 or cardinality(nevner) = 0 then
      feil := feil || (hva || ' må ha både teller og nevner.');
    end if;
    feil := feil || array(
      select format('%s bruker %s, som ikke hører til modulen.', hva, k)
      from unnest(teller || nevner) k where k <> all (analytter)
    );
    if teller && nevner then
      feil := feil || (hva || ' har samme analytt i teller og nevner.');
    end if;
    if cardinality(teller) <> (select count(distinct k) from unnest(teller) k)
      or cardinality(nevner) <> (select count(distinct k) from unnest(nevner) k)
    then
      feil := feil || (hva || ' har samme analytt to ganger.');
    end if;
    feil := feil || array(select intern.scenariotekstfeil(
      fo ->> 'nullmelding', format('Meldingen når nevneren i %s er 0', fo ->> 'nokkel'), parametere
    ));
  end loop;

  for p in select e from jsonb_array_elements(p_innhold -> 'parametere') e loop
    if btrim(p ->> 'navn') = '' then
      feil := feil || format('Grensen %s mangler navn.', p ->> 'nokkel');
    end if;
    if (p ->> 'verdi')::numeric <= 0 then
      feil := feil || format('Grensen %s må være et tall større enn 0.', p ->> 'nokkel');
    end if;
  end loop;

  for s in select e from jsonb_array_elements(p_innhold -> 'scenarier') e loop
    hva := 'Scenariet ' || (s ->> 'nokkel');
    pavist := intern.tekstliste(s, 'pavist');
    if cardinality(pavist) = 0 then
      feil := feil || (hva || ' må ha minst én påvist analytt.');
    end if;
    if cardinality(pavist) <> (select count(distinct k) from unnest(pavist) k) then
      feil := feil || (hva || ' har samme analytt to ganger.');
    end if;
    feil := feil || array(
      select format('%s bruker %s, som ikke hører til modulen.', hva, k)
      from unnest(pavist) k where k <> all (analytter)
    );

    for v in select e from jsonb_array_elements(s -> 'vilkar') e loop
      select e into forholdet
      from jsonb_array_elements(p_innhold -> 'forhold') e
      where e ->> 'nokkel' = v ->> 'forhold';
      if forholdet is null then
        feil := feil || format('%s viser til ukjent forhold %s.', hva, v ->> 'forhold');
      elsif not (intern.tekstliste(forholdet, 'teller') || intern.tekstliste(forholdet, 'nevner')) <@ pavist then
        feil := feil || format('%s regner %s av en analytt som ikke er påvist.', hva, v ->> 'forhold');
      end if;
      if (v ->> 'parameter') <> all (parametere) then
        feil := feil || format('%s viser til ukjent grense %s.', hva, v ->> 'parameter');
      end if;
      if (v ->> 'operator') not in ('<', '<=', '>', '>=') then
        feil := feil || (hva || ' har ugyldig sammenligning.');
      end if;
    end loop;

    if s -> 'utfall' ->> 'type' = 'manuell' then
      feil := feil || array(select intern.scenariotekstfeil(
        s -> 'utfall' ->> 'melding', 'Meldingen i ' || (s ->> 'nokkel'), parametere
      ));
      feil := feil || array(
        select intern.scenariotekstfeil(t, 'Veiledningen i ' || (s ->> 'nokkel'), parametere)
        from unnest(intern.tekstliste(s -> 'utfall', 'veiledning')) t
      );
      continue;
    end if;

    feil := feil || array(
      select intern.scenariotekstfeil(t, 'Notisen i ' || (s ->> 'nokkel'), parametere)
      from unnest(intern.tekstliste(s -> 'utfall', 'notiser')) t
    );
    if not exists (
      select 1 from jsonb_array_elements(s -> 'utfall' -> 'plasseringer') e where e ->> 'rolle' = 'hoved'
    ) then
      feil := feil || (hva || ' må ha minst én hovedkommentar.');
    end if;
    if (select count(*) from jsonb_array_elements(s -> 'utfall' -> 'plasseringer'))
      <> (select count(distinct e ->> 'merke') from jsonb_array_elements(s -> 'utfall' -> 'plasseringer') e)
    then
      feil := feil || (hva || ' har to kommentarer med samme merke.');
    end if;

    dekket := '{}';
    for pl in select e from jsonb_array_elements(s -> 'utfall' -> 'plasseringer') e loop
      feil := feil || array(select intern.scenariotekstfeil(pl ->> 'merke', 'Merket i ' || (s ->> 'nokkel'), parametere));
      -- Kommentaren slik den står i utkastet; plassholderne er de samme i alle
      -- revisjoner. Scenarioreglene limer inn teksten slik den står.
      select k.* into kommentaren from public.kommentarer k
      where k.objekt_id = (pl ->> 'kommentar')::uuid and k.tilstand = 'utkast';
      if not found then
        feil := feil || (hva || ' viser til en kommentar som ikke finnes.');
      elsif cardinality(kommentaren.plassholdere) > 0 then
        feil := feil || (hva || ' viser til en kommentar med plassholdere.');
      end if;
      koder := intern.tekstliste(pl, 'koder');
      if cardinality(koder) = 0 then
        feil := feil || (hva || ' har en kommentar uten analyttkode.');
      end if;
      dekket := dekket || koder;
    end loop;
    -- Hver påvist analytt får nøyaktig én kommentar, og ingen andre får noen.
    if cardinality(dekket) <> (select count(distinct k) from unnest(dekket) k)
      or not (dekket <@ pavist and pavist <@ dekket)
    then
      feil := feil || (hva || ' må gi hver påviste analytt nøyaktig én kommentar, og ingen andre.');
    end if;
  end loop;

  -- Bare når delene er i orden, gir det mening å prøve helheten.
  if cardinality(feil) = 0 then
    feil := array(select intern.scenariodekning(p_innhold));
  end if;

  return query select distinct on (m) m from unnest(feil) with ordinality as x(m, nr) order by m, nr;
end;
$$;

-- Formen på innholdet: feltene og typene, før reglene prøves.
create function intern.krev_scenarioform(p_innhold jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  e jsonb;
  s jsonb;
  u jsonb;
begin
  perform intern.krev_felt(
    p_innhold, array['modul', 'analytter', 'verdihjelp', 'forhold', 'parametere', 'scenarier']
  );
  perform intern.ra_tekst(p_innhold, 'modul');
  perform intern.ra_tekst(p_innhold, 'verdihjelp');
  perform intern.tekstliste(p_innhold, 'analytter');

  for e in select x from jsonb_array_elements(intern.liste(p_innhold, 'forhold')) x loop
    perform intern.krev_felt(e, array['nokkel', 'teller', 'nevner', 'nullmelding']);
    perform intern.ra_tekst(e, 'nokkel');
    perform intern.ra_tekst(e, 'nullmelding');
    perform intern.tekstliste(e, 'teller');
    perform intern.tekstliste(e, 'nevner');
  end loop;

  for e in select x from jsonb_array_elements(intern.liste(p_innhold, 'parametere')) x loop
    perform intern.krev_felt(e, array['nokkel', 'navn', 'verdi']);
    perform intern.ra_tekst(e, 'nokkel');
    perform intern.ra_tekst(e, 'navn');
    perform intern.tall(e, 'verdi');
  end loop;

  for s in select x from jsonb_array_elements(intern.liste(p_innhold, 'scenarier')) x loop
    perform intern.krev_felt(s, array['nokkel', 'pavist', 'vilkar', 'utfall']);
    perform intern.ra_tekst(s, 'nokkel');
    perform intern.tekstliste(s, 'pavist');
    for e in select x from jsonb_array_elements(intern.liste(s, 'vilkar')) x loop
      perform intern.krev_felt(e, array['forhold', 'operator', 'parameter']);
      perform intern.ra_tekst(e, 'forhold');
      perform intern.ra_tekst(e, 'operator');
      perform intern.ra_tekst(e, 'parameter');
    end loop;

    u := intern.objekt(s, 'utfall');
    case intern.ra_tekst(u, 'type')
      when 'manuell' then
        perform intern.krev_felt(u, array['type', 'melding', 'veiledning']);
        perform intern.ra_tekst(u, 'melding');
        perform intern.tekstliste(u, 'veiledning');
      when 'kommentarer' then
        perform intern.krev_felt(u, array['type', 'plasseringer', 'notiser']);
        perform intern.tekstliste(u, 'notiser');
        for e in select x from jsonb_array_elements(intern.liste(u, 'plasseringer')) x loop
          perform intern.krev_felt(e, array['rolle', 'merke', 'kommentar', 'koder']);
          if intern.ra_tekst(e, 'rolle') not in ('hoved', 'tillegg') then
            raise exception 'Rollen må være hoved eller tillegg.' using errcode = '22023';
          end if;
          perform intern.ra_tekst(e, 'merke');
          perform intern.id(e, 'kommentar');
          perform intern.tekstliste(e, 'koder');
        end loop;
      else
        raise exception 'Utfallet må være kommentarer eller manuell.' using errcode = '22023';
    end case;
  end loop;
end;
$$;

-- --- Skriving og lesing ----------------------------------------------------

create function intern.skriv_scenarioregelsett(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  feil text;
  ny_modul text;
  opptatt text;
begin
  perform intern.krev_scenarioform(p_innhold);

  select string_agg(m, E'\n') into feil from intern.scenariofeil(p_innhold) m;
  if feil is not null then
    raise exception '%', feil using errcode = '22023';
  end if;

  ny_modul := p_innhold ->> 'modul';
  if exists (
    select 1 from public.scenarioregelsett r
    where r.tilstand = p_tilstand and r.modul = ny_modul and r.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt et regelsett for modulen %.', ny_modul using errcode = '22023';
  end if;
  select string_agg(a.kode, ', ' order by a.kode) into opptatt
  from public.scenarioanalytter a
  where a.tilstand = p_tilstand and a.objekt_id <> p_objekt
    and a.kode in (select jsonb_array_elements_text(p_innhold -> 'analytter'));
  if opptatt is not null then
    raise exception 'Analyttkodene % fortolkes alt av et annet regelsett.', opptatt using errcode = '22023';
  end if;

  insert into public.scenarioregelsett (objekt_id, tilstand, modul, verdihjelp)
  values (p_objekt, p_tilstand, ny_modul, p_innhold ->> 'verdihjelp')
  on conflict on constraint scenarioregelsett_pkey
  do update set modul = excluded.modul, verdihjelp = excluded.verdihjelp;

  -- Delene skrives på nytt. Det som hører til analyttene, forholdene og
  -- scenariene, forsvinner med dem.
  delete from public.scenarier s where s.objekt_id = p_objekt and s.tilstand = p_tilstand;
  delete from public.scenarioforhold f where f.objekt_id = p_objekt and f.tilstand = p_tilstand;
  delete from public.scenarioparametere p where p.objekt_id = p_objekt and p.tilstand = p_tilstand;
  delete from public.scenarioanalytter a where a.objekt_id = p_objekt and a.tilstand = p_tilstand;

  insert into public.scenarioanalytter (objekt_id, tilstand, kode, posisjon)
  select p_objekt, p_tilstand, a, nr
  from jsonb_array_elements_text(p_innhold -> 'analytter') with ordinality as x(a, nr);

  insert into public.scenarioforhold (objekt_id, tilstand, nokkel, posisjon, nullmelding)
  select p_objekt, p_tilstand, f ->> 'nokkel', nr, f ->> 'nullmelding'
  from jsonb_array_elements(p_innhold -> 'forhold') with ordinality as x(f, nr);

  insert into public.scenarioforholdsledd (objekt_id, tilstand, forhold, kode, del, posisjon)
  select p_objekt, p_tilstand, f ->> 'nokkel', k, d.del, knr
  from jsonb_array_elements(p_innhold -> 'forhold') f,
    (values ('teller'), ('nevner')) as d(del),
    jsonb_array_elements_text(f -> d.del) with ordinality as y(k, knr);

  insert into public.scenarioparametere (objekt_id, tilstand, nokkel, posisjon, navn, verdi)
  select p_objekt, p_tilstand, p ->> 'nokkel', nr, p ->> 'navn', (p ->> 'verdi')::numeric
  from jsonb_array_elements(p_innhold -> 'parametere') with ordinality as x(p, nr);

  insert into public.scenarier (objekt_id, tilstand, nokkel, posisjon, utfall, melding)
  select p_objekt, p_tilstand, s ->> 'nokkel', nr, s -> 'utfall' ->> 'type', s -> 'utfall' ->> 'melding'
  from jsonb_array_elements(p_innhold -> 'scenarier') with ordinality as x(s, nr);

  insert into public.scenariopavist (objekt_id, tilstand, scenario, kode)
  select p_objekt, p_tilstand, s ->> 'nokkel', k
  from jsonb_array_elements(p_innhold -> 'scenarier') s, jsonb_array_elements_text(s -> 'pavist') k;

  insert into public.scenariovilkar (objekt_id, tilstand, scenario, posisjon, forhold, operator, parameter)
  select p_objekt, p_tilstand, s ->> 'nokkel', nr, v ->> 'forhold', v ->> 'operator', v ->> 'parameter'
  from jsonb_array_elements(p_innhold -> 'scenarier') s,
    jsonb_array_elements(s -> 'vilkar') with ordinality as x(v, nr);

  insert into public.scenarioplasseringer (objekt_id, tilstand, scenario, posisjon, rolle, merke, kommentar_id)
  select p_objekt, p_tilstand, s ->> 'nokkel', nr, pl ->> 'rolle', pl ->> 'merke', (pl ->> 'kommentar')::uuid
  from jsonb_array_elements(p_innhold -> 'scenarier') s,
    jsonb_array_elements(coalesce(s -> 'utfall' -> 'plasseringer', '[]')) with ordinality as x(pl, nr);

  insert into public.scenarioplasseringskoder (objekt_id, tilstand, scenario, plassering, posisjon, kode)
  select p_objekt, p_tilstand, s ->> 'nokkel', pnr, knr, k
  from jsonb_array_elements(p_innhold -> 'scenarier') s,
    jsonb_array_elements(coalesce(s -> 'utfall' -> 'plasseringer', '[]')) with ordinality as x(pl, pnr),
    jsonb_array_elements_text(pl -> 'koder') with ordinality as y(k, knr);

  insert into public.scenariotekster (objekt_id, tilstand, scenario, art, posisjon, tekst)
  select p_objekt, p_tilstand, s ->> 'nokkel', d.art, nr, t
  from jsonb_array_elements(p_innhold -> 'scenarier') s,
    (values ('notis', 'notiser'), ('veiledning', 'veiledning')) as d(art, felt),
    jsonb_array_elements_text(coalesce(s -> 'utfall' -> d.felt, '[]')) with ordinality as x(t, nr);
end;
$$;

-- Øyeblikksbildet: samme form som skriv tar imot. De påviste analyttene står
-- i modulens rekkefølge.
create function intern.les_scenarioregelsett(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'modul', r.modul,
    'analytter', coalesce(
      (select jsonb_agg(a.kode order by a.posisjon) from public.scenarioanalytter a
       where a.objekt_id = r.objekt_id and a.tilstand = r.tilstand),
      '[]'
    ),
    'verdihjelp', r.verdihjelp,
    'forhold', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'nokkel', f.nokkel,
         'teller', coalesce((select jsonb_agg(l.kode order by l.posisjon) from public.scenarioforholdsledd l
           where l.objekt_id = f.objekt_id and l.tilstand = f.tilstand and l.forhold = f.nokkel and l.del = 'teller'), '[]'),
         'nevner', coalesce((select jsonb_agg(l.kode order by l.posisjon) from public.scenarioforholdsledd l
           where l.objekt_id = f.objekt_id and l.tilstand = f.tilstand and l.forhold = f.nokkel and l.del = 'nevner'), '[]'),
         'nullmelding', f.nullmelding
       ) order by f.posisjon)
       from public.scenarioforhold f where f.objekt_id = r.objekt_id and f.tilstand = r.tilstand),
      '[]'
    ),
    'parametere', coalesce(
      (select jsonb_agg(jsonb_build_object('nokkel', p.nokkel, 'navn', p.navn, 'verdi', p.verdi) order by p.posisjon)
       from public.scenarioparametere p where p.objekt_id = r.objekt_id and p.tilstand = r.tilstand),
      '[]'
    ),
    'scenarier', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'nokkel', s.nokkel,
         'pavist', coalesce((select jsonb_agg(a.kode order by a.posisjon)
           from public.scenariopavist pa
           join public.scenarioanalytter a on a.objekt_id = pa.objekt_id and a.tilstand = pa.tilstand and a.kode = pa.kode
           where pa.objekt_id = s.objekt_id and pa.tilstand = s.tilstand and pa.scenario = s.nokkel), '[]'),
         'vilkar', coalesce((select jsonb_agg(jsonb_build_object(
             'forhold', v.forhold, 'operator', v.operator, 'parameter', v.parameter) order by v.posisjon)
           from public.scenariovilkar v
           where v.objekt_id = s.objekt_id and v.tilstand = s.tilstand and v.scenario = s.nokkel), '[]'),
         'utfall', case s.utfall
           when 'manuell' then jsonb_build_object(
             'type', 'manuell',
             'melding', s.melding,
             'veiledning', coalesce((select jsonb_agg(t.tekst order by t.posisjon) from public.scenariotekster t
               where t.objekt_id = s.objekt_id and t.tilstand = s.tilstand and t.scenario = s.nokkel
                 and t.art = 'veiledning'), '[]'))
           else jsonb_build_object(
             'type', 'kommentarer',
             'plasseringer', coalesce((select jsonb_agg(jsonb_build_object(
                 'rolle', pl.rolle,
                 'merke', pl.merke,
                 'kommentar', pl.kommentar_id,
                 'koder', coalesce((select jsonb_agg(k.kode order by k.posisjon) from public.scenarioplasseringskoder k
                   where k.objekt_id = pl.objekt_id and k.tilstand = pl.tilstand and k.scenario = pl.scenario
                     and k.plassering = pl.posisjon), '[]')
               ) order by pl.posisjon)
               from public.scenarioplasseringer pl
               where pl.objekt_id = s.objekt_id and pl.tilstand = s.tilstand and pl.scenario = s.nokkel), '[]'),
             'notiser', coalesce((select jsonb_agg(t.tekst order by t.posisjon) from public.scenariotekster t
               where t.objekt_id = s.objekt_id and t.tilstand = s.tilstand and t.scenario = s.nokkel
                 and t.art = 'notis'), '[]'))
         end
       ) order by s.posisjon)
       from public.scenarier s where s.objekt_id = r.objekt_id and s.tilstand = r.tilstand),
      '[]'
    )
  )
  from public.scenarioregelsett r
  where r.objekt_id = p_objekt and r.tilstand = p_tilstand
$$;

-- Feilene i et regelsett uten å lagre noe, for redigeringen. Kaster om formen
-- er feil, og gir ellers alle meldingene; en tom liste betyr gyldig.
create function public.valider_scenarioregelsett(innhold jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform intern.krev_admin();
  perform intern.krev_scenarioform(innhold);
  return array(select intern.scenariofeil(innhold));
end;
$$;

comment on function public.valider_scenarioregelsett(jsonb) is
  'Gir feilene i et scenarioregelsett uten å lagre det. Krever administrator.';

-- --- Radsikkerhet og rettigheter -------------------------------------------

alter table public.scenarioregelsett enable row level security;
alter table public.scenarioanalytter enable row level security;
alter table public.scenarioforhold enable row level security;
alter table public.scenarioforholdsledd enable row level security;
alter table public.scenarioparametere enable row level security;
alter table public.scenarier enable row level security;
alter table public.scenariopavist enable row level security;
alter table public.scenariovilkar enable row level security;
alter table public.scenarioplasseringer enable row level security;
alter table public.scenarioplasseringskoder enable row level security;
alter table public.scenariotekster enable row level security;

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioregelsett for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioanalytter for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioforhold for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioforholdsledd for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioparametere for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarier for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenariopavist for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenariovilkar for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioplasseringer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenarioplasseringskoder for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));
create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.scenariotekster for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

revoke all on table
  public.scenarioregelsett,
  public.scenarioanalytter,
  public.scenarioforhold,
  public.scenarioforholdsledd,
  public.scenarioparametere,
  public.scenarier,
  public.scenariopavist,
  public.scenariovilkar,
  public.scenarioplasseringer,
  public.scenarioplasseringskoder,
  public.scenariotekster
from anon, authenticated, service_role;

grant select on table
  public.scenarioregelsett,
  public.scenarioanalytter,
  public.scenarioforhold,
  public.scenarioforholdsledd,
  public.scenarioparametere,
  public.scenarier,
  public.scenariopavist,
  public.scenariovilkar,
  public.scenarioplasseringer,
  public.scenarioplasseringskoder,
  public.scenariotekster
to authenticated, service_role;

revoke all on function public.valider_scenarioregelsett(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.valider_scenarioregelsett(jsonb) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;