-- Stoffregisteret i databasen, del 2: lesingen og kategoriene.
--
-- Tabellene og inndelingen kom i `stoffregister_redigering`. Her kommer
-- funksjonen appen leser registeret med, og de som lager, gir nytt navn til,
-- flytter og arkiverer kategoriene. Resten av reglene kommer i
-- `stoffregister_funksjoner`; de står samlet i `docs/stoffregister.md`.

-- --- Innholdet på fagsiden -------------------------------------------------------

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

-- --- Rettighetene ------------------------------------------------------------------------

revoke all on function
  public.les_stoffregister(public.objekttilstand),
  public.opprett_stoffkategori(text, uuid),
  public.endre_stoffkategori(uuid, text),
  public.flytt_stoffkategori(uuid, uuid, integer),
  public.arkiver_stoffkategori(uuid, boolean)
from public, anon, authenticated, service_role;

grant execute on function
  public.les_stoffregister(public.objekttilstand),
  public.opprett_stoffkategori(text, uuid),
  public.endre_stoffkategori(uuid, text),
  public.flytt_stoffkategori(uuid, uuid, integer),
  public.arkiver_stoffkategori(uuid, boolean)
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
