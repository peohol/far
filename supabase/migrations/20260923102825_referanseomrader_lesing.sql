-- Referanseområdene fortolkningen viser under analyttnavnet, lest fra
-- informasjonssidene.
--
-- Referanseområdet står på informasjonssiden som kortet «Referanseområde» i
-- «Viktige data». Fortolkningen viser det samme tallet under analyttnavnet på
-- steg 2, og skal ha det fra samme sted, så de to aldri kan vise ulikt.
-- Bakgrunnen står i docs/fortolkningsregler.md.
--
-- Funksjonen kjører med rettighetene til den som kaller, så radsikkerheten
-- gjelder som ellers: innloggede ser det publiserte, administratorer alt.

-- Referanseområdet for hver analyttkode i én tilstand: kortet på hovedsiden
-- til laboratorieanalytten, som { analyttkode, verdi }, sortert på koden.
-- `verdi` er dataene i kortet: { nedre, ovre, enhet, forbehold }. Koder uten
-- kortet er ikke med. Et kort som er tatt bort fra siden, teller ikke.
create function public.les_referanseomrader(sidetilstand public.objekttilstand)
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
$$;

comment on function public.les_referanseomrader(public.objekttilstand) is
  'Referanseområdet på hovedsiden til hver laboratorieanalytt i én tilstand. Radsikkerheten gjelder.';

revoke all on function public.les_referanseomrader(public.objekttilstand)
  from public, anon, authenticated, service_role;

grant execute on function public.les_referanseomrader(public.objekttilstand) to authenticated;