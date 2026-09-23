-- Kortene som bare kan stå én gang i panelet sitt.
--
-- Preparatnavnene, hvert datakort i «Viktige data», rikteksten i
-- farmakodynamikk, dosering og indikasjon, og tabellen over
-- serumkonsentrasjoner finnes én gang per side og panel. Appen viser bare det
-- første av hvert; kom det et til, ville det bli skjult for den som leser,
-- men likevel publisert.
--
-- To administratorer som oppretter det samme kortet samtidig, ser begge at
-- det ikke finnes. Denne indeksen gjør at bare den første får det lagret; den
-- andre avvises og får se det som ble lagt inn. Kort som er fjernet fra siden
-- (panelet `fjernet`), teller ikke.
--
-- Typene står også som ENKELTELEMENTER i src/faginnhold/paneler.ts.
-- Testene kontrollerer at de stemmer overens.
create unique index innholdselementer_enkeltelement_idx
  on public.innholdselementer (infoside_id, tilstand, panel, elementtype)
  where panel <> 'fjernet'
    and elementtype in (
      'preparater',
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
