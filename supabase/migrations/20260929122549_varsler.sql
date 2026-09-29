-- Varsler: det som har skjedd siden brukeren sist så etter, samlet bak
-- bjella i toppmenyen.
--
-- Databasen lager varslene selv, med utløsere, når noe skjer:
--
--   * fortolkning: en fortolkningskommentar eller et regelsett er publisert.
--     Alle andre enn den som publiserte, får det.
--   * mine_ideer: noen har kommentert en idé du skrev, eller svart på en
--     kommentar du skrev.
--   * aktive_ideer: noen har kommentert en idé du har kommentert, uten at det
--     er et svar til deg.
--   * favoritter: endringer på sider du har som favoritt. Kategorien finnes,
--     men ingenting lager slike varsler før favorittene finnes.
--
-- Nye føringer i endringsloggen er også varsler, men de står i appen selv
-- (src/data/endringslogg.ts) og lages der; se docs/varsler.md.
--
-- Uleste varsler om det samme slås sammen: ett varsel om fortolkningen, og
-- ett per idé og kategori, med hendelsene i. Når varselet er lest, begynner
-- neste hendelse på et nytt. Hvilke kategorier brukeren vil se, velges i
-- appen og lagres i brukerinnstillingene; databasen lager alle, og appen
-- viser dem brukeren har valgt.

create type public.varselkategori as enum ('fortolkning', 'mine_ideer', 'aktive_ideer', 'favoritter');

create table public.varsler (
  id uuid primary key default gen_random_uuid(),
  mottaker_id uuid not null references public.profiles (id) on delete cascade,
  kategori public.varselkategori not null,
  -- Hva uleste varsler samles etter: kategorien, og idéen for kommentarene.
  gruppe text not null,
  -- Idéen varselet gjelder. Slettes idéen, går varslene med.
  ide_id uuid references public.ideer (id) on delete cascade,
  -- Hendelsene, eldste først: { kl, av } og det hendelsen gjelder.
  hendelser jsonb not null,
  opprettet_kl timestamptz not null default now(),
  oppdatert_kl timestamptz not null default now(),
  lest_kl timestamptz,
  constraint varsler_hendelser check (
    jsonb_typeof(hendelser) = 'array' and jsonb_array_length(hendelser) between 1 and 100
  )
);

comment on table public.varsler is
  'Varslene til hver bruker. Uleste om det samme er ett varsel med flere hendelser. Lages av utløsere, leses og merkes lest gjennom funksjonene.';

create unique index varsler_ulest_gruppe on public.varsler (mottaker_id, gruppe) where lest_kl is null;
create index varsler_mottaker_idx on public.varsler (mottaker_id, oppdatert_kl desc);
create index varsler_ide_idx on public.varsler (ide_id) where ide_id is not null;

alter table public.varsler enable row level security;

create policy "Brukeren ser egne varsler" on public.varsler
for select to authenticated using (mottaker_id = (select auth.uid()));

revoke all on public.varsler from anon, authenticated;
grant select on public.varsler to authenticated;

-- Hvor lenge et lest varsel blir stående.
create function intern.varselfrist()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '30 days'
$$;

-- --- Å lage et varsel ----------------------------------------------------------

-- Gir hver mottaker hendelsen: i det uleste varselet i gruppen når det finnes,
-- ellers i et nytt. Med `erstatt` byttes en tidligere hendelse med samme
-- verdi for den nøkkelen ut, så samme ting står én gang (et objekt som
-- publiseres to ganger). De siste hundre hendelsene beholdes.
create function intern.varsle(
  mottakere uuid[],
  kategori public.varselkategori,
  gruppe text,
  ide uuid,
  hendelse jsonb,
  erstatt text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.varsler as v (mottaker_id, kategori, gruppe, ide_id, hendelser)
  select distinct m, varsle.kategori, varsle.gruppe, varsle.ide, jsonb_build_array(varsle.hendelse)
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

-- En ny kommentar varsler den som skrev idéen og den som fikk svar
-- (mine_ideer), og de andre som har kommentert i tråden (aktive_ideer).
-- Den som skrev kommentaren, varsles ikke.
create function intern.varsle_idekommentar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ideforfatter uuid;
  svar_til uuid;
  hendelse jsonb;
begin
  select i.forfatter_id into ideforfatter from public.ideer i where i.id = new.ide_id;
  select k.forfatter_id into svar_til from public.idekommentarer k where k.id = new.forelder_id;
  hendelse := jsonb_build_object(
    'kl', new.opprettet_kl,
    'av', new.forfatter_id,
    'kommentar', new.id,
    'svar_til', svar_til
  );

  perform intern.varsle(
    array(
      select m from unnest(array[ideforfatter, svar_til]) m
      where m is distinct from new.forfatter_id
    ),
    'mine_ideer', 'mine_ideer:' || new.ide_id, new.ide_id, hendelse
  );

  perform intern.varsle(
    array(
      select k.forfatter_id
      from public.idekommentarer k
      where k.ide_id = new.ide_id
        and k.id <> new.id
        and not k.slettet
        and k.forfatter_id is distinct from new.forfatter_id
        and k.forfatter_id is distinct from ideforfatter
        and k.forfatter_id is distinct from svar_til
    ),
    'aktive_ideer', 'aktive_ideer:' || new.ide_id, new.ide_id, hendelse
  );
  return null;
end;
$$;

create trigger idekommentarer_varsle
after insert on public.idekommentarer
for each row execute function intern.varsle_idekommentar();

-- Fortolkningen er de publiserte kommentarene og regelsettene. Hver
-- publisering av en av dem varsler alle andre enn den som publiserte.
create function intern.er_fortolkning(typ public.objekttype)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select typ::text in ('kommentar', 'intervallregelsett', 'scenarioregelsett', 'thc_regelsett')
$$;

create function intern.varsle_publisering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if intern.er_fortolkning((select o.type from public.redigerbare_objekter o where o.id = new.objekt_id)) then
    perform intern.varsle(
      array(select p.id from public.profiles p where p.id <> new.utfort_av),
      'fortolkning', 'fortolkning', null,
      jsonb_build_object('kl', new.utfort_kl, 'av', new.utfort_av, 'objekt', new.objekt_id),
      'objekt'
    );
  end if;
  return null;
end;
$$;

create trigger objektpubliseringer_varsle
after insert on public.objektpubliseringer
for each row execute function intern.varsle_publisering();

-- Å åpne idéen er å lese kommentarene på den: varsler om den som ikke har fått
-- noe nytt etter at tråden ble lest (`merk_ide_sett`), er lest.
create function intern.idebesok_les_varsler()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.varsler v
  set lest_kl = now()
  where v.mottaker_id = new.bruker_id
    and v.ide_id = new.ide_id
    and v.lest_kl is null
    and v.oppdatert_kl <= new.sett_kl;
  return null;
end;
$$;

create trigger idebesok_les_varsler
after insert or update on public.idebesok
for each row execute function intern.idebesok_les_varsler();

-- --- Lesing ----------------------------------------------------------------------

-- Hva et fortolkningsobjekt heter, og analyttkoden reglene står under på
-- stoffsiden, så varselet kan lenke dit. For et regelsett med flere koder er
-- navnet kodene og koden den første av dem. En kommentar har koden til
-- regelsettet som bruker den, når det finnes; THC-syreregelsettet gjelder IRCAK.
create function intern.fortolkningsobjekt(objekt uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  typ public.objekttype;
  navn text;
  kode text;
begin
  select o.type into typ from public.redigerbare_objekter o where o.id = objekt;
  case typ::text
    when 'kommentar' then
      select k.navn into navn from public.kommentarer k where k.objekt_id = objekt and k.tilstand = 'publisert';
      kode := coalesce(
        (select s.analyttkode
         from public.intervallregelsett s
         where s.tilstand = 'publisert'
           and (objekt in (s.cutoff_innledning_id, s.cutoff_kommentar_id) or exists (
             select 1 from public.intervallregler r
             where r.regelsett_id = s.objekt_id and r.tilstand = s.tilstand and r.kommentar_id = objekt
           ))
         order by s.analyttkode
         limit 1),
        (select a.kode
         from public.scenarioplasseringer p
         join public.scenarioanalytter a on a.objekt_id = p.objekt_id and a.tilstand = p.tilstand
         where p.tilstand = 'publisert' and p.kommentar_id = objekt
         order by a.posisjon
         limit 1),
        (select 'IRCAK' from public.thc_tekstbolker b where b.tilstand = 'publisert' and b.kommentar_id = objekt limit 1)
      );
    when 'intervallregelsett' then
      select s.analyttkode, s.analyttkode into navn, kode
      from public.intervallregelsett s where s.objekt_id = objekt and s.tilstand = 'publisert';
    when 'scenarioregelsett' then
      select string_agg(a.kode, ' · ' order by a.posisjon), (array_agg(a.kode order by a.posisjon))[1] into navn, kode
      from public.scenarioanalytter a where a.objekt_id = objekt and a.tilstand = 'publisert';
    when 'thc_regelsett' then
      navn := 'IRCAK';
      kode := 'IRCAK';
    else
      return null;
  end case;
  return jsonb_build_object('id', objekt, 'type', typ, 'navn', navn, 'analyttkode', kode);
end;
$$;

-- Hendelsene slik de vises: fortolkningsobjektene med navn, og bare
-- kommentarer som fortsatt står (en slettet kommentar er ikke noe å se).
create function intern.varselhendelser(hendelser jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
      case when h ? 'objekt' then h || jsonb_build_object('objekt', intern.fortolkningsobjekt((h ->> 'objekt')::uuid)) else h end
      order by nr
    ), '[]'::jsonb)
  from jsonb_array_elements(hendelser) with ordinality t(h, nr)
  where not h ? 'kommentar' or exists (
    select 1 from public.idekommentarer k where k.id = (h ->> 'kommentar')::uuid and not k.slettet
  )
$$;

-- Varslene til den innloggede, de nyeste først: alle uleste, og de leste fra
-- de siste 30 dagene. `lest_kl` er når de ble lest, så de kan merkes lest slik
-- de var da (`merk_varsler_lest`).
create function public.mine_varsler()
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
          'hendelser', v.hendelser,
          'opprettet_kl', v.opprettet_kl,
          'oppdatert_kl', v.oppdatert_kl,
          'lest_kl', v.lest_kl
        ) order by v.oppdatert_kl desc, v.id)
      from (
        select v.id, v.kategori, v.ide_id, v.opprettet_kl, v.oppdatert_kl, v.lest_kl,
               intern.varselhendelser(v.hendelser) as hendelser
        from public.varsler v
        where v.mottaker_id = (select auth.uid())
          and (v.lest_kl is null or v.lest_kl > now() - intern.varselfrist())
        order by v.oppdatert_kl desc, v.id
        limit 200
      ) v
      where jsonb_array_length(v.hendelser) > 0
    ), '[]'::jsonb)
  )
$$;

comment on function public.mine_varsler() is
  'Varslene til den innloggede: alle uleste og de leste fra de siste 30 dagene, de nyeste først, med når de ble lest.';

-- Antall uleste varsler per kategori, til tallet på bjella.
create function public.uleste_varsler()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k.kategori, k.antall), '{}'::jsonb)
  from (
    select v ->> 'kategori' as kategori, count(*) as antall
    from jsonb_array_elements(public.mine_varsler() -> 'varsler') v
    where v ->> 'lest_kl' is null
    group by 1
  ) k
$$;

comment on function public.uleste_varsler() is
  'Hvor mange uleste varsler den innloggede har, per kategori.';

-- Merker varslene lest slik de var da de ble lest (`til`): et varsel som har
-- fått en ny hendelse siden, står ulest. Uten `varsler` gjelder det alle. Leste
-- varsler eldre enn fristen ryddes bort samtidig.
create function public.merk_varsler_lest(varsler uuid[], til timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := (select auth.uid());
begin
  if bruker is null then
    raise exception 'Bare innloggede har varsler.' using errcode = '42501';
  end if;
  update public.varsler v
  set lest_kl = now()
  where v.mottaker_id = bruker
    and v.lest_kl is null
    and v.oppdatert_kl <= least(merk_varsler_lest.til, now())
    and (merk_varsler_lest.varsler is null or v.id = any (merk_varsler_lest.varsler));
  delete from public.varsler v
  where v.mottaker_id = bruker and v.lest_kl <= now() - intern.varselfrist();
end;
$$;

comment on function public.merk_varsler_lest(uuid[], timestamptz) is
  'Merker den innloggedes varsler lest (alle, eller de oppgitte), slik de var på tidspunktet `til`.';

-- --- Rettigheter -----------------------------------------------------------------

revoke all on function public.mine_varsler() from public, anon, authenticated, service_role;
revoke all on function public.uleste_varsler() from public, anon, authenticated, service_role;
revoke all on function public.merk_varsler_lest(uuid[], timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.mine_varsler() to authenticated;
grant execute on function public.uleste_varsler() to authenticated;
grant execute on function public.merk_varsler_lest(uuid[], timestamptz) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;