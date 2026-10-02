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
-- * `analyttkoblede_stoffer`: stoffene fortolkningen lenker til, som ikke kan
--   slettes.
--
-- Alle innloggede kan endre kategoriene, plassere stoffer, arkivere og hente
-- tilbake, og slette en fagside som bare har et navn (og angre det). Bare
-- administratorer kan slette en fagside med innhold, se og tømme papirkurven,
-- og slette noe for godt. Alt skrives gjennom funksjonene i
-- `stoffregister_funksjoner`.
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
  constraint stoffkategorier_ikon check (ikon is null or (char_length(ikon) <= 60 and ikon ~ '^[A-Za-z][A-Za-z0-9-]*$')),
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

-- Stoffene fortolkningen lenker til: hvert stoff som er koblet til en
-- laboratorieanalytt i datafilen (`analyttkoblinger`). Fagsidene deres kan
-- arkiveres, men ikke slettes, så lenkene fra fortolkningen alltid virker.
-- Lista følger datafilen; en test (`stoffregisterdb.test.ts`) sier fra når de
-- går fra hverandre, og en ny kobling føres inn med en migrasjon.
create table public.analyttkoblede_stoffer (
  stoff text primary key
);

comment on table public.analyttkoblede_stoffer is
  'Stoffene som er koblet til en laboratorieanalytt i datafilen. Fagsidene deres kan ikke slettes, bare arkiveres.';

insert into public.analyttkoblede_stoffer (stoff) values
  ('alprazolam'), ('amfetamin'), ('amisulprid'), ('amitriptylin'), ('amlodipin'), ('aripiprazol'), ('atenolol'), ('bendroflumetiazid'),
  ('bisoprolol'), ('brekspiprazol'), ('bumetanid'), ('buprenorfin'), ('bupropion'), ('citalopram'), ('diazepam'), ('diltiazem'),
  ('doksazosin'), ('doksepin'), ('duloksetin'), ('enalapril'), ('eplerenon'), ('escitalopram'), ('etanol'), ('fentanyl'),
  ('fluoksetin'), ('flupentiksol'), ('fluvoksamin'), ('furosemid'), ('haloperidol'), ('hydroklortiazid'), ('irbesartan'), ('kandesartan'),
  ('kariprazin'), ('karvedilol'), ('klomipramin'), ('klonazepam'), ('klorprotiksen'), ('klozapin'), ('kodein'), ('kokain'),
  ('kvetiapin'), ('labetalol'), ('lamotrigin'), ('lerkanidipin'), ('levomepromazin'), ('lisinopril'), ('losartan'), ('lurasidon'),
  ('mdma'), ('metadon'), ('metamfetamin'), ('metoprolol'), ('mianserin'), ('mirtazapin'), ('morfin'), ('nifedipin'),
  ('nitrazepam'), ('nortriptylin'), ('oksazepam'), ('oksykodon'), ('olanzapin'), ('paliperidon'), ('paroksetin'), ('perfenazin'),
  ('ramipril'), ('risperidon'), ('sertralin'), ('spironolakton'), ('tapentadol'), ('telmisartan'), ('thc'), ('tramadol'),
  ('trimipramin'), ('valsartan'), ('venlafaksin'), ('verapamil'), ('vortioksetin'), ('ziprasidon'), ('zolpidem'), ('zopiklon'),
  ('zuklopentiksol');

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
    {"navn": "Antidepressiver", "ikon": "katAntidepressiver", "underkategorier": [{"navn": "SSRI", "stoffer": ["citalopram", "escitalopram", "fluoksetin", "fluvoksamin", "paroksetin", "sertralin"]}, {"navn": "SNRI", "stoffer": ["duloksetin", "venlafaksin"]}, {"navn": "NDRI", "stoffer": ["bupropion"]}, {"navn": "TCA", "stoffer": ["amitriptylin", "doksepin", "klomipramin", "nortriptylin", "trimipramin"]}, {"navn": "Reseptorantagonister (NaSSA)", "stoffer": ["mianserin", "mirtazapin"]}, {"navn": "Multimodale", "stoffer": ["vortioksetin"]}, {"navn": "NMDA-reseptorantagonister", "stoffer": ["ketamin"]}]},
    {"navn": "Stemningsstabiliserende", "ikon": "katStemningsstabiliserende", "stoffer": ["karbamazepin", "lamotrigin", "litium", "valproat"]},
    {"navn": "Antipsykotika", "ikon": "katAntipsykotika", "underkategorier": [{"navn": "Førstegenerasjonsmidler", "stoffer": ["flupentiksol", "haloperidol", "klorprotiksen", "levomepromazin", "perfenazin", "zuklopentiksol"]}, {"navn": "Andregenerasjonsmidler", "stoffer": ["amisulprid", "aripiprazol", "brekspiprazol", "kariprazin", "klozapin", "kvetiapin", "lurasidon", "olanzapin", "paliperidon", "risperidon", "sertindol", "ziprasidon"]}]},
    {"navn": "Antiepileptika", "ikon": "katAntiepileptika", "stoffer": ["fenobarbital", "fenytoin", "gabapentin", "karbamazepin", "klonazepam", "lamotrigin", "levetiracetam", "okskarbazepin", "topiramat", "valproat"]},
    {"navn": "Alkohol og GHB", "ikon": "katAlkohol", "stoffer": ["etanol", "ghb"]},
    {"navn": "Benzodiazepiner og Z-hypnotika", "ikon": "katBenzodiazepiner", "stoffer": ["alprazolam", "diazepam", "flunitrazepam", "klonazepam", "nitrazepam", "oksazepam", "zolpidem", "zopiklon"]},
    {"navn": "Opioider", "ikon": "katOpioider", "stoffer": ["buprenorfin", "fentanyl", "ketobemidon", "kodein", "metadon", "morfin", "oksykodon", "petidin", "tapentadol", "tramadol"]},
    {"navn": "Stimulanter", "ikon": "katStimulanter", "stoffer": ["amfetamin", "atomoksetin", "kokain", "mdma", "metamfetamin", "metylfenidat"]},
    {"navn": "Cannabinoider", "ikon": "katCannabinoider", "stoffer": ["thc", "cbd"]},
    {"navn": "Hallusinogene stoffer", "ikon": "katHallusinogener", "stoffer": ["ketamin"]},
    {"navn": "Antihypertensiver", "ikon": "katAntihypertensiver", "underkategorier": [{"navn": "ACE-hemmere", "stoffer": ["enalapril", "lisinopril", "ramipril"]}, {"navn": "Aldosteronantagonister", "stoffer": ["eplerenon", "spironolakton"]}, {"navn": "Alfa- og betablokkere", "stoffer": ["karvedilol", "labetalol"]}, {"navn": "Alfablokkere", "stoffer": ["doksazosin"]}, {"navn": "ARB", "stoffer": ["irbesartan", "kandesartan", "losartan", "telmisartan", "valsartan"]}, {"navn": "Betablokkere", "stoffer": ["atenolol", "bisoprolol", "metoprolol"]}, {"navn": "Diuretika", "stoffer": ["bendroflumetiazid", "bumetanid", "furosemid", "hydroklortiazid"]}, {"navn": "Kalsiumantagonister", "stoffer": ["amlodipin", "diltiazem", "lerkanidipin", "nifedipin", "verapamil"]}]}
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
    insert into public.stoffkategorier (navn, ikon, posisjon)
    values (kategori.verdi ->> 'navn', kategori.verdi ->> 'ikon', kategori.nr - 1)
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

-- --- Radsikkerhet og rettigheter for tabellene ----------------------------------

alter table public.stoffkategorier enable row level security;
alter table public.stoffplasseringer enable row level security;
alter table public.stoffstatus enable row level security;
alter table public.slettede_stoffsider enable row level security;
alter table public.analyttkoblede_stoffer enable row level security;

create policy "Innloggede ser kategoriene" on public.stoffkategorier for select to authenticated using (true);
create policy "Innloggede ser plasseringene" on public.stoffplasseringer for select to authenticated using (true);
create policy "Innloggede ser statusene" on public.stoffstatus for select to authenticated using (true);
create policy "Innloggede ser de analyttkoblede stoffene" on public.analyttkoblede_stoffer for select to authenticated using (true);
create policy "Bare administratorer ser loggen" on public.slettede_stoffsider
for select to authenticated using ((select public.er_admin()));

revoke all on table
  public.stoffkategorier,
  public.stoffplasseringer,
  public.stoffstatus,
  public.slettede_stoffsider,
  public.analyttkoblede_stoffer
from anon, authenticated, service_role;

grant select on table
  public.stoffkategorier,
  public.stoffplasseringer,
  public.stoffstatus,
  public.slettede_stoffsider,
  public.analyttkoblede_stoffer
to authenticated, service_role;
