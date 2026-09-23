-- Regelsett for de enkle konsentrasjonsreglene: hvilken kommentar en målt
-- konsentrasjon gir, og om rekvirenten skal ringes.
--
-- Bygger på fundamentet for redigerbart faginnhold. Et regelsett er ett
-- redigerbart objekt, med utkast, publisering, revisjoner og gjenoppretting
-- som alt annet faginnhold. Bakgrunnen står i docs/fortolkningsregler.md. Kort
-- fortalt:
--
--   * Kommentaren og regelen er ulike ting, i hver sin tabell. En kommentar er
--     ren tekst med en stabil ID i regelsettet; en regel sier når den brukes.
--     Flere regler kan bruke samme kommentar uten at teksten dupliseres.
--   * Regelsettet er likevel én enhet i historikken: reglene og kommentarene
--     står i det samme øyeblikksbildet. Da lagres, publiseres og gjenopprettes
--     hele regelsettet på én gang, og aldri halvveis.
--   * Et intervall har nedre grense med og øvre grense utenfor: [fra, til).
--     Det første og det siste er åpne i enden. Det som lagres, er
--     skillepunktene mellom intervallene, så to naboer deler alltid den samme
--     grensen og det kan ikke oppstå hull eller overlapp.
--   * «Ring rekvirent» er en handling på regelen, ikke en del av teksten.
--   * «Til stede under cut-off» er en innledning satt foran en av de
--     ordinære kommentarene, som begge står i regelsettet én gang.
--
-- Kommentartabellen er felles for alle regelsett, også de som kommer senere
-- (sammensatte analyttgrupper): hver regeltype har sin egen tabell for
-- reglene og peker på kommentarene her.

-- --- Typene ----------------------------------------------------------------

-- Samme verdier som KONSENTRASJONSNIVAER og REGELHANDLINGER i
-- src/regler/modell.ts. Testen sammenligner dem.
create type public.konsentrasjonsniva as enum ('under', 'innenfor', 'over');
create type public.regelhandling as enum ('ring_rekvirent');

-- --- Enhetene ----------------------------------------------------------------

-- Enhetene et regelsett kan oppgis i. En ny enhet legges til her, i en
-- migrasjon, og ikke i fritekst.
create table public.maleenheter (
  enhet text primary key,
  constraint maleenheter_enhet check (char_length(enhet) between 1 and 20 and enhet = btrim(enhet))
);

insert into public.maleenheter (enhet) values ('nmol/L'), ('µmol/L');

comment on table public.maleenheter is
  'Enhetene konsentrasjonene i et regelsett kan oppgis i.';

-- --- Kommentarene ----------------------------------------------------------

create table public.regelsettkommentarer (
  regelsett_id uuid not null,
  tilstand public.objekttilstand not null,
  kommentar_id uuid not null,
  posisjon integer not null,
  tekst text not null,
  constraint regelsettkommentarer_pkey primary key (regelsett_id, tilstand, kommentar_id),
  constraint regelsettkommentarer_posisjon_entydig unique (regelsett_id, tilstand, posisjon),
  constraint regelsettkommentarer_tilstand_fkey
    foreign key (regelsett_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint regelsettkommentarer_posisjon check (posisjon >= 1),
  -- Kommentaren limes inn i laboratoriesystemet som den står: ren tekst på én
  -- linje, uten kontrolltegn.
  constraint regelsettkommentarer_tekst check (
    char_length(tekst) between 1 and 4000 and tekst = btrim(tekst) and tekst !~ '[[:cntrl:]]'
  )
);

comment on table public.regelsettkommentarer is
  'Kommentartekstene i et regelsett: ren tekst med en stabil ID i regelsettet. Reglene peker hit; samme kommentar kan brukes av flere regler.';

-- --- Regelsettene ----------------------------------------------------------

create table public.intervallregelsett (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  analyttkode text not null,
  enhet text not null references public.maleenheter (enhet),
  desimaler integer not null,
  ringegrense numeric,
  cutoff_innledning_id uuid,
  cutoff_kommentar_id uuid,
  constraint intervallregelsett_pkey primary key (objekt_id, tilstand),
  constraint intervallregelsett_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint intervallregelsett_analyttkode_entydig unique (tilstand, analyttkode),
  constraint intervallregelsett_analyttkode check (
    char_length(analyttkode) <= 32 and analyttkode ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
  ),
  constraint intervallregelsett_desimaler check (desimaler between 0 and 6),
  constraint intervallregelsett_ringegrense check (ringegrense is null or ringegrense > 0),
  constraint intervallregelsett_cutoff check ((cutoff_innledning_id is null) = (cutoff_kommentar_id is null)),
  -- Kommentarene skrives på nytt hver gang regelsettet lagres. Koblingene
  -- kontrolleres derfor først når transaksjonen er ferdig.
  constraint intervallregelsett_cutoff_innledning_fkey
    foreign key (objekt_id, tilstand, cutoff_innledning_id)
    references public.regelsettkommentarer (regelsett_id, tilstand, kommentar_id)
    deferrable initially deferred,
  constraint intervallregelsett_cutoff_kommentar_fkey
    foreign key (objekt_id, tilstand, cutoff_kommentar_id)
    references public.regelsettkommentarer (regelsett_id, tilstand, kommentar_id)
    deferrable initially deferred
);

comment on table public.intervallregelsett is
  'Et regelsett for én analyttkode: konsentrasjonsintervaller med kommentar og eventuell handling. Reglene står i intervallregler.';
comment on column public.intervallregelsett.desimaler is
  'Hvor fint konsentrasjonen oppgis. Grensene er hele steg, og intervallene vises med dem: [10, 1800) med 0 desimaler er «10 – 1799».';
comment on column public.intervallregelsett.ringegrense is
  'Ringegrensen slik den vises som referansetall. Det er intervallene med handlingen ring_rekvirent som avgjør; grensen må stemme med dem.';

create table public.intervallregler (
  regelsett_id uuid not null,
  tilstand public.objekttilstand not null,
  posisjon integer not null,
  fra numeric,
  til numeric,
  niva public.konsentrasjonsniva not null,
  handling public.regelhandling,
  kommentar_id uuid not null,
  constraint intervallregler_pkey primary key (regelsett_id, tilstand, posisjon),
  constraint intervallregler_regelsett_fkey
    foreign key (regelsett_id, tilstand)
    references public.intervallregelsett (objekt_id, tilstand) on delete cascade,
  constraint intervallregler_kommentar_fkey
    foreign key (regelsett_id, tilstand, kommentar_id)
    references public.regelsettkommentarer (regelsett_id, tilstand, kommentar_id)
    deferrable initially deferred,
  constraint intervallregler_posisjon check (posisjon >= 1),
  constraint intervallregler_stigende check (fra is null or til is null or fra < til)
);

create index intervallregler_kommentar_idx
  on public.intervallregler (regelsett_id, tilstand, kommentar_id);

comment on table public.intervallregler is
  'Én regel per konsentrasjonsintervall: [fra, til), der null er en åpen ende. Naboer deler grensen, så intervallene dekker hele tallinjen.';

-- --- Vakter i databasen ----------------------------------------------------

create trigger intervallregelsett_objekttype
before insert or update on public.intervallregelsett
for each row execute function intern.krev_objekttype('objekt_id', 'intervallregelsett');

-- --- Lesing av det som sendes inn ------------------------------------------

create function intern.tall(p_innhold jsonb, p_felt text)
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

create function intern.tall_liste(p_innhold jsonb, p_felt text)
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'array' then
    raise exception 'Feltet % må være en liste.', p_felt using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_innhold -> p_felt) e(v) where jsonb_typeof(e.v) <> 'number'
  ) then
    raise exception 'Feltet % må inneholde tall.', p_felt using errcode = '22023';
  end if;
  return array(
    select trim_scale((e.v #>> '{}')::numeric)
    from jsonb_array_elements(p_innhold -> p_felt) with ordinality as e(v, nr)
    order by e.nr
  );
end;
$$;

-- Et tall slik det står i en melding: med desimalkomma, som i appen.
create function intern.vis_tall(p_tall numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select replace(trim_scale(p_tall)::text, '.', ',') $$;

-- --- Kommentarene, felles for alle regelsett -------------------------------

-- Skriver kommentarene i et regelsett for én tilstand, i den rekkefølgen de
-- sendes. Hver er `{"id": "...", "tekst": "..."}`. Reglene skrives etterpå og
-- peker på ID-ene; koblingene kontrolleres når transaksjonen er ferdig.
create function intern.skriv_regelsettkommentarer(
  p_objekt uuid, p_tilstand public.objekttilstand, p_kommentarer jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  kommentar jsonb;
  nr integer := 0;
  tekst text;
begin
  if jsonb_typeof(p_kommentarer) is distinct from 'array' then
    raise exception 'Kommentarene må være en liste.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_kommentarer) > 200 then
    raise exception 'Et regelsett kan ha høyst 200 kommentarer.' using errcode = '22023';
  end if;

  delete from public.regelsettkommentarer k
  where k.regelsett_id = p_objekt and k.tilstand = p_tilstand;

  for kommentar in select e.v from jsonb_array_elements(p_kommentarer) with ordinality e(v, nr) order by e.nr loop
    nr := nr + 1;
    if jsonb_typeof(kommentar) is distinct from 'object' then
      raise exception 'Kommentar % må være et objekt.', nr using errcode = '22023';
    end if;
    perform intern.krev_felt(kommentar, array['id', 'tekst']);
    tekst := intern.tekst(kommentar, 'tekst');
    if tekst = '' then
      raise exception 'Kommentar % er tom.', nr using errcode = '22023';
    end if;
    if tekst ~ '[[:cntrl:]]' then
      raise exception 'Kommentar % må være ren tekst på én linje, uten linjeskift eller tabulatorer.', nr
        using errcode = '22023';
    end if;
    if char_length(tekst) > 4000 then
      raise exception 'Kommentar % er lengre enn 4000 tegn.', nr using errcode = '22023';
    end if;
    if exists (
      select 1 from public.regelsettkommentarer k
      where k.regelsett_id = p_objekt and k.tilstand = p_tilstand
        and k.kommentar_id = intern.id(kommentar, 'id')
    ) then
      raise exception 'Samme kommentar-ID står to ganger.' using errcode = '22023';
    end if;

    insert into public.regelsettkommentarer (regelsett_id, tilstand, kommentar_id, posisjon, tekst)
    values (p_objekt, p_tilstand, intern.id(kommentar, 'id'), nr, tekst);
  end loop;
end;
$$;

create function intern.les_regelsettkommentarer(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', k.kommentar_id, 'tekst', k.tekst) order by k.posisjon),
    '[]'::jsonb
  )
  from public.regelsettkommentarer k
  where k.regelsett_id = p_objekt and k.tilstand = p_tilstand
$$;

-- Hver kommentar i regelsettet må brukes av minst én regel, og hver regel må
-- peke på en kommentar som finnes. `p_brukte` er kommentarene reglene peker på.
create function intern.krev_brukte_kommentarer(
  p_objekt uuid, p_tilstand public.objekttilstand, p_brukte uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(p_brukte) b(id)
    where not exists (
      select 1 from public.regelsettkommentarer k
      where k.regelsett_id = p_objekt and k.tilstand = p_tilstand and k.kommentar_id = b.id
    )
  ) then
    raise exception 'En regel peker på en kommentar som ikke finnes i regelsettet.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.regelsettkommentarer k
    where k.regelsett_id = p_objekt and k.tilstand = p_tilstand and k.kommentar_id <> all (p_brukte)
  ) then
    raise exception 'Regelsettet har en kommentar som ingen regel bruker. Fjern den, eller knytt den til en regel.'
      using errcode = '22023';
  end if;
end;
$$;

-- --- Kontrollen av intervallene --------------------------------------------

-- Intervallene i et regelsett slik de står i tabellen: de skal dekke hele
-- tallinjen, med de åpne endene ytterst og hver grense delt med naboen. Det
-- følger av måten de skrives på, men kontrolleres her av det som faktisk ble
-- lagret, så en feil i skrivingen aldri kan gi hull eller overlapp.
create function intern.krev_sammenhengende_intervaller(p_objekt uuid, p_tilstand public.objekttilstand)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  forrige public.intervallregler;
  regel public.intervallregler;
  antall integer := 0;
begin
  for regel in
    select r.* from public.intervallregler r
    where r.regelsett_id = p_objekt and r.tilstand = p_tilstand
    order by r.posisjon
  loop
    antall := antall + 1;
    if regel.posisjon <> antall then
      raise exception 'Intervallene er ikke nummerert fortløpende.' using errcode = '22023';
    end if;
    if antall = 1 then
      if regel.fra is not null then
        raise exception 'Det første intervallet må være åpent nedover.' using errcode = '22023';
      end if;
    elsif forrige.til is null or regel.fra is null then
      raise exception 'Bare det første og det siste intervallet kan være åpne.' using errcode = '22023';
    elsif regel.fra < forrige.til then
      raise exception 'Intervallene overlapper ved %.', intern.vis_tall(regel.fra) using errcode = '22023';
    elsif regel.fra > forrige.til then
      raise exception 'Det er et hull mellom % og %.', intern.vis_tall(forrige.til), intern.vis_tall(regel.fra)
        using errcode = '22023';
    end if;
    forrige := regel;
  end loop;

  if antall = 0 then
    raise exception 'Regelsettet må ha minst ett intervall.' using errcode = '22023';
  end if;
  if forrige.til is not null then
    raise exception 'Det siste intervallet må være åpent oppover.' using errcode = '22023';
  end if;
end;
$$;

-- --- Skriving og lesing ----------------------------------------------------

-- Innholdet er:
--
--   analyttkode    koden regelsettet gjelder, f.eks. "AMTNORSUM"
--   enhet          en av maleenheter
--   desimaler      hvor fint konsentrasjonen oppgis (0–6)
--   skillepunkter  grensene mellom intervallene, stigende; n grenser gir n + 1
--                  intervaller
--   intervaller    [{ "niva", "handling", "kommentar" }], nedenfra og opp
--   ringegrense    referansetallet som vises, eller null uten ringeregel
--   cutoff         null, eller { "innledning", "kommentar" }: to kommentarer
--                  som settes sammen, innledningen først
--   kommentarer    [{ "id", "tekst" }]
create function intern.skriv_intervallregelsett(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  kode text;
  ny_enhet text;
  nye_desimaler integer;
  steg numeric;
  grenser numeric[];
  intervaller jsonb;
  intervall jsonb;
  antall integer;
  nr integer;
  niva public.konsentrasjonsniva;
  forrige_niva public.konsentrasjonsniva;
  handling public.regelhandling;
  ring_fra integer;
  ring_grense numeric;
  cutoff jsonb;
  innledning uuid;
  hovedkommentar uuid;
  brukte uuid[] := array[]::uuid[];
  kommentar uuid;
begin
  perform intern.krev_felt(
    p_innhold,
    array['analyttkode', 'enhet', 'desimaler', 'skillepunkter', 'intervaller', 'ringegrense', 'cutoff', 'kommentarer']
  );

  kode := intern.tekst(p_innhold, 'analyttkode');
  if char_length(kode) > 32 or kode !~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$' then
    raise exception 'Analyttkoden «%» er ikke gyldig.', kode using errcode = '22023';
  end if;
  if exists (
    select 1 from public.intervallregelsett s
    where s.tilstand = p_tilstand and s.analyttkode = kode and s.objekt_id <> p_objekt
  ) then
    raise exception 'Analyttkoden % har alt et regelsett.', kode using errcode = '22023';
  end if;

  ny_enhet := intern.tekst(p_innhold, 'enhet');
  if ny_enhet = '' then
    raise exception 'Enheten mangler.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.maleenheter m where m.enhet = ny_enhet) then
    raise exception 'Enheten «%» er ikke gyldig.', ny_enhet using errcode = '22023';
  end if;

  nye_desimaler := intern.heltall(p_innhold, 'desimaler');
  if nye_desimaler not between 0 and 6 then
    raise exception 'Antall desimaler må være mellom 0 og 6.' using errcode = '22023';
  end if;
  steg := power(10::numeric, -nye_desimaler);

  -- Grensene: positive, i hele steg, og strengt stigende.
  grenser := intern.tall_liste(p_innhold, 'skillepunkter');
  for nr in 1 .. coalesce(cardinality(grenser), 0) loop
    if grenser[nr] <= 0 then
      raise exception 'Grensene må være større enn null.' using errcode = '22023';
    end if;
    if grenser[nr] % steg <> 0 then
      raise exception 'Grensen % har flere desimaler enn regelsettet (%).',
        intern.vis_tall(grenser[nr]), nye_desimaler using errcode = '22023';
    end if;
    if nr > 1 and grenser[nr] <= grenser[nr - 1] then
      raise exception 'Grensene må stige: % kommer etter %.',
        intern.vis_tall(grenser[nr]), intern.vis_tall(grenser[nr - 1]) using errcode = '22023';
    end if;
  end loop;

  -- Intervallene: ett mer enn grensene, hvert med nivå, kommentar og
  -- eventuell handling.
  if jsonb_typeof(p_innhold -> 'intervaller') is distinct from 'array' then
    raise exception 'Feltet intervaller må være en liste.' using errcode = '22023';
  end if;
  intervaller := p_innhold -> 'intervaller';
  antall := jsonb_array_length(intervaller);
  if antall = 0 then
    raise exception 'Regelsettet må ha minst ett intervall.' using errcode = '22023';
  end if;
  if antall > 20 then
    raise exception 'Et regelsett kan ha høyst 20 intervaller.' using errcode = '22023';
  end if;
  if antall <> coalesce(cardinality(grenser), 0) + 1 then
    raise exception 'Det må være nøyaktig ett intervall mer enn det er grenser.' using errcode = '22023';
  end if;

  delete from public.intervallregler r where r.regelsett_id = p_objekt and r.tilstand = p_tilstand;

  -- Selve regelsettet først, så kommentarene, så reglene som peker på dem.
  -- Cut-off-koblingene settes etter at innholdet er kontrollert.
  insert into public.intervallregelsett (objekt_id, tilstand, analyttkode, enhet, desimaler)
  values (p_objekt, p_tilstand, kode, ny_enhet, nye_desimaler)
  on conflict on constraint intervallregelsett_pkey do update set
    analyttkode = excluded.analyttkode,
    enhet = excluded.enhet,
    desimaler = excluded.desimaler,
    ringegrense = null,
    cutoff_innledning_id = null,
    cutoff_kommentar_id = null;

  perform intern.skriv_regelsettkommentarer(p_objekt, p_tilstand, p_innhold -> 'kommentarer');

  for nr in 1 .. antall loop
    intervall := intervaller -> (nr - 1);
    if jsonb_typeof(intervall) is distinct from 'object' then
      raise exception 'Intervall % må være et objekt.', nr using errcode = '22023';
    end if;
    perform intern.krev_felt(intervall, array['niva', 'handling', 'kommentar']);

    if jsonb_typeof(intervall -> 'niva') is distinct from 'string'
      or (intervall ->> 'niva') <> all (enum_range(null::public.konsentrasjonsniva)::text[])
    then
      raise exception 'Intervall % har et ukjent nivå.', nr using errcode = '22023';
    end if;
    niva := (intervall ->> 'niva')::public.konsentrasjonsniva;
    if forrige_niva is not null and niva < forrige_niva then
      raise exception 'Nivåene må følge konsentrasjonen: «%» kan ikke komme etter «%».', niva, forrige_niva
        using errcode = '22023';
    end if;
    forrige_niva := niva;

    handling := null;
    if jsonb_typeof(intervall -> 'handling') <> 'null' then
      if jsonb_typeof(intervall -> 'handling') <> 'string'
        or (intervall ->> 'handling') <> all (enum_range(null::public.regelhandling)::text[])
      then
        raise exception 'Intervall % har en ukjent handling.', nr using errcode = '22023';
      end if;
      handling := (intervall ->> 'handling')::public.regelhandling;
    end if;

    if jsonb_typeof(intervall -> 'kommentar') is distinct from 'string' then
      raise exception 'Intervall % mangler kommentar.', nr using errcode = '22023';
    end if;
    kommentar := intern.id(intervall, 'kommentar');
    brukte := brukte || kommentar;

    -- Ringegrensen gjelder alt over seg: fra det første intervallet med
    -- handlingen skal også alle over ha den.
    if handling = 'ring_rekvirent' then
      if nr = 1 then
        raise exception 'Det nederste intervallet kan ikke ha «ring rekvirent».' using errcode = '22023';
      end if;
      ring_fra := coalesce(ring_fra, nr);
    elsif ring_fra is not null then
      raise exception 'Alle intervallene over ringegrensen må ha «ring rekvirent».' using errcode = '22023';
    end if;

    insert into public.intervallregler (
      regelsett_id, tilstand, posisjon, fra, til, niva, handling, kommentar_id
    )
    values (
      p_objekt,
      p_tilstand,
      nr,
      case when nr = 1 then null else grenser[nr - 1] end,
      case when nr = antall then null else grenser[nr] end,
      niva,
      handling,
      kommentar
    );
  end loop;

  -- Ringegrensen som vises, må stemme med intervallene: den er grensen der
  -- ringingen begynner, eller tallet rett under når regelen er «over
  -- ringegrensen».
  if jsonb_typeof(p_innhold -> 'ringegrense') = 'null' then
    ring_grense := null;
  else
    ring_grense := intern.tall(p_innhold, 'ringegrense');
  end if;
  if ring_fra is null and ring_grense is not null then
    raise exception 'Ringegrensen er oppgitt, men ingen intervaller har «ring rekvirent».' using errcode = '22023';
  end if;
  if ring_fra is not null then
    if ring_grense is null then
      raise exception 'Ringegrensen mangler.' using errcode = '22023';
    end if;
    if ring_grense % steg <> 0 then
      raise exception 'Ringegrensen har flere desimaler enn regelsettet (%).', nye_desimaler using errcode = '22023';
    end if;
    if grenser[ring_fra - 1] not in (ring_grense, ring_grense + steg) then
      raise exception 'Ringegrensen % stemmer ikke med intervallet der ringingen begynner (%).',
        intern.vis_tall(ring_grense), intern.vis_tall(grenser[ring_fra - 1]) using errcode = '22023';
    end if;
  end if;

  -- Cut-off: en innledning satt foran en av de ordinære kommentarene.
  cutoff := p_innhold -> 'cutoff';
  if jsonb_typeof(cutoff) = 'object' then
    perform intern.krev_felt(cutoff, array['innledning', 'kommentar']);
    innledning := intern.id(cutoff, 'innledning');
    hovedkommentar := intern.id(cutoff, 'kommentar');
    if innledning = hovedkommentar then
      raise exception 'Innledningen til cut-off må være en egen kommentar.' using errcode = '22023';
    end if;
    if hovedkommentar <> all (brukte) then
      raise exception 'Cut-off må bygge på en av kommentarene intervallene bruker.' using errcode = '22023';
    end if;
    brukte := brukte || innledning;
  elsif jsonb_typeof(cutoff) is distinct from 'null' then
    raise exception 'Feltet cutoff må være et objekt eller null.' using errcode = '22023';
  end if;

  update public.intervallregelsett s set
    ringegrense = ring_grense,
    cutoff_innledning_id = innledning,
    cutoff_kommentar_id = hovedkommentar
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand;

  perform intern.krev_brukte_kommentarer(p_objekt, p_tilstand, brukte);
  perform intern.krev_sammenhengende_intervaller(p_objekt, p_tilstand);
end;
$$;

create function intern.les_intervallregelsett(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'analyttkode', s.analyttkode,
    'enhet', s.enhet,
    'desimaler', s.desimaler,
    'skillepunkter', coalesce(
      (
        select jsonb_agg(r.fra order by r.posisjon)
        from public.intervallregler r
        where r.regelsett_id = s.objekt_id and r.tilstand = s.tilstand and r.posisjon > 1
      ),
      '[]'::jsonb
    ),
    'intervaller', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('niva', r.niva, 'handling', r.handling, 'kommentar', r.kommentar_id)
          order by r.posisjon
        )
        from public.intervallregler r
        where r.regelsett_id = s.objekt_id and r.tilstand = s.tilstand
      ),
      '[]'::jsonb
    ),
    'ringegrense', s.ringegrense,
    'cutoff', case
      when s.cutoff_innledning_id is null then null
      else jsonb_build_object('innledning', s.cutoff_innledning_id, 'kommentar', s.cutoff_kommentar_id)
    end,
    'kommentarer', intern.les_regelsettkommentarer(s.objekt_id, s.tilstand)
  )
  from public.intervallregelsett s
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand
$$;

-- --- Lesingen appen gjør ---------------------------------------------------

-- Alle intervallregelsettene i én tilstand, på samme form som utgavene av en
-- analyttside. Fortolkningen leser det publiserte; redigeringen utkastet.
-- Kjører med rettighetene til den som leser, så radsikkerheten gjelder.
create function public.les_intervallregelsett(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.utgave_som_json(u) order by s.analyttkode), '[]'::jsonb)
  from public.intervallregelsett s
  join public.objektutgaver u on u.objekt_id = s.objekt_id and u.tilstand = s.tilstand
  where s.tilstand = sidetilstand
$$;

comment on function public.les_intervallregelsett(public.objekttilstand) is
  'Alle intervallregelsettene i én tilstand, med revisjonen de står på. Radsikkerheten gjelder.';

-- --- Radsikkerhet ----------------------------------------------------------

alter table public.maleenheter enable row level security;
alter table public.regelsettkommentarer enable row level security;
alter table public.intervallregelsett enable row level security;
alter table public.intervallregler enable row level security;

create policy "Innloggede ser enhetene"
on public.maleenheter for select to authenticated
using (true);

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.regelsettkommentarer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.intervallregelsett for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.intervallregler for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

-- --- Rettigheter -----------------------------------------------------------

revoke all on table
  public.maleenheter,
  public.regelsettkommentarer,
  public.intervallregelsett,
  public.intervallregler
from anon, authenticated, service_role;

grant select on table
  public.maleenheter,
  public.regelsettkommentarer,
  public.intervallregelsett,
  public.intervallregler
to authenticated, service_role;

revoke all on function public.les_intervallregelsett(public.objekttilstand)
from public, anon, authenticated, service_role;

grant execute on function public.les_intervallregelsett(public.objekttilstand) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
