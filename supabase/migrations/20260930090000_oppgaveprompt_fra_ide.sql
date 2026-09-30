-- Planlagte oppgaver: prompten starter med idéens tekst.
--
-- Når en administrator overfører en idé, får oppgaven idéens beskrivelse som
-- prompt, så den ikke starter blank. Prompten er ren tekst, så rikteksten
-- gjøres om: avsnitt skilles med en tom linje, punkter får «- » eller «1. »
-- foran, og en lenke får adressen i parentes. Har idéen ingen beskrivelse,
-- blir prompten overskriften. Oppgaven er fortsatt ikke påbegynt, og prompten
-- kan redigeres som før. Oppgaver som alt er overført, endres ikke.

-- Teksten i en riktekst (ProseMirror-JSON) som ren tekst. Noder den ikke
-- kjenner, blir teksten i dem; siteringer er ikke tekst og utelates.
create function intern.riktekst_som_tekst(node jsonb)
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

create or replace function public.overfor_ide(ide uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny uuid;
begin
  perform intern.krev_idevalg_admin();
  perform intern.las_apen_ide(overfor_ide.ide);
  insert into public.oppgaver (ide_id, tittel, nummer, prompt)
  select i.id, i.tittel, nextval('intern.oppgavenummer'),
    -- Samme grense som oppgaver_prompt.
    left(coalesce(nullif(btrim(intern.riktekst_som_tekst(i.tekst), E' \t\r\n'), ''), i.tittel), 50000)
  from public.ideer i where i.id = overfor_ide.ide
  returning id into ny;
  return ny;
end;
$$;

comment on function intern.riktekst_som_tekst(jsonb) is
  'Teksten i en riktekst som ren tekst: avsnitt med tom linje mellom, punktlister med «- », nummererte lister med «1. », lenker med adressen i parentes.';
comment on function public.overfor_ide(uuid) is
  'Gjør idéen til en planlagt oppgave med neste nummer og idéens tekst som prompt, og gir ID-en til oppgaven. Bare for administratorer.';

revoke all on function intern.riktekst_som_tekst(jsonb) from public, anon, authenticated, service_role;
