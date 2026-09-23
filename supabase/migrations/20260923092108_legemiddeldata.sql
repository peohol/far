-- Legemiddeldata fra FEST: OUSFARs egen kopi av de offentlige grunndataene
-- om preparater, virkestoff og pakninger.
--
-- Bakgrunnen står i docs/legemiddeldata.md. Kort fortalt:
--
--   * Dataene er et eget lag ved siden av faginnholdet. De redigeres aldri i
--     OUSFAR, har ingen revisjoner og publiseres ikke; de er det FEST sa ved
--     siste vellykkede synkronisering.
--   * Tabellene ligger i skjemaet `legemiddeldata`, som ingen av API-rollene
--     har tilgang til. Lesing og skriving går bare gjennom funksjonene nederst.
--   * Hver type har sin tabell, med FESTs egen ID som nøkkel og posten slik
--     `src/legemiddeldata/fest.ts` leste den. Det som brukes til oppslag, er i
--     tillegg egne kolonner.
--   * Synkroniseringen laster et helt uttrekk inn i `innlasting` og ber så
--     `legemiddeldata_fullfor_synk` bytte det inn i én transaksjon: nye rader
--     legges til, endrede oppdateres, og rader som er borte fra uttrekket,
--     merkes som utgått — de slettes aldri. Et uttrekk som er vesentlig
--     mindre enn det som ligger inne, avvises, og ingenting endres.

create schema legemiddeldata;
revoke all on schema legemiddeldata from public;

comment on schema legemiddeldata is
  'Legemiddeldata synkronisert fra FEST. Ingen av API-rollene har tilgang; se funksjonene legemiddeldata_* og les_legemidler i public.';

-- --- Typene som synkroniseres ---------------------------------------------

-- Samme navn som ENTITETER i src/legemiddeldata/fest.ts, og som tabellene
-- under. Testen sammenligner dem.
create table legemiddeldata.entiteter (
  navn text primary key,
  -- Et nytt uttrekk må ha minst så stor andel av radene som er aktive i dag.
  minste_andel numeric not null default 0.8 check (minste_andel between 0 and 1)
);

insert into legemiddeldata.entiteter (navn) values
  ('virkestoff'),
  ('virkestoff_styrke'),
  ('merkevare'),
  ('pakning'),
  ('byttegruppe');

comment on table legemiddeldata.entiteter is
  'Typene som synkroniseres fra FEST, med hvor mye mindre et nytt uttrekk kan være før det avvises.';

-- --- Kjøringene ------------------------------------------------------------

create table legemiddeldata.synkroniseringer (
  id bigint generated always as identity primary key,
  kilde text not null,
  status text not null default 'pagar' check (status in ('pagar', 'fullfort', 'uendret', 'feilet')),
  startet_kl timestamptz not null default now(),
  avsluttet_kl timestamptz,
  -- Om filen: det serveren oppga, kontrollsummen og når DMP laget uttrekket.
  etag text,
  sist_endret text,
  sha256 text,
  kildedato timestamp,
  parserversjon integer,
  antall jsonb,
  feil text
);

create unique index synkroniseringer_en_om_gangen_idx
  on legemiddeldata.synkroniseringer (kilde)
  where status = 'pagar';

comment on table legemiddeldata.synkroniseringer is
  'Hver synkronisering: når, hva slags fil, hvor mange rader som ble nye, endret eller utgått, og eventuell feil.';

create table legemiddeldata.innlasting (
  synk_id bigint not null references legemiddeldata.synkroniseringer (id) on delete cascade,
  entitet text not null references legemiddeldata.entiteter (navn),
  fest_id text not null,
  tidspunkt timestamp,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (synk_id, entitet, fest_id)
);

comment on table legemiddeldata.innlasting is
  'Mellomlager for et uttrekk under innlasting. Tømmes når synkroniseringen fullføres eller avbrytes.';

-- --- Dataene ---------------------------------------------------------------

-- Kolonnene alle typene har:
--   fest_id         FESTs ID for objektet (ikke oppføringen)
--   data            posten, med formen fra src/legemiddeldata/fest.ts
--   hash            md5 av posten, for å se om den er endret
--   fest_tidspunkt  når FEST sist endret oppføringen
--   forst_sett_kl, sist_endret_kl, sist_sett_synk, utgatt_kl
--                   når OUSFAR først så den, sist så en endring, i hvilken
--                   synkronisering den sist var med, og når den forsvant

create table legemiddeldata.virkestoff (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  navn text generated always as (data ->> 'navn') stored
);

create index virkestoff_navn_idx on legemiddeldata.virkestoff (lower(navn));
create index virkestoff_salter_idx on legemiddeldata.virkestoff using gin ((data -> 'salter'));

create table legemiddeldata.virkestoff_styrke (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  virkestoff_id text generated always as (data ->> 'virkestoff_id') stored
);

create index virkestoff_styrke_virkestoff_idx on legemiddeldata.virkestoff_styrke (virkestoff_id);

create table legemiddeldata.merkevare (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  varenavn text generated always as (data ->> 'varenavn') stored
);

create index merkevare_styrker_idx on legemiddeldata.merkevare using gin ((data -> 'virkestoff_med_styrke'));
create index merkevare_virkestoff_idx on legemiddeldata.merkevare using gin ((data -> 'virkestoff_uten_styrke'));

create table legemiddeldata.pakning (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  varenr text generated always as (data ->> 'varenr') stored
);

create index pakning_merkevarer_idx on legemiddeldata.pakning using gin ((data -> 'merkevarer'));

create table legemiddeldata.byttegruppe (
  fest_id text primary key,
  data jsonb not null,
  hash text not null,
  fest_tidspunkt timestamp,
  forst_sett_kl timestamptz not null,
  sist_endret_kl timestamptz not null,
  sist_sett_synk bigint not null references legemiddeldata.synkroniseringer (id),
  utgatt_kl timestamptz,
  kode text generated always as (data ->> 'kode') stored
);

comment on table legemiddeldata.virkestoff is 'Virkestoff fra FEST, med saltene som ID-er i data.salter.';
comment on table legemiddeldata.virkestoff_styrke is 'Virkestoff med styrke fra FEST. Preparatene peker hit.';
comment on table legemiddeldata.merkevare is 'Legemiddelmerkevarer fra FEST: ett preparat i én form og styrke.';
comment on table legemiddeldata.pakning is 'Legemiddelpakninger fra FEST, med varenummer.';
comment on table legemiddeldata.byttegruppe is 'Byttegrupper fra FEST.';

-- --- Synkroniseringen ------------------------------------------------------
--
-- Kalles av synkroniseringsjobben på serveren, med den hemmelige nøkkelen.
-- Ingen andre kan kalle dem.

-- Forrige vellykkede kjøring, så jobben kan spørre om filen er ny.
create function public.legemiddeldata_forrige_synk(kilde text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('etag', s.etag, 'sha256', s.sha256, 'parserversjon', s.parserversjon)
  from legemiddeldata.synkroniseringer s
  where s.kilde = legemiddeldata_forrige_synk.kilde
    and s.status in ('fullfort', 'uendret')
    and s.sha256 is not null
  order by s.id desc
  limit 1
$$;

-- Starter en kjøring. En kjøring som har stått uavsluttet i mer enn en
-- halvtime, har mistet forbindelsen og regnes som feilet.
create function public.legemiddeldata_start_synk(kilde text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny bigint;
begin
  update legemiddeldata.synkroniseringer s
  set status = 'feilet', avsluttet_kl = now(), feil = 'Avbrutt uten å bli fullført.'
  where s.kilde = legemiddeldata_start_synk.kilde
    and s.status = 'pagar'
    and s.startet_kl < now() - interval '30 minutes';

  delete from legemiddeldata.innlasting i
  using legemiddeldata.synkroniseringer s
  where i.synk_id = s.id and s.status <> 'pagar';

  begin
    insert into legemiddeldata.synkroniseringer (kilde) values (legemiddeldata_start_synk.kilde)
    returning id into ny;
  exception when unique_violation then
    raise exception 'En synkronisering fra % pågår allerede.', legemiddeldata_start_synk.kilde
      using errcode = 'PT409';
  end;
  return ny;
end;
$$;

-- Kjøringen som skal endres, låst, og bare om den fortsatt pågår.
create function legemiddeldata.pagaende(synk bigint)
returns legemiddeldata.synkroniseringer
language plpgsql
set search_path = ''
as $$
declare
  s legemiddeldata.synkroniseringer;
begin
  select * into s from legemiddeldata.synkroniseringer where id = synk for update;
  if not found then
    raise exception 'Synkroniseringen % finnes ikke.', synk using errcode = 'PT404';
  end if;
  if s.status <> 'pagar' then
    raise exception 'Synkroniseringen % er allerede avsluttet.', synk using errcode = '22023';
  end if;
  return s;
end;
$$;

-- Legger en porsjon rader i mellomlageret: [{fest_id, tidspunkt, data}, ...].
create function public.legemiddeldata_last_inn(synk bigint, entitet text, rader jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  antall integer;
begin
  perform legemiddeldata.pagaende(synk);
  if not exists (select 1 from legemiddeldata.entiteter e where e.navn = legemiddeldata_last_inn.entitet) then
    raise exception 'Ukjent type: %.', entitet using errcode = '22023';
  end if;
  if jsonb_typeof(rader) <> 'array' then
    raise exception 'Radene skal være en liste.' using errcode = '22023';
  end if;

  insert into legemiddeldata.innlasting (synk_id, entitet, fest_id, tidspunkt, data)
  select synk, legemiddeldata_last_inn.entitet, r ->> 'fest_id', (r ->> 'tidspunkt')::timestamp, r -> 'data'
  from jsonb_array_elements(rader) r;
  get diagnostics antall = row_count;
  return antall;
end;
$$;

-- Bytter inn uttrekket. Alt eller ingenting: avvises én type, endres ingen.
create function public.legemiddeldata_fullfor_synk(synk bigint, fil jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  inn integer;
  aktive integer;
  nye integer;
  endrede integer;
  utgatte integer;
  opptelling jsonb := '{}';
begin
  perform legemiddeldata.pagaende(synk);

  for e in select navn, minste_andel from legemiddeldata.entiteter order by navn loop
    select count(*) into inn
    from legemiddeldata.innlasting i
    where i.synk_id = synk and i.entitet = e.navn;

    execute format('select count(*) from legemiddeldata.%I where utgatt_kl is null', e.navn) into aktive;

    if inn = 0 or inn < ceil(aktive * e.minste_andel) then
      raise exception 'Uttrekket ser ufullstendig ut: % rader av typen %, mot % i dag.', inn, e.navn, aktive
        using errcode = '22023';
    end if;

    execute format(
      $sql$
        select
          count(*) filter (where t.fest_id is null),
          count(*) filter (where t.fest_id is not null
                             and (t.hash <> md5(i.data::text) or t.utgatt_kl is not null))
        from legemiddeldata.innlasting i
        left join legemiddeldata.%I t on t.fest_id = i.fest_id
        where i.synk_id = $1 and i.entitet = $2
      $sql$, e.navn)
    into nye, endrede
    using synk, e.navn;

    execute format(
      $sql$
        insert into legemiddeldata.%1$I as t
          (fest_id, data, hash, fest_tidspunkt, forst_sett_kl, sist_endret_kl, sist_sett_synk)
        select i.fest_id, i.data, md5(i.data::text), i.tidspunkt, now(), now(), $1
        from legemiddeldata.innlasting i
        where i.synk_id = $1 and i.entitet = $2
        on conflict (fest_id) do update set
          data = excluded.data,
          hash = excluded.hash,
          fest_tidspunkt = excluded.fest_tidspunkt,
          sist_endret_kl = case
            when t.hash is distinct from excluded.hash or t.utgatt_kl is not null then now()
            else t.sist_endret_kl
          end,
          sist_sett_synk = $1,
          utgatt_kl = null
      $sql$, e.navn)
    using synk, e.navn;

    execute format(
      'update legemiddeldata.%I set utgatt_kl = now(), sist_endret_kl = now()
       where utgatt_kl is null and sist_sett_synk <> $1', e.navn)
    using synk;
    get diagnostics utgatte = row_count;

    opptelling := opptelling || jsonb_build_object(e.navn, jsonb_build_object(
      'inn', inn, 'nye', nye, 'endrede', endrede, 'utgatte', utgatte));
  end loop;

  delete from legemiddeldata.innlasting where synk_id = synk;

  update legemiddeldata.synkroniseringer set
    status = 'fullfort',
    avsluttet_kl = now(),
    etag = fil ->> 'etag',
    sist_endret = fil ->> 'sist_endret',
    sha256 = fil ->> 'sha256',
    kildedato = (fil ->> 'kildedato')::timestamp,
    parserversjon = (fil ->> 'parserversjon')::integer,
    antall = opptelling
  where id = synk;

  return opptelling;
end;
$$;

-- Filen var den samme som sist: ingenting å bytte inn.
create function public.legemiddeldata_uendret_synk(synk bigint, fil jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform legemiddeldata.pagaende(synk);
  delete from legemiddeldata.innlasting where synk_id = synk;
  update legemiddeldata.synkroniseringer set
    status = 'uendret',
    avsluttet_kl = now(),
    etag = fil ->> 'etag',
    sist_endret = fil ->> 'sist_endret',
    sha256 = fil ->> 'sha256',
    parserversjon = (fil ->> 'parserversjon')::integer
  where id = synk;
end;
$$;

-- Noe gikk galt: kjøringen merkes som feilet, og mellomlageret tømmes.
create function public.legemiddeldata_avbryt_synk(synk bigint, feil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform legemiddeldata.pagaende(synk);
  delete from legemiddeldata.innlasting where synk_id = synk;
  update legemiddeldata.synkroniseringer set
    status = 'feilet',
    avsluttet_kl = now(),
    feil = left(legemiddeldata_avbryt_synk.feil, 2000)
  where id = synk;
end;
$$;

-- --- Lesingen --------------------------------------------------------------

-- Alt stoffsidene trenger om preparatene med disse virkestoffene: virkestoffene
-- selv (også utgåtte, så siden kan si fra), preparatene som inneholder dem
-- eller saltene deres, styrkene og virkestoffene i preparatene (også de andre
-- i kombinasjonene), pakningene, byttegruppene, og når dataene sist ble
-- kontrollert mot FEST. Utgåtte preparater og pakninger er ikke med.
create function public.les_legemidler(virkestoff_ider text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with koblet as (
    select v.fest_id, v.data, v.utgatt_kl
    from legemiddeldata.virkestoff v
    where v.fest_id = any (virkestoff_ider)
  ),
  stoff as (
    select k.fest_id from koblet k
    union
    select jsonb_array_elements_text(k.data -> 'salter') from koblet k
  ),
  styrker as (
    select s.fest_id
    from legemiddeldata.virkestoff_styrke s
    where s.virkestoff_id in (select fest_id from stoff) and s.utgatt_kl is null
  ),
  merkevarer as (
    select m.fest_id, m.data
    from legemiddeldata.merkevare m
    where m.utgatt_kl is null
      and (m.data -> 'virkestoff_med_styrke' ?| array(select fest_id from styrker)
           or m.data -> 'virkestoff_uten_styrke' ?| array(select fest_id from stoff))
  ),
  alle_styrker as (
    select s.fest_id, s.data
    from legemiddeldata.virkestoff_styrke s
    where s.fest_id in (select jsonb_array_elements_text(m.data -> 'virkestoff_med_styrke') from merkevarer m)
  ),
  alle_stoff as (
    select v.fest_id, v.data, v.utgatt_kl
    from legemiddeldata.virkestoff v
    where v.fest_id in (
      select fest_id from koblet
      union select data ->> 'virkestoff_id' from alle_styrker
      union select jsonb_array_elements_text(m.data -> 'virkestoff_uten_styrke') from merkevarer m
    )
  ),
  pakninger as (
    select p.fest_id, p.data
    from legemiddeldata.pakning p
    where p.utgatt_kl is null
      and p.data -> 'merkevarer' ?| array(select fest_id from merkevarer)
  ),
  byttegrupper as (
    select b.fest_id, b.data
    from legemiddeldata.byttegruppe b
    where b.utgatt_kl is null
      and b.fest_id in (select jsonb_array_elements_text(p.data -> 'byttegrupper') from pakninger p)
  )
  select jsonb_build_object(
    'kilde', 'FEST',
    'kontrollert_kl', (
      select max(s.avsluttet_kl) from legemiddeldata.synkroniseringer s
      where s.kilde = 'FEST' and s.status in ('fullfort', 'uendret')),
    'kildedato', (
      select s.kildedato from legemiddeldata.synkroniseringer s
      where s.kilde = 'FEST' and s.status = 'fullfort'
      order by s.id desc limit 1),
    'virkestoff', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.fest_id, 'utgatt', a.utgatt_kl is not null) || a.data order by a.fest_id)
      from alle_stoff a), '[]'),
    'styrker', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.fest_id) || s.data order by s.fest_id) from alle_styrker s), '[]'),
    'merkevarer', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.fest_id) || m.data order by m.fest_id) from merkevarer m), '[]'),
    'pakninger', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.fest_id) || p.data order by p.fest_id) from pakninger p), '[]'),
    'byttegrupper', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.fest_id) || b.data order by b.fest_id) from byttegrupper b), '[]')
  )
$$;

-- De siste kjøringene, til å se at synkroniseringen går som den skal.
create function public.legemiddeldata_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(s) - 'etag' - 'sist_endret' order by s.id desc), '[]')
  from (
    select id, kilde, status, startet_kl, avsluttet_kl, etag, sist_endret, kildedato, antall, feil
    from legemiddeldata.synkroniseringer
    order by id desc
    limit 20
  ) s
$$;

-- --- Tidsgrensen for serveren -----------------------------------------------
--
-- API-et avbryter spørringer etter 8 sekunder. Å bytte inn et helt uttrekk kan
-- ta lenger, og en tidsgrense satt på selve funksjonen virker ikke, fordi den
-- måles fra starten av kallet. Serverrollen, som bare den hemmelige nøkkelen
-- gir, får derfor en romsligere grense; innloggede og anonyme beholder sine.

alter role service_role set statement_timeout = '2min';
notify pgrst, 'reload config';

-- --- Rettigheter -----------------------------------------------------------

revoke all on all tables in schema legemiddeldata from public, anon, authenticated, service_role;
revoke all on all functions in schema legemiddeldata from public, anon, authenticated, service_role;

revoke all on function
  public.legemiddeldata_forrige_synk(text),
  public.legemiddeldata_start_synk(text),
  public.legemiddeldata_last_inn(bigint, text, jsonb),
  public.legemiddeldata_fullfor_synk(bigint, jsonb),
  public.legemiddeldata_uendret_synk(bigint, jsonb),
  public.legemiddeldata_avbryt_synk(bigint, text),
  public.les_legemidler(text[]),
  public.legemiddeldata_status()
from public, anon, authenticated, service_role;

grant execute on function
  public.legemiddeldata_forrige_synk(text),
  public.legemiddeldata_start_synk(text),
  public.legemiddeldata_last_inn(bigint, text, jsonb),
  public.legemiddeldata_fullfor_synk(bigint, jsonb),
  public.legemiddeldata_uendret_synk(bigint, jsonb),
  public.legemiddeldata_avbryt_synk(bigint, text)
to service_role;

grant execute on function
  public.les_legemidler(text[]),
  public.legemiddeldata_status()
to authenticated, service_role;
