-- Stoffregisteret i databasen: kategoriene, plasseringene, arkivet og papirkurven.
--
-- Inndelingen av stoffregisteret i kategorier og underkategorier sto til nå i
-- datafilen `src/data/stoffregister.json`. Den flyttes hit, så brukerne kan
-- lage, gi nytt navn til, flytte, arkivere og slette kategorier, og flytte
-- stoffene mellom dem, fra helsidevisningen av registeret (`#/stoffregister`).
-- Stoffene selv — nøkkelen, navnet, aliasene og koblingene til
-- laboratorieanalyttene — står fortsatt i datafilen og i fagsidene
-- (`infosider`); her står bare hvor hvert stoff er plassert, etter nøkkelen.
--
-- * `stoffkategorier`: kategoriene, i to nivåer. En underkategori har
--   `forelder_id`; en kategori med underkategorier kan ikke selv bli en.
--   Navnet er unikt blant søsknene. `ikon` er et navn i appens ikonregister,
--   og tomt gir plassholderikonet.
-- * `stoffplasseringer`: stoffene i hver kategori. Et stoff kan stå flere
--   steder (karbamazepin er både stemningsstabiliserende og antiepileptikum),
--   og et stoff uten plassering står under «Andre stoffer» i appen.
-- * `stoffstatus`: stoffene som ikke er aktive. `arkivert` er tatt ut av
--   registeret og kan hentes tilbake av alle; `papirkurv` er slettet og kan
--   hentes tilbake av en administrator i 30 dager; `fjernet` er slettet for
--   godt. `fjernet` blir stående som en gravstein, så et stoff fra datafilen
--   ikke dukker opp igjen; en ny fagside med den samme nøkkelen fjerner den.
-- * `slettede_stoffsider`: loggen over fagsider som er slettet for godt.
--
-- Alle innloggede kan endre kategoriene, plassere stoffer, arkivere og hente
-- tilbake, og slette en fagside som bare har et navn (og angre det). Bare
-- administratorer kan slette en fagside med innhold, se og tømme papirkurven,
-- og slette noe for godt. Alt skrives gjennom funksjonene nederst.
--
-- Å slette en fagside for godt er det andre unntaket fra at historikken for
-- faginnholdet aldri slettes (det første er en referanse som aldri er brukt):
-- siden, kortene på den, revisjonene og publiseringene deres går, men bare når
-- ingenting annet i historikken peker på dem. Diskusjonene på siden og
-- favorittene går med.
--
-- Diskusjonene får en ny slags side: `register:stoffregister`, helsiden.

-- --- Diskusjonene på helsiden --------------------------------------------------

create or replace function intern.er_diskusjonsside(side text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(side) <= 220 and side ~ '^(stoff|fortolkning|register):[a-z0-9]+(-[a-z0-9]+)*$'
$$;

-- --- Tabellene -----------------------------------------------------------------

create table public.stoffkategorier (
  id uuid primary key default gen_random_uuid(),
  forelder_id uuid references public.stoffkategorier (id) on delete cascade,
  navn text not null,
  posisjon integer not null default 0,
  ikon text,
  arkivert_kl timestamptz,
  opprettet_av uuid,
  opprettet_kl timestamptz not null default now(),
  constraint stoffkategorier_navn check (char_length(navn) between 1 and 80 and navn = btrim(navn)),
  -- «Andre stoffer» er appens samlekategori for stoffene uten plassering.
  constraint stoffkategorier_navn_reservert check (forelder_id is not null or lower(navn) <> 'andre stoffer'),
  constraint stoffkategorier_ikon check (ikon is null or (char_length(ikon) <= 60 and ikon ~ '^[a-z][a-z0-9-]*$')),
  constraint stoffkategorier_ikke_egen_forelder check (forelder_id is distinct from id)
);

comment on table public.stoffkategorier is
  'Kategoriene og underkategoriene i stoffregisteret, i to nivåer. Skrives gjennom funksjonene.';
comment on column public.stoffkategorier.ikon is
  'Navnet på ikonet i appens ikonregister. Tomt gir plassholderikonet.';

create unique index stoffkategorier_navn_idx
  on public.stoffkategorier (coalesce(forelder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(navn));
create index stoffkategorier_forelder_idx on public.stoffkategorier (forelder_id);

create table public.stoffplasseringer (
  stoff text not null,
  kategori_id uuid not null references public.stoffkategorier (id) on delete cascade,
  plassert_kl timestamptz not null default now(),
  constraint stoffplasseringer_pkey primary key (stoff, kategori_id),
  constraint stoffplasseringer_stoff check (char_length(stoff) <= 200 and stoff ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index stoffplasseringer_kategori_idx on public.stoffplasseringer (kategori_id);

comment on table public.stoffplasseringer is
  'Stoffene i hver kategori, etter stoffets nøkkel. Et stoff kan stå i flere kategorier. Skrives gjennom funksjonene.';

create table public.stoffstatus (
  stoff text primary key,
  status text not null,
  endret_av uuid,
  endret_kl timestamptz not null default now(),
  constraint stoffstatus_stoff check (char_length(stoff) <= 200 and stoff ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint stoffstatus_status check (status in ('arkivert', 'papirkurv', 'fjernet'))
);

create index stoffstatus_papirkurv_idx on public.stoffstatus (endret_kl) where status = 'papirkurv';

comment on table public.stoffstatus is
  'Stoffene som ikke er aktive: arkivert, i papirkurven eller fjernet for godt (en gravstein). Aktive stoffer har ingen rad.';

create table public.slettede_stoffsider (
  id bigint generated always as identity primary key,
  stoff text not null,
  navn text not null,
  objekt_id uuid not null,
  objekter integer not null,
  slettet_av uuid,
  slettet_kl timestamptz not null default now()
);

comment on table public.slettede_stoffsider is
  'Fagsidene som er slettet for godt: nøkkelen, navnet, objektet og hvor mange objekter som gikk med.';

-- To nivåer: en underkategori har en forelder uten forelder, og en kategori
-- med underkategorier blir ikke selv en underkategori.
create function intern.krev_to_kategorinivaer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.forelder_id is not null and (
    exists (select 1 from public.stoffkategorier k where k.id = new.forelder_id and k.forelder_id is not null)
    or exists (select 1 from public.stoffkategorier k where k.forelder_id = new.id)
  ) then
    raise exception 'Stoffregisteret har bare kategorier og underkategorier, ikke flere nivåer.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger stoffkategorier_to_nivaer
before insert or update of forelder_id on public.stoffkategorier
for each row execute function intern.krev_to_kategorinivaer();

-- --- Inndelingen fra datafilen ---------------------------------------------------

-- Kategoriene slik de sto i `src/data/stoffregister.json`, i samme rekkefølge.
do $$
declare
  data jsonb := $json$[
  {"navn": "Antidepressiver", "underkategorier": [{"navn": "SSRI", "stoffer": ["citalopram", "escitalopram", "fluoksetin", "fluvoksamin", "paroksetin", "sertralin"]}, {"navn": "SNRI", "stoffer": ["duloksetin", "venlafaksin"]}, {"navn": "NDRI", "stoffer": ["bupropion"]}, {"navn": "TCA", "stoffer": ["amitriptylin", "doksepin", "klomipramin", "nortriptylin", "trimipramin"]}, {"navn": "Reseptorantagonister (NaSSA)", "stoffer": ["mianserin", "mirtazapin"]}, {"navn": "Multimodale", "stoffer": ["vortioksetin"]}, {"navn": "NMDA-reseptorantagonister", "stoffer": ["ketamin"]}]},
  {"navn": "Stemningsstabiliserende", "stoffer": ["karbamazepin", "lamotrigin", "litium", "valproat"]},
  {"navn": "Antipsykotika", "underkategorier": [{"navn": "Førstegenerasjonsmidler", "stoffer": ["flupentiksol", "haloperidol", "klorprotiksen", "levomepromazin", "perfenazin", "zuklopentiksol"]}, {"navn": "Andregenerasjonsmidler", "stoffer": ["amisulprid", "aripiprazol", "brekspiprazol", "kariprazin", "klozapin", "kvetiapin", "lurasidon", "olanzapin", "paliperidon", "risperidon", "sertindol", "ziprasidon"]}]},
  {"navn": "Antiepileptika", "stoffer": ["fenobarbital", "fenytoin", "gabapentin", "karbamazepin", "klonazepam", "lamotrigin", "levetiracetam", "okskarbazepin", "topiramat", "valproat"]},
  {"navn": "Alkohol og GHB", "stoffer": ["etanol", "ghb"]},
  {"navn": "Benzodiazepiner og Z-hypnotika", "stoffer": ["alprazolam", "diazepam", "flunitrazepam", "klonazepam", "nitrazepam", "oksazepam", "zolpidem", "zopiklon"]},
  {"navn": "Opioider", "stoffer": ["buprenorfin", "fentanyl", "ketobemidon", "kodein", "metadon", "morfin", "oksykodon", "petidin", "tapentadol", "tramadol"]},
  {"navn": "Stimulanter", "stoffer": ["amfetamin", "atomoksetin", "kokain", "mdma", "metamfetamin", "metylfenidat"]},
  {"navn": "Cannabinoider", "stoffer": ["thc", "cbd"]},
  {"navn": "Hallusinogene stoffer", "stoffer": ["ketamin"]},
  {"navn": "Antihypertensiver", "underkategorier": [{"navn": "ACE-hemmere", "stoffer": ["enalapril", "lisinopril", "ramipril"]}, {"navn": "Aldosteronantagonister", "stoffer": ["eplerenon", "spironolakton"]}, {"navn": "Alfa- og betablokkere", "stoffer": ["karvedilol", "labetalol"]}, {"navn": "Alfablokkere", "stoffer": ["doksazosin"]}, {"navn": "ARB", "stoffer": ["irbesartan", "kandesartan", "losartan", "telmisartan", "valsartan"]}, {"navn": "Betablokkere", "stoffer": ["atenolol", "bisoprolol", "metoprolol"]}, {"navn": "Diuretika", "stoffer": ["bendroflumetiazid", "bumetanid", "furosemid", "hydroklortiazid"]}, {"navn": "Kalsiumantagonister", "stoffer": ["amlodipin", "diltiazem", "lerkanidipin", "nifedipin", "verapamil"]}]}
]$json$;
  kategori record;
  under record;
  kategori_id uuid;
  under_id uuid;
begin
  -- Bare i en database uten kategorier, så migrasjonen ikke legger dem inn to ganger.
  if exists (select 1 from public.stoffkategorier) then
    return;
  end if;
  for kategori in select k.verdi, k.nr from jsonb_array_elements(data) with ordinality k(verdi, nr) order by k.nr loop
    insert into public.stoffkategorier (navn, posisjon)
    values (kategori.verdi ->> 'navn', kategori.nr - 1)
    returning id into kategori_id;
    insert into public.stoffplasseringer (stoff, kategori_id)
    select s, kategori_id from jsonb_array_elements_text(coalesce(kategori.verdi -> 'stoffer', '[]')) s;
    for under in
      select u.verdi, u.nr from jsonb_array_elements(coalesce(kategori.verdi -> 'underkategorier', '[]')) with ordinality u(verdi, nr)
      order by u.nr
    loop
      insert into public.stoffkategorier (forelder_id, navn, posisjon)
      values (kategori_id, under.verdi ->> 'navn', under.nr - 1)
      returning id into under_id;
      insert into public.stoffplasseringer (stoff, kategori_id)
      select s, under_id from jsonb_array_elements_text(under.verdi -> 'stoffer') s;
    end loop;
  end loop;
end;
$$;

-- --- Nøkkelen følger fagsiden -------------------------------------------------------

-- Når en publisert fagside får ny nøkkel, flytter plasseringene og statusen med.
create function intern.stoffregister_folg_nokkel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stoffplasseringer (stoff, kategori_id, plassert_kl)
  select new.slug, p.kategori_id, p.plassert_kl
  from public.stoffplasseringer p
  where p.stoff = old.slug
  on conflict do nothing;
  delete from public.stoffplasseringer p where p.stoff = old.slug;

  update public.stoffstatus s
  set stoff = new.slug
  where s.stoff = old.slug
    and not exists (select 1 from public.stoffstatus t where t.stoff = new.slug);
  delete from public.stoffstatus s where s.stoff = old.slug;
  return null;
end;
$$;

create trigger infosider_stoffregister_folger_nokkel
after update of slug on public.infosider
for each row
when (new.tilstand = 'publisert' and old.slug is distinct from new.slug)
execute function intern.stoffregister_folg_nokkel();

-- En ny fagside med nøkkelen til et stoff som er fjernet for godt, tar stoffet i bruk igjen.
create function intern.ny_stoffside_fjerner_gravstein()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stoffstatus s where s.stoff = new.slug and s.status = 'fjernet';
  return null;
end;
$$;

create trigger infosider_fjerner_gravstein
after insert on public.infosider
for each row execute function intern.ny_stoffside_fjerner_gravstein();

-- --- Sletting for godt ---------------------------------------------------------

-- Historikken er fortsatt uforanderlig. Unntakene er en referanse som aldri
-- har vært publisert eller sitert (slett_referanse), og fagsidene og kortene
-- på dem som slettes for godt fra papirkurven (intern.fjern_stoff) — og bare
-- de objektene, i transaksjonen som sletter dem.
create or replace function intern.avvis_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slettes text := nullif(current_setting('intern.sletter_referanse', true), '');
  sider text := nullif(current_setting('intern.sletter_stoffside', true), '');
  objekt text := coalesce(to_jsonb(old) ->> 'objekt_id', to_jsonb(old) ->> 'id');
begin
  if tg_op = 'DELETE'
    and slettes is not null
    and tg_table_name in ('redigerbare_objekter', 'objektrevisjoner')
    and slettes = objekt
    and exists (
      select 1 from public.redigerbare_objekter o
      where o.id = slettes::uuid and o.type = 'referanse'
    )
  then
    return old;
  end if;
  if tg_op = 'DELETE'
    and sider is not null
    and tg_table_name in ('redigerbare_objekter', 'objektrevisjoner', 'objektpubliseringer')
    and objekt = any (string_to_array(sider, ','))
    and exists (
      select 1 from public.redigerbare_objekter o
      where o.id = objekt::uuid and o.type in ('infoside', 'innholdselement')
    )
  then
    return old;
  end if;
  raise exception 'Historikken for faginnholdet kan ikke endres eller slettes.'
    using errcode = '42501';
end;
$$;

-- Sant når fagsiden har noe mer enn navnet: kort (også fjernede kort og
-- utkast) eller kilder på et panel.
create function intern.stoffside_har_innhold(side uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.innholdselementer e where e.infoside_id = side)
    or exists (select 1 from public.referansekoblinger k where k.objekt_id = side)
$$;

-- Sletter stoffet for godt: fagsiden med kortene, revisjonene og
-- publiseringene, diskusjonene på siden, favorittene, varslene om siden og
-- plasseringene i registeret. Statusen blir `fjernet`. Gir tilbake antall
-- objekter som ble slettet. Avviser når noe utenfor siden peker på den.
create function intern.fjern_stoff(stoff text, bruker uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  side uuid;
  sidenavn text;
  objekter uuid[];
  tekster text[];
begin
  select s.objekt_id, s.navn into side, sidenavn
  from public.infosider s
  where s.slug = fjern_stoff.stoff
  order by (s.tilstand = 'publisert') desc
  limit 1;

  if side is not null then
    perform 1 from public.redigerbare_objekter o where o.id = side for update;
    objekter := array[side] || coalesce(
      (select array_agg(distinct e.objekt_id) from public.innholdselementer e where e.infoside_id = side),
      '{}'
    );
    tekster := (select array_agg(o::text) from unnest(objekter) o);

    -- Det som skal kunne gjenopprettes, må finnes: står noen av objektene i
    -- historikken til noe annet, blir siden liggende.
    if exists (
      select 1
      from public.objektrevisjoner r
      cross join unnest(tekster) t(id)
      where r.objekt_id <> all (objekter)
        and strpos(r.innhold::text, t.id) > 0
    ) then
      raise exception 'Fagsiden kan ikke slettes for godt, fordi noe annet i historikken peker på den. Den blir liggende i papirkurven.'
        using errcode = '22023';
    end if;

    insert into public.slettede_stoffsider (stoff, navn, objekt_id, objekter, slettet_av)
    values (fjern_stoff.stoff, sidenavn, side, cardinality(objekter), bruker);

    delete from public.varsler v where v.gruppe = 'favoritter:' || side::text;

    perform set_config('intern.sletter_stoffside', array_to_string(tekster, ','), true);
    delete from public.objektpubliseringer p where p.objekt_id = any (objekter);
    delete from public.objekttilstander t where t.objekt_id = any (objekter);
    delete from public.objektrevisjoner r where r.objekt_id = any (objekter);
    delete from public.redigerbare_objekter o where o.id = any (objekter);
    perform set_config('intern.sletter_stoffside', '', true);
  end if;

  delete from public.diskusjoner d where d.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.diskusjonskategorier k where k.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.stoffavoritter f where f.stoff = fjern_stoff.stoff;
  delete from public.stoffplasseringer p where p.stoff = fjern_stoff.stoff;
  insert into public.stoffstatus (stoff, status, endret_av)
  values (fjern_stoff.stoff, 'fjernet', bruker)
  on conflict on constraint stoffstatus_pkey do update set status = 'fjernet', endret_av = excluded.endret_av, endret_kl = now();

  return coalesce(cardinality(objekter), 0);
end;
$$;

-- --- Rekkefølgen -----------------------------------------------------------------

-- Søsknene under én forelder (eller kategoriene øverst når den er null) får
-- plassene 0, 1, 2 …, med `forst` på plassen `indeks`. De arkiverte står
-- utenfor rekkefølgen.
create function intern.ordne_stoffkategorier(forelder uuid, forst uuid default null, indeks integer default null)
returns void
language sql
security definer
set search_path = ''
as $$
  with rekke as (
    select k.id, row_number() over (order by k.posisjon, k.opprettet_kl, k.id) - 1 as nr
    from public.stoffkategorier k
    where k.forelder_id is not distinct from ordne_stoffkategorier.forelder
      and k.arkivert_kl is null
      and k.id is distinct from ordne_stoffkategorier.forst
  ),
  ny as (
    select r.id, case when ordne_stoffkategorier.indeks is not null and r.nr >= greatest(ordne_stoffkategorier.indeks, 0) then r.nr + 1 else r.nr end as plass
    from rekke r
    union all
    select ordne_stoffkategorier.forst, least(greatest(coalesce(ordne_stoffkategorier.indeks, 2147483646), 0), (select count(*) from rekke))
    where ordne_stoffkategorier.forst is not null
  )
  update public.stoffkategorier k
  set posisjon = ny.plass
  from ny
  where k.id = ny.id and k.posisjon is distinct from ny.plass
$$;

-- --- Hjelpere -------------------------------------------------------------------------

create function intern.krev_registerbruker()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  bruker uuid := (select auth.uid());
begin
  if bruker is null then
    raise exception 'Bare innloggede kan endre stoffregisteret.' using errcode = '42501';
  end if;
  return bruker;
end;
$$;

-- Kategorien, låst for endringen. Avviser en som ikke finnes.
create function intern.laas_stoffkategori(kategori uuid)
returns public.stoffkategorier
language plpgsql
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  select * into rad from public.stoffkategorier k where k.id = laas_stoffkategori.kategori for update;
  if rad.id is null then
    raise exception 'Kategorien finnes ikke lenger.' using errcode = 'P0002';
  end if;
  return rad;
end;
$$;

-- Avviser et navn som alt står blant søsknene, med en melding som kan vises.
create function intern.krev_ledig_kategorinavn(forelder uuid, navn text, unntatt uuid default null)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.stoffkategorier k
    where k.forelder_id is not distinct from krev_ledig_kategorinavn.forelder
      and lower(k.navn) = lower(btrim(krev_ledig_kategorinavn.navn))
      and k.id is distinct from krev_ledig_kategorinavn.unntatt
  ) then
    raise exception 'Det finnes alt en kategori som heter «%» her.', btrim(navn) using errcode = '23505';
  end if;
end;
$$;

-- Forelderen en ny eller flyttet underkategori skal stå under: en aktiv kategori øverst.
create function intern.krev_kategoriforelder(forelder uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if forelder is not null and not exists (
    select 1 from public.stoffkategorier k
    where k.id = krev_kategoriforelder.forelder and k.forelder_id is null and k.arkivert_kl is null
  ) then
    raise exception 'Kategorien underkategorien skulle stå under, finnes ikke lenger.' using errcode = 'P0002';
  end if;
end;
$$;

-- --- Det appen kaller: lesingen ------------------------------------------------------

-- Hele registeret i ett kall: kategoriene, plasseringene, statusene og
-- fagsidene i én tilstand, med om hver side har innhold og oppsummeringen
-- (rikteksten i panelet `identitet`). Utkastet leses bare av administratorer;
-- andre får det publiserte.
create function public.les_stoffregister(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tilstand as (
    select case when public.er_admin() then les_stoffregister.sidetilstand else 'publisert'::public.objekttilstand end as t
  )
  select jsonb_build_object(
    'kategorier', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', k.id, 'forelder', k.forelder_id, 'navn', k.navn, 'posisjon', k.posisjon,
          'ikon', k.ikon, 'arkivert_kl', k.arkivert_kl
        )
        order by k.posisjon, k.opprettet_kl, k.id
      )
      from public.stoffkategorier k
    ), '[]'::jsonb),
    'plasseringer', coalesce((
      select jsonb_agg(jsonb_build_object('stoff', p.stoff, 'kategori', p.kategori_id) order by p.stoff collate "C", p.kategori_id)
      from public.stoffplasseringer p
    ), '[]'::jsonb),
    'status', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'stoff', s.stoff, 'status', s.status, 'endret_kl', s.endret_kl,
          'endret_av', nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
        )
        order by s.stoff collate "C"
      )
      from public.stoffstatus s
      left join public.profiles p on p.id = s.endret_av
    ), '[]'::jsonb),
    'sider', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.objekt_id, 'slug', s.slug, 'navn', s.navn,
          'innhold', intern.stoffside_har_innhold(s.objekt_id),
          'oppsummering', (
            select e.data -> 'dokument'
            from public.innholdselementer e
            where e.infoside_id = s.objekt_id and e.tilstand = s.tilstand
              and e.panel = 'identitet' and e.elementtype = 'riktekst'
            limit 1
          )
        )
        order by lower(s.navn)
      )
      from public.infosider s, tilstand
      where s.tilstand = tilstand.t
    ), '[]'::jsonb)
  )
$$;

comment on function public.les_stoffregister(public.objekttilstand) is
  'Kategoriene, plasseringene, statusene og fagsidene i stoffregisteret. Utkastet bare for administratorer.';

-- --- Det appen kaller: kategoriene ---------------------------------------------------

-- En ny kategori, sist blant søsknene: øverst, eller under `forelder`. Gir ID-en tilbake.
create function public.opprett_stoffkategori(navn text, forelder uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  ny uuid;
begin
  perform intern.krev_kategoriforelder(opprett_stoffkategori.forelder);
  perform intern.krev_ledig_kategorinavn(opprett_stoffkategori.forelder, opprett_stoffkategori.navn);
  insert into public.stoffkategorier (forelder_id, navn, posisjon, opprettet_av)
  values (
    opprett_stoffkategori.forelder,
    btrim(opprett_stoffkategori.navn),
    coalesce((
      select max(k.posisjon) + 1 from public.stoffkategorier k
      where k.forelder_id is not distinct from opprett_stoffkategori.forelder and k.arkivert_kl is null
    ), 0),
    bruker
  )
  returning id into ny;
  return ny;
end;
$$;

comment on function public.opprett_stoffkategori(text, uuid) is
  'Lager en kategori sist øverst, eller en underkategori sist under forelderen, og gir ID-en tilbake.';

-- Nytt navn på en kategori.
create function public.endre_stoffkategori(kategori uuid, navn text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(endre_stoffkategori.kategori);
  perform intern.krev_ledig_kategorinavn(rad.forelder_id, endre_stoffkategori.navn, rad.id);
  update public.stoffkategorier k set navn = btrim(endre_stoffkategori.navn) where k.id = rad.id;
end;
$$;

comment on function public.endre_stoffkategori(uuid, text) is
  'Gir kategorien nytt navn. Navnet må være ledig blant søsknene.';

-- Flytter kategorien til plassen `indeks` under `forelder`: øverst når den er
-- null, ellers som underkategori. En kategori med underkategorier blir ikke
-- selv en underkategori.
create function public.flytt_stoffkategori(kategori uuid, forelder uuid, indeks integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(flytt_stoffkategori.kategori);
  if rad.arkivert_kl is not null then
    raise exception 'Kategorien er arkivert. Hent den tilbake før den flyttes.' using errcode = '22023';
  end if;
  if rad.forelder_id is distinct from flytt_stoffkategori.forelder then
    perform intern.krev_kategoriforelder(flytt_stoffkategori.forelder);
    perform intern.krev_ledig_kategorinavn(flytt_stoffkategori.forelder, rad.navn, rad.id);
    update public.stoffkategorier k set forelder_id = flytt_stoffkategori.forelder where k.id = rad.id;
    perform intern.ordne_stoffkategorier(rad.forelder_id);
  end if;
  perform intern.ordne_stoffkategorier(flytt_stoffkategori.forelder, rad.id, flytt_stoffkategori.indeks);
end;
$$;

comment on function public.flytt_stoffkategori(uuid, uuid, integer) is
  'Flytter kategorien til plassen indeks (fra 0) øverst eller under forelderen.';

-- Arkiverer kategorien, eller henter den tilbake sist blant søsknene.
create function public.arkiver_stoffkategori(kategori uuid, arkivert boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(arkiver_stoffkategori.kategori);
  if arkiver_stoffkategori.arkivert = (rad.arkivert_kl is not null) then
    return;
  end if;
  if not arkiver_stoffkategori.arkivert and rad.forelder_id is not null then
    perform intern.krev_kategoriforelder(rad.forelder_id);
  end if;
  update public.stoffkategorier k
  set arkivert_kl = case when arkiver_stoffkategori.arkivert then now() end,
      posisjon = case when arkiver_stoffkategori.arkivert then k.posisjon else 2147483646 end
  where k.id = rad.id;
  perform intern.ordne_stoffkategorier(rad.forelder_id);
end;
$$;

comment on function public.arkiver_stoffkategori(uuid, boolean) is
  'Arkiverer kategorien med underkategoriene, eller henter den tilbake sist blant søsknene.';

-- Sletter kategorien med underkategoriene. Stoffene i den mister bare den
-- plasseringen. Har den stoffer, kan bare en administrator slette den.
create function public.slett_stoffkategori(kategori uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(slett_stoffkategori.kategori);
  if not public.er_admin() and exists (
    select 1 from public.stoffplasseringer p
    join public.stoffkategorier k on k.id = p.kategori_id
    where k.id = rad.id or k.forelder_id = rad.id
  ) then
    raise exception 'Kategorien har stoffer. Flytt dem først, eller be en administrator slette den.' using errcode = '42501';
  end if;
  delete from public.stoffkategorier k where k.id = rad.id;
  perform intern.ordne_stoffkategorier(rad.forelder_id);
end;
$$;

comment on function public.slett_stoffkategori(uuid) is
  'Sletter kategorien med underkategoriene. En kategori med stoffer bare for administratorer.';

-- --- Det appen kaller: stoffene ----------------------------------------------------

-- Flytter stoffet fra kategorien `fra` til `til`. Uten `fra` legges det til
-- i `til` (og står der i tillegg); uten `til` tas det ut av `fra`.
create function public.plasser_stoff(stoff text, fra uuid, til uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_registerbruker();
  if plasser_stoff.til is not null then
    if not exists (
      select 1 from public.stoffkategorier k
      where k.id = plasser_stoff.til and k.arkivert_kl is null
        and not exists (select 1 from public.stoffkategorier f where f.id = k.forelder_id and f.arkivert_kl is not null)
    ) then
      raise exception 'Kategorien finnes ikke lenger, eller er arkivert.' using errcode = 'P0002';
    end if;
    insert into public.stoffplasseringer (stoff, kategori_id)
    values (plasser_stoff.stoff, plasser_stoff.til)
    on conflict do nothing;
  end if;
  if plasser_stoff.fra is not null and plasser_stoff.fra is distinct from plasser_stoff.til then
    delete from public.stoffplasseringer p where p.stoff = plasser_stoff.stoff and p.kategori_id = plasser_stoff.fra;
  end if;
end;
$$;

comment on function public.plasser_stoff(text, uuid, uuid) is
  'Flytter stoffet fra én kategori til en annen, legger det til i en kategori (uten fra) eller tar det ut (uten til).';

-- Arkiverer stoffet, eller henter det tilbake fra arkivet.
create function public.arkiver_stoff(stoff text, arkivert boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  naa text := (select s.status from public.stoffstatus s where s.stoff = arkiver_stoff.stoff for update);
begin
  if naa is not null and naa <> 'arkivert' then
    raise exception 'Fagsiden er slettet.' using errcode = '22023';
  end if;
  if arkiver_stoff.arkivert then
    insert into public.stoffstatus (stoff, status, endret_av)
    values (arkiver_stoff.stoff, 'arkivert', bruker)
    on conflict on constraint stoffstatus_pkey do nothing;
  else
    delete from public.stoffstatus s where s.stoff = arkiver_stoff.stoff and s.status = 'arkivert';
  end if;
end;
$$;

comment on function public.arkiver_stoff(text, boolean) is
  'Arkiverer stoffet eller henter det tilbake. Alle innloggede.';

-- Legger fagsiden i papirkurven. Bare en side i databasen kan slettes; en
-- side med innhold bare av en administrator.
create function public.slett_stoff(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  side uuid;
begin
  select s.objekt_id into side from public.infosider s where s.slug = slett_stoff.stoff limit 1;
  if side is null then
    raise exception 'Stoffet har ingen fagside å slette. Arkiver det i stedet.' using errcode = '22023';
  end if;
  if not public.er_admin() and intern.stoffside_har_innhold(side) then
    raise exception 'Bare administratorer kan slette en fagside med innhold. Arkiver den i stedet.' using errcode = '42501';
  end if;
  insert into public.stoffstatus (stoff, status, endret_av)
  values (slett_stoff.stoff, 'papirkurv', bruker)
  on conflict on constraint stoffstatus_pkey do update set status = 'papirkurv', endret_av = excluded.endret_av, endret_kl = now();
end;
$$;

comment on function public.slett_stoff(text) is
  'Legger fagsiden i papirkurven. Alle kan slette en side med bare navn; en side med innhold bare administratorer.';

-- Henter fagsiden tilbake fra papirkurven: en administrator, eller den som
-- la den der (så den som slettet, kan angre det uten å se papirkurven).
create function public.gjenopprett_stoff(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  rad public.stoffstatus;
begin
  select * into rad from public.stoffstatus s
  where s.stoff = gjenopprett_stoff.stoff and s.status = 'papirkurv'
  for update;
  if rad.stoff is null then
    raise exception 'Fagsiden ligger ikke i papirkurven.' using errcode = 'P0002';
  end if;
  if not public.er_admin() and rad.endret_av is distinct from bruker then
    raise exception 'Bare administratorer kan hente fagsider tilbake fra papirkurven.' using errcode = '42501';
  end if;
  delete from public.stoffstatus s where s.stoff = rad.stoff;
end;
$$;

comment on function public.gjenopprett_stoff(text) is
  'Henter fagsiden tilbake fra papirkurven. En administrator, eller den som la den der.';

-- Sletter fagsiden i papirkurven for godt.
create function public.slett_stoff_for_godt(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin public.profiles := intern.krev_admin();
begin
  if not exists (
    select 1 from public.stoffstatus s
    where s.stoff = slett_stoff_for_godt.stoff and s.status = 'papirkurv'
    for update
  ) then
    raise exception 'Fagsiden ligger ikke i papirkurven.' using errcode = 'P0002';
  end if;
  perform intern.fjern_stoff(slett_stoff_for_godt.stoff, admin.id);
end;
$$;

comment on function public.slett_stoff_for_godt(text) is
  'Sletter fagsiden i papirkurven for godt, med kortene, historikken og diskusjonene. Krever administrator.';

-- Sletter alt i papirkurven som er eldre enn `alder`, eller alt. Det som ikke
-- kan slettes for godt, blir liggende. Gir tilbake antallet som ble slettet.
create function intern.tom_papirkurv(alder interval, bruker uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad record;
  antall integer := 0;
begin
  for rad in
    select s.stoff from public.stoffstatus s
    where s.status = 'papirkurv' and (tom_papirkurv.alder is null or s.endret_kl < now() - tom_papirkurv.alder)
    order by s.endret_kl
    for update skip locked
  loop
    begin
      perform intern.fjern_stoff(rad.stoff, tom_papirkurv.bruker);
      antall := antall + 1;
    exception when sqlstate '22023' then
      -- Noe annet peker på siden; den blir liggende.
      null;
    end;
  end loop;
  return antall;
end;
$$;

-- Tømmer papirkurven.
create function public.tom_stoffpapirkurven()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin public.profiles := intern.krev_admin();
begin
  return intern.tom_papirkurv(null, admin.id);
end;
$$;

comment on function public.tom_stoffpapirkurven() is
  'Sletter alt i papirkurven for godt, utenom det noe annet peker på. Krever administrator.';

-- Sletter det som har ligget i papirkurven i mer enn 30 dager. Appen kaller
-- den når registeret hentes, så alle innloggede kan; den gjør ikke annet.
create function public.rydd_stoffpapirkurven()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_registerbruker();
  return intern.tom_papirkurv(interval '30 days', null);
end;
$$;

comment on function public.rydd_stoffpapirkurven() is
  'Sletter det som har ligget i papirkurven i mer enn 30 dager.';

-- --- Radsikkerhet og rettigheter -------------------------------------------------------

alter table public.stoffkategorier enable row level security;
alter table public.stoffplasseringer enable row level security;
alter table public.stoffstatus enable row level security;
alter table public.slettede_stoffsider enable row level security;

create policy "Innloggede ser kategoriene" on public.stoffkategorier for select to authenticated using (true);
create policy "Innloggede ser plasseringene" on public.stoffplasseringer for select to authenticated using (true);
create policy "Innloggede ser statusene" on public.stoffstatus for select to authenticated using (true);
create policy "Bare administratorer ser loggen" on public.slettede_stoffsider
for select to authenticated using ((select public.er_admin()));

revoke all on table
  public.stoffkategorier,
  public.stoffplasseringer,
  public.stoffstatus,
  public.slettede_stoffsider
from anon, authenticated, service_role;

grant select on table
  public.stoffkategorier,
  public.stoffplasseringer,
  public.stoffstatus,
  public.slettede_stoffsider
to authenticated, service_role;

revoke all on function
  public.les_stoffregister(public.objekttilstand),
  public.opprett_stoffkategori(text, uuid),
  public.endre_stoffkategori(uuid, text),
  public.flytt_stoffkategori(uuid, uuid, integer),
  public.arkiver_stoffkategori(uuid, boolean),
  public.slett_stoffkategori(uuid),
  public.plasser_stoff(text, uuid, uuid),
  public.arkiver_stoff(text, boolean),
  public.slett_stoff(text),
  public.gjenopprett_stoff(text),
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
from public, anon, authenticated, service_role;

grant execute on function
  public.les_stoffregister(public.objekttilstand),
  public.opprett_stoffkategori(text, uuid),
  public.endre_stoffkategori(uuid, text),
  public.flytt_stoffkategori(uuid, uuid, integer),
  public.arkiver_stoffkategori(uuid, boolean),
  public.slett_stoffkategori(uuid),
  public.plasser_stoff(text, uuid, uuid),
  public.arkiver_stoff(text, boolean),
  public.slett_stoff(text),
  public.gjenopprett_stoff(text),
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
