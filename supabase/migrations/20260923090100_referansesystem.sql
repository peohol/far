-- Referansesystemet: én global referansebase med stabile ID-er, og koblinger
-- fra informasjonssider og innholdselementer til referansene.
--
-- Bygger på fundamentet for redigerbart faginnhold. En referanse er en egen
-- objekttype, med utkast, publisering, revisjoner og gjenoppretting som alt
-- annet faginnhold. Bakgrunnen står i docs/faginnhold.md. Kort fortalt:
--
--   * Referansen har feltene Slaids bruker — tittel, forfattere, år og lenke —
--     og kan arkiveres. Arkivering er en vanlig revisjon og kan gjøres om.
--   * Innholdet siterer referansene på tre nivåer: på et panel (lagret på
--     informasjonssiden), på et kort (lagret på innholdselementet) og inline i
--     rikteksten (siteringsnoder i elementets data). Alle tre lagres som
--     referanse-ID-er, aldri som numre. Numrene regnes ut når siden vises.
--   * Hver sitering blir en rad i `referansekoblinger`, skrevet av de samme
--     funksjonene som skriver innholdet. Tabellen er det databasen håndhever
--     reglene med: at det publiserte bare siterer publiserte referanser, at en
--     arkivert referanse ikke kan siteres, og at en referanse i bruk ikke kan
--     slettes.
--   * En referanse kan bare slettes helt om den aldri har vært publisert og
--     aldri har vært sitert, heller ikke i en eldre revisjon av noe. Ellers
--     må den arkiveres. Slettingen føres i en egen logg.

-- --- Typene ----------------------------------------------------------------

-- Samme verdier som REFERANSENIVAER i src/faginnhold/modell.ts, i
-- leserekkefølge: panelet før kortene, kortet før teksten i det.
create type public.referanseniva as enum ('panel', 'element', 'inline');

-- --- Referansene -----------------------------------------------------------

create table public.referanser (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  tittel text not null,
  forfattere text not null,
  aar text not null,
  lenke text not null,
  arkivert boolean not null,
  constraint referanser_pkey primary key (objekt_id, tilstand),
  constraint referanser_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint referanser_tittel check (char_length(tittel) <= 1000 and tittel = btrim(tittel)),
  constraint referanser_forfattere check (
    char_length(forfattere) <= 2000 and forfattere = btrim(forfattere)
  ),
  constraint referanser_aar check (char_length(aar) <= 40 and aar = btrim(aar)),
  -- Lenken vises som en klikkbar lenke, og skal aldri kunne være noe annet
  -- enn en nettadresse.
  constraint referanser_lenke check (
    char_length(lenke) <= 2000 and (lenke = '' or lenke ~* '^https?://[^[:space:]]+$')
  ),
  -- Som i Slaids: en referanse uten tittel, forfatter og lenke er ingen kilde.
  constraint referanser_ikke_tom check (tittel <> '' or forfattere <> '' or lenke <> '')
);

comment on table public.referanser is
  'Én kilde i den globale referansebasen, på Slaids-formen Tittel · Forfatter(e) · År · Lenke. Numre lagres aldri; de regnes ut per side.';
comment on column public.referanser.arkivert is
  'En arkivert referanse kan ikke siteres. Arkivering er en revisjon som kan gjøres om.';

create table public.referansekoblinger (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nr integer not null,
  niva public.referanseniva not null,
  panel text,
  referanse_id uuid not null references public.redigerbare_objekter (id),
  constraint referansekoblinger_pkey primary key (objekt_id, tilstand, nr),
  constraint referansekoblinger_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint referansekoblinger_nr check (nr >= 1),
  constraint referansekoblinger_panel check (
    (niva = 'panel') = (panel is not null)
    and (panel is null or (char_length(panel) <= 60 and panel ~ '^[a-z][a-z0-9_]*$'))
  )
);

-- Et kort eller et panel viser til hver referanse bare én gang. Inline kan
-- samme referanse stå mange steder i samme tekst.
create unique index referansekoblinger_element_entydig
  on public.referansekoblinger (objekt_id, tilstand, referanse_id)
  where niva = 'element';
create unique index referansekoblinger_panel_entydig
  on public.referansekoblinger (objekt_id, tilstand, panel, referanse_id)
  where niva = 'panel';
create index referansekoblinger_referanse_idx
  on public.referansekoblinger (referanse_id, tilstand);

comment on table public.referansekoblinger is
  'Hver sitering av en referanse, fra et panel (objektet er informasjonssiden), et kort eller inline i teksten (objektet er innholdselementet). Skrives av funksjonene som skriver innholdet.';
comment on column public.referansekoblinger.nr is
  'Rekkefølgen i objektet. Nummeret på siden regnes ut ved visning, etter første forekomst.';

-- Referanser som er slettet for godt, med det siste øyeblikksbildet og hvem
-- som slettet dem. Bare referanser som aldri ble publisert eller sitert, havner
-- her; alt annet arkiveres.
create table public.slettede_referanser (
  objekt_id uuid primary key,
  innhold jsonb not null,
  revisjon integer not null,
  slettet_av uuid not null,
  slettet_av_fornavn text not null,
  slettet_av_etternavn text not null,
  slettet_kl timestamptz not null default now()
);

comment on table public.slettede_referanser is
  'Logg over referanser som er slettet for godt: siste utkast og hvem som slettet. Rader endres og slettes aldri.';

-- --- Vakter i databasen ----------------------------------------------------

-- Historikken er fortsatt uforanderlig. Det eneste unntaket er at
-- slett_referanse kan fjerne en referanse som aldri har vært publisert eller
-- sitert — og bare den ene, i transaksjonen som sletter den. Publiseringer
-- slettes aldri.
create or replace function intern.avvis_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slettes text := nullif(current_setting('intern.sletter_referanse', true), '');
begin
  if tg_op = 'DELETE'
    and slettes is not null
    and tg_table_name in ('redigerbare_objekter', 'objektrevisjoner')
    and slettes = coalesce(to_jsonb(old) ->> 'objekt_id', to_jsonb(old) ->> 'id')
    and exists (
      select 1 from public.redigerbare_objekter o
      where o.id = slettes::uuid and o.type = 'referanse'
    )
  then
    return old;
  end if;
  raise exception 'Historikken for faginnholdet kan ikke endres eller slettes.'
    using errcode = '42501';
end;
$$;

create trigger slettede_referanser_uforanderlig
before update or delete on public.slettede_referanser
for each row execute function intern.avvis_endring();

create trigger slettede_referanser_ikke_tom
before truncate on public.slettede_referanser
for each statement execute function intern.avvis_endring();

create trigger referanser_objekttype
before insert or update on public.referanser
for each row execute function intern.krev_objekttype('objekt_id', 'referanse');

-- Det publiserte siterer bare publiserte referanser. Referansen publiseres
-- derfor før det som siterer den.
create trigger referansekoblinger_objekttype
before insert or update on public.referansekoblinger
for each row execute function intern.krev_objekttype('referanse_id', 'referanse');

-- Panelreferanser står på informasjonssiden, kort- og inlinereferanser på
-- innholdselementet. En arkivert referanse kan ikke siteres.
create function intern.krev_gyldig_kobling()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  forventet public.objekttype :=
    case when new.niva = 'panel' then 'infoside' else 'innholdselement' end;
begin
  if (select o.type from public.redigerbare_objekter o where o.id = new.objekt_id)
    is distinct from forventet
  then
    raise exception 'Referanser på nivået % hører til et objekt av typen %.', new.niva, forventet
      using errcode = '22023';
  end if;

  -- Låsen gjør at en samtidig arkivering enten venter på denne siteringen og
  -- ser den, eller er ferdig før og blir sett her.
  perform 1 from public.referanser r
  where r.objekt_id = new.referanse_id and r.tilstand = new.tilstand
  for share;
  if exists (
    select 1 from public.referanser r
    where r.objekt_id = new.referanse_id and r.tilstand = new.tilstand and r.arkivert
  ) then
    raise exception 'En av referansene er arkivert og kan ikke brukes som kilde. Hent den fram igjen først.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger referansekoblinger_regler
before insert or update on public.referansekoblinger
for each row execute function intern.krev_gyldig_kobling();

-- --- Lesing av det som sendes inn ------------------------------------------

create function intern.sannhetsverdi(p_innhold jsonb, p_felt text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'boolean' then
    raise exception 'Feltet % må være sant eller usant.', p_felt using errcode = '22023';
  end if;
  return (p_innhold -> p_felt)::boolean;
end;
$$;

-- Et felt som kom til etter at objekttypen ble laget. Eldre revisjoner mangler
-- det, og skal fortsatt kunne gjenopprettes.
create function intern.med_standard(p_innhold jsonb, p_felt text, p_standard jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_innhold) = 'object' and not p_innhold ? p_felt
      then p_innhold || jsonb_build_object(p_felt, p_standard)
    else p_innhold
  end
$$;

-- Inline-siteringene i et elements data, i den rekkefølgen de står. En
-- sitering er en node `{"type": "sitering", "attrs": {"referanser": [...]}}`
-- hvor som helst i dataene — samme form som siteringsnoden i Slaids, med norske
-- navn. ID-ene må stå på den vanlige formen, med små bokstaver, siden appen
-- kjenner igjen referansene på teksten.
create function intern.siteringer(p_data jsonb)
returns table (nr integer, referanse_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
declare
  node jsonb;
  verdi jsonb;
  ider uuid[];
  teller integer := 0;
begin
  for node in
    select v from jsonb_path_query(p_data, 'strict $.**') v
    where jsonb_typeof(v) = 'object' and v ->> 'type' = 'sitering'
  loop
    if jsonb_typeof(node -> 'attrs') is distinct from 'object' then
      raise exception 'En sitering mangler referansene sine.' using errcode = '22023';
    end if;
    ider := intern.id_liste(node -> 'attrs', 'referanser');
    if cardinality(ider) = 0 then
      raise exception 'En sitering må vise til minst én referanse.' using errcode = '22023';
    end if;
    for verdi in select jsonb_array_elements(node -> 'attrs' -> 'referanser') loop
      if (verdi #>> '{}') <> (verdi #>> '{}')::uuid::text then
        raise exception 'Referanse-ID-ene i en sitering skal skrives med små bokstaver og bindestreker.'
          using errcode = '22023';
      end if;
    end loop;

    for i in 1 .. cardinality(ider) loop
      teller := teller + 1;
      nr := teller;
      referanse_id := ider[i];
      return next;
    end loop;
  end loop;
end;
$$;

-- --- Skriving og lesing, per objekttype ------------------------------------

create function intern.skriv_referanse(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  arkiveres boolean;
  i_bruk integer;
begin
  p_innhold := intern.med_standard(p_innhold, 'arkivert', 'false');
  perform intern.krev_felt(p_innhold, array['tittel', 'forfattere', 'aar', 'lenke', 'arkivert']);
  arkiveres := intern.sannhetsverdi(p_innhold, 'arkivert');

  if intern.tekst(p_innhold, 'tittel') = ''
    and intern.tekst(p_innhold, 'forfattere') = ''
    and intern.tekst(p_innhold, 'lenke') = ''
  then
    raise exception 'En referanse må ha minst en tittel, en forfatter eller en lenke.'
      using errcode = '22023';
  end if;
  if intern.tekst(p_innhold, 'lenke') !~* '^(https?://[^[:space:]]+)?$' then
    raise exception 'Lenken må være en nettadresse som begynner med http:// eller https://.'
      using errcode = '22023';
  end if;

  insert into public.referanser (objekt_id, tilstand, tittel, forfattere, aar, lenke, arkivert)
  values (
    p_objekt,
    p_tilstand,
    intern.tekst(p_innhold, 'tittel'),
    intern.tekst(p_innhold, 'forfattere'),
    intern.tekst(p_innhold, 'aar'),
    intern.tekst(p_innhold, 'lenke'),
    arkiveres
  )
  on conflict on constraint referanser_pkey do update set
    tittel = excluded.tittel,
    forfattere = excluded.forfattere,
    aar = excluded.aar,
    lenke = excluded.lenke,
    arkivert = excluded.arkivert;

  -- Kontrollen kommer etter skrivingen, som låser raden: en samtidig
  -- sitering venter på låsen (se krev_gyldig_kobling) og ser deretter at
  -- referansen er arkivert, eller er alt skrevet og telles med her.
  if arkiveres then
    select count(*) into i_bruk
    from public.referansekoblinger k
    where k.referanse_id = p_objekt and k.tilstand = p_tilstand;
    if i_bruk > 0 then
      raise exception '%', case p_tilstand
        when 'utkast' then
          'Referansen er i bruk og kan ikke arkiveres. Fjern den fra innholdet først.'
        else
          'Referansen er fortsatt i bruk i det publiserte innholdet. Publiser innholdet der den er fjernet, først.'
        end
        using errcode = '22023';
    end if;
  end if;
end;
$$;

create function intern.les_referanse(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'tittel', r.tittel,
    'forfattere', r.forfattere,
    'aar', r.aar,
    'lenke', r.lenke,
    'arkivert', r.arkivert
  )
  from public.referanser r
  where r.objekt_id = p_objekt and r.tilstand = p_tilstand
$$;

-- Informasjonssiden får panelreferansene: et objekt fra panelnøkkel til en
-- ordnet liste med referanse-ID-er. De lagres som koblinger, ikke som JSON.
--
-- Uten referanser utelates feltet i øyeblikksbildet, i stedet for å stå tomt.
-- Da er et objekt fra før denne migrasjonen fortsatt nøyaktig likt revisjonen
-- det peker på, og kan publiseres og gjenopprettes uten en ny revisjon.
create or replace function intern.skriv_infoside(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  nytt_navn text;
  paneler jsonb;
  panelet text;
  teller integer := 0;
begin
  p_innhold := intern.med_standard(p_innhold, 'panelreferanser', '{}');
  perform intern.krev_felt(p_innhold, array['navn', 'panelreferanser']);
  nytt_navn := intern.tekst(p_innhold, 'navn');
  paneler := intern.objekt(p_innhold, 'panelreferanser');

  if exists (
    select 1 from public.infosider s
    where s.tilstand = p_tilstand and lower(s.navn) = lower(nytt_navn) and s.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt en informasjonsside som heter %.', nytt_navn
      using errcode = '22023';
  end if;

  insert into public.infosider (objekt_id, tilstand, navn)
  values (p_objekt, p_tilstand, nytt_navn)
  on conflict on constraint infosider_pkey do update set navn = excluded.navn;

  delete from public.referansekoblinger k
  where k.objekt_id = p_objekt and k.tilstand = p_tilstand;

  for panelet in select p from jsonb_object_keys(paneler) p order by p loop
    if char_length(panelet) > 60 or panelet !~ '^[a-z][a-z0-9_]*$' then
      raise exception 'Panelet % har ikke en gyldig nøkkel.', panelet using errcode = '22023';
    end if;

    insert into public.referansekoblinger (objekt_id, tilstand, nr, niva, panel, referanse_id)
    select p_objekt, p_tilstand, teller + r.nr, 'panel', panelet, r.id
    from unnest(intern.id_liste(paneler, panelet)) with ordinality as r(id, nr);
    teller := teller + jsonb_array_length(paneler -> panelet);
  end loop;
end;
$$;

create or replace function intern.les_infoside(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('navn', s.navn) || coalesce(
    (
      select jsonb_build_object('panelreferanser', jsonb_object_agg(p.panel, p.ider))
      from (
        select k.panel, jsonb_agg(k.referanse_id order by k.nr) as ider
        from public.referansekoblinger k
        where k.objekt_id = s.objekt_id and k.tilstand = s.tilstand and k.niva = 'panel'
        group by k.panel
      ) p
      having count(*) > 0
    ),
    '{}'::jsonb
  )
  from public.infosider s
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand
$$;

-- Innholdselementet får kortreferansene som en ordnet liste, og
-- inline-siteringene leses ut av dataene. Uten kortreferanser utelates
-- feltet, av samme grunn som panelreferansene over.
create or replace function intern.skriv_innholdselement(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  kortreferanser uuid[];
  dataene jsonb;
begin
  p_innhold := intern.med_standard(p_innhold, 'referanser', '[]');
  perform intern.krev_felt(
    p_innhold, array['infoside', 'panel', 'posisjon', 'elementtype', 'data', 'referanser']
  );
  kortreferanser := intern.id_liste(p_innhold, 'referanser');
  dataene := intern.objekt(p_innhold, 'data');

  insert into public.innholdselementer (
    objekt_id, tilstand, infoside_id, panel, posisjon, elementtype, data
  )
  values (
    p_objekt,
    p_tilstand,
    intern.id(p_innhold, 'infoside'),
    intern.tekst(p_innhold, 'panel'),
    intern.heltall(p_innhold, 'posisjon'),
    intern.tekst(p_innhold, 'elementtype'),
    dataene
  )
  on conflict on constraint innholdselementer_pkey do update set
    infoside_id = excluded.infoside_id,
    panel = excluded.panel,
    posisjon = excluded.posisjon,
    elementtype = excluded.elementtype,
    data = excluded.data;

  delete from public.referansekoblinger k
  where k.objekt_id = p_objekt and k.tilstand = p_tilstand;

  insert into public.referansekoblinger (objekt_id, tilstand, nr, niva, referanse_id)
  select p_objekt, p_tilstand, r.nr, 'element', r.id
  from unnest(kortreferanser) with ordinality as r(id, nr);

  insert into public.referansekoblinger (objekt_id, tilstand, nr, niva, referanse_id)
  select p_objekt, p_tilstand, cardinality(kortreferanser) + s.nr, 'inline', s.referanse_id
  from intern.siteringer(dataene) s;
end;
$$;

create or replace function intern.les_innholdselement(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'infoside', e.infoside_id,
    'panel', e.panel,
    'posisjon', e.posisjon,
    'elementtype', e.elementtype,
    'data', e.data
  ) || coalesce(
    (
      select jsonb_build_object('referanser', jsonb_agg(k.referanse_id order by k.nr))
      from public.referansekoblinger k
      where k.objekt_id = e.objekt_id and k.tilstand = e.tilstand and k.niva = 'element'
      having count(*) > 0
    ),
    '{}'::jsonb
  )
  from public.innholdselementer e
  where e.objekt_id = p_objekt and e.tilstand = p_tilstand
$$;

-- --- Bruken av referansene -------------------------------------------------

-- Hvilke sider hver referanse brukes på, og hvor mange ganger, i utkastet og i
-- det publiserte. Radsikkerheten gjelder gjennom visningen.
create view public.referansebruk
with (security_invoker = true)
as
select
  k.referanse_id,
  k.tilstand,
  coalesce(e.infoside_id, k.objekt_id) as infoside_id,
  count(*)::integer as forekomster
from public.referansekoblinger k
left join public.innholdselementer e on e.objekt_id = k.objekt_id and e.tilstand = k.tilstand
group by k.referanse_id, k.tilstand, coalesce(e.infoside_id, k.objekt_id);

comment on view public.referansebruk is
  'Sidene hver referanse brukes på, med antall forekomster, i utkastet og i det publiserte.';

-- --- Sletting --------------------------------------------------------------

create function public.slett_referanse(objekt uuid, forventet_revisjon integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  forfatter public.profiles := intern.krev_admin();
  gjeldende public.objektrevisjoner := intern.laas_utkast(objekt, forventet_revisjon);
begin
  -- Låsen holder unna en samtidig lagring som ville sitert referansen:
  -- koblingen dit venter på den, og avvises når referansen er borte.
  perform 1 from public.redigerbare_objekter o where o.id = objekt for update;

  if (select o.type from public.redigerbare_objekter o where o.id = objekt) <> 'referanse' then
    raise exception 'Bare referanser kan slettes.' using errcode = '22023';
  end if;

  if exists (select 1 from public.objektpubliseringer p where p.objekt_id = objekt) then
    raise exception 'Referansen har vært publisert og kan ikke slettes. Arkiver den i stedet.'
      using errcode = '22023';
  end if;

  -- I bruk er også det som bare står i en eldre revisjon av noe: den skal
  -- fortsatt kunne gjenopprettes.
  if exists (select 1 from public.referansekoblinger k where k.referanse_id = objekt)
    or exists (
      select 1 from public.objektrevisjoner r
      where r.objekt_id <> objekt and strpos(lower(r.innhold::text), objekt::text) > 0
    )
  then
    raise exception 'Referansen er i bruk, nå eller i historikken, og kan ikke slettes. Arkiver den i stedet.'
      using errcode = '22023';
  end if;

  insert into public.slettede_referanser (
    objekt_id, innhold, revisjon, slettet_av, slettet_av_fornavn, slettet_av_etternavn
  )
  values (
    objekt, gjeldende.innhold, gjeldende.revisjon,
    forfatter.id, forfatter.first_name, forfatter.last_name
  );

  perform set_config('intern.sletter_referanse', objekt::text, true);
  delete from public.objekttilstander t where t.objekt_id = objekt;
  delete from public.objektrevisjoner r where r.objekt_id = objekt;
  delete from public.redigerbare_objekter o where o.id = objekt;
  perform set_config('intern.sletter_referanse', '', true);

  return objekt;
end;
$$;

comment on function public.slett_referanse(uuid, integer) is
  'Sletter en referanse som aldri har vært publisert eller sitert. Alt annet må arkiveres. Krever administrator.';

-- --- Radsikkerhet ----------------------------------------------------------

alter table public.referanser enable row level security;
alter table public.referansekoblinger enable row level security;
alter table public.slettede_referanser enable row level security;

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.referanser for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.referansekoblinger for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Bare administratorer ser slettede referanser"
on public.slettede_referanser for select to authenticated
using ((select public.er_admin()));

-- --- Rettigheter -----------------------------------------------------------

revoke all on table
  public.referanser,
  public.referansekoblinger,
  public.slettede_referanser,
  public.referansebruk
from anon, authenticated, service_role;

grant select on table
  public.referanser,
  public.referansekoblinger,
  public.slettede_referanser,
  public.referansebruk
to authenticated, service_role;

revoke all on function public.slett_referanse(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function public.slett_referanse(uuid, integer) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
