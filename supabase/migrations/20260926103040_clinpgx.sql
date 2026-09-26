-- Farmakogenetiske data fra ClinPGx: OUSFARs egen kopi av retningslinjene,
-- de farmakogenetiske preparatomtalene og de kliniske annotasjonene for
-- legemidlene stoffsidene er koblet til.
--
-- Bakgrunnen står i docs/clinpgx.md. Kort fortalt:
--
--   * En stoffside kobles til ett eller flere kjemikalier i ClinPGx med
--     ClinPGx' accession-ID (PA…), i elementet `clinpgxkobling` i panelet
--     «Farmakogenetikk». Koblingen er redaksjonelt innhold som alt annet på
--     siden: utkast, publisering og historikk.
--   * Dataene er et eget lag ved siden av faginnholdet, som legemiddeldataene
--     fra FEST. De redigeres aldri i OUSFAR og har ingen revisjoner; de er det
--     ClinPGx sa sist de ble hentet. De ligger i skjemaet `clinpgx`, som ingen
--     av API-rollene har tilgang til.
--   * Den ukentlige synkroniseringen henter dataene for ett kjemikalie om
--     gangen og bytter dem inn i én transaksjon per kjemikalie. Feiler ett
--     kjemikalie, står det som var der fra før, og de andre byttes inn som
--     vanlig. Svaret slik det kom fra ClinPGx lagres ved siden av det OUSFAR
--     leste ut av det (`raa`).

create schema clinpgx;
revoke all on schema clinpgx from public;

comment on schema clinpgx is
  'Farmakogenetiske data synkronisert fra ClinPGx. Ingen av API-rollene har tilgang; se funksjonene clinpgx_* og les_farmakogenetikk i public.';

-- --- Kjøringene ------------------------------------------------------------

create table clinpgx.synkroniseringer (
  id bigint generated always as identity primary key,
  status text not null default 'pagar' check (status in ('pagar', 'fullfort', 'delvis', 'feilet')),
  -- 'cron' for den ukentlige kjøringen, 'manuell' når en administrator ba om den.
  utlost_av text not null default 'cron' check (utlost_av in ('cron', 'manuell')),
  startet_kl timestamptz not null default now(),
  avsluttet_kl timestamptz,
  parserversjon integer,
  -- Hvor mange kjemikalier som ble hentet, feilet og ble utsatt, og hvor
  -- mange annotasjoner av hver type.
  antall jsonb,
  feil text
);

create unique index clinpgx_synkroniseringer_en_om_gangen_idx
  on clinpgx.synkroniseringer ((true))
  where status = 'pagar';

comment on table clinpgx.synkroniseringer is
  'Hver synkronisering fra ClinPGx: når, hvem som ba om den, hva som ble hentet, og feilene.';

-- --- Dataene ---------------------------------------------------------------

create table clinpgx.kjemikalier (
  clinpgx_id text primary key check (clinpgx_id ~ '^PA[0-9]+$'),
  -- Kjemikaliet slik src/clinpgx/modell.ts leste det. Tomt til det er hentet første gang.
  data jsonb check (data is null or jsonb_typeof(data) = 'object'),
  raa jsonb,
  hash text,
  -- Sant til ClinPGx svarer at kjemikaliet ikke finnes.
  finnes boolean not null default true,
  forst_sett_kl timestamptz not null default now(),
  sist_endret_kl timestamptz,
  -- Når dataene sist ble hentet og byttet inn.
  sist_hentet_kl timestamptz,
  sist_synk bigint references clinpgx.synkroniseringer (id),
  -- Siste feil for kjemikaliet, og når. Tømmes når det hentes igjen.
  feil text,
  feil_kl timestamptz
);

create table clinpgx.annotasjoner (
  type text not null check (type in ('retningslinje', 'preparatomtale', 'klinisk')),
  clinpgx_id text not null check (char_length(clinpgx_id) between 1 and 40),
  -- Annotasjonen slik src/clinpgx/modell.ts leste den, og svaret slik det kom.
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  raa jsonb not null,
  hash text not null,
  forst_sett_kl timestamptz not null default now(),
  sist_endret_kl timestamptz not null default now(),
  primary key (type, clinpgx_id)
);

-- Hvilke annotasjoner ClinPGx ga for hvert kjemikalie sist det ble hentet.
create table clinpgx.kjemikalie_annotasjoner (
  kjemikalie_id text not null references clinpgx.kjemikalier (clinpgx_id) on delete cascade,
  type text not null,
  annotasjon_id text not null,
  primary key (kjemikalie_id, type, annotasjon_id),
  foreign key (type, annotasjon_id) references clinpgx.annotasjoner (type, clinpgx_id) on delete cascade
);

create index clinpgx_kjemikalie_annotasjoner_annotasjon_idx
  on clinpgx.kjemikalie_annotasjoner (type, annotasjon_id);

comment on table clinpgx.kjemikalier is 'Kjemikaliene i ClinPGx stoffsidene er koblet til, med siste henting og feil.';
comment on table clinpgx.annotasjoner is 'Retningslinjer, preparatomtaler og kliniske annotasjoner fra ClinPGx, lest og som de kom.';
comment on table clinpgx.kjemikalie_annotasjoner is 'Annotasjonene ClinPGx ga for hvert kjemikalie ved siste vellykkede henting.';

-- --- Kortet som bare kan stå én gang ----------------------------------------
--
-- Koblingen til ClinPGx står én gang i panelet sitt, som koblingen til FEST.
-- Samme typer som ENKELTELEMENTER i src/faginnhold/paneler.ts.

drop index public.innholdselementer_enkeltelement_idx;

create unique index innholdselementer_enkeltelement_idx
  on public.innholdselementer (infoside_id, tilstand, panel, elementtype)
  where panel <> 'fjernet'
    and elementtype in (
      'legemiddelkobling',
      'clinpgxkobling',
      'riktekst',
      'dosetabell',
      'referanseomrade',
      'toksisk_omrade',
      'alvorlig_intoksikasjon',
      'halveringstid',
      'steady_state'
    );

comment on index public.innholdselementer_enkeltelement_idx is
  'Kortene som bare kan stå én gang per side og panel. Samme typer som ENKELTELEMENTER i src/faginnhold/paneler.ts.';

-- --- Synkroniseringen ------------------------------------------------------
--
-- Kalles av synkroniseringsjobben på serveren, med den hemmelige nøkkelen.
-- Ingen andre kan kalle dem.

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.clinpgx_start_synk(utlost_av text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  update clinpgx.synkroniseringer
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where status = 'pagar' and startet_kl < now() - interval '30 minutes';

  begin
    insert into clinpgx.synkroniseringer (utlost_av) values (coalesce(clinpgx_start_synk.utlost_av, 'cron'))
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra ClinPGx pågår allerede.' using errcode = 'PT409';
  end;
  return ny;
end;
$$;

-- Kjøringen som skal endres, låst, og bare om den fortsatt pågår.
create function clinpgx.pagaende(synk bigint)
returns clinpgx.synkroniseringer
language plpgsql
set search_path = ''
as $$
declare
  s clinpgx.synkroniseringer;
begin
  select * into s from clinpgx.synkroniseringer where id = synk for update;
  if not found then
    raise exception 'Synkroniseringen % finnes ikke.', synk using errcode = 'PT404';
  end if;
  if s.status <> 'pagar' then
    raise exception 'Synkroniseringen % er allerede avsluttet.', synk using errcode = '22023';
  end if;
  return s;
end;
$$;

-- Kjemikaliene stoffsidene er koblet til, i utkastene og det publiserte: de
-- som aldri er hentet, først, så de som ble hentet for lengst siden.
create function public.clinpgx_koblede_kjemikalier()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with koblet as (
    select k ->> 'clinpgx_id' as id, min(k ->> 'navn') as navn
    from public.innholdselementer e,
         jsonb_array_elements(case when jsonb_typeof(e.data -> 'kjemikalier') = 'array' then e.data -> 'kjemikalier' else '[]' end) k
    where e.elementtype = 'clinpgxkobling'
      and e.panel <> 'fjernet'
      and k ->> 'clinpgx_id' ~ '^PA[0-9]+$'
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'navn', k.navn, 'sist_hentet_kl', c.sist_hentet_kl)
                            order by c.sist_hentet_kl nulls first, k.id), '[]')
  from koblet k
  left join clinpgx.kjemikalier c on c.clinpgx_id = k.id
$$;

-- Bytter inn alt ClinPGx ga for ett kjemikalie, i én transaksjon:
-- kjemikalie = {id, data, raa}, annotasjoner = [{type, id, data, raa}, ...].
--
-- Er det vesentlig færre annotasjoner av en type enn sist (under halvparten
-- av minst fire), avvises byttet, og det som var der, står. Et svar som
-- plutselig nesten er tomt, er oftere en feil hos kilden enn at kunnskapen
-- er borte.
create function public.clinpgx_lagre_kjemikalie(synk bigint, kjemikalie jsonb, annotasjoner jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kid text := kjemikalie ->> 'id';
  t text;
  for_ integer;
  etter integer;
  opptelling jsonb := '{}';
begin
  perform clinpgx.pagaende(synk);
  if kid is null or kid !~ '^PA[0-9]+$' then
    raise exception 'Ugyldig ClinPGx-ID: %.', kid using errcode = '22023';
  end if;
  if jsonb_typeof(annotasjoner) <> 'array' then
    raise exception 'Annotasjonene skal være en liste.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(annotasjoner) a
    where a ->> 'type' is null or a ->> 'type' not in ('retningslinje', 'preparatomtale', 'klinisk')
       or coalesce(a ->> 'id', '') = '' or jsonb_typeof(a -> 'data') <> 'object'
  ) then
    raise exception 'Annotasjonene for % har feil form.', kid using errcode = '22023';
  end if;

  foreach t in array array['retningslinje', 'preparatomtale', 'klinisk'] loop
    select count(*) into for_ from clinpgx.kjemikalie_annotasjoner where kjemikalie_id = kid and type = t;
    select count(distinct a ->> 'id') into etter from jsonb_array_elements(annotasjoner) a where a ->> 'type' = t;
    if for_ >= 4 and etter < ceil(for_ / 2.0) then
      raise exception 'ClinPGx ga % % for %, mot % sist. Svaret ser ufullstendig ut og er ikke tatt i bruk.',
        etter, t, kid, for_ using errcode = '22023';
    end if;
    opptelling := opptelling || jsonb_build_object(t, etter);
  end loop;

  insert into clinpgx.kjemikalier as c (clinpgx_id, data, raa, hash, finnes, sist_endret_kl, sist_hentet_kl, sist_synk, feil, feil_kl)
  values (kid, kjemikalie -> 'data', kjemikalie -> 'raa', md5((kjemikalie -> 'data')::text), true, now(), now(), synk, null, null)
  on conflict (clinpgx_id) do update set
    data = excluded.data,
    raa = excluded.raa,
    hash = excluded.hash,
    finnes = true,
    sist_endret_kl = case when c.hash is distinct from excluded.hash then now() else c.sist_endret_kl end,
    sist_hentet_kl = now(),
    sist_synk = synk,
    feil = null,
    feil_kl = null;

  insert into clinpgx.annotasjoner as a (type, clinpgx_id, data, raa, hash)
  select distinct on (x ->> 'type', x ->> 'id')
    x ->> 'type', x ->> 'id', x -> 'data', coalesce(x -> 'raa', 'null'), md5((x -> 'data')::text)
  from jsonb_array_elements(annotasjoner) x
  order by x ->> 'type', x ->> 'id'
  on conflict (type, clinpgx_id) do update set
    data = excluded.data,
    raa = excluded.raa,
    hash = excluded.hash,
    sist_endret_kl = case when a.hash <> excluded.hash then now() else a.sist_endret_kl end;

  delete from clinpgx.kjemikalie_annotasjoner where kjemikalie_id = kid;
  insert into clinpgx.kjemikalie_annotasjoner (kjemikalie_id, type, annotasjon_id)
  select distinct kid, x ->> 'type', x ->> 'id' from jsonb_array_elements(annotasjoner) x;

  -- Det ingen kjemikalier viser til lenger, er borte fra ClinPGx' svar.
  delete from clinpgx.annotasjoner a
  where not exists (
    select 1 from clinpgx.kjemikalie_annotasjoner k where k.type = a.type and k.annotasjon_id = a.clinpgx_id);

  return opptelling;
end;
$$;

-- Hentingen av ett kjemikalie feilet: feilen noteres, og dataene står som
-- før. `finnes` er usann når ClinPGx svarer at kjemikaliet ikke finnes.
create function public.clinpgx_kjemikalie_feilet(synk bigint, kjemikalie_id text, feil text, finnes boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform clinpgx.pagaende(synk);
  if kjemikalie_id is null or kjemikalie_id !~ '^PA[0-9]+$' then
    raise exception 'Ugyldig ClinPGx-ID: %.', kjemikalie_id using errcode = '22023';
  end if;
  insert into clinpgx.kjemikalier as c (clinpgx_id, finnes, sist_synk, feil, feil_kl)
  values (kjemikalie_id, coalesce(finnes, true), synk, left(feil, 2000), now())
  on conflict (clinpgx_id) do update set
    finnes = coalesce(clinpgx_kjemikalie_feilet.finnes, true),
    sist_synk = synk,
    feil = excluded.feil,
    feil_kl = now();
end;
$$;

-- Kjøringen er ferdig. `resultat` er tellingen jobben gjorde; er noe
-- feilet eller utsatt, er kjøringen «delvis».
create function public.clinpgx_fullfor_synk(synk bigint, resultat jsonb, parserversjon integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny text;
begin
  perform clinpgx.pagaende(synk);
  ny := case
    when coalesce((resultat ->> 'feilet')::integer, 0) = 0 and coalesce((resultat ->> 'utsatt')::integer, 0) = 0
      then 'fullfort'
    else 'delvis'
  end;
  update clinpgx.synkroniseringer set
    status = ny,
    avsluttet_kl = now(),
    antall = resultat,
    parserversjon = clinpgx_fullfor_synk.parserversjon,
    feil = nullif(left(resultat ->> 'feil', 2000), '')
  where id = synk;
  return ny;
end;
$$;

-- Noe gikk galt før noe kunne hentes: kjøringen merkes som feilet.
create function public.clinpgx_avbryt_synk(synk bigint, feil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform clinpgx.pagaende(synk);
  update clinpgx.synkroniseringer set
    status = 'feilet',
    avsluttet_kl = now(),
    feil = left(clinpgx_avbryt_synk.feil, 2000)
  where id = synk;
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Alt stoffsidene trenger fra ClinPGx for disse kjemikaliene: kjemikaliene
-- selv, med når de sist ble hentet og eventuell feil, og retningslinjene,
-- preparatomtalene og de kliniske annotasjonene — hver med hvilke av
-- kjemikaliene den gjelder. Rådataene er ikke med.
create function public.les_farmakogenetikk(kjemikalie_ider text[])
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

  return (
    with koblet as (
      select k.kjemikalie_id, k.type, k.annotasjon_id
      from clinpgx.kjemikalie_annotasjoner k
      where k.kjemikalie_id = any (kjemikalie_ider)
    ),
    annotert as (
      select a.type, a.clinpgx_id, a.data,
             jsonb_agg(k.kjemikalie_id order by k.kjemikalie_id) as kjemikalier
      from clinpgx.annotasjoner a
      join koblet k on k.type = a.type and k.annotasjon_id = a.clinpgx_id
      group by a.type, a.clinpgx_id, a.data
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
        from clinpgx.kjemikalier c where c.clinpgx_id = any (kjemikalie_ider)), '[]'),
      'retningslinjer', coalesce((
        select jsonb_agg(a.data || jsonb_build_object('kjemikalier', a.kjemikalier) order by a.clinpgx_id)
        from annotert a where a.type = 'retningslinje'), '[]'),
      'preparatomtaler', coalesce((
        select jsonb_agg(a.data || jsonb_build_object('kjemikalier', a.kjemikalier) order by a.clinpgx_id)
        from annotert a where a.type = 'preparatomtale'), '[]'),
      'kliniske', coalesce((
        select jsonb_agg(a.data || jsonb_build_object('kjemikalier', a.kjemikalier) order by a.clinpgx_id)
        from annotert a where a.type = 'klinisk'), '[]')
    )
  );
end;
$$;

-- De siste kjøringene, til å se at synkroniseringen går som den skal.
create function public.clinpgx_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id desc), '[]')
  from (
    select id, status, utlost_av, startet_kl, avsluttet_kl, antall, feil
    from clinpgx.synkroniseringer
    order by id desc
    limit 20
  ) s
$$;

-- --- Rettigheter -----------------------------------------------------------

revoke all on all tables in schema clinpgx from public, anon, authenticated, service_role;
revoke all on all functions in schema clinpgx from public, anon, authenticated, service_role;

revoke all on function
  public.clinpgx_start_synk(text),
  public.clinpgx_koblede_kjemikalier(),
  public.clinpgx_lagre_kjemikalie(bigint, jsonb, jsonb),
  public.clinpgx_kjemikalie_feilet(bigint, text, text, boolean),
  public.clinpgx_fullfor_synk(bigint, jsonb, integer),
  public.clinpgx_avbryt_synk(bigint, text),
  public.les_farmakogenetikk(text[]),
  public.clinpgx_status()
from public, anon, authenticated, service_role;

grant execute on function
  public.clinpgx_start_synk(text),
  public.clinpgx_koblede_kjemikalier(),
  public.clinpgx_lagre_kjemikalie(bigint, jsonb, jsonb),
  public.clinpgx_kjemikalie_feilet(bigint, text, text, boolean),
  public.clinpgx_fullfor_synk(bigint, jsonb, integer),
  public.clinpgx_avbryt_synk(bigint, text)
to service_role;

grant execute on function
  public.les_farmakogenetikk(text[]),
  public.clinpgx_status()
to authenticated, service_role;
