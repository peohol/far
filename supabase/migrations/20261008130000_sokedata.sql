-- Lette søkedata til søket i hele kunnskapsbasen, og versjoner så appen kan
-- gjenbruke det den har lest før.
--
-- Søket trenger bare navnene: preparatnavnene per legemiddelform og navnet på
-- det hver interaksjon er med. Før leste det alle legemiddeldataene
-- (`les_legemidler`, ~3 MB) og alle interaksjonene (`les_interaksjoner`,
-- ~7 MB) for alle sidene samtidig, og på en travel database gikk kallene ut på
-- tid, så preparatene og interaksjonene falt ut av søket.
--
-- - `les_preparatsok` og `les_interaksjonssok` gir det søket trenger per side,
--   med de samme preparatene og interaksjonene som seksjonene på siden viser
--   (`utvalgFor`, `preparattekster`, `byggInteraksjoner` i src/legemiddeldata).
-- - Interaksjonene slås opp i en liten oppslagstabell med stoffene og
--   gruppenavnene, som holdes à jour av synkroniseringen. Også
--   `les_interaksjoner` på siden bruker den.
-- - `les_farmakogenetikk_sok` er `les_farmakogenetikk` uten feltene søket ikke
--   bruker (allelfenotypene, legemidlene og litteraturen).
-- - `sokedata_versjoner` sier når hver kilde sist ble endret, så appen bare
--   leser på nytt det som er endret.

-- --- Interaksjonene ------------------------------------------------------

-- Navnet på en substansgruppe, som `gruppenavn` i src/legemiddeldata/interaksjoner.ts:
-- gruppens eget, ellers stoffet med den overordnede ATC-koden som omfatter
-- alle de andre, ellers stoffene etter hverandre.
create function legemiddeldata.gruppenavn(gruppe jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  with substanser as (
    select s.n, coalesce(s.x ->> 'navn', '') as navn, coalesce(s.x -> 'atc' ->> 'kode', '') as kode
    from jsonb_array_elements(
      case when jsonb_typeof(gruppe -> 'substanser') = 'array' then gruppe -> 'substanser' else '[]'::jsonb end
    ) with ordinality as s(x, n)
  )
  select coalesce(
    nullif(gruppe ->> 'navn', ''),
    (
      select o.navn
      from substanser o
      where o.kode <> '' and o.navn <> ''
        and not exists (select 1 from substanser k where k.kode <> '' and not starts_with(k.kode, o.kode))
      order by o.n
      limit 1
    ),
    (
      select string_agg(u.navn, ', ' order by u.forst)
      from (select s.navn, min(s.n) as forst from substanser s where s.navn <> '' group by s.navn) u
    ),
    ''
  )
$$;

-- De aktive interaksjonene, med relevansen og navnet på hver substansgruppe.
create table legemiddeldata.interaksjonsoppslag (
  interaksjon_id text primary key references legemiddeldata.interaksjon (fest_id) on delete cascade,
  relevans text,
  gruppenavn text[] not null
);

-- Stoffene i hver substansgruppe: ATC-koden og virkestoffet. `gruppe` er
-- gruppens nummer i interaksjonen, fra 1.
create table legemiddeldata.interaksjonssubstanser (
  interaksjon_id text not null references legemiddeldata.interaksjonsoppslag (interaksjon_id) on delete cascade,
  gruppe smallint not null,
  atc text,
  virkestoff_id text,
  check (atc is not null or virkestoff_id is not null)
);

create index interaksjonssubstanser_interaksjon_idx on legemiddeldata.interaksjonssubstanser (interaksjon_id);
create index interaksjonssubstanser_atc_idx on legemiddeldata.interaksjonssubstanser (atc) where atc is not null;
create index interaksjonssubstanser_virkestoff_idx
  on legemiddeldata.interaksjonssubstanser (virkestoff_id) where virkestoff_id is not null;

comment on table legemiddeldata.interaksjonsoppslag is
  'Oppslag for de aktive interaksjonene: relevansen og navnet på hver substansgruppe. Avledet av interaksjon; holdes à jour av en trigger.';
comment on table legemiddeldata.interaksjonssubstanser is
  'Oppslag for de aktive interaksjonene: ATC-koden og virkestoffet til hvert stoff, med gruppen det står i. Avledet av interaksjon.';

-- Bygger oppslaget for interaksjonene på nytt fra dataene.
create function legemiddeldata.bygg_interaksjonsoppslag(ider text[])
returns void
language sql
set search_path = ''
as $$
  delete from legemiddeldata.interaksjonsoppslag o where o.interaksjon_id = any (ider);

  insert into legemiddeldata.interaksjonsoppslag (interaksjon_id, relevans, gruppenavn)
  select i.fest_id, i.relevans, array(
    select legemiddeldata.gruppenavn(g.g)
    from jsonb_array_elements(
      case when jsonb_typeof(i.data -> 'substansgrupper') = 'array' then i.data -> 'substansgrupper' else '[]'::jsonb end
    ) with ordinality as g(g, n)
    order by g.n
  )
  from legemiddeldata.interaksjon i
  where i.fest_id = any (ider) and i.utgatt_kl is null;

  insert into legemiddeldata.interaksjonssubstanser (interaksjon_id, gruppe, atc, virkestoff_id)
  select i.fest_id, g.n, nullif(s.x -> 'atc' ->> 'kode', ''), nullif(s.x ->> 'virkestoff_id', '')
  from legemiddeldata.interaksjon i
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(i.data -> 'substansgrupper') = 'array' then i.data -> 'substansgrupper' else '[]'::jsonb end
  ) with ordinality as g(g, n)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(g.g -> 'substanser') = 'array' then g.g -> 'substanser' else '[]'::jsonb end
  ) as s(x)
  where i.fest_id = any (ider) and i.utgatt_kl is null
    and (nullif(s.x -> 'atc' ->> 'kode', '') is not null or nullif(s.x ->> 'virkestoff_id', '') is not null);
$$;

-- Synkroniseringen skriver alle radene hver natt; oppslaget bygges bare for
-- de nye, de endrede og de som er utgått eller kommet tilbake.
create function legemiddeldata.oppdater_interaksjonsoppslag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform legemiddeldata.bygg_interaksjonsoppslag(array(select n.fest_id from ny n));
  else
    perform legemiddeldata.bygg_interaksjonsoppslag(array(
      select n.fest_id
      from ny n
      join gammel g on g.fest_id = n.fest_id
      where n.hash is distinct from g.hash or n.utgatt_kl is distinct from g.utgatt_kl
    ));
  end if;
  return null;
end;
$$;

create trigger interaksjon_oppslag_nye
  after insert on legemiddeldata.interaksjon
  referencing new table as ny
  for each statement execute function legemiddeldata.oppdater_interaksjonsoppslag();

create trigger interaksjon_oppslag_endrede
  after update on legemiddeldata.interaksjon
  referencing old table as gammel new table as ny
  for each statement execute function legemiddeldata.oppdater_interaksjonsoppslag();

select legemiddeldata.bygg_interaksjonsoppslag(array(select i.fest_id from legemiddeldata.interaksjon i));

-- Siden slår opp interaksjonene i oppslaget i stedet for i JSON-dataene.
-- Svaret er det samme som før.
create or replace function public.les_interaksjoner(atc_koder text[], virkestoff_ider text[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(atc_koder), 0) > 100 or coalesce(cardinality(virkestoff_ider), 0) > 100 then
    raise exception 'For mange ATC-koder eller virkestoff.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(atc_koder, '{}'::text[])) a(kode)
    where a.kode is null
       or a.kode !~ '^[A-Z0-9]{1,7}$'
  ) then
    raise exception 'Ugyldig ATC-kode.' using errcode = '22023';
  end if;

  return (
    with
    sok_atc as (
      select distinct left(a.kode, n.n) as kode
      from unnest(coalesce(atc_koder, '{}'::text[])) as a(kode)
      cross join lateral generate_series(1, length(a.kode)) as n(n)
      where a.kode is not null and a.kode <> ''
    ),
    interaksjons_ider as (
      select s.interaksjon_id as fest_id
      from legemiddeldata.interaksjonssubstanser s
      where s.virkestoff_id = any (coalesce(virkestoff_ider, '{}'::text[]))
      union
      select s.interaksjon_id
      from sok_atc a
      join legemiddeldata.interaksjonssubstanser s on s.atc = a.kode
    ),
    ikke_vurdert_ider as (
      select distinct v.fest_id
      from sok_atc a
      cross join lateral (
        select x.fest_id
        from legemiddeldata.interaksjon_ikke_vurdert x
        where x.utgatt_kl is null
          and x.data @> jsonb_build_object(
            'atc',
            jsonb_build_array(jsonb_build_object('kode', a.kode))
          )
      ) v
    )
    select jsonb_build_object(
      'interaksjoner', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.fest_id) || i.data order by i.fest_id)
        from legemiddeldata.interaksjon i
        join interaksjons_ider f on f.fest_id = i.fest_id
        where i.utgatt_kl is null
      ), '[]'::jsonb),
      'ikke_vurdert', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.fest_id) || v.data order by v.fest_id)
        from legemiddeldata.interaksjon_ikke_vurdert v
        join ikke_vurdert_ider f on f.fest_id = v.fest_id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- --- Søkedataene per side ------------------------------------------------

-- `sider` er én liste per side med FEST-ID-ene til virkestoffene siden er
-- koblet til. Svaret har ett element per side, i samme rekkefølge.
create function legemiddeldata.kontroller_sider(sider jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(sider) is distinct from 'array'
     or jsonb_array_length(sider) > 500
     or exists (
       select 1
       from jsonb_array_elements(sider) s(liste)
       where jsonb_typeof(s.liste) <> 'array'
          or jsonb_array_length(s.liste) > 50
          or exists (
            select 1 from jsonb_array_elements(s.liste) v(id)
            where jsonb_typeof(v.id) <> 'string' or length(v.id #>> '{}') > 100
          )
     )
  then
    raise exception 'Ugyldig liste over sider.' using errcode = '22023';
  end if;
end;
$$;

-- Virkestoffene som hører til hver side: de koblede og saltene deres, som
-- `egneVirkestoff`. `side` teller fra 0.
create function legemiddeldata.sidenes_virkestoff(sider jsonb)
returns table (side integer, virkestoff_id text)
language sql
stable
set search_path = ''
as $$
  with koblet as (
    select (s.n - 1)::integer as side, v.id
    from jsonb_array_elements(sider) with ordinality as s(liste, n)
    cross join lateral jsonb_array_elements_text(s.liste) as v(id)
  )
  select k.side, k.id from koblet k
  union
  select k.side, salt.id
  from koblet k
  join legemiddeldata.virkestoff v on v.fest_id = k.id
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(v.data -> 'salter') = 'array' then v.data -> 'salter' else '[]'::jsonb end
  ) as salt(id)
$$;

-- Preparatene hver side viser: de som ikke er utgått, med et av sidens
-- virkestoff med en styrke som ikke er utgått, eller uten styrke, som
-- `les_legemidler` og `utvalgFor`.
create function legemiddeldata.sidenes_preparater(sider jsonb)
returns table (side integer, merkevare_id text)
language sql
stable
set search_path = ''
as $$
  with egne as (select * from legemiddeldata.sidenes_virkestoff(sider))
  select e.side, m.fest_id
  from egne e
  join legemiddeldata.virkestoff_styrke s on s.virkestoff_id = e.virkestoff_id and s.utgatt_kl is null
  join legemiddeldata.merkevare m on m.data -> 'virkestoff_med_styrke' ? s.fest_id and m.utgatt_kl is null
  union
  select e.side, m.fest_id
  from egne e
  join legemiddeldata.merkevare m on m.data -> 'virkestoff_uten_styrke' ? e.virkestoff_id and m.utgatt_kl is null
$$;

-- Preparatnavnene per side, som `[formkode, formtekst, varenavn]`, i
-- rekkefølgen `les_legemidler` gir merkevarene.
create function public.les_preparatsok(sider jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform legemiddeldata.kontroller_sider(sider);

  return (
    with
    rader as (
      select p.side,
             m.data -> 'legemiddelform' ->> 'kode' as kode,
             m.data -> 'legemiddelform' ->> 'tekst' as tekst,
             m.data ->> 'varenavn' as navn,
             min(m.fest_id) as forst
      from legemiddeldata.sidenes_preparater(sider) p
      join legemiddeldata.merkevare m on m.fest_id = p.merkevare_id
      group by p.side, 2, 3, 4
    ),
    per_side as (
      select r.side, jsonb_agg(jsonb_build_array(r.kode, r.tekst, r.navn) order by r.forst, r.kode, r.tekst, r.navn) as liste
      from rader r
      group by r.side
    )
    select coalesce(jsonb_agg(coalesce(ps.liste, '[]'::jsonb) order by s.n), '[]'::jsonb)
    from generate_series(0, jsonb_array_length(sider) - 1) as s(n)
    left join per_side ps on ps.side = s.n
  );
end;
$$;

-- Interaksjonene per side som seksjonen viser (bare relevans 1 og 2), som
-- `[id, relevans, navnet på det siden interagerer med]`.
--
-- Nøklene er de samme som `interaksjonsnokler`: ATC-kodene til preparatene
-- med bare sidens virkestoff, og virkestoffene selv. Sidens gruppe er den
-- første som har et av stoffene, og den andre gruppen er den siden
-- interagerer med, som `byggInteraksjoner`.
create function public.les_interaksjonssok(sider jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform legemiddeldata.kontroller_sider(sider);

  return (
    with
    egne as (select * from legemiddeldata.sidenes_virkestoff(sider)),
    preparater as (select * from legemiddeldata.sidenes_preparater(sider)),
    stoff as (
      select p.side, p.merkevare_id, s.virkestoff_id
      from preparater p
      join legemiddeldata.merkevare m on m.fest_id = p.merkevare_id
      cross join lateral jsonb_array_elements_text(m.data -> 'virkestoff_med_styrke') as ms(id)
      join legemiddeldata.virkestoff_styrke s on s.fest_id = ms.id
      union all
      select p.side, p.merkevare_id, u.id
      from preparater p
      join legemiddeldata.merkevare m on m.fest_id = p.merkevare_id
      cross join lateral jsonb_array_elements_text(m.data -> 'virkestoff_uten_styrke') as u(id)
    ),
    rene as (
      select st.side, st.merkevare_id
      from stoff st
      left join egne e on e.side = st.side and e.virkestoff_id = st.virkestoff_id
      group by st.side, st.merkevare_id
      having bool_and(e.virkestoff_id is not null)
    ),
    atc as (
      select distinct r.side, m.data -> 'atc' ->> 'kode' as kode
      from rene r
      join legemiddeldata.merkevare m on m.fest_id = r.merkevare_id
      where coalesce(m.data -> 'atc' ->> 'kode', '') <> ''
    ),
    prefikser as (
      select distinct a.side, left(a.kode, n.n) as kode
      from atc a
      cross join lateral generate_series(1, length(a.kode)) as n(n)
    ),
    treff as (
      select p.side, s.interaksjon_id, s.gruppe
      from prefikser p
      join legemiddeldata.interaksjonssubstanser s on s.atc = p.kode
      union
      select e.side, s.interaksjon_id, s.gruppe
      from egne e
      join legemiddeldata.interaksjonssubstanser s on s.virkestoff_id = e.virkestoff_id
    ),
    egen as (
      select t.side, t.interaksjon_id, min(t.gruppe) as gruppe
      from treff t
      group by t.side, t.interaksjon_id
    ),
    per_side as (
      select e.side, jsonb_agg(jsonb_build_array(
        o.interaksjon_id,
        o.relevans,
        coalesce((
          select g.navn
          from unnest(o.gruppenavn) with ordinality as g(navn, n)
          where g.n <> e.gruppe
          order by g.n
          limit 1
        ), '')
      ) order by o.interaksjon_id) as liste
      from egen e
      join legemiddeldata.interaksjonsoppslag o on o.interaksjon_id = e.interaksjon_id
      where o.relevans in ('1', '2')
      group by e.side
    )
    select coalesce(jsonb_agg(coalesce(ps.liste, '[]'::jsonb) order by s.n), '[]'::jsonb)
    from generate_series(0, jsonb_array_length(sider) - 1) as s(n)
    left join per_side ps on ps.side = s.n
  );
end;
$$;

-- --- ClinPGx ---------------------------------------------------------------

-- Utvalget `les_farmakogenetikk` gir, uten feltene i `utelatt` i annotasjonene.
create function clinpgx.utvalg(kjemikalie_ider text[], utelatt text[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  with koblet as (
    select k.type, k.annotasjon_id, jsonb_agg(k.kjemikalie_id order by k.kjemikalie_id) as kjemikalier
    from clinpgx.kjemikalie_annotasjoner k
    where k.kjemikalie_id = any (kjemikalie_ider)
    group by k.type, k.annotasjon_id
  ),
  annotert as (
    select a.type, a.clinpgx_id, (a.data - utelatt) || jsonb_build_object('kjemikalier', k.kjemikalier) as data
    from koblet k
    join clinpgx.annotasjoner a on a.type = k.type and a.clinpgx_id = k.annotasjon_id
  )
  select jsonb_build_object(
    'kilde', 'ClinPGx',
    'kontrollert_kl', (
      select max(s.avsluttet_kl) from clinpgx.synkroniseringer s where s.status in ('fullfort', 'delvis')),
    'kjemikalier', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.clinpgx_id,
        'navn', c.data ->> 'navn',
        'finnes', c.finnes,
        'sist_hentet_kl', c.sist_hentet_kl,
        'feil', c.feil,
        'feil_kl', c.feil_kl) order by c.clinpgx_id)
      from clinpgx.kjemikalier c where c.clinpgx_id = any (kjemikalie_ider)), '[]'::jsonb),
    'retningslinjer', coalesce((
      select jsonb_agg(a.data order by a.clinpgx_id) from annotert a where a.type = 'retningslinje'), '[]'::jsonb),
    'preparatomtaler', coalesce((
      select jsonb_agg(a.data order by a.clinpgx_id) from annotert a where a.type = 'preparatomtale'), '[]'::jsonb),
    'kliniske', coalesce((
      select jsonb_agg(a.data order by a.clinpgx_id) from annotert a where a.type = 'klinisk'), '[]'::jsonb)
  )
$$;

create or replace function public.les_farmakogenetikk(kjemikalie_ider text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(kjemikalie_ider), 0) > 200 then
    raise exception 'For mange kjemikalier.' using errcode = '22023';
  end if;
  return clinpgx.utvalg(kjemikalie_ider, '{}');
end;
$$;

-- Det søket bruker: uten allelfenotypene, legemidlene og litteraturen.
create function public.les_farmakogenetikk_sok(kjemikalie_ider text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(kjemikalie_ider), 0) > 200 then
    raise exception 'For mange kjemikalier.' using errcode = '22023';
  end if;
  return clinpgx.utvalg(kjemikalie_ider, array['fenotyper', 'legemidler', 'litteratur']);
end;
$$;

-- --- Versjonene ------------------------------------------------------------

-- Telles opp hver gang noe publisert endres: sidene, elementene,
-- referansekoblingene eller utgavene de peker på. Utkast teller ikke.
create sequence intern.publisert_innhold_versjon;

create function intern.merk_publisert_endring()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  endret boolean := false;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select exists (select 1 from ny where tilstand = 'publisert') into endret;
  end if;
  if not endret and tg_op in ('UPDATE', 'DELETE') then
    select exists (select 1 from gammel where tilstand = 'publisert') into endret;
  end if;
  if endret then
    perform nextval('intern.publisert_innhold_versjon');
  end if;
  return null;
end;
$$;

-- Revisjonene legges bare til; en endring eller sletting telles alltid.
create function intern.merk_innhold_endret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform nextval('intern.publisert_innhold_versjon');
  return null;
end;
$$;

do $$
declare
  tabell text;
begin
  foreach tabell in array array['objekttilstander', 'infosider', 'innholdselementer', 'referansekoblinger'] loop
    execute format(
      'create trigger %1$s_publisert_ny after insert on public.%1$I
         referencing new table as ny for each statement execute function intern.merk_publisert_endring()', tabell);
    execute format(
      'create trigger %1$s_publisert_endret after update on public.%1$I
         referencing old table as gammel new table as ny for each statement execute function intern.merk_publisert_endring()', tabell);
    execute format(
      'create trigger %1$s_publisert_slettet after delete on public.%1$I
         referencing old table as gammel for each statement execute function intern.merk_publisert_endring()', tabell);
  end loop;
end
$$;

create trigger objektrevisjoner_endret
  after update or delete on public.objektrevisjoner
  for each statement execute function intern.merk_innhold_endret();

-- Når hver kilde søket leser, sist ble endret. Appen leser bare på nytt det
-- som har en annen versjon enn det den har lagret. Sidene leses uansett på
-- nytt hvert døgn.
create function public.sokedata_versjoner()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sider', (select v.last_value::text from intern.publisert_innhold_versjon v) || ':' || current_date::text,
    'fest', coalesce((
      select max(s.id)::text from legemiddeldata.synkroniseringer s
      where s.kilde = 'FEST' and s.status = 'fullfort'), '0'),
    'clinpgx', coalesce((
      select max(s.id)::text from clinpgx.synkroniseringer s where s.status in ('fullfort', 'delvis')), '0')
      || ':' || coalesce((select max(k.sist_hentet_kl)::text from clinpgx.kjemikalier k), ''),
    'cpic', coalesce(cpic.kilde() ->> 'endret_kl', '')
  )
$$;

-- --- Rettigheter -----------------------------------------------------------

revoke all on table legemiddeldata.interaksjonsoppslag, legemiddeldata.interaksjonssubstanser
  from public, anon, authenticated, service_role;

revoke all on function
  legemiddeldata.gruppenavn(jsonb),
  legemiddeldata.bygg_interaksjonsoppslag(text[]),
  legemiddeldata.oppdater_interaksjonsoppslag(),
  legemiddeldata.kontroller_sider(jsonb),
  legemiddeldata.sidenes_virkestoff(jsonb),
  legemiddeldata.sidenes_preparater(jsonb),
  clinpgx.utvalg(text[], text[]),
  intern.merk_publisert_endring(),
  intern.merk_innhold_endret()
  from public, anon, authenticated, service_role;

revoke all on sequence intern.publisert_innhold_versjon from public, anon, authenticated, service_role;

revoke all on function
  public.les_preparatsok(jsonb),
  public.les_interaksjonssok(jsonb),
  public.les_farmakogenetikk_sok(text[]),
  public.sokedata_versjoner()
  from public, anon, authenticated, service_role;

grant execute on function
  public.les_preparatsok(jsonb),
  public.les_interaksjonssok(jsonb),
  public.les_farmakogenetikk_sok(text[]),
  public.sokedata_versjoner()
  to authenticated, service_role;
