# Farmakodynamikk: mekanismekortene, ikonene og fargene

Les dette før du lager eller endrer et ikon, en mekanismetype eller en farge
for farmakodynamikken. Reglene er Peders (2026-10-01).

Filene:

| Fil | Hva |
| --- | --- |
| `src/faginnhold/mekanismer.ts` | Mekanismetypene (`MEKANISMER`), virkningene (`VIRKNINGER`), systemene (`SYSTEMER`) og subtypene i målnavnene (`subtypedeler`) |
| `src/components/ikon/register.ts` | Tegningene (`mek…`), og byggeklossene over `REGISTER`: `membran`, `reseptor`, `kanal`, `transportor`, `enzym`, `stoff`, `modulator`, `substrat` |
| `src/components/stoffside/panelvisning.ts` | Hvilket ikon hver mekanisme har (`MEKANISMEIKONER`) |
| `src/components/stoffside/Mekanismevisning.tsx` | Effektpillen, målnavnet med senket subtype, og klassene på kortet |
| `src/styles/tokens.css` | `--virkning-*` og `--system-*`, i lyst og mørkt tema |
| `src/styles/ikon.css` | Rollene `o1`/`o2`, fargene `system` og `virkning-*`, klassene `.system-<navn>` og animasjonene |
| `src/__tests__/farmakodynamikk.test.ts` | Kontrollerer reglene under |

## Kortet

- **Lukket:** ikonet, målet som tittel og effekten som en pille. Ingenting
  annet.
- **Tittelen** er målet slik kilden navngir det. Subtypen vises senket: D₁,
  AT₁, 5-HT₂C, α₂, GABA_A. Den lagres som vanlig tekst («D1-reseptor») og
  senkes når den vises (`subtypedeler`); en ny reseptorfamilie legges til i
  `SUBTYPE` i `mekanismer.ts`.
- **Pillen** er effekten så kort som mulig, helst ett ord («Agonist»,
  «Hemmer», «Ingen effekt»), i trafikklysfargen for virkningen. Teksten kommer
  fra mekanismetypen (`effekt`), ikke fra fri tekst, så den alltid stemmer
  med fargen og ikonet. Det står aldri «Effekt:» foran.
- **Kanten** til venstre har samme trafikklysfarge, dempet.
- **Åpnet** viser kortet bare den utdypende teksten og kildene. Kortet åpnes
  bare når det har noe mer å vise.
- Dataene er `{ maal, mekanisme, dokument? }`. Mekanismen bestemmer alene
  pillen, fargen og ikonet.

## Fargene

To fargesystemer, med hver sin jobb:

**Virkningen er et trafikklys** (`VIRKNINGER`, `--virkning-*`). Den gjelder
den direkte aktiviteten på målet, ikke nedstrøms virkninger.

| Virkning | Farge | Brukes til |
| --- | --- | --- |
| `okt` | grønn (`--referanse`) | øker aktiviteten: agonist, positiv modulator |
| `delvis` | gul (`--toksisk`) | øker aktiviteten litt: partiell agonist |
| `redusert` | rød (`--alvorlig`) | reduserer eller snur aktiviteten: antagonist, invers agonist, hemmer, blokker, negativ modulator |
| `noytral` | grå (`--glass`) | ingen eller ukjent effekt: «Ingen effekt», «Binder», «Påvirker» |

Trafikklyset brukes på stoffet i ikonet, pillen og kanten på kortet — aldri
på målproteinet.

**Systemet har en fast farge** (`SYSTEMER`, `--system-*`). Målproteinet får
fargen til systemet det hører til, uansett hva stoffet gjør med det.
Reseptorer, reopptaksproteiner og andre proteiner i samme system har samme
farge. Fargene er dempede, så de ikke konkurrerer med trafikklyset.

| System | Farge | Eksempler |
| --- | --- | --- |
| `dopamin` | grønn | D₁–D₅, DAT |
| `noradrenalin` | blå | α₁, α₂, β₁, β₂, NET |
| `serotonin` | gul | 5-HT-reseptorer, SERT |
| `histamin` | lilla | H₁ |
| `opioid` | oransje | μ, κ, δ |
| `glutamat` | rosa | NMDA, AMPA, mGlu |
| `gaba` | indigo | GABA_A, GABA-reopptak |
| `acetylkolin` | turkis | muskarine og nikotinerge reseptorer |
| `raas` | brun | ACE, AT₁, aldosteron-/mineralokortikoidreseptor |
| `hormon` | oliven | kjønnshormon- og andre hormonreseptorer |
| `ioner` | himmelblå | ionekanaler og kotransportører utenfor systemene over |
| (ingen) | grå (`--glass`) | navnet passer ikke noe system |

Systemet leses av navnet på målet med mønstrene i `SYSTEMER`; det første som
passer, vinner. Kortet setter klassen `.system-<navn>`, som setter
`--system-farge`, og ikonet tegner målet med fargen `system`.

**Et nytt system:** legg det til i `SYSTEMER` (med mønsteret på riktig plass i
rekkefølgen), legg `--system-<navn>` i begge temaene i `tokens.css` og
`.system-<navn>` i `ikon.css`, og før det opp i tabellen over. Velg en dempet
farge som skiller seg fra de andre systemene; unngå rødt, som er trafikklysets.
Testen stopper om tokenet eller klassen mangler.

## Ikonene

Ikonene tegnes i 48-rutenettet med byggeklossene i `register.ts`. Rollen
avgjør hvordan en flate males:

- **Målproteinet er ugjennomsiktig** (`o1`, farge `system`), og tegnes etter
  membranen, så membranen ikke synes gjennom proteinet. Bruk aldri `f1`/`f2`
  (gjennomskinnelig) på noe som ligger over noe annet.
- **Stoffet er ugjennomsiktig** (`o2`, trafikklysfargen) og tegnes til slutt.

### Stoffet

Stoffet er alltid en halvsirkel med flatsiden vendt mot målet (`stoff`):

- **Med utstikker** fra flatsiden ned i bindingssetet (eller poren, eller det
  aktive setet): stoffet binder *og* virker der. Agonist (grønn), partiell
  agonist (gul), invers agonist (rød), kanalblokker, reopptakshemmer og
  enzymhemmer (rød).
- **Uten utstikker**, liggende oppå setet, som står tomt: stoffet binder uten
  å aktivere. Antagonist (rød), og «Binder»/«Påvirker» (grå).
- **Allosterisk modulator** (`modulator`): halvsirkelen binder på siden av
  målet, ikke i bindingssetet. Positiv (grønn): kanalen åpnes mer enn normalt.
  Negativ (rød): kanalen lukker seg.

### Målene

| Mål | Kloss | Kjennetegn |
| --- | --- | --- |
| Reseptor | `reseptor` | kantet protein gjennom membranen, bindingssetet som et hakk øverst |
| Ionekanal | `kanal(apning)` | to underenheter med poren mellom; `apning` er bredden |
| Transportør | `transportor` | avrundet protein gjennom membranen, inngangen øverst og veien gjennom stiplet |
| Enzym | `enzym` | løst, rundt protein uten membran, med det aktive setet øverst |

Signalstoffet eller substratet (`substrat`) er små prikker i systemfargen.
Ioner er prikker i `info`.

### Mekanismene i dag

| Mekanisme | Ikon | Tegning |
| --- | --- | --- |
| Agonist | `mekAgonisme` | reseptor, grønt stoff med utstikker |
| Partiell agonist | `mekPartiellAgonisme` | reseptor, gult stoff med utstikker |
| Antagonist | `mekAntagonisme` | reseptor, rødt stoff uten utstikker |
| Kompetitiv antagonist | `mekKompetitivAntagonisme` | som antagonist, og en liten grønn agonist som skyves bort |
| Invers agonist | `mekInversAgonisme` | reseptor, rødt stoff med utstikker |
| Positiv modulator | `mekPositivModulering` | vid kanal med ioner, grønn modulator på siden |
| Negativ modulator | `mekNegativModulering` | lukket kanal, ionet utenfor, rød modulator på siden |
| Binder / Påvirker (reseptor) | `mekReseptor` | reseptor, grått stoff uten utstikker |
| Kanalblokkering | `mekKanalblokkering` | kanal, rødt stoff med utstikker i poren |
| Bruksavhengig blokkering | `mekBruksavhengigBlokkering` | som kanalblokkering, med aksjonspotensialer over |
| Påvirker (ionekanal) | `mekIonekanal` | kanal, grått stoff uten utstikker |
| Reopptakshemmer | `mekReopptakshemming` | transportør, rødt stoff i inngangen, signalstoff som blir stående ute |
| Hemmer (transportør) | `mekTransporterhemming` | transportør, rødt stoff i inngangen, ett substrat |
| Hemmer (kotransportør) | `mekKotransporterhemming` | transportør, rødt stoff i inngangen, to ulike ioner |
| Påvirker (transportør) | `mekTransportor` | transportør, grått stoff uten utstikker |
| Hemmer (enzym) | `mekEnzymhemming` | enzym, rødt stoff i det aktive setet, substratet skyves bort |
| Ingen effekt | — | ingen ikon, med vilje |

### Animasjonene

Ikonet spilles én gang når kortet kommer i bildet og når pekeren eller
fokuset kommer til det. Stoffet faller på plass (`drop`); det som skyves
bort, glir ut (`bumpR`); en kanal som åpnes eller lukkes, glir på plass etter
at modulatoren har bundet (`glidR`/`glidL`, som står stille i begynnelsen).

**Hver animasjon skal ende der tegningen står (identitet), og ingen må bruke
`animation-fill-mode`.** En animasjon som holder sluttverdien, får Chromium
til å tegne delen som et bilde, og ikonet blir uskarpt i hvile. Tegn derfor
sluttilstanden (den lukkede kanalen, den vide poren) og la animasjonen starte
et annet sted og gli dit.

## Ny mekanisme eller nytt ikon

1. Legg typen i `MEKANISMER` med familie, navnet i redigeringen (med
   presiseringen i parentes når typen er generell), effekten i pillen og
   virkningen. Ikke gjør typen mer presis enn kildene den er laget for.
2. Tegn ikonet i `register.ts` med byggeklossene, etter prinsippene over:
   målet i `system`, stoffet som halvsirkel i trafikklysfargen, utstikker bare
   når stoffet fyller setet. Trenger du et nytt mål, lag en ny kloss ved siden
   av de andre, ugjennomsiktig (`o1`).
3. Koble typen til ikonet i `MEKANISMEIKONER`. En generell type deler ikonet
   for familien sin; en spesifikk type har sitt eget.
4. Før den opp i tabellen over, og kjør `npm test`.
