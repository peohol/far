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
| `supabase/migrations/*_regelredigering_lesing.sql` | `finn_intervallregelsett`: regelsettet for én kode, til analyttsiden |
| `supabase/import/intervallregelsett.json` | Importdatasettet: dagens regler, ett regelsett per linje, med kilden |
| `src/regler/modell.ts` | Formen på et regelsett, felles for appen og databasen |
| `src/regler/import.ts`, `scripts/importer-intervallregelsett.ts` | SQL-en som legger inn datasettet, og porsjoneringen |
| `src/domain/intervallregler.ts` | Motoren: intervallene, regelen en verdi treffer, cut-off og båndene steg 2 viser |
| `src/domain/valg.ts` | `regelsettvalg`: valgene på steg 2 fra et regelsett, med «Til stede under cut-off» sist |
| `src/domain/piller.ts` | Tallene over knappene: ringegrensen og den toksiske grensen fra regelsettet, resten fra datasettet |
| `src/regler/publiserte.ts`, `src/hooks/usePubliserteRegler.ts` | De publiserte regelsettene fortolkningen bruker: hentingen, og oppslaget for én kode |
| `src/components/BandStep.tsx` | Steg 2: knappene, og hva som står i stedet mens reglene hentes eller mangler |
| `src/regler/redigering.ts` | Endringene redigeringen gjør — grenser, deling, sammenslåing, kommentarer, ringing, cut-off — som rene funksjoner |
| `src/regler/visning.ts` | Navnene på nivåer og handlinger, feltene historikken sammenligner, og simulatoren |
| `src/components/regler/` | «Fortolkning» på analyttsiden: tabellen, simulatoren og redigeringen |
| `src/__tests__/intervallregelsett.test.ts` | Import, paritet, validering, tilgang og versjonering, mot en ekte database |
| `src/__tests__/hjelp/dagensregler.ts`, `src/__tests__/data/dagensgrenser.json` | Fasiten fra før byttet: regelsettene og grensene den gamle motoren ga |
| `src/__tests__/fortolkningUendret.test.ts`, `steg2regler.test.tsx` | At klinisk output er den samme som før byttet, og steg 2 på regelsettene i appen |
| `src/__tests__/regelredigering.test.ts`, `analyttside.test.tsx` | Redigeringen, simulatoren og historikken, som rene funksjoner og i siden |

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
(`utgave_som_json`); `finn_intervallregelsett(analyttkode, sidetilstand)` gir
ett av dem, eller `null`. Alle innloggede leser det publiserte; bare
administratorer leser utkastene. Tabellene har bare lesetilgang, og alle
endringer går gjennom `opprett_utkast`, `lagre_utkast`, `publiser_utkast` og
`gjenopprett_revisjon`, som krever administrator. Ingenting slettes.

## Importen av dagens regler

Reglene lå i de statiske datasettene (`src/data/`) og ble fortolket av en
motor i `src/domain/`. De ble lagt inn som regelsett før fortolkningen ble
byttet over.

- **Datasettet** `supabase/import/intervallregelsett.json` er regelsettene
  den gamle motoren ga, med kilden hver revisjon skal vise. Det ble laget med
  den gamle motoren selv, og testene krevde at det var nøyaktig det den ga.
  Kommentar-ID-ene er faste (md5 av analyttkode og hva kommentaren er), så
  importen blir den samme hver gang. Etter byttet er det fasiten (se under).
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

Før byttet ble den nye motoren prøvd mot den gamle på de samme dataene. Den
gamle motoren er borte, men det den ga, står igjen som en frosset **fasit**
(`src/__tests__/hjelp/dagensregler.ts`), med kontrollsum:

- **importdatasettet**, regelsettene og kommentarene ord for ord;
- **`dagensgrenser.json`**: grensene den gamle motoren fortolket etter — nedre
  og øvre grense og ringegrensen — og båndene den ga, skrevet ut med den
  gamle motoren rett før den ble fjernet.

`src/__tests__/intervallregelsett.test.ts` legger inn importen i en ekte
database, leser regelsettene tilbake som en vanlig bruker og krever for hver
analytt:

- at båndene er de samme som den gamle motoren ga: nøkler, grenser, ring og
  rekkefølge, og at knappene og kommentarene er fasitens;
- at cut-off finnes for de samme analyttene, og ringegrensen og ringingen er
  de samme;
- at hver grense, ett og to steg under og over den, og et halvt og en
  tiendedels steg under og over den, gir samme nivå, bånd og ring som den
  gamle motoren.

`src/__tests__/fortolkningUendret.test.ts` lager steg 2 — knappene,
kommentarene, cut-off og pillene — for alle analyttene av fasiten, med den
samme koden appen bruker, og krever den samme kontrollsummen over all
klinisk output som før analyttsidene kom. Den ble ikke endret av byttet.

## I fortolkningen

Appen henter de publiserte regelsettene én gang når den åpnes
(`les_intervallregelsett('publisert')`), og steg 2 bruker regelsettet for
analytten: knappene, kommentarene, «Til stede under cut-off» og tallene over
knappene. Kjernen og stegene henter ingenting selv; regelsettet kommer som et
argument (`Regeloppslag`), og `fortolkningUendret.test.ts` passer på at de
ikke tar inn noe fra databasen eller faginnholdet.

- **Mens reglene hentes,** eller når hentingen feiler eller koden ikke har
  noe publisert regelsett, står en melding i stedet for knappene, og tastene
  gjør ingenting. Uten knapper kan ingen kommentar bli gitt etter andre regler
  enn de publiserte. En feil har «Prøv igjen». Referanseområdet,
  påvisningsgrensen og terapiområdet står likevel; de er fra datasettet.
- **Nye regler** gjelder fra neste gang appen åpnes. En administrator som går
  fra en analyttside tilbake til fortolkningen, får dem hentet på nytt med en
  gang. Har appen alt regelsettene, blir de stående til de nye er hentet.
- **Tallene over knappene:** ringegrensen, og for antihypertensiver den
  toksiske grensen — der det første intervallet på nivået «over» begynner —
  leses av regelsettet. Enheten står på den første pillen, og på en senere
  bare når den har en annen enhet.
- **Datasettene** (`analytter.json`, `antihypertensiver.json`) har ikke lenger
  grensene, ringegrensen eller kommentarene, og byggeskriptene skriver dem
  ikke. Skriptene leser og kontrollerer dem fortsatt, så `meta.rettelser` og
  `meta.avvik` viser hvordan de importerte reglene og tekstene kom fra
  kildedokumentene; det er grunnen til at de står igjen. Resten av
  datasettene er uendret.

## På analyttsiden

Regelsettet vises på analyttsiden for koden, under panelene, som
«Fortolkning»: en tabell med konsentrasjonen, kommentaren og «Ring rekvirent»
— de samme radene, fargene og tekstene som knappene på steg 2 — med
ringegrensen under. Under tabellen er **simulatoren**: en konsentrasjon inn,
og ut intervallet den treffer, nivået, kommentaren og handlingen. Den bruker
`regelsettvalg` og `finnRegel`, altså nøyaktig det steg 2 gir, og kan også
prøve «Til stede under cut-off».

**Redigeringen** (administratorer, i redigeringsmodus) viser intervallene
nedenfra og opp med **grensen mellom hver av dem som ett felt**: den er delt
av to naboer og endres derfor ett sted. Et intervall kan deles i to ved en
ny grense (begge delene får regelen og kommentaren) eller slås sammen med det
over (det nederstes regel beholdes). Kommentaren redigeres der den brukes;
brukes den av flere intervaller eller av cut-off, sies det, og intervallet
kan få sin egen eller ta i bruk en annen. «Ring rekvirent fra og med» velger
intervallet ringingen begynner i, og ringegrensen vises som grensen selv
eller ett steg under. Cut-off slås av og på, med innledningen og hvilken
kommentar den settes foran. Simulatoren prøver skjemaet slik det står.

Funksjonene i `redigering.ts` holder regelsettet slik databasen krever det
etter hver endring: kommentarer ingen bruker, tas bort; cut-off følger med
når intervallet den bygde på, slås sammen eller får en annen kommentar; og
ringingen og ringegrensen følger grensene. Testen kjører en rekke endringer
på hvert av de importerte regelsettene og krever at databasen godtar
resultatet.

Alt lagres som utkast i én revisjon mot den brukeren åpnet. Har noen andre
lagret i mellomtiden, står det brukeren har gjort, og hen kan sammenligne med
det de lagret (feltene som er ulike, rødt og grønt) og velge å forkaste sitt
eller lagre over deres. Publiseringen skjer med resten av siden, og
oppsummeringen før den sier hvilke felt i regelsettet som endres. «Sist
redigert» åpner historikken, der en tidligere revisjon kan sammenlignes og
gjenopprettes som en ny (se `docs/faginnhold.md`).

## Når noe skal endres

**Nytt felt på regelsettet.** Legg det i `modell.ts`, i
`skriv_intervallregelsett` og `les_intervallregelsett` (ny migrasjon), med en
standardverdi i skrivingen så eldre revisjoner fortsatt kan gjenopprettes.

**Ny handling eller enhet.** En ny verdi i `regelhandling` (egen migrasjon,
som for en ny objekttype) og i `REGELHANDLINGER`; en ny rad i
`maleenheter` og i `MALEENHETER`. Testen sammenligner begge med koden.

**Ny import.** Legg dataene i et importdatasett med kilde, lag SQL-en med
`npm run import:intervallregelsett -- <brukernavn> <fil> --migrering --del i/n`,
rull den ut med `apply_migration` og gi fila versjonen prosjektet registrerte.
