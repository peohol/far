-- Diskusjoner: tråder på fagsidene og fortolkningssidene.
--
-- Hver side har sine egne tråder, ordnet i kategorier som brukerne lager selv.
-- En side er en nøkkel: `stoff:<stoffets nøkkel>` for en fagside og
-- `fortolkning:<analyttens nøkkel>` for en fortolkningsside (se
-- `src/diskusjoner/modell.ts`). Nøkkelen til en fagside følger siden når den
-- får ny nøkkel, som favorittene.
--
-- Alle innloggede kan lage, endre, flytte, arkivere og gjenopprette tråder, og
-- lage, endre, flytte og løse opp kategorier. En tråd slettes aldri; den kan
-- bare arkiveres, og en arkivert tråd er frosset til den er gjenopprettet. Å
-- løse opp en kategori sletter den og legger trådene i den under
-- «Ukategoriserte» (kategori null), som bare vises når den har tråder. Nye
-- tråder kan ikke legges der.
--
-- Kommentarene er som under idéene: svar i svar, hjerter, og en kommentar med
-- svar står igjen uten tekst når den slettes. Bare forfatteren endrer og
-- sletter sin egen kommentar, også for administratorer. En administrator kan
-- i stedet skjule innholdet i en kommentar eller i det første innlegget, for
-- eksempel om noe er skrevet ved en feil: teksten fjernes for godt, og plassen
-- står igjen med en merknad.
--
-- Skrivingen av trådene og kategoriene går gjennom funksjonene nedenfor, som
-- holder rekkefølgen og reglene samlet. Kommentarene og hjertene skrives rett
-- mot tabellene, der radsikkerheten avgjør hvem som får gjøre hva.
--
-- Varslene om trådene (kategoriene `mine_diskusjoner`, `aktive_diskusjoner` og
-- `favorittdiskusjoner`) lages av utløsere her; se `docs/varsler.md`.

-- --- Sidene -----------------------------------------------------------------

-- En side trådene står på: `stoff:<nøkkel>` eller `fortolkning:<nøkkel>`.
create function intern.er_diskusjonsside(side text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(side) <= 220 and side ~ '^(stoff|fortolkning):[a-z0-9]+(-[a-z0-9]+)*$'
$$;

-- --- Kategoriene --------------------------------------------------------------

create table public.diskusjonskategorier (
  id uuid primary key default gen_random_uuid(),
  side text not null,
  navn text not null,
  emoji text not null,
  posisjon integer not null default 0,
  opprettet_av uuid default auth.uid() references public.profiles (id) on delete set null,
  opprettet_kl timestamptz not null default now(),
  constraint diskusjonskategorier_side check (intern.er_diskusjonsside(side)),
  -- «Ukategoriserte» og 🫧 hører til plassen for trådene uten kategori.
  constraint diskusjonskategorier_navn check (
    char_length(navn) between 1 and 60 and navn = btrim(navn) and lower(navn) <> 'ukategoriserte'
  ),
  constraint diskusjonskategorier_emoji check (
    char_length(emoji) between 1 and 16 and emoji !~ '[\x00-\x7F]' and emoji <> '🫧'
  )
);

comment on table public.diskusjonskategorier is
  'Kategoriene trådene på hver side ordnes i. Navn og emoji er unike på siden. Skrives gjennom funksjonene.';

create unique index diskusjonskategorier_navn_idx on public.diskusjonskategorier (side, lower(navn));
create unique index diskusjonskategorier_emoji_idx on public.diskusjonskategorier (side, emoji);

-- --- Trådene --------------------------------------------------------------------

create table public.diskusjoner (
  id uuid primary key default gen_random_uuid(),
  side text not null,
  -- Null er «Ukategoriserte»: kategorien tråden sto i, er løst opp.
  kategori_id uuid references public.diskusjonskategorier (id) on delete set null,
  forfatter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  tittel text not null,
  -- Det første innlegget som riktekst (ProseMirror-JSON), eller null uten.
  tekst jsonb,
  -- Når en administrator skjulte det første innlegget. Teksten er da borte.
  skjult_kl timestamptz,
  posisjon integer not null default 0,
  opprettet_kl timestamptz not null default now(),
  endret_kl timestamptz,
  arkivert_kl timestamptz,
  constraint diskusjoner_side check (intern.er_diskusjonsside(side)),
  constraint diskusjoner_tittel check (char_length(tittel) between 1 and 140 and tittel = btrim(tittel)),
  constraint diskusjoner_tekst check (
    tekst is null or (skjult_kl is null and jsonb_typeof(tekst) = 'object' and octet_length(tekst::text) <= 100000)
  )
);

comment on table public.diskusjoner is
  'Trådene på fagsidene og fortolkningssidene. Slettes aldri, men kan arkiveres. Skrives gjennom funksjonene.';

create index diskusjoner_side_idx on public.diskusjoner (side);
create index diskusjoner_kategori_idx on public.diskusjoner (kategori_id);

-- --- Kommentarene ---------------------------------------------------------------

create table public.diskusjonskommentarer (
  id uuid primary key default gen_random_uuid(),
  diskusjon_id uuid not null references public.diskusjoner (id) on delete cascade,
  forelder_id uuid references public.diskusjonskommentarer (id) on delete cascade,
  -- Null for en slettet kommentar, og når brukeren som skrev den, er slettet.
  forfatter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  tekst jsonb,
  slettet boolean not null default false,
  -- Når en administrator skjulte kommentaren. Teksten er da borte.
  skjult_kl timestamptz,
  opprettet_kl timestamptz not null default now(),
  endret_kl timestamptz,
  constraint diskusjonskommentarer_tekst check (
    case
      when slettet then tekst is null and forfatter_id is null and skjult_kl is null
      when skjult_kl is not null then tekst is null
      else tekst is not null and jsonb_typeof(tekst) = 'object' and octet_length(tekst::text) <= 50000
    end
  )
);

comment on table public.diskusjonskommentarer is
  'Kommentarene i trådene, med svar i svar. En slettet kommentar med svar står igjen uten tekst.';

create index diskusjonskommentarer_diskusjon_idx on public.diskusjonskommentarer (diskusjon_id);
create index diskusjonskommentarer_forelder_idx on public.diskusjonskommentarer (forelder_id);

-- --- Hjertene -------------------------------------------------------------------

create table public.diskusjonshjerter (
  diskusjon_id uuid not null references public.diskusjoner (id) on delete cascade,
  kommentar_id uuid references public.diskusjonskommentarer (id) on delete cascade,
  bruker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  gitt_kl timestamptz not null default now()
);

comment on table public.diskusjonshjerter is
  'Hjertene på trådene og kommentarene. Ett per bruker på hver.';

create unique index diskusjonshjerter_unik on public.diskusjonshjerter (
  diskusjon_id,
  coalesce(kommentar_id, '00000000-0000-0000-0000-000000000000'::uuid),
  bruker_id
);
create index diskusjonshjerter_kommentar_idx on public.diskusjonshjerter (kommentar_id) where kommentar_id is not null;

-- --- Sist åpnet -------------------------------------------------------------------

create table public.diskusjonsbesok (
  bruker_id uuid not null references public.profiles (id) on delete cascade,
  diskusjon_id uuid not null references public.diskusjoner (id) on delete cascade,
  sett_kl timestamptz not null default now(),
  primary key (bruker_id, diskusjon_id)
);

comment on table public.diskusjonsbesok is
  'Når hver bruker sist åpnet hver tråd. Det som er skrevet av andre etter det, er nytt for brukeren.';

create index diskusjonsbesok_diskusjon_idx on public.diskusjonsbesok (diskusjon_id);

-- --- Reglene tabellene ikke kan uttrykke selv -------------------------------------

-- En arkivert tråd er frosset: ingen kan kommentere, gi hjerter eller endre
-- noe i den før den er gjenopprettet.
create function public.diskusjon_er_apen(diskusjon uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.diskusjoner d where d.id = diskusjon and d.arkivert_kl is null)
$$;

comment on function public.diskusjon_er_apen(uuid) is
  'Om tråden finnes og ikke er arkivert. Brukes av radsikkerheten.';

-- Et svar hører til samme tråd som kommentaren det svarer på, og det svares
-- ikke på en slettet kommentar. Et hjerte på en kommentar hører til trådens.
create function intern.diskusjonskommentar_kontroller()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.forelder_id is not null and not exists (
    select 1 from public.diskusjonskommentarer f
    where f.id = new.forelder_id and f.diskusjon_id = new.diskusjon_id and not f.slettet
  ) then
    raise exception 'Kommentaren det svares på, finnes ikke i denne tråden.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger diskusjonskommentarer_kontroller
before insert on public.diskusjonskommentarer
for each row execute function intern.diskusjonskommentar_kontroller();

create function intern.diskusjonshjerte_kontroller()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kommentar_id is not null and not exists (
    select 1 from public.diskusjonskommentarer k
    where k.id = new.kommentar_id and k.diskusjon_id = new.diskusjon_id and not k.slettet
  ) then
    raise exception 'Kommentaren finnes ikke i denne tråden.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger diskusjonshjerter_kontroller
before insert on public.diskusjonshjerter
for each row execute function intern.diskusjonshjerte_kontroller();

-- Når en kommentar er endret, settes av databasen. Å slette eller skjule den
-- er ingen endring av den.
create function intern.diskusjonskommentar_merk_endret()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tekst is distinct from old.tekst and not new.slettet and new.skjult_kl is null then
    new.endret_kl := now();
  else
    new.endret_kl := old.endret_kl;
  end if;
  return new;
end;
$$;

create trigger diskusjonskommentarer_merk_endret
before update on public.diskusjonskommentarer
for each row execute function intern.diskusjonskommentar_merk_endret();

-- En kommentar med svar tømmes i stedet for å slettes, så svarene står igjen,
-- og en tømt kommentar ryddes bort når det siste svaret under den er borte.
-- Slik er det under idéene også.
create function intern.diskusjonskommentar_slett()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from public.diskusjonskommentarer s where s.forelder_id = old.id) then
    update public.diskusjonskommentarer
    set tekst = null, forfatter_id = null, skjult_kl = null, slettet = true
    where id = old.id;
    delete from public.diskusjonshjerter where kommentar_id = old.id;
    return null;
  end if;
  return old;
end;
$$;

create trigger diskusjonskommentarer_slett
before delete on public.diskusjonskommentarer
for each row execute function intern.diskusjonskommentar_slett();

create function intern.diskusjonskommentar_rydd()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.forelder_id is not null then
    delete from public.diskusjonskommentarer f
    where f.id = old.forelder_id
      and f.slettet
      and not exists (select 1 from public.diskusjonskommentarer s where s.forelder_id = f.id);
  end if;
  return null;
end;
$$;

create trigger diskusjonskommentarer_rydd
after delete on public.diskusjonskommentarer
for each row execute function intern.diskusjonskommentar_rydd();

-- --- Rekkefølgen ------------------------------------------------------------------

-- Trådene i én kategori på én side (eller «Ukategoriserte» når kategorien er
-- null) får plassene 0, 1, 2 … i den rekkefølgen de står, med `forst` på
-- plassen `indeks`. De arkiverte står utenfor rekkefølgen.
create function intern.ordne_diskusjoner(side text, kategori uuid, forst uuid default null, indeks integer default null)
returns void
language sql
security definer
set search_path = ''
as $$
  with rekke as (
    select d.id, row_number() over (order by d.posisjon, d.opprettet_kl, d.id) - 1 as nr
    from public.diskusjoner d
    where d.side = ordne_diskusjoner.side
      and d.kategori_id is not distinct from ordne_diskusjoner.kategori
      and d.arkivert_kl is null
      and d.id is distinct from ordne_diskusjoner.forst
  ),
  ny as (
    select r.id, case when ordne_diskusjoner.indeks is not null and r.nr >= greatest(ordne_diskusjoner.indeks, 0) then r.nr + 1 else r.nr end as plass
    from rekke r
    union all
    select ordne_diskusjoner.forst, least(greatest(coalesce(ordne_diskusjoner.indeks, 2147483646), 0), (select count(*) from rekke))
    where ordne_diskusjoner.forst is not null
  )
  update public.diskusjoner d
  set posisjon = ny.plass
  from ny
  where d.id = ny.id and d.posisjon is distinct from ny.plass
$$;

-- Kategoriene på en side får plassene 0, 1, 2 …, med `forst` på plassen `indeks`.
create function intern.ordne_diskusjonskategorier(side text, forst uuid default null, indeks integer default null)
returns void
language sql
security definer
set search_path = ''
as $$
  with rekke as (
    select k.id, row_number() over (order by k.posisjon, k.opprettet_kl, k.id) - 1 as nr
    from public.diskusjonskategorier k
    where k.side = ordne_diskusjonskategorier.side
      and k.id is distinct from ordne_diskusjonskategorier.forst
  ),
  ny as (
    select r.id, case when ordne_diskusjonskategorier.indeks is not null and r.nr >= greatest(ordne_diskusjonskategorier.indeks, 0) then r.nr + 1 else r.nr end as plass
    from rekke r
    union all
    select ordne_diskusjonskategorier.forst, least(greatest(coalesce(ordne_diskusjonskategorier.indeks, 2147483646), 0), (select count(*) from rekke))
    where ordne_diskusjonskategorier.forst is not null
  )
  update public.diskusjonskategorier k
  set posisjon = ny.plass
  from ny
  where k.id = ny.id and k.posisjon is distinct from ny.plass
$$;

-- --- Det appen kaller: kategoriene --------------------------------------------------

create function intern.krev_innlogget()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  bruker uuid := (select auth.uid());
begin
  if bruker is null then
    raise exception 'Bare innloggede kan delta i diskusjonene.' using errcode = '42501';
  end if;
  return bruker;
end;
$$;

-- En ny kategori, sist på siden. Gir ID-en tilbake.
create function public.opprett_diskusjonskategori(side text, navn text, emoji text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny uuid;
begin
  perform intern.krev_innlogget();
  insert into public.diskusjonskategorier (side, navn, emoji, posisjon, opprettet_av)
  values (
    opprett_diskusjonskategori.side,
    btrim(opprett_diskusjonskategori.navn),
    btrim(opprett_diskusjonskategori.emoji),
    coalesce((select max(k.posisjon) + 1 from public.diskusjonskategorier k where k.side = opprett_diskusjonskategori.side), 0),
    (select auth.uid())
  )
  returning id into ny;
  return ny;
end;
$$;

comment on function public.opprett_diskusjonskategori(text, text, text) is
  'Lager en ny kategori sist på siden og gir ID-en tilbake. Navn og emoji må være ledige på siden.';

-- Nytt navn eller ny emoji på en kategori.
create function public.endre_diskusjonskategori(kategori uuid, navn text, emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_innlogget();
  update public.diskusjonskategorier k
  set navn = btrim(endre_diskusjonskategori.navn), emoji = btrim(endre_diskusjonskategori.emoji)
  where k.id = endre_diskusjonskategori.kategori;
  if not found then
    raise exception 'Kategorien finnes ikke lenger.' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.endre_diskusjonskategori(uuid, text, text) is
  'Gir kategorien nytt navn og ny emoji. Begge må være ledige på siden.';

-- Flytter kategorien til plassen `indeks` blant kategoriene på siden.
create function public.flytt_diskusjonskategori(kategori uuid, indeks integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kategoriside text;
begin
  perform intern.krev_innlogget();
  select k.side into kategoriside from public.diskusjonskategorier k where k.id = flytt_diskusjonskategori.kategori for update;
  if kategoriside is null then
    raise exception 'Kategorien finnes ikke lenger.' using errcode = 'P0002';
  end if;
  perform intern.ordne_diskusjonskategorier(kategoriside, flytt_diskusjonskategori.kategori, flytt_diskusjonskategori.indeks);
end;
$$;

comment on function public.flytt_diskusjonskategori(uuid, integer) is
  'Flytter kategorien til plassen indeks (fra 0) blant kategoriene på siden.';

-- Løser opp kategorien: den slettes, og trådene i den står sist under
-- «Ukategoriserte», i den rekkefølgen de hadde.
create function public.los_opp_diskusjonskategori(kategori uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kategoriside text;
  forste integer;
begin
  perform intern.krev_innlogget();
  select k.side into kategoriside from public.diskusjonskategorier k where k.id = los_opp_diskusjonskategori.kategori for update;
  if kategoriside is null then
    raise exception 'Kategorien finnes ikke lenger.' using errcode = 'P0002';
  end if;
  select coalesce(max(d.posisjon) + 1, 0) into forste
  from public.diskusjoner d
  where d.side = kategoriside and d.kategori_id is null and d.arkivert_kl is null;
  update public.diskusjoner d
  set posisjon = forste + d.posisjon
  where d.kategori_id = los_opp_diskusjonskategori.kategori;
  delete from public.diskusjonskategorier k where k.id = los_opp_diskusjonskategori.kategori;
  perform intern.ordne_diskusjoner(kategoriside, null);
  perform intern.ordne_diskusjonskategorier(kategoriside);
end;
$$;

comment on function public.los_opp_diskusjonskategori(uuid) is
  'Sletter kategorien og legger trådene i den under «Ukategoriserte».';

-- --- Det appen kaller: trådene ---------------------------------------------------

-- En ny tråd sist i kategorien. Med `ny_kategori` og `ny_emoji` lages
-- kategorien sammen med tråden, sist på siden, og `kategori` er uten betydning.
create function public.opprett_diskusjon(
  side text,
  kategori uuid,
  tittel text,
  tekst jsonb,
  ny_kategori text default null,
  ny_emoji text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  valgt uuid := opprett_diskusjon.kategori;
  ny uuid;
begin
  perform intern.krev_innlogget();
  if opprett_diskusjon.ny_kategori is not null then
    valgt := public.opprett_diskusjonskategori(opprett_diskusjon.side, opprett_diskusjon.ny_kategori, coalesce(opprett_diskusjon.ny_emoji, ''));
  elsif not exists (
    select 1 from public.diskusjonskategorier k where k.id = valgt and k.side = opprett_diskusjon.side
  ) then
    raise exception 'Velg en kategori på siden for tråden.' using errcode = '23503';
  end if;

  insert into public.diskusjoner (side, kategori_id, forfatter_id, tittel, tekst, posisjon)
  values (
    opprett_diskusjon.side,
    valgt,
    (select auth.uid()),
    btrim(opprett_diskusjon.tittel),
    opprett_diskusjon.tekst,
    coalesce((select max(d.posisjon) + 1 from public.diskusjoner d where d.kategori_id = valgt and d.arkivert_kl is null), 0)
  )
  returning id into ny;
  return ny;
end;
$$;

comment on function public.opprett_diskusjon(text, uuid, text, jsonb, text, text) is
  'Lager en ny tråd sist i kategorien, eventuelt i en ny kategori, og gir ID-en tilbake.';

-- Ny overskrift. Alle kan endre den, så lenge tråden ikke er arkivert. Det
-- gjør ikke det første innlegget «endret».
create function public.sett_diskusjonstittel(diskusjon uuid, tittel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_innlogget();
  update public.diskusjoner d
  set tittel = btrim(sett_diskusjonstittel.tittel)
  where d.id = sett_diskusjonstittel.diskusjon and d.arkivert_kl is null and d.tittel is distinct from btrim(sett_diskusjonstittel.tittel);
  if not found and not exists (select 1 from public.diskusjoner d where d.id = sett_diskusjonstittel.diskusjon and d.arkivert_kl is null) then
    raise exception 'Tråden er arkivert eller finnes ikke.' using errcode = '42501';
  end if;
end;
$$;

comment on function public.sett_diskusjonstittel(uuid, text) is
  'Gir tråden en ny overskrift. Alle innloggede kan gjøre det, men ikke i en arkivert tråd.';

-- Nytt første innlegg. Bare den som skrev tråden.
create function public.sett_diskusjonstekst(diskusjon uuid, tekst jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_innlogget();
  update public.diskusjoner d
  set tekst = sett_diskusjonstekst.tekst, skjult_kl = null, endret_kl = now()
  where d.id = sett_diskusjonstekst.diskusjon
    and d.arkivert_kl is null
    and d.forfatter_id = (select auth.uid());
  if not found then
    raise exception 'Bare den som skrev tråden, kan endre innlegget, og ikke i en arkivert tråd.' using errcode = '42501';
  end if;
end;
$$;

comment on function public.sett_diskusjonstekst(uuid, jsonb) is
  'Endrer det første innlegget i tråden. Bare forfatteren, og ikke i en arkivert tråd.';

-- Flytter tråden til plassen `indeks` i kategorien (fra 0). Kategorien må
-- være på samme side; «Ukategoriserte» tar ikke imot tråder.
create function public.flytt_diskusjon(diskusjon uuid, kategori uuid, indeks integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  traad public.diskusjoner%rowtype;
begin
  perform intern.krev_innlogget();
  select * into traad from public.diskusjoner d where d.id = flytt_diskusjon.diskusjon for update;
  if traad.id is null or traad.arkivert_kl is not null then
    raise exception 'Tråden er arkivert eller finnes ikke.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.diskusjonskategorier k where k.id = flytt_diskusjon.kategori and k.side = traad.side
  ) then
    raise exception 'Tråden kan bare flyttes til en kategori på samme side.' using errcode = '23503';
  end if;
  update public.diskusjoner d set kategori_id = flytt_diskusjon.kategori where d.id = traad.id;
  perform intern.ordne_diskusjoner(traad.side, flytt_diskusjon.kategori, traad.id, flytt_diskusjon.indeks);
  if traad.kategori_id is distinct from flytt_diskusjon.kategori then
    perform intern.ordne_diskusjoner(traad.side, traad.kategori_id);
  end if;
end;
$$;

comment on function public.flytt_diskusjon(uuid, uuid, integer) is
  'Flytter tråden til plassen indeks (fra 0) i en kategori på samme side.';

-- Arkiverer tråden, eller henter den tilbake sist i kategorien den sto i.
create function public.arkiver_diskusjon(diskusjon uuid, arkivert boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  traad public.diskusjoner%rowtype;
begin
  perform intern.krev_innlogget();
  select * into traad from public.diskusjoner d where d.id = arkiver_diskusjon.diskusjon for update;
  if traad.id is null then
    raise exception 'Tråden finnes ikke.' using errcode = 'P0002';
  end if;
  if (traad.arkivert_kl is not null) = arkiver_diskusjon.arkivert then
    return;
  end if;
  if arkiver_diskusjon.arkivert then
    update public.diskusjoner d set arkivert_kl = now() where d.id = traad.id;
    perform intern.ordne_diskusjoner(traad.side, traad.kategori_id);
  else
    update public.diskusjoner d set arkivert_kl = null where d.id = traad.id;
    perform intern.ordne_diskusjoner(traad.side, traad.kategori_id, traad.id, null);
  end if;
end;
$$;

comment on function public.arkiver_diskusjon(uuid, boolean) is
  'Arkiverer tråden (den fryses), eller gjenoppretter den sist i kategorien den sto i.';

-- En administrator skjuler innholdet i det første innlegget (uten kommentar)
-- eller i en kommentar. Teksten fjernes for godt.
create function public.skjul_i_diskusjon(diskusjon uuid, kommentar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.er_admin() then
    raise exception 'Bare en administrator kan skjule innhold.' using errcode = '42501';
  end if;
  if skjul_i_diskusjon.kommentar is null then
    update public.diskusjoner d
    set tekst = null, skjult_kl = now()
    where d.id = skjul_i_diskusjon.diskusjon and d.tekst is not null;
  else
    update public.diskusjonskommentarer k
    set tekst = null, skjult_kl = now()
    where k.id = skjul_i_diskusjon.kommentar
      and k.diskusjon_id = skjul_i_diskusjon.diskusjon
      and not k.slettet
      and k.skjult_kl is null;
  end if;
end;
$$;

comment on function public.skjul_i_diskusjon(uuid, uuid) is
  'Fjerner teksten i det første innlegget (kommentar null) eller i en kommentar, med en merknad om at den er skjult. Bare for administratorer.';

-- Tråden er sett slik den var da den ble lest (`lest_kl` fra diskusjonstraad).
create function public.merk_diskusjon_sett(diskusjon uuid, lest_kl timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.diskusjonsbesok (bruker_id, diskusjon_id, sett_kl)
  select (select auth.uid()), d.id, least(merk_diskusjon_sett.lest_kl, now())
  from public.diskusjoner d
  where d.id = merk_diskusjon_sett.diskusjon and (select auth.uid()) is not null
  on conflict (bruker_id, diskusjon_id) do update
    set sett_kl = greatest(public.diskusjonsbesok.sett_kl, excluded.sett_kl)
$$;

comment on function public.merk_diskusjon_sett(uuid, timestamptz) is
  'Merker at den innloggede har sett tråden slik den var da den ble lest.';

-- --- Lesing ---------------------------------------------------------------------

-- Kategoriene og trådene på en side, uten innleggene, med det som er nytt for
-- den innloggede: en tråd er usett når noen andre har skrevet den og den aldri
-- er åpnet, eller når andre har kommentert etter at den sist ble åpnet.
create function public.diskusjonsoversikt(side text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with traader as (
    select d.*, b.sett_kl
    from public.diskusjoner d
    left join public.diskusjonsbesok b on b.diskusjon_id = d.id and b.bruker_id = (select auth.uid())
    where d.side = diskusjonsoversikt.side
  ),
  kommentarer as (
    select
      k.diskusjon_id,
      count(*) as antall,
      count(*) filter (
        where k.forfatter_id is distinct from (select auth.uid())
          and (t.sett_kl is null or k.opprettet_kl > t.sett_kl)
      ) as nye,
      max(k.opprettet_kl) as siste
    from public.diskusjonskommentarer k
    join traader t on t.id = k.diskusjon_id
    where not k.slettet
    group by k.diskusjon_id
  ),
  hjerter as (
    select h.diskusjon_id, count(*) as antall, bool_or(h.bruker_id = (select auth.uid())) as mitt
    from public.diskusjonshjerter h
    join traader t on t.id = h.diskusjon_id
    where h.kommentar_id is null
    group by h.diskusjon_id
  )
  select jsonb_build_object(
    'kategorier', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id,
          'navn', k.navn,
          'emoji', k.emoji,
          'posisjon', k.posisjon
        ) order by k.posisjon, k.opprettet_kl, k.id)
      from public.diskusjonskategorier k
      where k.side = diskusjonsoversikt.side
    ), '[]'::jsonb),
    'diskusjoner', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'kategori_id', t.kategori_id,
          'forfatter_id', t.forfatter_id,
          'tittel', t.tittel,
          'posisjon', t.posisjon,
          'opprettet_kl', t.opprettet_kl,
          'arkivert_kl', t.arkivert_kl,
          'siste_kl', greatest(t.opprettet_kl, k.siste),
          'kommentarer', coalesce(k.antall, 0),
          'nye_kommentarer', coalesce(k.nye, 0),
          'usett', (t.sett_kl is null and t.forfatter_id is distinct from (select auth.uid())) or coalesce(k.nye, 0) > 0,
          'hjerter', coalesce(h.antall, 0),
          'mitt_hjerte', coalesce(h.mitt, false)
        ) order by t.posisjon, t.opprettet_kl, t.id)
      from traader t
      left join kommentarer k on k.diskusjon_id = t.id
      left join hjerter h on h.diskusjon_id = t.id
    ), '[]'::jsonb)
  )
$$;

comment on function public.diskusjonsoversikt(text) is
  'Kategoriene og trådene på siden, med antall kommentarer og hjerter og hva som er nytt for den innloggede.';

-- Én tråd med det første innlegget og alle kommentarene, eller null.
create function public.diskusjonstraad(diskusjon uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with hjerter as (
    select h.kommentar_id, count(*) as antall, bool_or(h.bruker_id = (select auth.uid())) as mitt
    from public.diskusjonshjerter h
    where h.diskusjon_id = diskusjonstraad.diskusjon
    group by h.kommentar_id
  )
  select jsonb_build_object(
    'id', d.id,
    'side', d.side,
    'kategori_id', d.kategori_id,
    'forfatter_id', d.forfatter_id,
    'tittel', d.tittel,
    'tekst', d.tekst,
    'skjult', d.skjult_kl is not null,
    'opprettet_kl', d.opprettet_kl,
    'endret_kl', d.endret_kl,
    'arkivert_kl', d.arkivert_kl,
    'lest_kl', now(),
    'sist_sett', (
      select b.sett_kl from public.diskusjonsbesok b
      where b.diskusjon_id = d.id and b.bruker_id = (select auth.uid())
    ),
    'hjerter', coalesce((select h.antall from hjerter h where h.kommentar_id is null), 0),
    'mitt_hjerte', coalesce((select h.mitt from hjerter h where h.kommentar_id is null), false),
    'kommentarer', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id,
          'forelder_id', k.forelder_id,
          'forfatter_id', k.forfatter_id,
          'tekst', k.tekst,
          'slettet', k.slettet,
          'skjult', k.skjult_kl is not null,
          'opprettet_kl', k.opprettet_kl,
          'endret_kl', k.endret_kl,
          'hjerter', case when k.slettet then 0 else coalesce(h.antall, 0) end,
          'mitt_hjerte', case when k.slettet then false else coalesce(h.mitt, false) end
        ) order by k.opprettet_kl, k.id)
      from public.diskusjonskommentarer k
      left join hjerter h on h.kommentar_id = k.id
      where k.diskusjon_id = d.id
    ), '[]'::jsonb)
  )
  from public.diskusjoner d
  where d.id = diskusjonstraad.diskusjon
$$;

comment on function public.diskusjonstraad(uuid) is
  'Én tråd med det første innlegget, hjertene og alle kommentarene, når den innloggede sist åpnet den og når tråden ble lest. Null når den ikke finnes.';

-- Tekstene i trådene på en side, til søket: overskriften, det første innlegget
-- og kommentarene som står. Appen leser teksten ut av rikteksten.
create function public.diskusjonstekster(side text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'tittel', d.tittel,
      'tekster', to_jsonb(array_remove(array[d.tekst], null)) || coalesce((
        select jsonb_agg(k.tekst order by k.opprettet_kl, k.id)
        from public.diskusjonskommentarer k
        where k.diskusjon_id = d.id and k.tekst is not null
      ), '[]'::jsonb)
    ) order by d.posisjon, d.opprettet_kl, d.id), '[]'::jsonb)
  from public.diskusjoner d
  where d.side = diskusjonstekster.side
$$;

comment on function public.diskusjonstekster(text) is
  'Overskriften og innleggene i hver tråd på siden, til søket i trådene.';

-- --- Nøkkelen følger fagsiden ------------------------------------------------------

-- Når en publisert fagside får ny nøkkel, flytter trådene og kategoriene med.
-- Har den nye nøkkelen alt en kategori med samme navn eller emoji, havner
-- trådene der, sist, og den gamle kategorien forsvinner.
create function intern.diskusjoner_folg_nokkel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fra text := 'stoff:' || old.slug;
  til text := 'stoff:' || new.slug;
  gammel record;
  malet uuid;
begin
  if new.slug is null or old.slug is null or not intern.er_diskusjonsside(til) then
    return null;
  end if;
  for gammel in select k.* from public.diskusjonskategorier k where k.side = fra order by k.posisjon loop
    select k.id into malet
    from public.diskusjonskategorier k
    where k.side = til and (lower(k.navn) = lower(gammel.navn) or k.emoji = gammel.emoji)
    order by (lower(k.navn) = lower(gammel.navn)) desc
    limit 1;
    if malet is not null then
      update public.diskusjoner d
      set kategori_id = malet, side = til, posisjon = 1000000 + d.posisjon
      where d.kategori_id = gammel.id;
      delete from public.diskusjonskategorier k where k.id = gammel.id;
      perform intern.ordne_diskusjoner(til, malet);
    else
      update public.diskusjonskategorier k
      set side = til, posisjon = 1000000 + k.posisjon
      where k.id = gammel.id;
    end if;
  end loop;
  update public.diskusjoner d
  set side = til, posisjon = case when d.kategori_id is null then 1000000 + d.posisjon else d.posisjon end
  where d.side = fra;
  perform intern.ordne_diskusjonskategorier(til);
  perform intern.ordne_diskusjoner(til, null);
  return null;
end;
$$;

create trigger infosider_diskusjoner_folger_nokkel
after update of slug on public.infosider
for each row
when (new.tilstand = 'publisert' and old.slug is distinct from new.slug)
execute function intern.diskusjoner_folg_nokkel();

-- --- Varslene ------------------------------------------------------------------------

alter type public.varselkategori add value 'mine_diskusjoner';
alter type public.varselkategori add value 'aktive_diskusjoner';
alter type public.varselkategori add value 'favorittdiskusjoner';

alter table public.varsler
  add column diskusjon_id uuid references public.diskusjoner (id) on delete cascade;

create index varsler_diskusjon_idx on public.varsler (diskusjon_id) where diskusjon_id is not null;

-- `intern.varsle` får tråden varselet gjelder, ved siden av idéen.
drop function intern.varsle(uuid[], public.varselkategori, text, uuid, jsonb, text);

create function intern.varsle(
  mottakere uuid[],
  kategori public.varselkategori,
  gruppe text,
  ide uuid,
  hendelse jsonb,
  erstatt text default null,
  diskusjon uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.varsler as v (mottaker_id, kategori, gruppe, ide_id, diskusjon_id, hendelser)
  select distinct m, varsle.kategori, varsle.gruppe, varsle.ide, varsle.diskusjon, jsonb_build_array(varsle.hendelse)
  from unnest(varsle.mottakere) m
  where m is not null
  on conflict (mottaker_id, gruppe) where lest_kl is null do update
    set hendelser = (
        select coalesce(jsonb_agg(h.verdi order by h.nr), '[]'::jsonb)
        from (
          select t.verdi, t.nr
          from jsonb_array_elements(v.hendelser || excluded.hendelser) with ordinality t(verdi, nr)
          where varsle.erstatt is null
            or t.nr = jsonb_array_length(v.hendelser) + 1
            or t.verdi -> varsle.erstatt is distinct from varsle.hendelse -> varsle.erstatt
          order by t.nr desc
          limit 100
        ) h
      ),
      oppdatert_kl = now()
$$;

-- En ny kommentar varsler den som startet tråden og den som fikk svar
-- (mine_diskusjoner), og de andre som har kommentert i tråden
-- (aktive_diskusjoner). Den som skrev kommentaren, varsles ikke.
create function intern.varsle_diskusjonskommentar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  traadforfatter uuid;
  svar_til uuid;
  hendelse jsonb;
begin
  select d.forfatter_id into traadforfatter from public.diskusjoner d where d.id = new.diskusjon_id;
  select k.forfatter_id into svar_til from public.diskusjonskommentarer k where k.id = new.forelder_id;
  hendelse := jsonb_build_object(
    'kl', new.opprettet_kl,
    'av', new.forfatter_id,
    'innlegg', new.id,
    'svar_til', svar_til
  );

  perform intern.varsle(
    array(
      select m from unnest(array[traadforfatter, svar_til]) m
      where m is distinct from new.forfatter_id
    ),
    'mine_diskusjoner', 'mine_diskusjoner:' || new.diskusjon_id, null, hendelse, null, new.diskusjon_id
  );

  perform intern.varsle(
    array(
      select k.forfatter_id
      from public.diskusjonskommentarer k
      where k.diskusjon_id = new.diskusjon_id
        and k.id <> new.id
        and not k.slettet
        and k.forfatter_id is distinct from new.forfatter_id
        and k.forfatter_id is distinct from traadforfatter
        and k.forfatter_id is distinct from svar_til
    ),
    'aktive_diskusjoner', 'aktive_diskusjoner:' || new.diskusjon_id, null, hendelse, null, new.diskusjon_id
  );
  return null;
end;
$$;

create trigger diskusjonskommentarer_varsle
after insert on public.diskusjonskommentarer
for each row execute function intern.varsle_diskusjonskommentar();

-- En ny tråd på en fagside varsler dem som har siden som favoritt.
create function intern.varsle_ny_diskusjon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.side like 'stoff:%' then
    perform intern.varsle(
      array(
        select f.bruker_id from public.stoffavoritter f
        where f.stoff = substr(new.side, 7) and f.bruker_id is distinct from new.forfatter_id
      ),
      'favorittdiskusjoner', 'favorittdiskusjoner:' || new.id, null,
      jsonb_build_object('kl', new.opprettet_kl, 'av', new.forfatter_id), null, new.id
    );
  end if;
  return null;
end;
$$;

create trigger diskusjoner_varsle
after insert on public.diskusjoner
for each row execute function intern.varsle_ny_diskusjon();

-- Å åpne tråden er å lese det nye i den: varslene om den som ikke har fått noe
-- nytt etter at tråden ble lest, er lest.
create function intern.diskusjonsbesok_les_varsler()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.varsler v
  set lest_kl = now()
  where v.mottaker_id = new.bruker_id
    and v.diskusjon_id = new.diskusjon_id
    and v.lest_kl is null
    and v.oppdatert_kl <= new.sett_kl;
  return null;
end;
$$;

create trigger diskusjonsbesok_les_varsler
after insert or update on public.diskusjonsbesok
for each row execute function intern.diskusjonsbesok_les_varsler();

-- Hendelsene slik de vises: som før, og bare trådkommentarer som fortsatt står.
create or replace function intern.varselhendelser(hendelser jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
      case
        when h ? 'objekt' then h || jsonb_build_object('objekt', intern.fortolkningsobjekt((h ->> 'objekt')::uuid))
        when h ? 'side' then h || jsonb_build_object('side', intern.varselside((h ->> 'side')::uuid))
        else h
      end
      order by nr
    ), '[]'::jsonb)
  from jsonb_array_elements(hendelser) with ordinality t(h, nr)
  where (not h ? 'kommentar' or exists (
      select 1 from public.idekommentarer k where k.id = (h ->> 'kommentar')::uuid and not k.slettet
    ))
    and (not h ? 'innlegg' or exists (
      select 1 from public.diskusjonskommentarer k where k.id = (h ->> 'innlegg')::uuid and not k.slettet
    ))
$$;

-- Varslene til den innloggede, som før, med tråden varselet gjelder.
create or replace function public.mine_varsler()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lest_kl', now(),
    'varsler', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', v.id,
          'kategori', v.kategori,
          'ide', (select jsonb_build_object('id', i.id, 'tittel', i.tittel, 'forfatter_id', i.forfatter_id)
                  from public.ideer i where i.id = v.ide_id),
          'diskusjon', (select jsonb_build_object('id', d.id, 'tittel', d.tittel, 'side', d.side, 'forfatter_id', d.forfatter_id)
                        from public.diskusjoner d where d.id = v.diskusjon_id),
          'hendelser', v.hendelser,
          'opprettet_kl', v.opprettet_kl,
          'oppdatert_kl', v.oppdatert_kl,
          'lest_kl', v.lest_kl
        ) order by v.oppdatert_kl desc, v.id)
      from (
        select v.id, v.kategori, v.ide_id, v.diskusjon_id, v.opprettet_kl, v.oppdatert_kl, v.lest_kl,
               intern.varselhendelser(v.hendelser) as hendelser
        from public.varsler v
        where v.mottaker_id = (select auth.uid())
          and (v.lest_kl is null or v.lest_kl > now() - intern.varselfrist())
        order by v.lest_kl is not null, v.oppdatert_kl desc, v.id
        limit 200
      ) v
      where jsonb_array_length(v.hendelser) > 0
    ), '[]'::jsonb)
  )
$$;

-- --- Radsikkerhet og rettigheter ------------------------------------------------------

alter table public.diskusjonskategorier enable row level security;
alter table public.diskusjoner enable row level security;
alter table public.diskusjonskommentarer enable row level security;
alter table public.diskusjonshjerter enable row level security;
alter table public.diskusjonsbesok enable row level security;

create policy "Innloggede leser kategoriene" on public.diskusjonskategorier
for select to authenticated using (true);

create policy "Innloggede leser trådene" on public.diskusjoner
for select to authenticated using (true);

create policy "Innloggede leser kommentarene" on public.diskusjonskommentarer
for select to authenticated using (true);
create policy "Innloggede kommenterer åpne tråder" on public.diskusjonskommentarer
for insert to authenticated
with check (forfatter_id = (select auth.uid()) and not slettet and skjult_kl is null and public.diskusjon_er_apen(diskusjon_id));
create policy "Forfatteren endrer kommentaren i en åpen tråd" on public.diskusjonskommentarer
for update to authenticated
using (forfatter_id = (select auth.uid()) and not slettet and skjult_kl is null and public.diskusjon_er_apen(diskusjon_id))
with check (forfatter_id = (select auth.uid()) and not slettet and skjult_kl is null);
create policy "Forfatteren sletter kommentaren i en åpen tråd" on public.diskusjonskommentarer
for delete to authenticated
using (forfatter_id = (select auth.uid()) and not slettet and public.diskusjon_er_apen(diskusjon_id));

create policy "Innloggede ser hjertene" on public.diskusjonshjerter
for select to authenticated using (true);
create policy "Innloggede gir egne hjerter i åpne tråder" on public.diskusjonshjerter
for insert to authenticated with check (bruker_id = (select auth.uid()) and public.diskusjon_er_apen(diskusjon_id));
create policy "Innloggede tar tilbake egne hjerter i åpne tråder" on public.diskusjonshjerter
for delete to authenticated using (bruker_id = (select auth.uid()) and public.diskusjon_er_apen(diskusjon_id));

create policy "Brukeren ser egne besøk" on public.diskusjonsbesok
for select to authenticated using (bruker_id = (select auth.uid()));

-- Kategoriene og trådene kan bare leses direkte; de skrives gjennom
-- funksjonene. Forfatter, tråd, forelder, tidspunkt og merkene kan ikke
-- settes fra nettleseren.
revoke all on public.diskusjonskategorier, public.diskusjoner, public.diskusjonskommentarer,
  public.diskusjonshjerter, public.diskusjonsbesok from anon, authenticated;

grant select on public.diskusjonskategorier, public.diskusjoner, public.diskusjonsbesok to authenticated;

grant select, delete on public.diskusjonskommentarer to authenticated;
grant insert (diskusjon_id, forelder_id, tekst) on public.diskusjonskommentarer to authenticated;
grant update (tekst) on public.diskusjonskommentarer to authenticated;

grant select, delete on public.diskusjonshjerter to authenticated;
grant insert (diskusjon_id, kommentar_id) on public.diskusjonshjerter to authenticated;

revoke all on function
  public.opprett_diskusjonskategori(text, text, text),
  public.endre_diskusjonskategori(uuid, text, text),
  public.flytt_diskusjonskategori(uuid, integer),
  public.los_opp_diskusjonskategori(uuid),
  public.opprett_diskusjon(text, uuid, text, jsonb, text, text),
  public.sett_diskusjonstittel(uuid, text),
  public.sett_diskusjonstekst(uuid, jsonb),
  public.flytt_diskusjon(uuid, uuid, integer),
  public.arkiver_diskusjon(uuid, boolean),
  public.skjul_i_diskusjon(uuid, uuid),
  public.merk_diskusjon_sett(uuid, timestamptz),
  public.diskusjonsoversikt(text),
  public.diskusjonstraad(uuid),
  public.diskusjonstekster(text),
  public.diskusjon_er_apen(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.opprett_diskusjonskategori(text, text, text),
  public.endre_diskusjonskategori(uuid, text, text),
  public.flytt_diskusjonskategori(uuid, integer),
  public.los_opp_diskusjonskategori(uuid),
  public.opprett_diskusjon(text, uuid, text, jsonb, text, text),
  public.sett_diskusjonstittel(uuid, text),
  public.sett_diskusjonstekst(uuid, jsonb),
  public.flytt_diskusjon(uuid, uuid, integer),
  public.arkiver_diskusjon(uuid, boolean),
  public.skjul_i_diskusjon(uuid, uuid),
  public.merk_diskusjon_sett(uuid, timestamptz),
  public.diskusjonsoversikt(text),
  public.diskusjonstraad(uuid),
  public.diskusjonstekster(text),
  public.diskusjon_er_apen(uuid)
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;