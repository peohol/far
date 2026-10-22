-- «Fenomenologi»: et fast kort i «Virkninger», ved siden av de frie kortene.
--
-- To ting følger det faste kortet: databasen håndhever at det står én gang
-- per side, og kurateringene får det som et eget kontrollpunkt i
-- dekningsmatrisen.
--
-- «Virkninger» (`virkninger`) har kort med fri overskrift, og får nå også det
-- faste kortet «Fenomenologi» (`kort` og `frieKort` i
-- src/faginnhold/paneler.ts). Det faste kortet kan stå én gang per side og
-- tilstand, som de faste kortene i de andre seksjonene; de frie kortene kan
-- fortsatt ha samme overskrift flere ganger. Indeksen lages derfor på nytt med
-- både panelene som bare har faste kort, og de faste overskriftene i panelene
-- som også har frie.
--
-- Panelene og overskriftene er de samme som i paneler.ts
-- (`PANELER_MED_FASTE_KORT`, `erFastOverskrift`); testene kontrollerer at de
-- stemmer. Ingen tidligere migrasjon har lagt inn et kort med overskriften
-- «Fenomenologi»; skulle en side likevel ha to slike i «Virkninger», stopper
-- migrasjonen uten at noe er endret.

drop index public.innholdselementer_fast_kort_idx;

create unique index innholdselementer_fast_kort_idx
  on public.innholdselementer (infoside_id, tilstand, panel, (btrim(data ->> 'tittel')))
  where elementtype = 'kinetikkort'
    and (
      panel in (
        'toksisitet_forgiftning',
        'graviditet_amming',
        'avhengighet_toleranse'
      )
      or (panel, btrim(data ->> 'tittel')) in (
        ('virkninger', 'Fenomenologi')
      )
    );

comment on index public.innholdselementer_fast_kort_idx is
  'De faste kortene i en seksjon står én gang per side, panel og tilstand, etter overskriften. Samme paneler og overskrifter som PANELER_MED_FASTE_KORT og erFastOverskrift i src/faginnhold/paneler.ts.';

-- Kontrollpunktene i dekningsmatrisen (`kontrollpunkter()` i
-- src/kuratorprotokoll/dekning.ts) får det nye faste kortet rett etter
-- seksjonen sitt. En dekningsmatrise som er lagret før dette, må få punktet
-- før kurateringen leveres.
create or replace function kuratering.kontrollpunkter()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'identitet',
    'viktige_data',
    'viktige_data/referanseomrade',
    'viktige_data/toksisk_omrade',
    'viktige_data/alvorlig_intoksikasjon',
    'viktige_data/halveringstid',
    'viktige_data/steady_state',
    'farmakodynamikk',
    'virkninger',
    'virkninger/Fenomenologi',
    'bivirkninger',
    'toksisitet_forgiftning',
    'toksisitet_forgiftning/Toksisk dose og eksponering',
    'toksisitet_forgiftning/Toksiske konsentrasjoner',
    'toksisitet_forgiftning/Klinisk forgiftningsbilde',
    'toksisitet_forgiftning/Alvorlige komplikasjoner',
    'toksisitet_forgiftning/Toksikokinetiske særtrekk',
    'toksisitet_forgiftning/Behandling ved forgiftning',
    'indikasjon',
    'preparater',
    'dosering',
    'farmakokinetikk',
    'farmakogenetikk',
    'interaksjoner',
    'tdm',
    'laboratorieanalyser',
    'kjemiske_grunndata',
    'serumkonsentrasjoner',
    'graviditet_amming',
    'graviditet_amming/Graviditet',
    'graviditet_amming/Perinatal og neonatal påvirkning',
    'graviditet_amming/Amming',
    'graviditet_amming/Fertilitet og reproduksjon',
    'avhengighet_toleranse',
    'avhengighet_toleranse/fysiologisk_adaptasjon/Toleranseutvikling',
    'avhengighet_toleranse/fysiologisk_adaptasjon/Abstinens, seponeringssyndrom og rebound-effekter',
    'avhengighet_toleranse/laering_motivasjon/Addiksjon',
    'avhengighet_toleranse/laering_motivasjon/Lært mestringsavhengighet'
  ]
$$;
