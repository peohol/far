-- Kommentartrådene i kurateringsgrenene (docs/kurateringsgrener.md,
-- «Kommentarene»; fase D i docs/kurateringsgrener-fremdrift.md).
--
-- En tråd er festet til noe konkret i grenen: et kort, et felt i det, en
-- seksjon, en referanse, en bivirkningskilde eller et arbeidsdokument, og til
-- revisjonen den ble skrevet mot. En sperrende tråd (fra kontrolløren eller en
-- administrator) hindrer godkjenning og publisering til den som åpnet den,
-- eller en administrator, har lukket den. Før grenen sendes til en ny
-- kontrollrunde, må kuratoren ha svart i hver åpen sperrende tråd der
-- kontrolløren sist skrev. Alt er uforanderlig, som resten av grenen.

create table kuratering.kommentarer (
  id uuid primary key default gen_random_uuid(),
  gren uuid not null references kuratering.grener (id) on delete cascade,
  infoside uuid not null,
  -- Trådens første kommentar; den første har sin egen ID.
  traad uuid not null,
  revisjon integer not null,
  -- Hva kommentaren er: en kommentar, eller at tråden lukkes eller åpnes igjen.
  handling text not null default 'kommentar',
  -- Bare på trådens første kommentar.
  art text,
  anker jsonb,
  tekst text not null,
  agent uuid references kuratering.agenter (id),
  profil uuid,
  profil_navn text,
  opprettet_kl timestamptz not null default now(),
  constraint kommentarer_handling check (handling in ('kommentar', 'lukket', 'gjenapnet')),
  constraint kommentarer_art check ((art is null) = (traad <> id) and (art is null or art in ('merknad', 'sperrende'))),
  constraint kommentarer_anker check (anker is null or (jsonb_typeof(anker) = 'object' and traad = id)),
  constraint kommentarer_tekst check (char_length(tekst) between 1 and 10000),
  constraint kommentarer_hvem check ((agent is null) <> (profil is null))
);

create index kommentarer_gren_idx on kuratering.kommentarer (gren, opprettet_kl);
create index kommentarer_traad_idx on kuratering.kommentarer (traad, opprettet_kl);

create trigger kommentarer_uforanderlig before update or delete on kuratering.kommentarer
for each row execute function kuratering.avvis_endring();
create trigger kommentarer_ikke_tom before truncate on kuratering.kommentarer
for each statement execute function intern.avvis_endring();
alter table kuratering.kommentarer enable row level security;

-- --- Trådene ----------------------------------------------------------------------

-- Hver tråd i grenen med status: åpen eller lukket, og om den venter på
-- kuratoren: kontrolløren eller en administrator skrev sist i en åpen tråd,
-- eller åpnet den igjen med en ny innvending. En gjenåpning gir en ny
-- svarplikt, som først er oppfylt når kuratoren svarer etter den.
create function kuratering.traader(p_gren kuratering.grener)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(t.j order by t.sperrende_apen desc, t.opprettet_kl), '[]'::jsonb)
  from (
    select
      r.opprettet_kl,
      r.art = 'sperrende' and s.status = 'apen' as sperrende_apen,
      jsonb_strip_nulls(jsonb_build_object(
        'id', r.id,
        'art', r.art,
        'anker', r.anker,
        'revisjon', r.revisjon,
        'status', s.status,
        'venter_pa_kurator', s.status = 'apen' and s.siste_fra_kurator is false,
        'apnet_av', r.profil_navn,
        'kommentarer', (
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', k.id, 'handling', k.handling, 'tekst', k.tekst, 'revisjon', k.revisjon,
            'av', k.profil_navn, 'kurator', k.agent is not distinct from p_gren.kurator and k.agent is not null,
            'kl', k.opprettet_kl)) order by k.opprettet_kl, k.id)
          from kuratering.kommentarer k where k.traad = r.id
        )
      )) as j
    from kuratering.kommentarer r
    cross join lateral (
      select
        coalesce((
          select case x.handling when 'lukket' then 'lukket' else 'apen' end
          from kuratering.kommentarer x
          where x.traad = r.id and x.handling in ('lukket', 'gjenapnet')
          order by x.opprettet_kl desc, x.id desc limit 1
        ), 'apen') as status,
        (
          select x.agent is not distinct from p_gren.kurator and x.agent is not null
          from kuratering.kommentarer x
          where x.traad = r.id and x.handling in ('kommentar', 'gjenapnet')
          order by x.opprettet_kl desc, x.id desc limit 1
        ) as siste_fra_kurator
    ) s
    where r.gren = p_gren.id and r.id = r.traad
  ) t
$$;

-- De sperrende trådene som står åpne, hindrer godkjenning og publisering.
create or replace function kuratering.sperrer(p_gren kuratering.grener)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(
    'Sperrende kommentar er åpen: «' || left(t -> 'kommentarer' -> 0 ->> 'tekst', 80) || '»'
    order by t ->> 'id'), '{}')
  from jsonb_array_elements(kuratering.traader(p_gren)) t
  where t ->> 'art' = 'sperrende' and t ->> 'status' = 'apen'
$$;

-- Seksjonene på en fagside, i sidens rekkefølge: de samme som `PANELER` i
-- `src/faginnhold/paneler.ts` (testen `kurateringskommentarer.test.ts`
-- kontrollerer at de stemmer overens).
create function kuratering.seksjoner()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'identitet', 'viktige_data', 'farmakodynamikk', 'virkninger', 'bivirkninger', 'toksisitet_forgiftning',
    'indikasjon', 'preparater', 'dosering', 'farmakokinetikk', 'farmakogenetikk', 'interaksjoner', 'tdm',
    'laboratorieanalyser', 'kjemiske_grunndata', 'serumkonsentrasjoner', 'graviditet_amming', 'avhengighet_toleranse'
  ]
$$;

-- Ankeret en tråd festes til, kontrollert mot grenen: et objekt på siden eller
-- i grenen og eventuelt et felt i det, en seksjon på fagsiden, en referanse,
-- en preparatomtale (bivirkningskilden) på siden eller i grenen, eller et
-- arbeidsdokument.
create function kuratering.les_anker(p_gren kuratering.grener, p_anker jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  grunnlag public.sideversjoner;
  objekt uuid;
  ut jsonb;
  tekst text;
begin
  if p_anker is null or p_anker = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(p_anker) <> 'object' then
    raise exception 'Ankeret må være et objekt.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_anker) k where k not in ('objekt', 'felt', 'seksjon', 'referanse', 'kilde', 'dokument')) then
    raise exception 'Ankeret kan ha objekt, felt, seksjon, referanse, kilde og dokument.' using errcode = '22023';
  end if;
  foreach tekst in array array['felt', 'seksjon', 'kilde'] loop
    if p_anker ? tekst and char_length(coalesce(p_anker ->> tekst, '')) not between 1 and 200 then
      raise exception 'Ankeret: % må være en tekst på 1 til 200 tegn.', tekst using errcode = '22023';
    end if;
  end loop;
  if p_anker ? 'dokument' and not (p_anker ->> 'dokument' in ('kildeplan', 'evidensjournal', 'dekningsmatrise', 'blindprotokoll', 'selvtest', 'notat')) then
    raise exception 'Ankeret: ukjent dokument «%».', p_anker ->> 'dokument' using errcode = '22023';
  end if;

  if p_anker ? 'felt' and not p_anker ? 'objekt' then
    raise exception 'Ankeret: et felt må høre til et objekt (siden eller et kort).' using errcode = '22023';
  end if;
  if p_anker ? 'seksjon' and not (btrim(p_anker ->> 'seksjon') = any (kuratering.seksjoner())) then
    raise exception 'Ankeret: ukjent seksjon «%».', p_anker ->> 'seksjon' using errcode = '22023';
  end if;

  select v.* into strict grunnlag from public.sideversjoner v where v.id = p_gren.grunnversjon;
  if p_anker ? 'kilde'
    and not exists (select 1 from jsonb_array_elements(coalesce(grunnlag.manifest -> 'bivirkninger', '[]')) b where b ->> 'nokkel' = btrim(p_anker ->> 'kilde'))
    and not exists (
      select 1 from jsonb_array_elements(coalesce(kuratering.tilstand(p_gren) -> 'bivirkninger' -> 'importer', '[]')) i
      where i -> 'kilde' ->> 'nokkel' = btrim(p_anker ->> 'kilde')
    )
  then
    raise exception 'Ankeret: preparatomtalen «%» står ikke på fagsiden eller i grenen.', p_anker ->> 'kilde' using errcode = '22023';
  end if;
  if p_anker ? 'objekt' then
    objekt := (p_anker ->> 'objekt')::uuid;
    if not (kuratering.tilstand(p_gren) -> 'objekter' ? objekt::text) and kuratering.revisjon_i_versjon(grunnlag, objekt) is null then
      raise exception 'Ankeret: objektet % hører ikke til fagsiden eller grenen.', objekt using errcode = '22023';
    end if;
  end if;
  if p_anker ? 'referanse' then
    objekt := (p_anker ->> 'referanse')::uuid;
    if not (kuratering.tilstand(p_gren) -> 'objekter' ? objekt::text)
      and not exists (select 1 from jsonb_array_elements(grunnlag.manifest -> 'referanser') r where (r ->> 'id')::uuid = objekt)
    then
      raise exception 'Ankeret: referansen % står ikke på fagsiden eller i grenen.', objekt using errcode = '22023';
    end if;
  end if;
  select jsonb_object_agg(k, case when k in ('objekt', 'referanse') then to_jsonb((p_anker ->> k)::uuid) else to_jsonb(btrim(p_anker ->> k)) end)
  into ut
  from jsonb_object_keys(p_anker) k;
  return ut;
end;
$$;

create function kuratering.ny_kommentar(
  p_gren kuratering.grener, p_aktor kuratering.aktor, p_traad uuid, p_handling text, p_art text, p_anker jsonb, p_tekst text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  ny uuid := gen_random_uuid();
begin
  if char_length(btrim(coalesce(p_tekst, ''))) not between 1 and 10000 then
    raise exception 'Kommentaren må ha en tekst på 1 til 10 000 tegn.' using errcode = '22023';
  end if;
  insert into kuratering.kommentarer (id, gren, infoside, traad, revisjon, handling, art, anker, tekst, agent, profil, profil_navn)
  values (
    ny, p_gren.id, p_gren.infoside, coalesce(p_traad, ny), p_gren.revisjon, p_handling, p_art, p_anker, btrim(p_tekst),
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end, kuratering.aktornavn(p_aktor)
  );
  perform kuratering.ny_hendelse(p_gren, 'kommentar', p_aktor, null, null, jsonb_strip_nulls(jsonb_build_object(
    'traad', coalesce(p_traad, ny), 'handling', p_handling, 'art', p_art)));
  update kuratering.grener x set oppdatert_kl = now() where x.id = p_gren.id;
  return ny;
end;
$$;

-- Den som kan lese grenen, kan lese trådene: kuratoren sin egen gren,
-- kontrolløren og administratorene alle.
create function kuratering.krev_leser(p_aktor kuratering.aktor, p_gren kuratering.grener)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not p_aktor.admin and not ('kontrollor' = any (p_aktor.roller)) then
    perform kuratering.krev_kurator(p_aktor, p_gren);
  end if;
end;
$$;

-- Trådene i en publisert eller arkivert gren står som de var da den ble
-- avsluttet.
create function kuratering.krev_aktiv_traad(p_gren kuratering.grener)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not kuratering.er_aktiv(p_gren.status) then
    raise exception 'Grenen er avsluttet.' using errcode = '22023';
  end if;
end;
$$;

-- Trådens første kommentar, eller feil.
create function kuratering.traaden(p_gren kuratering.grener, p_kommentar uuid)
returns kuratering.kommentarer
language plpgsql
stable
set search_path = ''
as $$
declare
  k kuratering.kommentarer;
begin
  select r.* into k
  from kuratering.kommentarer x
  join kuratering.kommentarer r on r.id = x.traad
  where x.id = p_kommentar and x.gren = p_gren.id;
  if k.id is null then
    raise exception 'Fant ikke kommentaren i grenen.' using errcode = 'PT404';
  end if;
  return k;
end;
$$;

-- --- Handlingene ------------------------------------------------------------------

-- En ny tråd ({gren, tekst, art?, anker?}) eller et svar ({gren, svar_pa, tekst}).
-- Kuratoren skriver merknader og svar; bare kontrolløren og administratorene
-- åpner sperrende tråder.
create function kuratering.h_kommenter(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
  art text := coalesce(p_data ->> 'art', 'merknad');
  v_id uuid;
begin
  perform kuratering.krev_leser(p_aktor, g);
  perform kuratering.krev_aktiv_traad(g);
  if p_data ->> 'svar_pa' is not null then
    traad := kuratering.traaden(g, (p_data ->> 'svar_pa')::uuid);
    v_id := kuratering.ny_kommentar(g, p_aktor, traad.id, 'kommentar', null, null, p_data ->> 'tekst');
  else
    if art not in ('merknad', 'sperrende') then
      raise exception 'Arten må være merknad eller sperrende.' using errcode = '22023';
    end if;
    if art = 'sperrende' and not p_aktor.admin and not ('kontrollor' = any (p_aktor.roller) and p_aktor.agent is distinct from g.kurator) then
      raise exception 'Bare kontrolløren og administratorene åpner en sperrende tråd.' using errcode = '42501';
    end if;
    v_id := kuratering.ny_kommentar(g, p_aktor, null, 'kommentar', art, kuratering.les_anker(g, p_data -> 'anker'), p_data ->> 'tekst');
  end if;
  return jsonb_build_object('id', v_id, 'traad', coalesce(traad.id, v_id));
end;
$$;

-- Lukker en tråd ({gren, kommentar, tekst?}). En sperrende tråd lukkes av den
-- som åpnet den eller en administrator; en merknad av alle som kan lese grenen.
create function kuratering.h_lukk_kommentar(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
begin
  perform kuratering.krev_leser(p_aktor, g);
  perform kuratering.krev_aktiv_traad(g);
  traad := kuratering.traaden(g, (p_data ->> 'kommentar')::uuid);
  if traad.art = 'sperrende' and not p_aktor.admin
    and (p_aktor.agent is null or traad.agent is distinct from p_aktor.agent)
  then
    raise exception 'En sperrende tråd lukkes av den som åpnet den, eller en administrator.' using errcode = '42501';
  end if;
  if (select t ->> 'status' from jsonb_array_elements(kuratering.traader(g)) t where (t ->> 'id')::uuid = traad.id) = 'lukket' then
    raise exception 'Tråden er alt lukket.' using errcode = '22023';
  end if;
  perform kuratering.ny_kommentar(g, p_aktor, traad.id, 'lukket', null, null, coalesce(nullif(btrim(p_data ->> 'tekst'), ''), 'Lukket.'));
  return jsonb_build_object('traad', traad.id, 'status', 'lukket');
end;
$$;

-- Åpner en lukket tråd igjen ({gren, kommentar, tekst}), for kontrolløren og
-- administratorene.
create function kuratering.h_gjenapne_kommentar(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
begin
  perform kuratering.krev_rolle(p_aktor, 'kontrollor');
  perform kuratering.krev_aktiv_traad(g);
  traad := kuratering.traaden(g, (p_data ->> 'kommentar')::uuid);
  if (select t ->> 'status' from jsonb_array_elements(kuratering.traader(g)) t where (t ->> 'id')::uuid = traad.id) <> 'lukket' then
    raise exception 'Tråden er åpen.' using errcode = '22023';
  end if;
  perform kuratering.ny_kommentar(g, p_aktor, traad.id, 'gjenapnet', null, null, p_data ->> 'tekst');
  return jsonb_build_object('traad', traad.id, 'status', 'apen');
end;
$$;

-- Trådene i grenen ({gren, apne?}).
create function kuratering.h_kommentarer(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  select x.* into g from kuratering.grener x where x.id = (p_data ->> 'gren')::uuid;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  perform kuratering.krev_leser(p_aktor, g);
  return coalesce((
    select jsonb_agg(t)
    from jsonb_array_elements(kuratering.traader(g)) t
    where not coalesce((p_data ->> 'apne')::boolean, false) or t ->> 'status' = 'apen'
  ), '[]'::jsonb);
end;
$$;

-- Lesingen av grenen tar med trådene.
create or replace function kuratering.h_les(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  g kuratering.grener;
begin
  select x.* into g from kuratering.grener x where x.id = (p_data ->> 'gren')::uuid;
  if g.id is null then
    raise exception 'Fant ikke kurateringsgrenen.' using errcode = 'PT404';
  end if;
  perform kuratering.krev_leser(p_aktor, g);
  return kuratering.detaljer(g, (p_data ->> 'revisjon')::integer, g.blindfase and p_aktor.agent is not distinct from g.kurator)
    || jsonb_build_object('traader', kuratering.traader(g));
end;
$$;

-- En ny kontrollrunde krever at kuratoren har svart i hver åpen sperrende
-- tråd der kontrolløren sist skrev.
create or replace function kuratering.h_til_kontroll(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  r kuratering.grenrevisjoner;
  ubesvart integer;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  perform kuratering.krev_status(g, array['arbeid', 'retting'], 'sendes til kontroll');
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if g.blindfase then
    raise exception 'Blindfasen må avsluttes før grenen sendes til kontroll.' using errcode = '22023';
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  if r.revisjon is null then
    raise exception 'Grenen har ingen endringer.' using errcode = '22023';
  end if;
  if not coalesce((r.teknisk ->> 'ok')::boolean, false) or not coalesce((r.teknisk ->> 'rapport_ok')::boolean, false) then
    raise exception 'Prøvepubliseringen må bestå, med en rapport som stemmer, før grenen sendes til kontroll: %',
      coalesce(r.teknisk ->> 'feil', r.teknisk ->> 'rapportfeil', 'ukjent feil') using errcode = '22023';
  end if;
  if (kuratering.siste_versjon(g.infoside)).id is distinct from g.grunnversjon then
    raise exception 'Fagsiden er publisert på nytt; oppdater grenen til den nye versjonen først.' using errcode = 'PT409';
  end if;
  perform kuratering.krev_dokumenter(g, kuratering.pakrevde_dokumenter(g.art), 'Grenen kan ikke sendes til kontroll');
  select count(*) into ubesvart
  from jsonb_array_elements(kuratering.traader(g)) t
  where t ->> 'art' = 'sperrende' and (t ->> 'venter_pa_kurator')::boolean;
  if ubesvart > 0 then
    raise exception '% sperrende kommentar(er) venter på svar fra kuratoren.', ubesvart using errcode = '22023';
  end if;
  update kuratering.grener x set runde = x.runde + 1 where x.id = g.id returning x.* into g;
  g := kuratering.sett_status(g, 'klar', p_aktor, 'til_kontroll', null, jsonb_build_object('runde', g.runde));
  return kuratering.sammendrag(g);
end;
$$;

create or replace function kuratering.handlinger(p_admin boolean)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when p_admin
    then array['oversikt', 'les', 'les_dokument', 'vurder', 'publiser', 'stans', 'gjenoppta', 'forkast', 'agenter', 'ny_agentnokkel',
      'gjenopprett_versjon', 'kommenter', 'lukk_kommentar', 'gjenapne_kommentar', 'kommentarer']
    else array['oversikt', 'apne', 'les', 'skriv', 'aktivitet', 'dokument', 'les_dokument', 'avslutt_blindfase',
      'til_kontroll', 'trekk_fra_kontroll', 'vurder', 'oppdater_grunnlag', 'publiser', 'forkast',
      'kommenter', 'lukk_kommentar', 'gjenapne_kommentar', 'kommentarer']
  end
$$;

revoke all on all tables in schema kuratering from public, anon, authenticated, service_role;
revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
