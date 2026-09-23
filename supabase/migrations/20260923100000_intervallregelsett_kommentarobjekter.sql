-- De enkle konsentrasjonsreglene peker på de felles kommentarobjektene i
-- stedet for å ha sine egne kommentarer.
--
-- Kommentar og regel er separate objekter (docs/analyttsider-og-redigering.md,
-- avsnitt 10): et regelsett inneholder, versjonerer og publiserer ikke
-- kommentartekstene, men peker på kommentarobjekter med stabile ID-er. Hver
-- kommentar har sin egen historikk og publisering, og samme kommentar kan
-- brukes av flere regler og regelsett.
--
-- Denne migrasjonen legger om skrivingen og lesingen. Den neste flytter
-- kommentarene som alt finnes, over i kommentarobjekter med de samme
-- ID-ene, og fjerner den gamle kommentartabellen. Bakgrunnen står i
-- docs/fortolkningsregler.md.

-- --- Et objekt med en ID som alt er valgt ----------------------------------

-- Som opprett_utkast, men med ID-en gitt. Kommentarene som flyttes, beholder
-- ID-ene reglene alt peker på, og redigeringen lager en ny kommentar og
-- reglene som bruker den, i samme lagring. Krever administrator.
create function intern.opprett_objekt(p_type public.objekttype, p_objekt uuid, p_innhold jsonb)
returns public.objektstatus
language plpgsql
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
begin
  if p_type is null then
    raise exception 'Objekttypen mangler.' using errcode = '22023';
  end if;
  if p_objekt is null then
    raise exception 'ID-en til det nye objektet mangler.' using errcode = '22023';
  end if;
  if exists (select 1 from public.redigerbare_objekter o where o.id = p_objekt) then
    raise exception 'Det finnes alt et objekt med ID-en %.', p_objekt using errcode = '22023';
  end if;

  insert into public.redigerbare_objekter (id, type)
  values (p_objekt, p_type);

  -- Utkastet må finnes før innholdet kan legges inn i det. Koblingen til
  -- revisjonen kontrolleres først når transaksjonen er ferdig.
  insert into public.objekttilstander (objekt_id, tilstand, revisjon)
  values (p_objekt, 'utkast', 1);

  perform intern.ny_revisjon(
    p_objekt,
    'opprettet',
    intern.skriv(p_type, p_objekt, 'utkast', p_innhold),
    forfatter
  );
  return intern.status(p_objekt);
end;
$$;

-- Samme oppførsel som før, nå gjennom den felles veien.
create or replace function public.opprett_utkast(objekttype public.objekttype, innhold jsonb)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
begin
  return intern.opprett_objekt(objekttype, gen_random_uuid(), innhold);
end;
$$;

-- --- Koblingene til kommentarene -------------------------------------------

-- Kommentarene er ikke lenger rader i regelsettet. Koblingene peker på
-- kommentarobjektene, og det publiserte bare på publiserte kommentarer, med
-- den samme kontrollen som resten av faginnholdet.
alter table public.intervallregelsett
  drop constraint intervallregelsett_cutoff_innledning_fkey,
  drop constraint intervallregelsett_cutoff_kommentar_fkey,
  add constraint intervallregelsett_cutoff_ulike check (cutoff_innledning_id <> cutoff_kommentar_id);

alter table public.intervallregler
  drop constraint intervallregler_kommentar_fkey;

drop index public.intervallregler_kommentar_idx;
create index intervallregler_kommentar_idx on public.intervallregler (kommentar_id);

create trigger intervallregler_kommentar
before insert or update on public.intervallregler
for each row execute function intern.krev_objekttype('kommentar_id', 'kommentar');

create trigger intervallregelsett_cutoff
before insert or update on public.intervallregelsett
for each row
when (new.cutoff_innledning_id is not null)
execute function intern.krev_objekttype(
  'cutoff_innledning_id', 'kommentar', 'cutoff_kommentar_id', 'kommentar'
);

comment on table public.intervallregelsett is
  'Et regelsett for én analyttkode: konsentrasjonsintervaller med kommentar og eventuell handling. Reglene står i intervallregler, tekstene i kommentarer.';
comment on column public.intervallregler.kommentar_id is
  'Kommentarobjektet regelen gir. Teksten står i kommentarer og har sin egen historikk.';

-- --- Kontrollen av kommentarene --------------------------------------------

-- En konsentrasjonsregel limer inn teksten som den står, og fyller ikke inn
-- noe. Kommentarene den peker på, kan derfor ikke ha plassholdere. De er de
-- samme i alle revisjoner av en kommentar, så det holder å se på én rad.
create function intern.krev_kommentarer_uten_plassholdere(p_ider uuid[])
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  navn text;
  plassholdere text[];
begin
  select k.navn, k.plassholdere into navn, plassholdere
  from public.kommentarer k
  where k.objekt_id = any (p_ider) and cardinality(k.plassholdere) > 0
  limit 1;
  if found then
    raise exception 'Kommentaren «%» har plassholdere (%) og kan ikke brukes i en konsentrasjonsregel.',
      navn, array_to_string(plassholdere, ', ') using errcode = '22023';
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
--   intervaller    [{ "niva", "handling", "kommentar" }], nedenfra og opp;
--                  kommentar er ID-en til et kommentarobjekt
--   ringegrense    referansetallet som vises, eller null uten ringeregel
--   cutoff         null, eller { "innledning", "kommentar" }: to
--                  kommentarobjekter som settes sammen, innledningen først
--
-- Revisjoner fra før kommentarene ble egne objekter, har i tillegg
-- "kommentarer": [{ "id", "tekst" }]. Slike revisjoner kan fortsatt
-- gjenopprettes: ID-ene er de samme kommentarobjektene, og listen må stemme
-- med dem reglene bruker. Tekstene i den tas ikke inn igjen; de har sin egen
-- historikk i kommentarobjektene.
create or replace function intern.skriv_intervallregelsett(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  eldre_kommentarer jsonb;
  eldre jsonb;
  eldre_ider uuid[] := array[]::uuid[];
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
  if jsonb_typeof(p_innhold) = 'object' and p_innhold ? 'kommentarer' then
    eldre_kommentarer := p_innhold -> 'kommentarer';
    p_innhold := p_innhold - 'kommentarer';
  end if;

  perform intern.krev_felt(
    p_innhold,
    array['analyttkode', 'enhet', 'desimaler', 'skillepunkter', 'intervaller', 'ringegrense', 'cutoff']
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

  -- Selve regelsettet først, så reglene. Cut-off og ringegrensen settes etter
  -- at intervallene er kontrollert.
  insert into public.intervallregelsett (objekt_id, tilstand, analyttkode, enhet, desimaler)
  values (p_objekt, p_tilstand, kode, ny_enhet, nye_desimaler)
  on conflict on constraint intervallregelsett_pkey do update set
    analyttkode = excluded.analyttkode,
    enhet = excluded.enhet,
    desimaler = excluded.desimaler,
    ringegrense = null,
    cutoff_innledning_id = null,
    cutoff_kommentar_id = null;

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
    if kommentar <> all (brukte) then
      brukte := brukte || kommentar;
    end if;

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

    -- Koblingen kontrolleres av intervallregler_kommentar: den må peke på en
    -- kommentar, og det publiserte på en publisert kommentar.
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

  -- Cut-off: en innledning satt foran en av kommentarene intervallene gir.
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
    if innledning <> all (brukte) then
      brukte := brukte || innledning;
    end if;
  elsif jsonb_typeof(cutoff) is distinct from 'null' then
    raise exception 'Feltet cutoff må være et objekt eller null.' using errcode = '22023';
  end if;

  update public.intervallregelsett s set
    ringegrense = ring_grense,
    cutoff_innledning_id = innledning,
    cutoff_kommentar_id = hovedkommentar
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand;

  perform intern.krev_kommentarer_uten_plassholdere(brukte);
  perform intern.krev_sammenhengende_intervaller(p_objekt, p_tilstand);

  -- En eldre revisjon: listen må være nøyaktig kommentarene reglene bruker.
  if eldre_kommentarer is not null then
    if jsonb_typeof(eldre_kommentarer) is distinct from 'array' then
      raise exception 'Kommentarene må være en liste.' using errcode = '22023';
    end if;
    for eldre in select e.v from jsonb_array_elements(eldre_kommentarer) e(v) loop
      if jsonb_typeof(eldre) is distinct from 'object' then
        raise exception 'En kommentar må være et objekt.' using errcode = '22023';
      end if;
      perform intern.krev_felt(eldre, array['id', 'tekst']);
      perform intern.tekst(eldre, 'tekst');
      eldre_ider := eldre_ider || intern.id(eldre, 'id');
    end loop;
    if cardinality(eldre_ider) <> (select count(distinct e) from unnest(eldre_ider) e)
      or not (eldre_ider @> brukte and brukte @> eldre_ider)
    then
      raise exception 'Kommentarene i revisjonen stemmer ikke med dem reglene bruker.' using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function intern.les_intervallregelsett(p_objekt uuid, p_tilstand public.objekttilstand)
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
    end
  )
  from public.intervallregelsett s
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand
$$;

-- --- Lagringen redigeringen gjør -------------------------------------------

-- Regelsettet og kommentarene det bruker, lagret som utkast i én transaksjon:
-- enten alt eller ingenting. `kommentarer` er de nye og endrede:
--
--   [{ "id", "revisjon", "innhold" }]
--
-- der `revisjon` er den redigeringen åpnet, eller null for en ny kommentar
-- med den ID-en. Hver kommentar lagres mot sin revisjon og regelsettet mot
-- `forventet_revisjon`, så en konflikt på noen av dem stopper det hele.
create function public.lagre_intervallregelsett(
  objekt uuid, forventet_revisjon integer, innhold jsonb, kommentarer jsonb
)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
declare
  kommentar jsonb;
  kommentar_id uuid;
begin
  perform intern.krev_admin();
  if (select o.type from public.redigerbare_objekter o where o.id = objekt) is distinct from 'intervallregelsett' then
    raise exception 'Fant ikke regelsettet.' using errcode = 'PT404';
  end if;
  if jsonb_typeof(kommentarer) is distinct from 'array' then
    raise exception 'Kommentarene må være en liste.' using errcode = '22023';
  end if;
  if jsonb_array_length(kommentarer) > 50 then
    raise exception 'Høyst 50 kommentarer kan lagres sammen med et regelsett.' using errcode = '22023';
  end if;

  for kommentar in
    select e.v from jsonb_array_elements(kommentarer) with ordinality e(v, nr) order by e.nr
  loop
    if jsonb_typeof(kommentar) is distinct from 'object' then
      raise exception 'En kommentar må være et objekt.' using errcode = '22023';
    end if;
    perform intern.krev_felt(kommentar, array['id', 'revisjon', 'innhold']);
    kommentar_id := intern.id(kommentar, 'id');
    if jsonb_typeof(kommentar -> 'revisjon') = 'null' then
      perform intern.opprett_objekt('kommentar', kommentar_id, kommentar -> 'innhold');
    else
      if (select o.type from public.redigerbare_objekter o where o.id = kommentar_id) is distinct from 'kommentar' then
        raise exception 'Fant ikke kommentaren som skulle lagres.' using errcode = 'PT404';
      end if;
      perform public.lagre_utkast(kommentar_id, intern.heltall(kommentar, 'revisjon'), kommentar -> 'innhold');
    end if;
  end loop;

  return public.lagre_utkast(objekt, forventet_revisjon, innhold);
end;
$$;

comment on function public.lagre_intervallregelsett(uuid, integer, jsonb, jsonb) is
  'Lagrer et intervallregelsett og de nye og endrede kommentarene det bruker, som utkast i én transaksjon. Avvises med PT409 hvis noen av revisjonene er endret. Krever administrator.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on function public.lagre_intervallregelsett(uuid, integer, jsonb, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.lagre_intervallregelsett(uuid, integer, jsonb, jsonb) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
