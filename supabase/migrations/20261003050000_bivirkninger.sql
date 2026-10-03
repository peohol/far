-- Bivirkningene på fagsidene som strukturerte data, importert fra
-- preparatomtalene (SPC). Bakgrunnen står i docs/bivirkninger.md. Kort fortalt:
--
--   * Det finnes ett datasett: hver bivirkning er én rad med kilden (og
--     gjennom den fagsiden), organsystemet, frekvensen og teksten slik den
--     står i preparatomtalen. Visningen etter frekvens og visningen etter
--     organsystem lages av de samme radene i appen; ingen av dem lagres.
--   * Frekvensene og organsystemene er faste lister her og i
--     src/bivirkninger/modell.ts. En rad kan bare peke på en kode som står i
--     listene, og importen avviser alt annet med en melding om hvor feilen er,
--     så det aldri oppstår en ny variant.
--   * Importen (bivirkninger.importer) tar én preparatomtale om gangen, i
--     formatet fra src/bivirkninger/import.ts, og kontrollerer den med de
--     samme meldingene som appen. En ny import av den samme kilden på den
--     samme siden erstatter den forrige: den gamle merkes som erstattet og
--     står igjen som historikk med radene sine, så det verken blir dubletter
--     eller rader uten kilde. Er innholdet det samme som sist, endres
--     ingenting.
--   * Ingen rader slettes. En kilde som ikke lenger skal vises, trekkes
--     tilbake (bivirkninger.trekk_tilbake) med en begrunnelse.
--   * Ingen av API-rollene har tilgang til skjemaet. Appen leser gjennom
--     public.les_bivirkninger; importen gjøres med datamigrasjoner.

create schema bivirkninger;
revoke all on schema bivirkninger from public;

comment on schema bivirkninger is
  'Bivirkningene på fagsidene, importert fra preparatomtalene. Ingen av API-rollene har tilgang; appen leser med public.les_bivirkninger.';

-- --- De faste listene -------------------------------------------------------

-- Samme koder og rekkefølge som FREKVENSER i src/bivirkninger/modell.ts.
create table bivirkninger.frekvenser (
  kode text primary key,
  navn text not null unique,
  rang smallint not null unique,
  definisjon text not null
);

insert into bivirkninger.frekvenser (kode, navn, rang, definisjon) values
  ('svaert_vanlige', 'Svært vanlige', 1, '≥ 1/10'),
  ('vanlige', 'Vanlige', 2, '≥ 1/100 til < 1/10'),
  ('mindre_vanlige', 'Mindre vanlige', 3, '≥ 1/1 000 til < 1/100'),
  ('sjeldne', 'Sjeldne', 4, '≥ 1/10 000 til < 1/1 000'),
  ('svaert_sjeldne', 'Svært sjeldne', 5, '< 1/10 000'),
  ('ikke_kjent', 'Ikke kjent', 6, 'kan ikke anslås ut ifra tilgjengelige data');

comment on table bivirkninger.frekvenser is
  'Frekvenskategoriene i preparatomtalene, fra den høyeste frekvensen (rang 1) til «Ikke kjent».';

-- Samme koder og rekkefølge som ORGANSYSTEMER i src/bivirkninger/modell.ts:
-- organklassesystemene i MedDRA i den internasjonalt avtalte rekkefølgen.
create table bivirkninger.organsystemer (
  kode text primary key,
  navn text not null unique,
  engelsk text not null unique,
  meddra_kode integer not null unique,
  rang smallint not null unique
);

insert into bivirkninger.organsystemer (kode, navn, engelsk, meddra_kode, rang) values
  ('infeksiose', 'Infeksiøse og parasittære sykdommer', 'Infections and infestations', 10021881, 1),
  ('svulster', 'Godartede, ondartede og uspesifiserte svulster (inkludert cyster og polypper)', 'Neoplasms benign, malignant and unspecified (incl cysts and polyps)', 10029104, 2),
  ('blod_lymfe', 'Sykdommer i blod og lymfatiske organer', 'Blood and lymphatic system disorders', 10005329, 3),
  ('immunsystemet', 'Forstyrrelser i immunsystemet', 'Immune system disorders', 10021428, 4),
  ('endokrine', 'Endokrine sykdommer', 'Endocrine disorders', 10014698, 5),
  ('stoffskifte', 'Stoffskifte- og ernæringsbetingede sykdommer', 'Metabolism and nutrition disorders', 10027433, 6),
  ('psykiatriske', 'Psykiatriske lidelser', 'Psychiatric disorders', 10037175, 7),
  ('nevrologiske', 'Nevrologiske sykdommer', 'Nervous system disorders', 10029205, 8),
  ('oye', 'Øyesykdommer', 'Eye disorders', 10015919, 9),
  ('ore_labyrint', 'Sykdommer i øre og labyrint', 'Ear and labyrinth disorders', 10013993, 10),
  ('hjerte', 'Hjertesykdommer', 'Cardiac disorders', 10007541, 11),
  ('kar', 'Karsykdommer', 'Vascular disorders', 10047065, 12),
  ('respirasjon', 'Sykdommer i respirasjonsorganer, thorax og mediastinum', 'Respiratory, thoracic and mediastinal disorders', 10038738, 13),
  ('gastrointestinale', 'Gastrointestinale sykdommer', 'Gastrointestinal disorders', 10017947, 14),
  ('lever_galle', 'Sykdommer i lever og galleveier', 'Hepatobiliary disorders', 10019805, 15),
  ('hud', 'Hud- og underhudssykdommer', 'Skin and subcutaneous tissue disorders', 10040785, 16),
  ('muskel_skjelett', 'Sykdommer i muskler, bindevev og skjelett', 'Musculoskeletal and connective tissue disorders', 10028395, 17),
  ('nyre_urinveier', 'Sykdommer i nyre og urinveier', 'Renal and urinary disorders', 10038359, 18),
  ('svangerskap', 'Tilstander i forbindelse med svangerskap, puerperium og perinatalperioden', 'Pregnancy, puerperium and perinatal conditions', 10036585, 19),
  ('kjonnsorganer_bryst', 'Lidelser i kjønnsorganer og brystsykdommer', 'Reproductive system and breast disorders', 10038604, 20),
  ('medfodte', 'Medfødte, familiære og genetiske sykdommer', 'Congenital, familial and genetic disorders', 10010331, 21),
  ('generelle', 'Generelle lidelser og reaksjoner på administrasjonsstedet', 'General disorders and administration site conditions', 10018065, 22),
  ('undersokelser', 'Undersøkelser', 'Investigations', 10022891, 23),
  ('skader', 'Skader, forgiftninger og komplikasjoner ved medisinske prosedyrer', 'Injury, poisoning and procedural complications', 10022117, 24),
  ('prosedyrer', 'Kirurgiske prosedyrer og medisinske prosedyrer', 'Surgical and medical procedures', 10042613, 25),
  ('sosiale', 'Sosiale omstendigheter', 'Social circumstances', 10041244, 26),
  ('produktproblemer', 'Problemer med produktet', 'Product issues', 10077536, 27);

comment on table bivirkninger.organsystemer is
  'Organklassesystemene (SOC) i MedDRA, med de norske navnene fra preparatomtalene og den internasjonalt avtalte rekkefølgen (rang).';

-- --- Kildene og radene ------------------------------------------------------

create table bivirkninger.kilder (
  id uuid primary key default gen_random_uuid(),
  -- Fagsiden (objektet, ikke navnet eller nøkkelen, så kilden følger siden).
  infoside uuid not null references public.redigerbare_objekter (id),
  -- Nøkkelen importen gir kilden. En ny import med samme nøkkel på samme
  -- side erstatter den forrige.
  nokkel text not null check (char_length(nokkel) <= 100 and nokkel ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check (type in ('spc')),
  tittel text not null check (char_length(tittel) between 1 and 300),
  preparat text check (char_length(preparat) between 1 and 200),
  innehaver text check (char_length(innehaver) between 1 and 200),
  spc_versjon text check (char_length(spc_versjon) between 1 and 100),
  revisjonsdato date,
  lenke text check (char_length(lenke) <= 2000 and lenke ~ '^https?://\S+$'),
  kontrollert date,
  kontrollert_av text check (char_length(kontrollert_av) between 1 and 200),
  merknad text check (char_length(merknad) between 1 and 2000),
  importert_av text not null check (char_length(importert_av) between 1 and 200),
  importert_kl timestamptz not null default now(),
  -- md5 av importen uten importert_av: samme innhold importert på nytt endrer ingenting.
  innholdssum text not null,
  -- Importen slik den ble levert, for sporbarheten.
  importen jsonb not null,
  -- Kilden som erstattet denne, når en ny import av samme kilde kom.
  erstattet_av uuid references bivirkninger.kilder (id) deferrable initially deferred,
  erstattet_kl timestamptz,
  trukket_kl timestamptz,
  trukket_begrunnelse text check (char_length(trukket_begrunnelse) between 1 and 2000),
  check ((erstattet_av is null) = (erstattet_kl is null)),
  check ((trukket_kl is null) = (trukket_begrunnelse is null)),
  check (erstattet_kl is null or trukket_kl is null)
);

-- Bare én gjeldende import av hver kilde på en side.
create unique index bivirkninger_kilder_gjeldende_idx
  on bivirkninger.kilder (infoside, nokkel)
  where erstattet_av is null and trukket_kl is null;

comment on table bivirkninger.kilder is
  'Hver import av en preparatomtale for en fagside, med sporbarheten. Erstattede og tilbaketrukne står igjen som historikk.';

create table bivirkninger.bivirkninger (
  id bigint generated always as identity primary key,
  kilde uuid not null references bivirkninger.kilder (id),
  organsystem text not null references bivirkninger.organsystemer (kode),
  frekvens text not null references bivirkninger.frekvenser (kode),
  tekst text not null check (char_length(tekst) between 1 and 500 and tekst !~ '^\s|\s$|[\n\r\t]'),
  fotnote text check (char_length(fotnote) between 1 and 1000 and fotnote !~ '^\s|\s$|[\n\r\t]'),
  -- Rekkefølgen i preparatomtalen, innenfor organsystemet og frekvensen.
  posisjon integer not null check (posisjon >= 0),
  unique (kilde, organsystem, frekvens, posisjon)
);

create unique index bivirkninger_bivirkninger_tekst_idx
  on bivirkninger.bivirkninger (kilde, organsystem, frekvens, lower(tekst));

comment on table bivirkninger.bivirkninger is
  'Én bivirkning per rad: kilden, organsystemet, frekvensen og teksten slik den står i preparatomtalen. Begge visningene på fagsiden lages av disse radene.';

-- --- Kontrollen av importen -------------------------------------------------
--
-- Den samme kontrollen, med de samme meldingene, som importfeil() i
-- src/bivirkninger/import.ts. Endres den ene, endres den andre.

-- Feltene i objektet som ikke hører til, sortert.
create function bivirkninger.ukjente_felt(o jsonb, sti text, tillatte text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(
      format('%s%s: ukjent felt. Tillatte felt: %s.', case when sti = '' then '' else sti || '.' end, k, array_to_string(tillatte, ', '))
      order by k collate "C"),
    '{}')
  from jsonb_object_keys(o) k
  where k <> all (tillatte)
$$;

-- Feilen i et tekstfelt. Et valgfritt felt kan mangle eller være null.
create function bivirkninger.tekstfeil(v jsonb, sti text, maks integer, pakrevd boolean)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return case when pakrevd then array[sti || ': må fylles ut.'] else '{}'::text[] end;
  end if;
  if jsonb_typeof(v) <> 'string' then
    return array[sti || ': må være tekst.'];
  end if;
  t := v #>> '{}';
  if t = '' then
    return array[case when pakrevd then sti || ': må fylles ut.' else sti || ': kan ikke være tom tekst; utelat feltet i stedet.' end];
  end if;
  if t ~ '[\n\r\t]' then
    return array[sti || ': kan ikke ha linjeskift eller tabulator.'];
  end if;
  if t ~ '^\s|\s$' then
    return array[sti || ': har mellomrom i begynnelsen eller slutten.'];
  end if;
  if char_length(t) > maks then
    return array[format('%s: er lengre enn %s tegn.', sti, maks)];
  end if;
  return '{}';
end;
$$;

-- Feilen i et datofelt: en gyldig dato på formen ÅÅÅÅ-MM-DD, eller ingenting.
create function bivirkninger.datofeil(v jsonb, sti text)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  d date;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return '{}';
  end if;
  if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      d := (v #>> '{}')::date;
      if to_char(d, 'YYYY-MM-DD') = v #>> '{}' and extract(year from d) >= 1900 then
        return '{}';
      end if;
    exception when others then
      null;
    end;
  end if;
  return array[sti || ': må være en dato på formen ÅÅÅÅ-MM-DD.'];
end;
$$;

-- En verdi i en melding: tekst i anførselstegn, alt annet som JSON.
create function bivirkninger.vis(v jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'string' then '«' || (v #>> '{}') || '»' else v::text end
$$;

-- Feilen i et felt som skal være en kode fra en fast liste. % i meldingen er verdien.
create function bivirkninger.kodefeil(v jsonb, sti text, gyldig boolean, ukjent text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then array[sti || ': må fylles ut.']
    when gyldig then '{}'::text[]
    else array[sti || ': ' || replace(ukjent, '%', bivirkninger.vis(v))]
  end
$$;

create function bivirkninger.bivirkningsfeil(liste jsonb, sti text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  feil text[] := '{}';
  sett text[] := '{}';
  b jsonb;
  tekst jsonb;
  her text;
begin
  if jsonb_typeof(liste) is distinct from 'array' or jsonb_array_length(liste) = 0 then
    return array[sti || ': må være en liste med minst én bivirkning.'];
  end if;
  for k in 0 .. jsonb_array_length(liste) - 1 loop
    b := liste -> k;
    her := format('%s[%s]', sti, k);
    if jsonb_typeof(b) = 'string' then
      tekst := b;
      feil := feil || bivirkninger.tekstfeil(b, her, 500, true);
    elsif jsonb_typeof(b) = 'object' then
      tekst := b -> 'tekst';
      feil := feil
        || bivirkninger.ukjente_felt(b, her, array['tekst', 'fotnote'])
        || bivirkninger.tekstfeil(b -> 'tekst', her || '.tekst', 500, true)
        || bivirkninger.tekstfeil(b -> 'fotnote', her || '.fotnote', 1000, false);
    else
      feil := feil || (her || ': må være tekst eller et objekt med tekst og fotnote.');
      continue;
    end if;
    if jsonb_typeof(tekst) is distinct from 'string' then
      continue;
    end if;
    if lower(tekst #>> '{}') = any (sett) then
      feil := feil || format('%s: «%s» står mer enn én gang i samme kombinasjon av organsystem og frekvens.', her, tekst #>> '{}');
    end if;
    sett := sett || lower(tekst #>> '{}');
  end loop;
  return feil;
end;
$$;

create function bivirkninger.frekvensfeil(liste jsonb, sti text)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  feil text[] := '{}';
  sett text[] := '{}';
  ukjent text[];
  f jsonb;
  her text;
  kodene text := (select string_agg(kode, ', ' order by rang) from bivirkninger.frekvenser);
begin
  if jsonb_typeof(liste) is distinct from 'array' or jsonb_array_length(liste) = 0 then
    return array[sti || ': må være en liste med minst én frekvens.'];
  end if;
  for j in 0 .. jsonb_array_length(liste) - 1 loop
    f := liste -> j;
    her := format('%s[%s]', sti, j);
    if jsonb_typeof(f) <> 'object' then
      feil := feil || (her || ': må være et objekt.');
      continue;
    end if;
    feil := feil || bivirkninger.ukjente_felt(f, her, array['frekvens', 'bivirkninger']);
    ukjent := bivirkninger.kodefeil(
      f -> 'frekvens',
      her || '.frekvens',
      exists (select 1 from bivirkninger.frekvenser k where to_jsonb(k.kode) = f -> 'frekvens'),
      'ukjent frekvenskategori %. Tillatte: ' || kodene || '.');
    if cardinality(ukjent) > 0 then
      feil := feil || ukjent;
    elsif (f ->> 'frekvens') = any (sett) then
      feil := feil || format('%s.frekvens: «%s» står mer enn én gang under samme organsystem.', her, f ->> 'frekvens');
    else
      sett := sett || (f ->> 'frekvens');
    end if;
    feil := feil || bivirkninger.bivirkningsfeil(f -> 'bivirkninger', her || '.bivirkninger');
  end loop;
  return feil;
end;
$$;

-- Alle feilene i en import, med stedet i fila foran hver. Tom når importen
-- kan legges inn. Om fagsiden finnes, sjekker importer().
create function bivirkninger.importfeil(p jsonb)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  feil text[] := '{}';
  sett text[] := '{}';
  ukjent text[];
  kilde jsonb := p -> 'kilde';
  liste jsonb := p -> 'organsystemer';
  o jsonb;
  her text;
  lenke text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return array['Importen må være et JSON-objekt.'];
  end if;
  feil := feil || bivirkninger.ukjente_felt(p, '', array['format', 'stoff', 'kilde', 'organsystemer']);
  if p -> 'format' is distinct from to_jsonb('ousfar-bivirkninger/1'::text) then
    feil := feil || 'format: må være «ousfar-bivirkninger/1».'::text;
  end if;
  if jsonb_typeof(p -> 'stoff') is distinct from 'string' or (p ->> 'stoff') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    feil := feil || 'stoff: må være nøkkelen til en fagside (små bokstaver a–z, tall og enkle bindestreker).'::text;
  end if;

  if kilde is null or jsonb_typeof(kilde) <> 'object' then
    feil := feil || 'kilde: må være et objekt.'::text;
  else
    feil := feil || bivirkninger.ukjente_felt(kilde, 'kilde', array[
      'nokkel', 'type', 'tittel', 'preparat', 'innehaver', 'spc_versjon', 'revisjonsdato',
      'lenke', 'kontrollert', 'kontrollert_av', 'importert_av', 'merknad']);
    if jsonb_typeof(kilde -> 'nokkel') is distinct from 'string'
      or (kilde ->> 'nokkel') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or char_length(kilde ->> 'nokkel') > 100 then
      feil := feil || 'kilde.nokkel: må bestå av små bokstaver a–z, tall og enkle bindestreker (høyst 100 tegn).'::text;
    end if;
    feil := feil
      || bivirkninger.kodefeil(kilde -> 'type', 'kilde.type', (kilde -> 'type') = '"spc"'::jsonb, 'ukjent kildetype %. Tillatte: spc.')
      || bivirkninger.tekstfeil(kilde -> 'tittel', 'kilde.tittel', 300, true)
      || bivirkninger.tekstfeil(kilde -> 'preparat', 'kilde.preparat', 200, false)
      || bivirkninger.tekstfeil(kilde -> 'innehaver', 'kilde.innehaver', 200, false)
      || bivirkninger.tekstfeil(kilde -> 'spc_versjon', 'kilde.spc_versjon', 100, false)
      || bivirkninger.datofeil(kilde -> 'revisjonsdato', 'kilde.revisjonsdato');
    lenke := bivirkninger.tekstfeil(kilde -> 'lenke', 'kilde.lenke', 2000, false);
    if cardinality(lenke) = 0 and jsonb_typeof(kilde -> 'lenke') = 'string' and (kilde ->> 'lenke') !~ '^https?://\S+$' then
      lenke := array['kilde.lenke: må begynne med http:// eller https:// og kan ikke ha mellomrom.'];
    end if;
    feil := feil
      || lenke
      || bivirkninger.datofeil(kilde -> 'kontrollert', 'kilde.kontrollert')
      || bivirkninger.tekstfeil(kilde -> 'kontrollert_av', 'kilde.kontrollert_av', 200, false)
      || bivirkninger.tekstfeil(kilde -> 'importert_av', 'kilde.importert_av', 200, true)
      || bivirkninger.tekstfeil(kilde -> 'merknad', 'kilde.merknad', 2000, false);
  end if;

  if jsonb_typeof(liste) is distinct from 'array' or jsonb_array_length(liste) = 0 then
    feil := feil || 'organsystemer: må være en liste med minst ett organsystem.'::text;
  else
    for i in 0 .. jsonb_array_length(liste) - 1 loop
      o := liste -> i;
      her := format('organsystemer[%s]', i);
      if jsonb_typeof(o) <> 'object' then
        feil := feil || (her || ': må være et objekt.');
        continue;
      end if;
      feil := feil || bivirkninger.ukjente_felt(o, her, array['organsystem', 'frekvenser']);
      ukjent := bivirkninger.kodefeil(
        o -> 'organsystem',
        her || '.organsystem',
        exists (select 1 from bivirkninger.organsystemer k where to_jsonb(k.kode) = o -> 'organsystem'),
        'ukjent organsystem %. De tillatte kodene står i docs/bivirkninger.md.');
      if cardinality(ukjent) > 0 then
        feil := feil || ukjent;
      elsif (o ->> 'organsystem') = any (sett) then
        feil := feil || format('%s.organsystem: «%s» står mer enn én gang; samle frekvensene under ett organsystem.', her, o ->> 'organsystem');
      else
        sett := sett || (o ->> 'organsystem');
      end if;
      feil := feil || bivirkninger.frekvensfeil(o -> 'frekvenser', her || '.frekvenser');
    end loop;
  end if;
  return feil;
end;
$$;

-- --- Importen ---------------------------------------------------------------

-- Legger inn én kontrollert import og gir tilbake ID-en til kilden. Har
-- importen feil, eller finnes ikke fagsiden, avvises den med alle feilene, og
-- ingenting endres. En tidligere import av samme kilde (samme nøkkel) på samme
-- side merkes som erstattet; er innholdet det samme som sist, gis den
-- gjeldende kilden tilbake uten endringer.
create function bivirkninger.importer(p_import jsonb)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  feil text[];
  v_side uuid;
  v_sum text;
  v_forrige bivirkninger.kilder;
  v_ny uuid := gen_random_uuid();
  k jsonb := p_import -> 'kilde';
begin
  feil := bivirkninger.importfeil(p_import);
  if cardinality(feil) = 0 then
    select s.objekt_id into v_side
    from public.infosider s
    where s.slug = p_import ->> 'stoff'
    order by s.tilstand = 'publisert' desc
    limit 1;
    if v_side is null then
      feil := array[format('stoff: fant ingen fagside med nøkkelen «%s».', p_import ->> 'stoff')];
    end if;
  end if;
  if cardinality(feil) > 0 then
    raise exception using
      errcode = '22023',
      message = 'Bivirkningsimporten har feil:' || E'\n' || array_to_string(feil, E'\n');
  end if;

  v_sum := md5((p_import #- '{kilde,importert_av}')::text);
  select * into v_forrige
  from bivirkninger.kilder
  where infoside = v_side and nokkel = k ->> 'nokkel' and erstattet_av is null and trukket_kl is null
  for update;
  if found and v_forrige.innholdssum = v_sum then
    return v_forrige.id;
  end if;
  if found then
    update bivirkninger.kilder set erstattet_av = v_ny, erstattet_kl = now() where id = v_forrige.id;
  end if;

  insert into bivirkninger.kilder (
    id, infoside, nokkel, type, tittel, preparat, innehaver, spc_versjon, revisjonsdato, lenke,
    kontrollert, kontrollert_av, merknad, importert_av, innholdssum, importen)
  values (
    v_ny, v_side, k ->> 'nokkel', k ->> 'type', k ->> 'tittel', k ->> 'preparat', k ->> 'innehaver',
    k ->> 'spc_versjon', (k ->> 'revisjonsdato')::date, k ->> 'lenke', (k ->> 'kontrollert')::date,
    k ->> 'kontrollert_av', k ->> 'merknad', k ->> 'importert_av', v_sum, p_import);

  insert into bivirkninger.bivirkninger (kilde, organsystem, frekvens, tekst, fotnote, posisjon)
  select
    v_ny,
    o.v ->> 'organsystem',
    f.v ->> 'frekvens',
    case when jsonb_typeof(b.v) = 'string' then b.v #>> '{}' else b.v ->> 'tekst' end,
    case when jsonb_typeof(b.v) = 'object' then b.v ->> 'fotnote' end,
    b.n - 1
  from jsonb_array_elements(p_import -> 'organsystemer') o(v)
  cross join lateral jsonb_array_elements(o.v -> 'frekvenser') f(v)
  cross join lateral jsonb_array_elements(f.v -> 'bivirkninger') with ordinality b(v, n);

  return v_ny;
end;
$$;

-- Trekker tilbake den gjeldende importen av en kilde på en fagside, så den
-- ikke vises lenger. Radene står igjen som historikk.
create function bivirkninger.trekk_tilbake(p_stoff text, p_nokkel text, p_begrunnelse text)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_begrunnelse is null or btrim(p_begrunnelse) = '' then
    raise exception 'En kilde trekkes bare tilbake med en begrunnelse.' using errcode = '22023';
  end if;
  update bivirkninger.kilder k
  set trukket_kl = now(), trukket_begrunnelse = btrim(p_begrunnelse)
  where k.nokkel = p_nokkel
    and k.erstattet_av is null
    and k.trukket_kl is null
    and k.infoside in (select s.objekt_id from public.infosider s where s.slug = p_stoff)
  returning k.id into v_id;
  if v_id is null then
    raise exception 'Fagsiden «%» har ingen gjeldende bivirkningskilde med nøkkelen «%».', p_stoff, p_nokkel
      using errcode = 'PT404';
  end if;
  return v_id;
end;
$$;

-- --- Lesingen ---------------------------------------------------------------

-- Bivirkningene på fagsiden med nøkkelen: de gjeldende kildene og radene fra
-- dem, i preparatomtalenes rekkefølge (organsystem, frekvens, kilde, plass).
-- Navnene på frekvensene og organsystemene står i appen.
create function public.les_bivirkninger(stoff text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with kilder as (
    select k.*
    from bivirkninger.kilder k
    where k.erstattet_av is null
      and k.trukket_kl is null
      and k.infoside in (select s.objekt_id from public.infosider s where s.slug = les_bivirkninger.stoff)
  )
  select jsonb_build_object(
    'kilder', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nokkel', k.nokkel, 'type', k.type, 'tittel', k.tittel, 'preparat', k.preparat,
        'innehaver', k.innehaver, 'spc_versjon', k.spc_versjon, 'revisjonsdato', k.revisjonsdato,
        'lenke', k.lenke, 'kontrollert', k.kontrollert, 'kontrollert_av', k.kontrollert_av,
        'merknad', k.merknad, 'importert_kl', k.importert_kl, 'importert_av', k.importert_av)
        order by k.importert_kl, k.nokkel)
      from kilder k), '[]'),
    'bivirkninger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kilde', b.kilde, 'organsystem', b.organsystem, 'frekvens', b.frekvens,
        'tekst', b.tekst, 'fotnote', b.fotnote, 'posisjon', b.posisjon)
        order by o.rang, f.rang, k.importert_kl, k.nokkel, b.posisjon)
      from bivirkninger.bivirkninger b
      join kilder k on k.id = b.kilde
      join bivirkninger.organsystemer o on o.kode = b.organsystem
      join bivirkninger.frekvenser f on f.kode = b.frekvens), '[]')
  )
$$;

comment on function public.les_bivirkninger(text) is
  'Bivirkningene på en fagside: de gjeldende kildene med sporbarheten, og radene fra dem.';

-- --- Rettigheter ------------------------------------------------------------

revoke all on all tables in schema bivirkninger from public, anon, authenticated, service_role;
revoke all on all sequences in schema bivirkninger from public, anon, authenticated, service_role;
revoke all on all functions in schema bivirkninger from public, anon, authenticated, service_role;
revoke all on function public.les_bivirkninger(text) from public, anon, authenticated, service_role;
grant execute on function public.les_bivirkninger(text) to authenticated, service_role;
