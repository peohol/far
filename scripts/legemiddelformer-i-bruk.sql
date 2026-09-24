-- Legemiddelformene som faktisk forekommer blant preparatene til de publiserte
-- stoffsidene: de publiserte koblingene i «Preparater», virkestoffene og
-- saltene deres, og merkevarene som ikke er utgått, slik les_legemidler finner
-- dem. Gir hele innholdet i src/legemiddeldata/legemiddelformer-i-bruk.json.
--
-- Bare lesing. Kjøres mot produksjonsdatabasen, f.eks. med Supabase-verktøyet
-- for SQL, og svaret lagres i JSON-filen. Se docs/legemiddeldata.md.
with koblet as (
  select distinct v ->> 'fest_id' as fest_id
  from public.innholdselementer e
  join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = 'publisert'
  cross join lateral jsonb_array_elements(e.data -> 'virkestoff') v
  where e.elementtype = 'legemiddelkobling' and e.tilstand = 'publisert'
),
stoff as (
  select fest_id from koblet
  union
  select jsonb_array_elements_text(v.data -> 'salter')
  from legemiddeldata.virkestoff v
  where v.fest_id in (select fest_id from koblet)
),
styrker as (
  select s.fest_id
  from legemiddeldata.virkestoff_styrke s
  where s.virkestoff_id in (select fest_id from stoff) and s.utgatt_kl is null
),
merkevarer as (
  select m.data
  from legemiddeldata.merkevare m
  where m.utgatt_kl is null
    and (m.data -> 'virkestoff_med_styrke' ?| array(select fest_id from styrker)
         or m.data -> 'virkestoff_uten_styrke' ?| array(select fest_id from stoff))
),
former as (
  select m.data -> 'legemiddelform' ->> 'kode' as kode,
         m.data -> 'legemiddelform' ->> 'tekst' as tekst,
         count(*) as merkevarer
  from merkevarer m
  group by 1, 2
)
select jsonb_build_object(
  'hentet', current_date,
  'kildedato', (
    select s.kildedato from legemiddeldata.synkroniseringer s
    where s.kilde = 'FEST' and s.status = 'fullfort'
    order by s.id desc limit 1),
  'virkestoff', (select count(*) from koblet),
  'former', coalesce((
    select jsonb_agg(jsonb_build_object('kode', f.kode, 'tekst', f.tekst, 'merkevarer', f.merkevarer)
                     order by length(f.kode), f.kode)
    from former f), '[]')
) as legemiddelformer;
