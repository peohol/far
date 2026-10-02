-- Direktelenker: en lenke rett til en diskusjon, en idé eller en kommentar i
-- en av dem.
--
-- Lenken bærer bare ID-ene (`#/diskusjon/<id>`, `#/ide/<id>`, med kommentaren
-- som et ledd til), så den virker også etter at tråden er flyttet til en annen
-- side eller har fått ny overskrift. Appen slår opp hva lenken peker på med
-- `direktelenke()`: når den åpnes, når den settes inn i en tekst (den godtas
-- bare når den peker på noe som finnes), og til navnet og forhåndsvisningen på
-- lenkebrikken i teksten.
--
-- I en tekst står lenken som en egen node (`direktelenke`) med ID-ene og navnet
-- den hadde da den ble satt inn. Når en idé overføres til planlagte oppgaver,
-- blir den navnet i prompten.

-- Navnet til den som skrev noe, slik appen viser det (`visningsnavn`): for- og
-- etternavn, eller brukernavnet når de er tomme. Null for en slettet
-- kommentar, som ikke sier hvem som skrev den.
create function intern.direktelenke_forfatter(bruker uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name, 'username', p.username)
  from public.profiles p
  where p.id = direktelenke_forfatter.bruker
$$;

-- Det en direktelenke peker på, eller null når det ikke finnes (lenger), eller
-- når kommentaren ikke står i den tråden lenken sier. Samme regler for hva
-- som kan leses, som i `diskusjonstraad()` og `idetraad()`: en idé som har
-- ligget i arkivet forbi fristen, finnes ikke.
create function public.direktelenke(slag text, id uuid, kommentar uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case direktelenke.slag
    when 'diskusjon' then (
      select jsonb_build_object(
        'slag', 'diskusjon',
        'id', d.id,
        'side', d.side,
        'tittel', d.tittel,
        'kategori', (
          select jsonb_build_object('navn', k.navn, 'emoji', k.emoji)
          from public.diskusjonskategorier k where k.id = d.kategori_id
        ),
        'forfatter', intern.direktelenke_forfatter(d.forfatter_id),
        'opprettet_kl', d.opprettet_kl,
        'tekst', d.tekst,
        'skjult', d.skjult_kl is not null,
        'arkivert_kl', d.arkivert_kl,
        'kommentarer', (
          select count(*) from public.diskusjonskommentarer k
          where k.diskusjon_id = d.id and not k.slettet
        ),
        'kommentar', (
          select jsonb_build_object(
            'id', k.id,
            'forfatter', intern.direktelenke_forfatter(k.forfatter_id),
            'opprettet_kl', k.opprettet_kl,
            'tekst', k.tekst,
            'slettet', k.slettet,
            'skjult', k.skjult_kl is not null
          )
          from public.diskusjonskommentarer k
          where k.id = direktelenke.kommentar and k.diskusjon_id = d.id
        )
      )
      from public.diskusjoner d
      where d.id = direktelenke.id
        and (direktelenke.kommentar is null or exists (
          select 1 from public.diskusjonskommentarer k
          where k.id = direktelenke.kommentar and k.diskusjon_id = d.id
        ))
    )
    when 'ide' then (
      select jsonb_build_object(
        'slag', 'ide',
        'id', i.id,
        'tittel', i.tittel,
        'idekategori', i.kategori,
        'forfatter', intern.direktelenke_forfatter(i.forfatter_id),
        'opprettet_kl', i.opprettet_kl,
        'tekst', i.tekst,
        'arkivert_kl', i.arkivert_kl,
        'overfort', exists (select 1 from public.oppgaver o where o.ide_id = i.id),
        'kommentarer', (
          select count(*) from public.idekommentarer k
          where k.ide_id = i.id and not k.slettet
        ),
        'kommentar', (
          select jsonb_build_object(
            'id', k.id,
            'forfatter', intern.direktelenke_forfatter(k.forfatter_id),
            'opprettet_kl', k.opprettet_kl,
            'tekst', k.tekst,
            'slettet', k.slettet,
            'skjult', false
          )
          from public.idekommentarer k
          where k.id = direktelenke.kommentar and k.ide_id = i.id
        )
      )
      from public.ideer i
      where i.id = direktelenke.id
        and (i.arkivert_kl is null or i.arkivert_kl > now() - intern.arkivfrist())
        and (direktelenke.kommentar is null or exists (
          select 1 from public.idekommentarer k
          where k.id = direktelenke.kommentar and k.ide_id = i.id
        ))
    )
  end
  where (select auth.uid()) is not null
$$;

comment on function public.direktelenke(text, uuid, uuid) is
  'Det en direktelenke peker på — en diskusjon eller en idé, eventuelt en kommentar i den — med det lenkebrikken og forhåndsvisningen viser. Null når det ikke finnes.';
comment on function intern.direktelenke_forfatter(uuid) is
  'Navnet til en bruker, til forhåndsvisningen av en direktelenke.';

-- Teksten i en riktekst som ren tekst, nå også med lenkebrikkene: de blir
-- navnet de står med. Ellers som før (`20260930090946_oppgaveprompt_fra_ide`).
create or replace function intern.riktekst_som_tekst(node jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  slag text := node ->> 'type';
  barn jsonb := case when jsonb_typeof(node -> 'content') = 'array' then node -> 'content' else '[]'::jsonb end;
  start integer;
begin
  if node is null or jsonb_typeof(node) <> 'object' then
    return '';
  end if;

  if slag = 'text' then
    return coalesce(node ->> 'text', '');
  elsif slag = 'hardBreak' then
    return E'\n';
  elsif slag = 'direktelenke' then
    return coalesce(node -> 'attrs' ->> 'etikett', '');
  elsif slag = 'doc' then
    -- Blokkene med en tom linje mellom, uten de tomme.
    return coalesce((
      select string_agg(t, E'\n\n' order by n)
      from jsonb_array_elements(barn) with ordinality as b(blokk, n),
        lateral (select intern.riktekst_som_tekst(b.blokk) as t) x
      where btrim(t, E' \t\r\n') <> ''
    ), '');
  elsif slag = 'listItem' then
    return coalesce((
      select string_agg(intern.riktekst_som_tekst(b.blokk), E'\n' order by n)
      from jsonb_array_elements(barn) with ordinality as b(blokk, n)
    ), '');
  elsif slag in ('bulletList', 'orderedList') then
    start := case when node -> 'attrs' ->> 'start' ~ '^[0-9]{1,6}$' then (node -> 'attrs' ->> 'start')::integer else 1 end;
    -- Hvert punkt på sin linje, med linjene under innrykket til teksten.
    return coalesce((
      select string_agg(
        p.merke || replace(intern.riktekst_som_tekst(b.punkt), E'\n', E'\n' || repeat(' ', char_length(p.merke))),
        E'\n' order by n)
      from jsonb_array_elements(barn) with ordinality as b(punkt, n),
        lateral (select case when slag = 'bulletList' then '- ' else (start + n - 1)::text || '. ' end as merke) p
    ), '');
  else
    -- Tekst som står etter hverandre med samme lenke, er én lenke, også når
    -- deler av den er formatert: adressen kommer én gang, etter hele lenken.
    return coalesce((
      with deler as (
        select b.n, intern.riktekst_som_tekst(b.del) as t,
          (select m -> 'attrs' ->> 'href'
            from jsonb_array_elements(case when jsonb_typeof(b.del -> 'marks') = 'array' then b.del -> 'marks' else '[]'::jsonb end) m
            where b.del ->> 'type' = 'text' and m ->> 'type' = 'link'
            limit 1) as href
        from jsonb_array_elements(barn) with ordinality as b(del, n)
      ),
      grupper as (
        select d.n, d.t, d.href,
          count(*) filter (where d.href is distinct from d.forrige) over (order by d.n) as gruppe
        from (select deler.*, lag(deler.href) over (order by deler.n) as forrige from deler) d
      ),
      lenker as (
        select g.gruppe, max(g.href) as href, string_agg(g.t, '' order by g.n) as t
        from grupper g
        group by g.gruppe
      )
      select string_agg(
        l.t || case when l.href is not null and l.href <> l.t then ' (' || l.href || ')' else '' end,
        '' order by l.gruppe)
      from lenker l
    ), '');
  end if;
end;
$$;

comment on function intern.riktekst_som_tekst(jsonb) is
  'Teksten i en riktekst som ren tekst: avsnitt med tom linje mellom, punktlister med «- », nummererte lister med «1. », lenker med adressen i parentes og lenkebrikker med navnet sitt.';

revoke all on function public.direktelenke(text, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.direktelenke(text, uuid, uuid) to authenticated;
revoke all on function intern.direktelenke_forfatter(uuid) from public, anon, authenticated, service_role;
revoke all on function intern.riktekst_som_tekst(jsonb) from public, anon, authenticated, service_role;