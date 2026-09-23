-- Stoffsidene kobles til legemiddeldataene fra FEST.
--
-- En informasjonsside peker på ett eller flere virkestoff i FEST med FESTs
-- egen ID, i elementet `legemiddelkobling` i panelet «Preparater». Koblingen er
-- redaksjonelt innhold som alt annet på siden: den lagres som utkast, publiseres
-- og har historikk. Navnelikhet gir bare forslag i redigeringen; en kobling tas
-- i bruk først når en administrator har lagret og publisert den.
--
-- Bakgrunnen står i docs/legemiddeldata.md.

-- --- Kortene som bare kan stå én gang --------------------------------------
--
-- Koblingen står én gang i panelet sitt. Preparatnavnene som ble skrevet inn
-- for hånd (`preparater`), er erstattet av legemiddeldataene og lages ikke
-- lenger; de som finnes, ligger i panelet `fjernet` og teller ikke.

drop index public.innholdselementer_enkeltelement_idx;

create unique index innholdselementer_enkeltelement_idx
  on public.innholdselementer (infoside_id, tilstand, panel, elementtype)
  where panel <> 'fjernet'
    and elementtype in (
      'legemiddelkobling',
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

-- --- Søket etter virkestoff -------------------------------------------------
--
-- Til å velge hva en side kobles til. Treffer navnet eller det engelske navnet;
-- likt navn først, så de som begynner med søket, så resten. Hvert treff sier
-- hvilke stoffer det er salt eller ester av, og hvor mange preparater som ikke
-- er utgått, som har det — også gjennom saltene.

create function public.sok_virkestoff(sok text, antall integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with sporring as (
    select lower(btrim(sok)) as s
  ),
  treff as (
    select v.fest_id, v.data, v.navn,
      case
        when lower(v.navn) = q.s then 0
        when lower(v.navn) like q.s || '%' then 1
        else 2
      end as rang
    from legemiddeldata.virkestoff v, sporring q
    where v.utgatt_kl is null
      and char_length(q.s) >= 2
      and (strpos(lower(v.navn), q.s) > 0 or strpos(lower(coalesce(v.data ->> 'navn_engelsk', '')), q.s) > 0)
    order by rang, lower(v.navn)
    limit least(greatest(coalesce(antall, 20), 1), 50)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.fest_id,
    'navn', t.navn,
    'navn_engelsk', t.data -> 'navn_engelsk',
    'salt_av', coalesce((
      select jsonb_agg(m.navn order by m.navn)
      from legemiddeldata.virkestoff m
      where m.data -> 'salter' ? t.fest_id and m.utgatt_kl is null), '[]'),
    'preparater', (
      with stoff as (
        select t.fest_id as id
        union
        select jsonb_array_elements_text(t.data -> 'salter')
      )
      select count(*)
      from legemiddeldata.merkevare mv
      where mv.utgatt_kl is null
        and (mv.data -> 'virkestoff_med_styrke' ?| array(
               select s.fest_id from legemiddeldata.virkestoff_styrke s
               where s.virkestoff_id in (select id from stoff) and s.utgatt_kl is null)
             or mv.data -> 'virkestoff_uten_styrke' ?| array(select id from stoff)))
  ) order by t.rang, lower(t.navn)), '[]')
  from treff t
$$;

revoke all on function public.sok_virkestoff(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.sok_virkestoff(text, integer) to authenticated, service_role;
