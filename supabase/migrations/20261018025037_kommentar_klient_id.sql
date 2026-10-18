-- En kommentar lagres nøyaktig én gang, også når et forsøk blir stoppet eller
-- svaret aldri kommer fram (docs/kurateringsgrener.md, «Kommentarene»).
--
-- Agenten kan gi kommentaren en `klient_id`, som den velger før det første
-- forsøket. Et nytt forsøk med den samme ID-en og den samme teksten lagrer
-- ingenting nytt, men svarer med kommentaren som alt er lagret
-- (`alt_lagret: true`). Den samme ID-en for en annen tekst eller en annen tråd
-- er en feil, så ingenting forsvinner i stillhet. Svaret på `kommenter` sier nå
-- også uttrykkelig at kommentaren er lagret, og når; trådene viser ID-en, så
-- kontrolløren kan se etter i neste kjøring hva som faktisk står der.
--
-- Bare kuratering.ny_kommentar, kuratering.traader og kuratering.h_kommenter
-- endres; resten står som før.

alter table kuratering.kommentarer
  add column klient_id text,
  add constraint kommentarer_klient_id check (klient_id is null or klient_id ~ '^[A-Za-z0-9._:-]{8,100}$');

create unique index kommentarer_klient_id_idx on kuratering.kommentarer (gren, coalesce(agent, profil), klient_id)
where klient_id is not null;

-- Den nye kommentaren, med klient-ID-en når den er gitt.
create function kuratering.ny_kommentar(
  p_gren kuratering.grener, p_aktor kuratering.aktor, p_traad uuid, p_handling text, p_art text, p_anker jsonb, p_tekst text,
  p_klient_id text
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
  insert into kuratering.kommentarer (id, gren, infoside, traad, revisjon, handling, art, anker, tekst, agent, profil, profil_navn, klient_id)
  values (
    ny, p_gren.id, p_gren.infoside, coalesce(p_traad, ny), p_gren.revisjon, p_handling, p_art, p_anker, btrim(p_tekst),
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end, kuratering.aktornavn(p_aktor), p_klient_id
  );
  perform kuratering.ny_hendelse(p_gren, 'kommentar', p_aktor, null, null, jsonb_strip_nulls(jsonb_build_object(
    'traad', coalesce(p_traad, ny), 'handling', p_handling, 'art', p_art)));
  update kuratering.grener x set oppdatert_kl = now() where x.id = p_gren.id;
  return ny;
end;
$$;

-- Lukking og gjenåpning har ingen klient-ID.
create or replace function kuratering.ny_kommentar(
  p_gren kuratering.grener, p_aktor kuratering.aktor, p_traad uuid, p_handling text, p_art text, p_anker jsonb, p_tekst text
)
returns uuid
language sql
set search_path = ''
as $$
  select kuratering.ny_kommentar(p_gren, p_aktor, p_traad, p_handling, p_art, p_anker, p_tekst, null)
$$;

-- Hver tråd i grenen med status: åpen eller lukket, og om den venter på
-- kuratoren: kontrolløren eller en administrator skrev sist i en åpen tråd,
-- eller åpnet den igjen med en ny innvending. En gjenåpning gir en ny
-- svarplikt, som først er oppfylt når kuratoren svarer etter den.
create or replace function kuratering.traader(p_gren kuratering.grener)
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
            'kl', k.opprettet_kl, 'klient_id', k.klient_id)) order by k.opprettet_kl, k.id)
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

-- En ny tråd ({gren, tekst, art?, anker?, klient_id?}) eller et svar ({gren,
-- svar_pa, tekst, klient_id?}). Kuratoren skriver merknader og svar; bare
-- kontrolløren og administratorene åpner sperrende tråder. Med en klient-ID
-- som alt er lagret for den samme teksten og tråden, svarer den med
-- kommentaren som står der, også om grenen er avsluttet siden.
create or replace function kuratering.h_kommenter(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
  art text := coalesce(p_data ->> 'art', 'merknad');
  v_klient text := nullif(btrim(p_data ->> 'klient_id'), '');
  tidligere kuratering.kommentarer;
  v_id uuid;
begin
  perform kuratering.krev_leser(p_aktor, g);
  if v_klient is not null then
    if v_klient !~ '^[A-Za-z0-9._:-]{8,100}$' then
      raise exception 'klient_id må ha 8 til 100 tegn: bokstavene a–z og A–Z, sifre og . _ : -' using errcode = '22023';
    end if;
    -- Samtidige forsøk med den samme ID-en venter på hverandre.
    perform pg_advisory_xact_lock(hashtextextended('kommentar:' || g.id::text || ':' || v_klient, 0));
    select k.* into tidligere
    from kuratering.kommentarer k
    where k.gren = g.id and k.klient_id = v_klient
      and coalesce(k.agent, k.profil) = coalesce(p_aktor.agent, (p_aktor.profil).id);
    if tidligere.id is not null then
      if tidligere.tekst is distinct from btrim(coalesce(p_data ->> 'tekst', ''))
        or tidligere.traad is distinct from (case
          when p_data ->> 'svar_pa' is null then tidligere.id
          else (kuratering.traaden(g, (p_data ->> 'svar_pa')::uuid)).id
        end)
      then
        raise exception 'klient_id % er alt brukt for en annen kommentar i grenen. Velg en ny for en ny kommentar.', v_klient using errcode = 'PT409';
      end if;
      return jsonb_build_object('id', tidligere.id, 'traad', tidligere.traad, 'kl', tidligere.opprettet_kl, 'klient_id', v_klient,
        'lagret', true, 'alt_lagret', true);
    end if;
  end if;
  perform kuratering.krev_aktiv_traad(g);
  if p_data ->> 'svar_pa' is not null then
    traad := kuratering.traaden(g, (p_data ->> 'svar_pa')::uuid);
    v_id := kuratering.ny_kommentar(g, p_aktor, traad.id, 'kommentar', null, null, p_data ->> 'tekst', v_klient);
  else
    if art not in ('merknad', 'sperrende') then
      raise exception 'Arten må være merknad eller sperrende.' using errcode = '22023';
    end if;
    if art = 'sperrende' and not p_aktor.admin and not ('kontrollor' = any (p_aktor.roller) and p_aktor.agent is distinct from g.kurator) then
      raise exception 'Bare kontrolløren og administratorene åpner en sperrende tråd.' using errcode = '42501';
    end if;
    v_id := kuratering.ny_kommentar(g, p_aktor, null, 'kommentar', art, kuratering.les_anker(g, p_data -> 'anker'), p_data ->> 'tekst', v_klient);
  end if;
  return jsonb_strip_nulls(jsonb_build_object('id', v_id, 'traad', coalesce(traad.id, v_id), 'kl', now(), 'klient_id', v_klient,
    'lagret', true));
end;
$$;

revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
