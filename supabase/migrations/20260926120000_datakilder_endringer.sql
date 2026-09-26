-- Endringsdeteksjon for de farmakogenetiske datakildene (ClinPGx og CPIC):
-- hva som er nytt, endret eller borte siden forrige vellykkede henting, om
-- endringen er klinisk eller bare metadata, og nok til å spore den tilbake til
-- kjøringen, releasen og kildens egen merknad.
--
-- Bakgrunnen står i docs/datakilder.md. Kort fortalt:
--
--   * Endringene fanges av triggere på datatabellene i `clinpgx` og `cpic`,
--     ikke i synkroniseringsfunksjonene. Alt som bytter inn data, logges likt,
--     og synkroniseringene er uendret. Triggerne kjører i samme transaksjon som
--     byttet: avvises byttet, forsvinner loggføringen med det.
--   * Første gang noe hentes (et kjemikalie i ClinPGx, en type i CPIC), er det
--     et grunnlag, ikke en endring: én føring, ikke én per objekt.
--   * Om en endring er klinisk eller metadata, avgjøres av feltene som er
--     endret og reglene i `datakilder.feltregler`. Et felt uten regel regnes
--     som klinisk, så noe nytt fra kilden aldri havner blant metadataene av
--     seg selv. Et felt som bare finnes på én side (fordi OUSFARs lesing har
--     fått eller mistet feltet), og en endring bare i rådataene, er metadata.
--   * Ingenting her går til sluttbrukerne. Administratorer leser loggen med
--     `datakilder_status()`.

create schema datakilder;
revoke all on schema datakilder from public;

comment on schema datakilder is
  'Endringsloggen for datakildene ClinPGx og CPIC. Ingen av API-rollene har tilgang; administratorer leser den med datakilder_status().';

-- --- Reglene --------------------------------------------------------------

-- Hvilke felt som er metadata og hvilke som er kliniske, per kilde og type.
-- `felt = '*'` er standarden for typen, og gjelder også når et objekt kommer
-- til eller forsvinner. Uten regel: klinisk.
create table datakilder.feltregler (
  kilde text not null check (kilde in ('clinpgx', 'cpic')),
  type text not null,
  felt text not null,
  niva text not null check (niva in ('klinisk', 'metadata')),
  primary key (kilde, type, felt)
);

comment on table datakilder.feltregler is
  'Om en endring i et felt er klinisk eller metadata. felt = ''*'' er standarden for typen; uten regel er feltet klinisk.';

insert into datakilder.feltregler (kilde, type, felt, niva) values
  -- ClinPGx. Feltnavnene er OUSFARs (src/clinpgx/modell.ts).
  ('clinpgx', 'kjemikalie', '*', 'metadata'),
  ('clinpgx', 'kjemikalie', 'finnes', 'klinisk'),
  ('clinpgx', 'retningslinje', 'navn', 'metadata'),
  ('clinpgx', 'retningslinje', 'legemidler', 'metadata'),
  ('clinpgx', 'retningslinje', 'litteratur', 'metadata'),
  ('clinpgx', 'preparatomtale', 'navn', 'metadata'),
  ('clinpgx', 'preparatomtale', 'legemidler', 'metadata'),
  ('clinpgx', 'preparatomtale', 'litteratur', 'metadata'),
  ('clinpgx', 'klinisk', 'nummer', 'metadata'),
  ('clinpgx', 'klinisk', 'navn', 'metadata'),
  ('clinpgx', 'klinisk', 'poeng', 'metadata'),
  ('clinpgx', 'klinisk', 'legemidler', 'metadata'),
  ('clinpgx', 'klinisk', 'retningslinjer', 'metadata'),
  ('clinpgx', 'klinisk', 'preparatomtaler', 'metadata'),
  -- CPIC. Feltnavnene er OUSFARs (src/cpic/modell.ts).
  ('cpic', 'legemiddel', '*', 'metadata'),
  ('cpic', 'legemiddel', 'retningslinje_id', 'klinisk'),
  ('cpic', 'gen', '*', 'metadata'),
  ('cpic', 'gen', 'oppslagsmetode', 'klinisk'),
  ('cpic', 'retningslinje', 'navn', 'metadata'),
  ('cpic', 'retningslinje', 'url', 'metadata'),
  ('cpic', 'retningslinje', 'clinpgx_id', 'metadata'),
  ('cpic', 'par', 'pmid', 'metadata'),
  ('cpic', 'par', 'clinpgx_niva', 'metadata'),
  ('cpic', 'genresultat_oppslag', 'beskrivelse', 'metadata'),
  ('cpic', 'allel', 'pmid', 'metadata'),
  ('cpic', 'alleldefinisjon', '*', 'metadata'),
  ('cpic', 'publikasjon', '*', 'metadata'),
  ('cpic', 'term', '*', 'metadata'),
  ('cpic', 'endring', '*', 'metadata');

-- --- Loggen ---------------------------------------------------------------

create table datakilder.endringer (
  id bigint generated always as identity primary key,
  kilde text not null check (kilde in ('clinpgx', 'cpic')),
  -- Kjøringen som hentet endringen (clinpgx.synkroniseringer eller
  -- cpic.synkroniseringer), når den ble hentet av en kjøring.
  synk_id bigint,
  type text not null,
  objekt_id text not null,
  -- Kjemikaliet i ClinPGx en annotasjon kom til eller forsvant fra.
  kontekst text,
  art text not null check (art in ('ny', 'endret', 'fjernet', 'grunnlag')),
  niva text not null check (niva in ('klinisk', 'metadata')),
  -- Hva objektet er, i klartekst, slik det var da endringen ble logget.
  etikett text not null,
  -- De endrede feltene; «raa.» foran et felt som bare er endret i rådataene.
  felt text[] not null default '{}',
  -- Endret: verdiene i de endrede feltene før og etter. Ny: objektet slik det
  -- kom. Fjernet: objektet slik det var.
  foer jsonb,
  etter jsonb,
  -- Sporet tilbake til kilden: kildens egen siste merknad (ClinPGx), CPICs
  -- versjonsnummer for raden, antall i et grunnlag.
  spor jsonb not null default '{}',
  txid bigint not null default txid_current(),
  registrert_kl timestamptz not null default now()
);

create index datakilder_endringer_synk_idx on datakilder.endringer (kilde, synk_id);
create index datakilder_endringer_tid_idx on datakilder.endringer (registrert_kl desc, id desc);
create index datakilder_endringer_txid_idx on datakilder.endringer (txid) where art = 'fjernet';

comment on table datakilder.endringer is
  'Hva som er nytt, endret eller borte i ClinPGx- og CPIC-kopien, per kjøring, klinisk eller metadata, med sporet tilbake til kilden.';

-- --- Sammenligningen --------------------------------------------------------

-- Toppnivåfeltene som er ulike i to versjoner av et objekt. `begge` er usann
-- når feltet bare finnes på den ene siden.
create function datakilder.ulike_felt(gammel jsonb, ny jsonb)
returns table (felt text, foer jsonb, etter jsonb, begge boolean)
language sql
immutable
set search_path = ''
as $$
  select n.k, gammel -> n.k, ny -> n.k, (gammel ? n.k and ny ? n.k)
  from (
    select jsonb_object_keys(case when jsonb_typeof(gammel) = 'object' then gammel else '{}' end)
    union
    select jsonb_object_keys(case when jsonb_typeof(ny) = 'object' then ny else '{}' end)
  ) n (k)
  where (gammel -> n.k) is distinct from (ny -> n.k)
$$;

-- Om en endring i feltet er klinisk: regelen for feltet, ellers for typen,
-- ellers klinisk.
create function datakilder.feltniva(kilde text, type text, felt text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select r.niva from datakilder.feltregler r where r.kilde = $1 and r.type = $2 and r.felt = $3),
    (select r.niva from datakilder.feltregler r where r.kilde = $1 and r.type = $2 and r.felt = '*'),
    'klinisk')
$$;

-- Hva et objekt er, i klartekst: legemiddelet og genresultatene for en
-- anbefaling, genet og allelet for et allel, og ellers navnet.
create function datakilder.etikett(kilde text, type text, data jsonb, objekt_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select left(coalesce(nullif(
    case
      when $1 = 'cpic' and $2 in ('anbefaling', 'par') then concat_ws(' · ',
        (select l.data ->> 'navn' from cpic.legemiddel l where l.cpic_id = $3 ->> 'legemiddel_id'),
        case when $2 = 'par' then $3 ->> 'gen' end,
        (select string_agg(e.key || ' ' || e.value, ', ' order by e.key)
         from jsonb_each_text(case when jsonb_typeof($3 -> 'oppslagsnokkel') = 'object' then $3 -> 'oppslagsnokkel' else '{}' end) e),
        $3 ->> 'populasjon')
      when $1 = 'cpic' and $2 = 'genresultat' then concat_ws(' ', $3 ->> 'gen', $3 ->> 'resultat')
      when $1 = 'cpic' and $2 = 'genresultat_oppslag' then $3 ->> 'beskrivelse'
      when $1 = 'cpic' and $2 = 'diplotype' then concat_ws(' ',
        (select string_agg(g, '/' order by g)
         from jsonb_object_keys(case when jsonb_typeof($3 -> 'nokkel') = 'object' then $3 -> 'nokkel' else '{}' end) g),
        $3 ->> 'diplotype')
      when $1 = 'cpic' and $2 in ('allel', 'alleldefinisjon') then concat_ws(' ', $3 ->> 'gen', $3 ->> 'navn')
      when $1 = 'clinpgx' and $2 = 'klinisk' then concat_ws(' · ',
        (select string_agg(g ->> 'symbol', ', ')
         from jsonb_array_elements(case when jsonb_typeof($3 -> 'gener') = 'array' then $3 -> 'gener' else '[]' end) g),
        $3 ->> 'variant',
        'nivå ' || ($3 ->> 'niva'),
        (select string_agg(k ->> 'navn', ', ')
         from jsonb_array_elements(case when jsonb_typeof($3 -> 'legemidler') = 'array' then $3 -> 'legemidler' else '[]' end) k))
      else coalesce($3 ->> 'navn', $3 ->> 'symbol', $3 ->> 'tittel', $3 ->> 'term', $3 ->> 'merknad')
    end, ''), $4), 300)
$$;

-- ClinPGx' egen siste merknad om en annotasjon (`history` i svaret): når,
-- hva slags og hva ClinPGx skrev.
create function datakilder.clinpgx_kildenotat(raa jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object('dato', h ->> 'date', 'type', h ->> 'type', 'merknad', h ->> 'description'))
  from jsonb_array_elements(case when jsonb_typeof(raa -> 'history') = 'array' then raa -> 'history' else '[]' end) h
  order by h ->> 'date' desc nulls last
  limit 1
$$;

-- Logger endringene i et sett objekter fra én kilde og én type:
-- objekter = [{id, foer, etter, foer_raa, etter_raa, kontekst, spor}, ...].
-- Uten `foer` er objektet nytt, uten `etter` fjernet. Med begge logges det
-- bare om noe er ulikt: i de leste dataene (klinisk eller metadata etter
-- reglene), ellers i rådataene (metadata).
create function datakilder.logg(kilde text, type text, synk bigint, objekter jsonb)
returns void
language sql
set search_path = ''
as $$
  with o as (
    select n, x ->> 'id' as id, x ->> 'kontekst' as kontekst,
           nullif(x -> 'foer', 'null') as foer, nullif(x -> 'etter', 'null') as etter,
           x -> 'foer_raa' as foer_raa, x -> 'etter_raa' as etter_raa,
           coalesce(nullif(x -> 'spor', 'null'), '{}') as spor
    from jsonb_array_elements(objekter) with ordinality as a (x, n)
  ),
  data_endret as (
    select o.n,
           array_agg(u.felt order by u.felt) as felt,
           bool_or(u.begge and datakilder.feltniva(logg.kilde, logg.type, u.felt) = 'klinisk') as klinisk,
           jsonb_object_agg(u.felt, u.foer) as foer,
           jsonb_object_agg(u.felt, u.etter) as etter
    from o, datakilder.ulike_felt(o.foer, o.etter) u
    where o.foer is not null and o.etter is not null
    group by o.n
  ),
  raa_endret as (
    select o.n,
           array_agg('raa.' || u.felt order by u.felt) as felt,
           jsonb_object_agg(u.felt, u.foer) as foer,
           jsonb_object_agg(u.felt, u.etter) as etter
    from o, datakilder.ulike_felt(o.foer_raa, o.etter_raa) u
    where o.foer is not null and o.etter is not null and o.foer = o.etter
    group by o.n
  ),
  rader as (
    select o.id, o.kontekst, o.spor, 'ny' as art, datakilder.feltniva(logg.kilde, logg.type, '*') as niva,
           o.etter as data, '{}'::text[] as felt, null::jsonb as foer, o.etter as etter
    from o where o.foer is null and o.etter is not null
    union all
    select o.id, o.kontekst, o.spor, 'fjernet', datakilder.feltniva(logg.kilde, logg.type, '*'),
           o.foer, '{}', o.foer, null
    from o where o.foer is not null and o.etter is null
    union all
    select o.id, o.kontekst, o.spor, 'endret', case when d.klinisk then 'klinisk' else 'metadata' end,
           o.etter, d.felt, d.foer, d.etter
    from o join data_endret d using (n)
    union all
    select o.id, o.kontekst, o.spor, 'endret', 'metadata', o.etter, r.felt, r.foer, r.etter
    from o join raa_endret r using (n)
  )
  insert into datakilder.endringer (kilde, synk_id, type, objekt_id, kontekst, art, niva, etikett, felt, foer, etter, spor)
  select logg.kilde, logg.synk, logg.type, r.id, r.kontekst, r.art, r.niva,
         datakilder.etikett(logg.kilde, logg.type, r.data, r.id), r.felt, r.foer, r.etter, r.spor
  from rader r
$$;

-- Et grunnlag: noe er hentet for første gang. Én føring, med antallet.
create function datakilder.grunnlag(kilde text, type text, synk bigint, objekt_id text, etikett text, antall integer)
returns void
language sql
set search_path = ''
as $$
  insert into datakilder.endringer (kilde, synk_id, type, objekt_id, art, niva, etikett, spor)
  values ($1, $3, $2, $4, 'grunnlag', 'metadata', $5, jsonb_strip_nulls(jsonb_build_object('antall', $6)))
$$;

-- --- CPIC -------------------------------------------------------------------
--
-- cpic_fullfor_synk bytter inn en type med én insert … on conflict og én
-- update for det som er borte. Triggerne ser radene før og etter. En type som
-- aldri er byttet inn før (ingen kontrollsum i cpic.entiteter ennå), er et
-- grunnlag.

create function datakilder.cpic_etter_bytte()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk, og en nested loop over dem blir
-- kvadratisk når mange rader byttes inn på én gang (CPIC har over hundre
-- tusen diplotyper).
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from cpic.synkroniseringer s where s.status = 'pagar');
  grunnlag boolean := (select e.sha256 is null from cpic.entiteter e where e.navn = tg_table_name);
  antall integer;
begin
  if tg_op = 'INSERT' then
    if grunnlag then
      select count(*) into antall from nye;
      if antall > 0 then
        perform datakilder.grunnlag('cpic', tg_table_name, synk, tg_table_name, 'Første innlasting fra CPIC', antall);
      end if;
      return null;
    end if;
    perform datakilder.logg('cpic', tg_table_name, synk, coalesce((
      select jsonb_agg(jsonb_build_object('id', n.cpic_id, 'etter', n.data,
                                          'spor', jsonb_build_object('cpic_versjon', n.cpic_versjon)))
      from nye n), '[]'));
    return null;
  end if;

  perform datakilder.logg('cpic', tg_table_name, synk, coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.cpic_id,
      'foer', case when g.utgatt_kl is null then g.data end,
      'etter', case when n.utgatt_kl is null then n.data end,
      'foer_raa', g.raa,
      'etter_raa', n.raa,
      'spor', jsonb_strip_nulls(jsonb_build_object(
        'cpic_versjon', case when g.cpic_versjon is distinct from n.cpic_versjon
                             then jsonb_build_object('foer', g.cpic_versjon, 'etter', n.cpic_versjon)
                             else to_jsonb(n.cpic_versjon) end,
        'tilbake', case when g.utgatt_kl is not null and n.utgatt_kl is null then true end))))
    from gamle g
    join nye n on n.cpic_id = g.cpic_id
    where (g.utgatt_kl is null) is distinct from (n.utgatt_kl is null)
       or (n.utgatt_kl is null and g.hash is distinct from n.hash)), '[]'));
  return null;
end;
$$;

do $$
declare
  e text;
begin
  for e in select navn from cpic.entiteter loop
    execute format(
      'create trigger datakilder_ny after insert on cpic.%I referencing new table as nye
         for each statement execute function datakilder.cpic_etter_bytte()', e);
    execute format(
      'create trigger datakilder_endret after update on cpic.%I referencing old table as gamle new table as nye
         for each statement execute function datakilder.cpic_etter_bytte()', e);
  end loop;
end;
$$;

-- --- ClinPGx ----------------------------------------------------------------
--
-- clinpgx_lagre_kjemikalie bytter inn ett kjemikalie om gangen: kjemikaliet,
-- så annotasjonene (upsert), så hvilke annotasjoner kjemikaliet har (slettes
-- og settes inn på nytt), så ryddes annotasjoner ingen viser til. Derfor:
--
--   * kjemikaliet: første vellykkede henting er et grunnlag, og merkes for
--     resten av transaksjonen så koblingene ikke logges som nye; ellers
--     logges endringene i dataene og i `finnes`;
--   * en annotasjon som endres: logges én gang, uansett hvor mange
--     kjemikalier den gjelder;
--   * koblingene mellom kjemikalie og annotasjon: det som slettes, logges
--     foreløpig som fjernet; det som settes inn igjen i samme transaksjon,
--     stryker den foreløpige føringen, og det som er nytt, logges som nytt.

-- Kjemikaliene som er hentet for første gang i denne transaksjonen.
create function datakilder.clinpgx_grunnlag()
returns text[]
language sql
stable
set search_path = ''
as $$
  select string_to_array(nullif(current_setting('datakilder.clinpgx_grunnlag', true), ''), ',')
$$;

create function datakilder.clinpgx_kjemikalie_endret()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk, og en nested loop over dem blir
-- kvadratisk når mange rader byttes inn på én gang (CPIC har over hundre
-- tusen diplotyper).
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from clinpgx.synkroniseringer s where s.status = 'pagar');
  forste text[];
  id text;
begin
  -- Hentet for første gang: satt inn med data, eller fått data for første gang.
  -- (Transisjonstabellen `gamle` finnes bare ved update, derfor to spørringer.)
  if tg_op = 'INSERT' then
    forste := array(select n.clinpgx_id from nye n where n.data is not null);
  else
    forste := array(
      select n.clinpgx_id from nye n join gamle g on g.clinpgx_id = n.clinpgx_id
      where n.data is not null and g.data is null);
  end if;
  foreach id in array forste loop
    perform datakilder.grunnlag('clinpgx', 'kjemikalie', synk, id,
      coalesce((select n.data ->> 'navn' from nye n where n.clinpgx_id = id), id) || ': første henting fra ClinPGx', null);
  end loop;
  if cardinality(forste) > 0 then
    perform set_config('datakilder.clinpgx_grunnlag',
      array_to_string(coalesce(datakilder.clinpgx_grunnlag(), '{}') || forste, ','), true);
  end if;

  if tg_op = 'UPDATE' then
    perform datakilder.logg('clinpgx', 'kjemikalie', synk, coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.clinpgx_id,
        'foer', g.data || jsonb_build_object('finnes', g.finnes),
        'etter', coalesce(n.data, g.data) || jsonb_build_object('finnes', n.finnes)))
      from gamle g
      join nye n on n.clinpgx_id = g.clinpgx_id
      where g.data is not null
        and (g.finnes is distinct from n.finnes or (n.data is not null and g.hash is distinct from n.hash))), '[]'));
  end if;
  return null;
end;
$$;

create trigger datakilder_ny after insert on clinpgx.kjemikalier referencing new table as nye
  for each statement execute function datakilder.clinpgx_kjemikalie_endret();
create trigger datakilder_endret after update on clinpgx.kjemikalier referencing old table as gamle new table as nye
  for each statement execute function datakilder.clinpgx_kjemikalie_endret();

create function datakilder.clinpgx_annotasjon_endret()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk, og en nested loop over dem blir
-- kvadratisk når mange rader byttes inn på én gang (CPIC har over hundre
-- tusen diplotyper).
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from clinpgx.synkroniseringer s where s.status = 'pagar');
  t text;
begin
  foreach t in array array['retningslinje', 'preparatomtale', 'klinisk'] loop
    perform datakilder.logg('clinpgx', t, synk, coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.clinpgx_id,
        'foer', g.data,
        'etter', n.data,
        'foer_raa', g.raa,
        'etter_raa', n.raa,
        'spor', jsonb_strip_nulls(jsonb_build_object('kildenotat', datakilder.clinpgx_kildenotat(n.raa)))))
      from gamle g
      join nye n on n.type = g.type and n.clinpgx_id = g.clinpgx_id
      where n.type = t and (g.hash is distinct from n.hash or g.raa is distinct from n.raa)), '[]'));
  end loop;
  return null;
end;
$$;

create trigger datakilder_endret after update on clinpgx.annotasjoner referencing old table as gamle new table as nye
  for each statement execute function datakilder.clinpgx_annotasjon_endret();

create function datakilder.clinpgx_koblinger_endret()
returns trigger
language plpgsql
set search_path = ''
-- Transisjonstabellene har ingen statistikk, og en nested loop over dem blir
-- kvadratisk når mange rader byttes inn på én gang (CPIC har over hundre
-- tusen diplotyper).
set enable_nestloop = off
as $$
declare
  synk bigint := (select s.id from clinpgx.synkroniseringer s where s.status = 'pagar');
  t text;
begin
  if tg_op = 'DELETE' then
    foreach t in array array['retningslinje', 'preparatomtale', 'klinisk'] loop
      perform datakilder.logg('clinpgx', t, synk, coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.annotasjon_id,
          'kontekst', g.kjemikalie_id,
          'foer', coalesce(a.data, jsonb_build_object('id', g.annotasjon_id))))
        from gamle g
        left join clinpgx.annotasjoner a on a.type = g.type and a.clinpgx_id = g.annotasjon_id
        where g.type = t), '[]'));
    end loop;
    return null;
  end if;

  -- Nye koblinger. En kobling som ble slettet tidligere i transaksjonen og
  -- settes inn igjen, er ingen endring; den foreløpige føringen strykes under.
  foreach t in array array['retningslinje', 'preparatomtale', 'klinisk'] loop
    perform datakilder.logg('clinpgx', t, synk, coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.annotasjon_id,
        'kontekst', n.kjemikalie_id,
        'etter', a.data,
        'spor', jsonb_strip_nulls(jsonb_build_object('kildenotat', datakilder.clinpgx_kildenotat(a.raa)))))
      from nye n
      join clinpgx.annotasjoner a on a.type = n.type and a.clinpgx_id = n.annotasjon_id
      where n.type = t
        and n.kjemikalie_id <> all (coalesce(datakilder.clinpgx_grunnlag(), '{}'))
        and not exists (
          select 1 from datakilder.endringer e
          where e.txid = txid_current() and e.art = 'fjernet' and e.kilde = 'clinpgx'
            and e.type = n.type and e.objekt_id = n.annotasjon_id and e.kontekst = n.kjemikalie_id)), '[]'));
  end loop;

  delete from datakilder.endringer e
  using nye n
  where e.txid = txid_current() and e.art = 'fjernet' and e.kilde = 'clinpgx'
    and e.type = n.type and e.objekt_id = n.annotasjon_id and e.kontekst = n.kjemikalie_id;
  return null;
end;
$$;

create trigger datakilder_fjernet after delete on clinpgx.kjemikalie_annotasjoner referencing old table as gamle
  for each statement execute function datakilder.clinpgx_koblinger_endret();
create trigger datakilder_ny after insert on clinpgx.kjemikalie_annotasjoner referencing new table as nye
  for each statement execute function datakilder.clinpgx_koblinger_endret();

-- --- Lesingen ---------------------------------------------------------------

-- Driftstatusen for administratorer: for hver kilde de siste kjøringene med
-- hvor mye som var klinisk endret, metadata og grunnlag, siste vellykkede
-- kjøring, og de siste endringene med sporet tilbake til kjøringen.
create function public.datakilder_status(antall integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.er_admin() then
    raise exception 'Bare for administratorer.' using errcode = '42501';
  end if;

  return (
    with kjoringer as (
      select 'clinpgx' as kilde, s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             null::text as release, s.parserversjon::text as versjon, s.antall, s.feil
      from clinpgx.synkroniseringer s
      union all
      select 'cpic', s.id, s.status, s.utlost_av, s.startet_kl, s.avsluttet_kl,
             s.release, s.skjemaversjon, s.antall, s.feil
      from cpic.synkroniseringer s
    ),
    siste as (
      select k.*, row_number() over (partition by k.kilde order by k.id desc) as nr
      from kjoringer k
    ),
    opptalt as (
      select e.kilde, e.synk_id,
             jsonb_build_object(
               'klinisk', count(*) filter (where e.niva = 'klinisk' and e.art <> 'grunnlag'),
               'metadata', count(*) filter (where e.niva = 'metadata' and e.art <> 'grunnlag'),
               'grunnlag', count(*) filter (where e.art = 'grunnlag')) as endringer
      from datakilder.endringer e
      where e.synk_id is not null
      group by e.kilde, e.synk_id
    )
    select jsonb_build_object(
      'kjoringer', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kilde', s.kilde, 'id', s.id, 'status', s.status, 'utlost_av', s.utlost_av,
          'startet_kl', s.startet_kl, 'avsluttet_kl', s.avsluttet_kl, 'release', s.release,
          'versjon', s.versjon, 'antall', s.antall, 'feil', s.feil,
          'endringer', coalesce(o.endringer, '{"klinisk": 0, "metadata": 0, "grunnlag": 0}'))
          order by s.kilde, s.id desc)
        from siste s
        left join opptalt o on o.kilde = s.kilde and o.synk_id = s.id
        where s.nr <= 10), '[]'),
      'endringer', coalesce((
        select jsonb_agg(to_jsonb(e) - 'txid' order by e.registrert_kl desc, e.id desc)
        from (
          select e.* from datakilder.endringer e
          order by e.registrert_kl desc, e.id desc
          limit least(greatest(coalesce(datakilder_status.antall, 200), 1), 1000)
        ) e), '[]')
    )
  );
end;
$$;

-- --- Rettigheter ------------------------------------------------------------

revoke all on all tables in schema datakilder from public, anon, authenticated, service_role;
revoke all on all functions in schema datakilder from public, anon, authenticated, service_role;

revoke all on function public.datakilder_status(integer) from public, anon, authenticated, service_role;
grant execute on function public.datakilder_status(integer) to authenticated;
