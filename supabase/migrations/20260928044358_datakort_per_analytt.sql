-- Datakort per analyttkode på sider flere koder deler.
--
-- En metabolitt som ikke er et legemiddel selv, står på moderstoffets side
-- (`sammenslatte` i src/data/stoffregister.json): O-desmetyltramadol (OTRAM)
-- viser tramadolsiden. Koden beholder sine egne tall, som referanseområdet,
-- og kortet for dem står på den felles siden med koden i `data.gjelder`.
-- Kortene til sidens egen kode har ingen `gjelder`.
--
-- 1. Hvert datakort kan da stå én gang per kode, ikke én gang per side:
--    `gjelder` tas med i indeksen. For de andre typene er den alltid tom,
--    så de står fortsatt én gang per side og panel.
-- 2. `les_referanseomrader` gir hver kode sitt kort: kortet med koden i
--    `gjelder`, eller kortet uten `gjelder` når siden er stoffets egen — når
--    hovedsiden også er en av komponentene til analytten. En metabolitt på
--    moderstoffets side får altså aldri moderstoffets referanseområde.

drop index public.innholdselementer_enkeltelement_idx;

create unique index innholdselementer_enkeltelement_idx
  on public.innholdselementer (infoside_id, tilstand, panel, elementtype, (coalesce(data ->> 'gjelder', '')))
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
  'Kortene som bare kan stå én gang per side og panel — datakortene én gang per analyttkode (data.gjelder). Samme typer som ENKELTELEMENTER i src/faginnhold/paneler.ts.';

create or replace function public.les_referanseomrader(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('analyttkode', a.kode, 'verdi', e.data) order by a.kode),
    '[]'::jsonb
  )
  from public.laboratorieanalytter a
  join public.innholdselementer e
    on e.infoside_id = a.hovedside_id and e.tilstand = a.tilstand
  where a.tilstand = sidetilstand
    and e.panel = 'viktige_data'
    and e.elementtype = 'referanseomrade'
    and case
      when nullif(e.data ->> 'gjelder', '') is not null then e.data ->> 'gjelder' = a.kode
      else exists (
        select 1 from public.analyttkomponenter k
        where k.analytt_id = a.objekt_id and k.tilstand = a.tilstand and k.infoside_id = a.hovedside_id
      )
    end
$$;

comment on function public.les_referanseomrader(public.objekttilstand) is
  'Referanseområdet for hver laboratorieanalytt i én tilstand: kortet for koden på hovedsiden (data.gjelder), eller sidens eget når siden er stoffets. Radsikkerheten gjelder.';