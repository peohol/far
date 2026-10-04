-- De faste kortene i en seksjon kan stå én gang per side.
--
-- Seksjonene med faste kort («Toksisitet og forgiftning», «Graviditet, amming
-- og reproduksjon» og «Avhengighet, toleranse og tilbakeslagseffekter») har
-- kort med faste overskrifter (`kort`/`grupper` i src/faginnhold/paneler.ts).
-- Kortene er `kinetikkort` med overskriften i `data.tittel`, og hvert kan stå
-- én gang per side, panel og tilstand. Appen tilbyr bare de som mangler; her
-- håndheves det også, så to som legger til det samme kortet samtidig, ikke
-- begge får det lagret. Et kort som er tatt bort, står i panelet `fjernet`
-- og gir plass til et nytt.
--
-- Panellisten er den samme som PANELER_MED_FASTE_KORT i paneler.ts; testene
-- kontrollerer at de stemmer. De to første panelene er nye og tomme; i
-- «Avhengighet, toleranse og tilbakeslagseffekter» står hvert kort én gang i
-- produksjon (kontrollert 2026-10-04).

create unique index innholdselementer_fast_kort_idx
  on public.innholdselementer (infoside_id, tilstand, panel, (btrim(data ->> 'tittel')))
  where elementtype = 'kinetikkort'
    and panel in (
      'toksisitet_forgiftning',
      'graviditet_amming',
      'avhengighet_toleranse'
    );

comment on index public.innholdselementer_fast_kort_idx is
  'De faste kortene i en seksjon står én gang per side, panel og tilstand, etter overskriften. Samme paneler som PANELER_MED_FASTE_KORT i src/faginnhold/paneler.ts.';
