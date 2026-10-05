# Fortolkningsregler i Supabase

Leses når noe som har med konsentrasjonsreglene, kommentarene fortolkningen
gir, «ring rekvirent» eller cut-off å gjøre skal endres. Planen og fremdriften
står i `docs/stoffsider-og-redigering.md` (arbeidspakke 5); maskineriet med
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
| `supabase/migrations/*_regelredigering_lesing.sql` | `finn_intervallregelsett`: regelsettet for én kode, til redigeringen av fortolkningen |
| `supabase/migrations/*_intervallregelsett_kommentarobjekter.sql`, `*_flytt_regelsettkommentarer.sql` | Reglene peker på de felles kommentarobjektene, `lagre_intervallregelsett`, og flyttingen av tekstene dit. Lagringen av kommentarene er felles med scenarioreglene (`intern.lagre_kommentarendringer` i `*_lagre_scenarioregelsett.sql`) |
| `supabase/import/intervallregelsett.json` | Importdatasettet: dagens regler, ett regelsett per linje, med kilden |
| `src/regler/modell.ts` | Formen på et regelsett, felles for appen og databasen |
| `src/regler/kommentarer.ts` | Regelsettet satt sammen med tekstene i kommentarobjektene, og tatt fra hverandre igjen når det lagres |
| `src/regler/import.ts`, `scripts/importer-intervallregelsett.ts` | SQL-en som legger inn datasettet, og porsjoneringen |
| `src/domain/intervallregler.ts` | Motoren: intervallene, regelen en verdi treffer, cut-off og båndene steg 2 viser |
| `src/domain/valg.ts` | `regelsettvalg`: valgene på steg 2 fra et regelsett, med «Til stede under cut-off» sist |
| `src/domain/piller.ts` | Tallene over knappene: referanseområdet fra fagsiden, ringegrensen og den toksiske grensen fra regelsettet, resten fra datasettet |
| `supabase/migrations/*_referanseomrader_lesing.sql` | `les_referanseomrader`: referanseområdet på fagsiden for hver kode |
| `src/regler/publiserte.ts`, `src/hooks/usePubliserteRegler.ts` | De publiserte regelsettene fortolkningen bruker: hentingen (`lesPubliserteRegelsett` i `kommentarer.ts`), og oppslaget for én kode |
| `src/components/BandStep.tsx` | Steg 2: knappene, og hva som står i stedet mens reglene hentes eller mangler |
| `src/regler/redigering.ts` | Endringene redigeringen gjør — grenser, deling, sammenslåing, kommentarer, ringing, cut-off — som rene funksjoner |
| `src/regler/visning.ts` | Navnene på nivåer og handlinger, feltene historikken sammenligner, og simulatoren |
| `src/components/regler/` | Redigeringssiden for fortolkningen (`Fortolkningsredigering.tsx`, `useFortolkningsredigering.ts`) med tabellen, simulatoren og redigeringen. Feltene, lagringen med konflikten (`Regelfelter.tsx`) og historikken under reglene (`Regelhistorikk.tsx`) er felles med scenarioreglene |
| `src/__tests__/intervallregelsett.test.ts` | Import, paritet, validering, tilgang og versjonering, mot en ekte database |
| `src/__tests__/kommentarflytting.test.ts` | Flyttingen av tekstene til kommentarobjekter, på de historiske importfilene |
| `src/__tests__/hjelp/dagensregler.ts`, `src/__tests__/data/dagensgrenser.json` | Fasiten fra før byttet: regelsettene og grensene den gamle motoren ga |
| `src/__tests__/fortolkningUendret.test.ts`, `steg2regler.test.tsx` | At klinisk output er den samme som før byttet, og steg 2 på regelsettene i appen |
| `src/__tests__/referanseomrader.test.ts`, `src/__tests__/data/referanseomrader.json` | Lesingen av referanseområdene, og referanseområdene fasiten bruker |
| `src/__tests__/regelredigering.test.ts`, `fortolkningsredigering.test.tsx` | Redigeringen, simulatoren og historikken, som rene funksjoner og på redigeringssiden |

## Modellen

Et **regelsett** er ett redigerbart objekt (objekttypen `intervallregelsett`)
per analyttkode. Det har utkast, publisering, revisjoner og gjenoppretting
som alt annet faginnhold, og hele regelsettet — grensene og reglene — står i
det samme øyeblikksbildet. Derfor lagres, publiseres og gjenopprettes det
alltid helt, aldri halvveis. Tekstene er ikke en del av det: reglene peker på
**kommentarobjekter** (objekttypen `kommentar`, `docs/faginnhold.md`), som har
sin egen historikk og publisering.

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
}
```

- **Kommentar og regel er separate objekter.** `<id>` er ID-en til et
  kommentarobjekt i `kommentarer`; reglene i `intervallregler` peker på det,
  og regelsettet inneholder, versjonerer og publiserer ikke tekstene. Flere
  regler og regelsett kan bruke samme kommentar uten at teksten dupliseres.
  En konsentrasjonsregel limer inn teksten som den står, så kommentaren kan
  ikke ha plassholdere. Det publiserte regelsettet kan bare peke på
  publiserte kommentarer, som resten av faginnholdet (`krev_objekttype`).
- **Appen setter dem sammen.** `Intervallregelsettinnhold` er formen som
  lagres; `Intervallregelsett` har i tillegg `kommentarer: [{ id, tekst }]`,
  tekstene slått opp i kommentarobjektene (`medKommentarer`), som motoren,
  steg 2 og redigeringen bruker. Mangler en tekst, er det en feil, ikke en
  tom kommentar.
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
laboratorieanalytten. Stoff, laboratorieanalytt og fortolkningsmodul er
separate begreper: regelsettet hører til koden (HBUP-reglene til HBUP), og
finnes også for koder som ikke er koblet til noe stoff.

## Valideringen

`intern.skriv_intervallregelsett` avviser, med en norsk melding (feilkode
`22023`), alt som ikke er et gyldig regelsett: ukjent eller manglende enhet,
desimaler utenfor 0–6, grenser som ikke er positive, har for mange desimaler
eller ikke stiger, feil antall intervaller, ukjent nivå eller handling,
manglende kommentar, en kommentar som ikke er et kommentarobjekt eller har
plassholdere, nivåer som går nedover, feil med ringingen eller ringegrensen,
en cut-off som ikke bygger på en av kommentarene, og ukjente felt. En
analyttkode kan bare ha ett regelsett.

Etter skrivingen kontrollerer `intern.krev_sammenhengende_intervaller` de
lagrede radene: intervallene nummerert fortløpende, det første åpent nedover,
det siste åpent oppover og ingen hull eller overlapp. Den fanger også rader som
er endret utenom funksjonen.

Revisjonene fra før tekstene ble egne objekter, har i tillegg feltet
`kommentarer` med tekstene. De kan fortsatt gjenopprettes: skrivingen godtar
feltet når ID-ene i det er nøyaktig dem reglene bruker, og legger ikke
tekstene inn igjen — de har sin egen historikk i kommentarobjektene.

## Lesingen og tilgangen

`les_intervallregelsett(sidetilstand)` gir alle regelsettene i én tilstand,
sortert på analyttkode, i samme form som de andre objekttypene
(`utgave_som_json`); `finn_intervallregelsett(analyttkode, sidetilstand)` gir
ett av dem, eller `null`. Alle innloggede leser det publiserte; bare
administratorer leser utkastene. Tabellene har bare lesetilgang, og alle
endringer går gjennom `opprett_utkast`, `lagre_utkast`, `publiser_utkast`,
`gjenopprett_revisjon` og `lagre_intervallregelsett` (under), som krever
administrator. Ingenting slettes. Tekstene leses med
`les_kommentarer(tilstand, ider)`: appen leser de publiserte regelsettene og
kommentarene i to kall.

## Importen av dagens regler

Reglene lå i de statiske datasettene (`src/data/`) og ble fortolket av en
motor i `src/domain/`. De ble lagt inn som regelsett før fortolkningen ble
byttet over.

- **Datasettet** `supabase/import/intervallregelsett.json` er regelsettene
  den gamle motoren ga, med kilden hver revisjon skal vise. Det ble laget med
  den gamle motoren selv, og testene krevde at det var nøyaktig det den ga.
  Kommentar-ID-ene er faste (md5 av analyttkode og hva kommentaren er), så
  importen blir den samme hver gang. Etter byttet er det fasiten (se under).
- **SQL-en** (`regelimportSql`) lager kommentarobjektene med de faste ID-ene
  (`intern.opprett_objekt`) og så regelsettene, og publiserer dem, som
  administratoren som bestilte importen (Peder,
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
- **Flyttingen av tekstene.** De historiske importfilene la tekstene i
  regelsettene, i en egen tabell (`regelsettkommentarer`).
  `*_flytt_regelsettkommentarer.sql` gjør hver av dem til et kommentarobjekt
  med den samme ID-en og teksten tegn for tegn, med et navn som sier hva den
  brukes til («AMIS – innenfor referanseområdet»; det samme `kommentarnavn`
  gir), lagrer hvert regelsett på nytt uten tekstene som en ny revisjon,
  publiserer alt og fjerner tabellen. Den stopper hvis et regelsett har
  endringer som ikke er publisert. `kommentarflytting.test.ts` kjører den på
  de historiske importfilene og krever det samme som en import rett inn i den
  nye formen, og den samme fortolkningen.

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
klinisk output som før fagsidene kom. Den ble ikke endret av byttet, men
én gang senere, med vilje, for referanseområdet (se «I fortolkningen»).

## I fortolkningen

Appen henter de publiserte regelsettene og kommentarene én gang når den
åpnes (`lesPubliserteRegelsett`), sammen med referanseområdene
(`les_referanseomrader`), og steg 2 bruker det som gjelder analytten:
knappene, kommentarene, «Til stede under cut-off» og tallene over knappene.
Kjernen og stegene henter ingenting selv; regelsettet og referanseområdet
kommer som et argument (`Regeloppslag`), og `fortolkningUendret.test.ts` passer på at de
ikke tar inn noe fra databasen eller faginnholdet.

- **Mens reglene hentes,** eller når hentingen feiler eller koden ikke har
  noe publisert regelsett, står en melding i stedet for knappene, og tastene
  gjør ingenting. Uten knapper kan ingen kommentar bli gitt etter andre regler
  enn de publiserte. En feil har «Prøv igjen». Påvisningsgrensen og
  terapiområdet står likevel; de er fra datasettet.
- **Nye regler** gjelder fra neste gang appen åpnes. En administrator som
  publiserer på redigeringssiden, får dem hentet på nytt med en gang. Har appen alt regelsettene, blir de stående til de nye er hentet.
- **Tallene over knappene:** ringegrensen, og for antihypertensiver den
  toksiske grensen — der det første intervallet på nivået «over» begynner —
  leses av regelsettet. Enheten står på den første pillen, og på en senere
  bare når den har en annen enhet.
- **Referanseområdet** under analyttnavnet er kortet «Referanseområde» i
  «Viktige data» på hovedsiden til koden — de samme tallene som
  fagsiden viser, fra samme rad i databasen, og endret når kortet
  endres og publiseres. Det står når det er hentet, og ikke for en kode uten
  kortet. Med dette ble tre av tallene steg 2 viste, annerledes enn før:
  BREK 50–350 (før 50–330), DOKSUM 180–550 (før 18–550) og LMP 10–300 (før
  «< 300»), slik Peder bestemte. Fasiten for klinisk output
  (`fortolkningUendret.test.ts`) ble endret for akkurat det, og bruker
  referanseområdene slik de står på fagsidene
  (`src/__tests__/data/referanseomrader.json`).
- **Datasettene** (`analytter.json`, `antihypertensiver.json`) har ikke lenger
  grensene, ringegrensen, kommentarene eller referanseområdet, og
  byggeskriptene skriver dem ikke. Skriptene leser og kontrollerer dem fortsatt, så `meta.rettelser` og
  `meta.avvik` viser hvordan de importerte reglene og tekstene kom fra
  kildedokumentene; det er grunnen til at de står igjen. Resten av
  datasettene er uendret.

## Redigeringssiden

Fagsidene og fortolkningen er adskilt: fagsidene viser ingen regler. I
fortolkningen har administratorer knappen «Rediger fortolkningen» (blyanten i
toppmenyen) når modulen har regler. Den åpner en egen side over
fortolkningen, `#/fortolkning/<nøkkel>/rediger`, med alle delene av reglene
modulen gir: scenarioreglene (`docs/scenarioregler.md`), THC-syrereglene
(`docs/thc-syre.md`) og konsentrasjonsreglene for hver kode i modulen
(`analytterForFortolkning` i `src/domain/koblinger.ts`). Hver del er en seksjon
i den felles seksjonsmodellen (`docs/seksjoner.md`). Er det bare én, står den
åpen med en gang; ellers står bare én åpen om gangen, og hver har sin tittel og adresse,
`#/fortolkning/diaz-dmi-oxa/rediger/fortolkning-dmi` osv. (og et detaljkort i den, `…/fortolkning-dmi/simulator`). Siden viser alltid
utkastet, toppmenyen har den samme statusen, publiseringen og «Avslutt
redigering» som fagsidene, og `Escape` går tilbake til fortolkningen. For andre
enn administratorer er adressen bare fortolkningen. Den gamle adressen
`#/analytt/<KODE>/fortolkning` fører til fortolkningen for koden.

Konsentrasjonsreglene er seksjonen «Fortolkning». Lukket sier den hvor mange områder det er, og
ringegrensen og cut-off når de finnes. Åpnet viser den en tabell med
konsentrasjonen, kommentaren og «Ring rekvirent» — de samme radene, fargene og
tekstene som knappene på steg 2 — med ringegrensen under. Under tabellen er
detaljkortet **Simulator** (`…/fortolkning/simulator`): en konsentrasjon inn,
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

Alt lagres som utkast i én transaksjon med `lagre_intervallregelsett`:
regelsettet, og de kommentarene som er nye eller har fått en annen tekst,
hver mot revisjonen brukeren åpnet. En ny kommentar får et navn etter hva den
brukes til. Har noen andre lagret regelsettet eller en av kommentarene i
mellomtiden, lagres ingenting, står det brukeren har gjort, og hen kan sammenligne med
det de lagret (feltene som er ulike, rødt og grønt) og velge å forkaste sitt
eller lagre over deres. Publiseringen skjer med resten av redigeringssiden
(`regelplan` i `src/faginnhold/stoffside.ts`), kommentarene før regelsettet, og oppsummeringen før den sier hva som endres. «Sist
redigert» åpner historikken, der en tidligere revisjon kan sammenlignes og
gjenopprettes som en ny (se `docs/faginnhold.md`): for regelsettet, der
kommentarene vises med navnet, og for hver kommentar for seg, ord for ord, i
detaljkortet «Historikken for hver kommentar».

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
