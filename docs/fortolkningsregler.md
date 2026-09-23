# Fortolkningsregler i Supabase

Leses når noe som har med konsentrasjonsreglene, kommentarene fortolkningen
gir, «ring rekvirent» eller cut-off å gjøre skal endres. Planen og fremdriften
står i `docs/analyttsider-og-redigering.md` (arbeidspakke 5); maskineriet med
utkast, publisering og revisjoner i `docs/faginnhold.md`. Her står hvordan
reglene faktisk er bygget.

Regelsettene er de enkle konsentrasjonsreglene: én analyttkode, én målt
konsentrasjon, én kommentar og eventuelt «ring rekvirent». De sammensatte
rusmiddelreglene og THC-syre har egne regeltyper.

## Delene

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_intervallregelsett_objekttype.sql`, `*_intervallregelsett.sql` | Objekttypen, tabellene, valideringen og lesingen |
| `supabase/migrations/*_importer_intervallregelsett_1.sql` … `_6.sql` | Importen av dagens regler, i seks porsjoner |
| `supabase/import/intervallregelsett.json` | Importdatasettet: dagens regler, ett regelsett per linje, med kilden |
| `src/regler/modell.ts` | Formen på et regelsett, felles for appen og databasen |
| `src/regler/import.ts`, `scripts/importer-intervallregelsett.ts` | SQL-en som legger inn datasettet, og porsjoneringen |
| `src/domain/intervallregler.ts` | Motoren: intervallene, regelen en verdi treffer, cut-off og båndene steg 2 viser |
| `src/domain/valg.ts` | `regelsettvalg`: valgene på steg 2 fra et regelsett, i samme form som fra datasettet |
| `src/__tests__/intervallregelsett.test.ts` | Import, paritet, validering, tilgang og versjonering, mot en ekte database |
| `src/__tests__/hjelp/regelimport.ts` | Dagens regler gjort om til regelsett med den gamle motoren — fasiten |

## Modellen

Et **regelsett** er ett redigerbart objekt (objekttypen `intervallregelsett`)
per analyttkode. Det har utkast, publisering, revisjoner og gjenoppretting
som alt annet faginnhold, og hele regelsettet — grensene, reglene og
kommentarene — står i det samme øyeblikksbildet. Derfor lagres, publiseres og
gjenopprettes det alltid helt, aldri halvveis.

```ts
{
  analyttkode: 'AMIS',
  enhet: 'nmol/L',            // fra tabellen maleenheter
  desimaler: 0,               // oppløsningen verdiene oppgis med
  skillepunkter: [10, 1800],  // n grenser gir n + 1 intervaller
  intervaller: [              // nedenfra og opp
    { niva: 'under',    handling: null,             kommentar: '<id>' },
    { niva: 'innenfor', handling: null,             kommentar: '<id>' },
    { niva: 'over',     handling: 'ring_rekvirent', kommentar: '<id>' },
  ],
  ringegrense: 1800,          // tallet som vises som ringegrense
  cutoff: { innledning: '<id>', kommentar: '<id>' },  // eller null
  kommentarer: [{ id: '<id>', tekst: '…' }],
}
```

- **Kommentar og regel er separate.** Kommentarene står i
  `regelsettkommentarer` med en stabil ID, reglene i `intervallregler` og
  peker på dem. Flere regler kan bruke samme kommentar uten at teksten
  dupliseres. En kommentar er ren tekst på én linje (den limes inn i
  laboratoriesystemet som den står), 1–4000 tegn. En kommentar ingen regel
  bruker, avvises.
- **Intervallene er `[fra, til)`:** nedre grense med, øvre utenfor. Det
  første er åpent nedover og det siste åpent oppover. Det som lagres, er
  **skillepunktene**, så to naboer deler alltid den samme grensen: det finnes
  ingen måte å skrive et hull eller en overlapp på, og et skillepunkt endres
  på ett sted. Tabellen har `fra` og `til` for lesing og kontroll; de skrives
  bare av `skriv_intervallregelsett`.
- **Knappene på steg 2** viser hele steg: `[10, 1800)` med 0 desimaler er
  «10 – 1799». En verdi mellom to steg (1799,5) hører til intervallet under
  grensen, som i dag.
- **«Ring rekvirent»** er handlingen `ring_rekvirent` på regelen, ikke en
  del av teksten. `ringegrense` er tallet som vises, og må stemme med
  intervallene: det første intervallet som ringer, begynner på ringegrensen
  eller ett steg over den (for regler som er «over ringegrensen», slik
  DOKSUM, FLUP og ZUKLO har i dag). Fra dette intervallet og opp må alle
  ringe, og det nederste kan aldri det.
- **«Til stede under cut-off»** er en innledning (egen kommentar) satt foran
  en av kommentarene intervallene bruker, med mellomrom mellom. Hovedteksten
  står altså bare én gang.
- **Nivåene** (`under`, `innenfor`, `over`) følger konsentrasjonen: de kan
  gjentas (to «innenfor»-intervaller der bare det øverste ringer), men ikke
  gå nedover.

`intervallregelsett` peker på analyttkoden som tekst, ikke på
laboratorieanalytten. Informasjonsside, laboratorieanalytt og
fortolkningsmodul er separate begreper, og regelsettet skal kunne finnes også
for koder som ikke har en side.

## Valideringen

`intern.skriv_intervallregelsett` avviser, med en norsk melding (feilkode
`22023`), alt som ikke er et gyldig regelsett: ukjent eller manglende enhet,
desimaler utenfor 0–6, grenser som ikke er positive, har for mange desimaler
eller ikke stiger, feil antall intervaller, ukjent nivå eller handling,
manglende kommentar, nivåer som går nedover, feil med ringingen eller
ringegrensen, en cut-off som ikke bygger på en av kommentarene, og ukjente
felt. En analyttkode kan bare ha ett regelsett.

Etter skrivingen kontrollerer `intern.krev_sammenhengende_intervaller` de
lagrede radene: intervallene nummerert fortløpende, det første åpent nedover,
det siste åpent oppover og ingen hull eller overlapp. Den fanger også rader som
er endret utenom funksjonen.

Kommentartabellen og funksjonene for den er felles for alle regeltyper:
`intern.skriv_regelsettkommentarer(objekt, tilstand, kommentarer)`,
`intern.les_regelsettkommentarer(objekt, tilstand)` og
`intern.krev_brukte_kommentarer(objekt, tilstand, brukte_id-er)`. En ny
regeltype har sin egen tabell for reglene og bruker disse for kommentarene.

## Lesingen og tilgangen

`les_intervallregelsett(sidetilstand)` gir alle regelsettene i én tilstand,
sortert på analyttkode, i samme form som de andre objekttypene
(`utgave_som_json`). Alle innloggede leser det publiserte; bare
administratorer leser utkastene. Tabellene har bare lesetilgang, og alle
endringer går gjennom `opprett_utkast`, `lagre_utkast`, `publiser_utkast` og
`gjenopprett_revisjon`, som krever administrator. Ingenting slettes.

## Importen av dagens regler

Dagens regler ligger i de statiske datasettene (`src/data/`). De er lagt inn
som regelsett, uten at fortolkningen er byttet over.

- **Fasiten** er `regelsettFraAnalytt` i `src/__tests__/hjelp/regelimport.ts`.
  Den bygger regelsettene med den gamle motoren selv (`bands` og
  cut-off-teksten i `valg.ts`), så regelsettene er nøyaktig det dagens motor
  gir. Kommentar-ID-ene er faste (md5 av analyttkode og hva kommentaren er),
  så importen blir den samme hver gang.
- **Datasettet** `supabase/import/intervallregelsett.json` er fasiten skrevet
  ut, med kilden hver revisjon skal vise. Testen krever at det er likt
  fasiten.
- **SQL-en** (`regelimportSql`) går gjennom `opprett_utkast` og
  `publiser_utkast`, som administratoren som bestilte importen (Peder,
  `peohol`), med kilden i `far.revisjonskilde`. Den har en kontrollsum for
  dataene og stopper før noe er lagt inn hvis de er endret underveis. Et
  regelsett som finnes, hoppes over, så den kan kjøres igjen.
- **Utrullingen.** SQL-verktøyet i MCP kan bare lese, så importen er rullet ut
  som datamigreringer, delt i seks porsjoner (`importdel`) så hver er liten nok.
  I en tom database (testene, en ny gren) finnes ikke administratoren, og da
  gjør migreringene ingenting. Testen krever at filene til sammen er nøyaktig
  importen av datasettet.
- **Kontrollen i produksjon.** Etter utrullingen ga en kontrollsum over alle
  regelsettene, reglene, kommentarene og revisjonene (innhold og kilde) det
  samme i produksjonen som i testdatabasen etter den samme importen: 60
  publiserte regelsett, alle av `peohol`.

## Pariteten

`src/__tests__/intervallregelsett.test.ts` legger inn importen i en ekte
database, leser regelsettene tilbake og krever for hver analytt:

- at valgene på steg 2 fra regelsettet (`regelsettvalg`) er nøyaktig de samme
  som fra datasettet (`valgene`): nøkler, grenser, tekst, ring og rekkefølge;
- at cut-off-teksten, ringegrensen og ringingen er de samme;
- at hver grense, ett og to steg under og over den, og et halvt og en
  tiendedels steg under og over den, gir samme nivå, kommentar og ring i
  begge motorene.

Byttet av fortolkningen til regelsettene gjøres for seg, med
`fortolkningUendret.test.ts` og kontrollsummen over all klinisk output som
vakt.

## Når noe skal endres

**Nytt felt på regelsettet.** Legg det i `modell.ts`, i
`skriv_intervallregelsett` og `les_intervallregelsett` (ny migrasjon), med en
standardverdi i skrivingen så eldre revisjoner fortsatt kan gjenopprettes.

**Ny handling eller enhet.** En ny verdi i `regelhandling` (egen migrasjon,
som for en ny objekttype) og i `REGELHANDLINGER`; en ny rad i
`maleenheter`. Testen sammenligner enum-verdiene med koden.

**Ny import.** Legg dataene i et importdatasett med kilde, lag SQL-en med
`npm run import:intervallregelsett -- <brukernavn> <fil> --migrering --del i/n`,
rull den ut med `apply_migration` og gi fila versjonen prosjektet registrerte.
