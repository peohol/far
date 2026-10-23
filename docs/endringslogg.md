# Loggføringsprotokoll

Leses som **siste steg før en PR er klar til å slås sammen** — ikke underveis i
arbeidet. Da er det klart hva endringen faktisk ble, og føringen kan skrives én
gang i stedet for å måtte rettes for hver push.

## 0. Er det en stille designjustering?

En PR som **bare** justerer hvordan appen ser ut, uten at det betyr noe for hva
den gjør eller hva den viser, er stille: den får **ingen føring**, ingen ny
versjon (`package.json` står urørt), intet varsel og ingen melding om å
oppdatere siden. Slikt er bare støy for brukerne, og de får endringen neste
gang de laster siden uansett.

Stille er for eksempel:

- luft: margin, padding, gap, linjeavstand, justering av plassering
- størrelser: bredder, høyder, ikoner, avrundinger, skygger
- overganger og animasjoner

Ikke stille — skal ha føring etter resten av protokollen:

- all tekst i grensesnittet, og alt faglig innhold
- farger, fordi de kan bære betydning (som «over» og «cut-off»)
- noe som vises, skjules, flyttes til et annet sted eller får en ny rekkefølge
- tastatur, fokus, tilgjengelighet eller noe annet ved hvordan appen brukes
- en retting av noe brukerne har meldt eller merket som feil

Er du i tvil, er det ikke stille. En PR som ellers har en føring, tar med
designjusteringene sine i den. Er PR-en stille, skriv «Stille
designjustering: ingen føring i endringsloggen» i beskrivelsen av den i stedet
for punktet om endringsloggen, og hopp over resten av denne protokollen.

Appen ber bare brukerne oppdatere når versjonen de skal oppdatere til — den
nyeste føringen som varsles — er ny (`docs/oppdatering.md`). En stille PR
endrer ikke den, og det gjør heller ikke en føring med `utenVarsel`.

## 1. Har denne grenen alt en føring?

Det skal være **nøyaktig én føring per PR** som ikke er stille (steg 0),
uansett hvor mange pushes den har.

```
git show origin/main:src/data/endringslogg.ts | grep -m1 versjon
```

Er den øverste versjonen der ulik den øverste i arbeidstreet, ligger føringen
alt inne på grenen: **rediger den**. Legg aldri til en føring nummer to.

## 2. Skriv føringen

Øverst i `src/data/endringslogg.ts`. Nyest først.

```ts
{
  versjon: '1.1.0',
  dato: '2026-09-03',        // ISO. Datoen PR-en slås sammen.
  sammendrag: 'Én ekstremt kort linje om hva som ble gjort',
  typer: ['Funksjonalitet'],
  omfang: 'Mindre omfang',
  gjelder: ['fortolkning/thc'], // Sidene endringen gjelder; se steg 4.
  punkter: [
    'Det konkrete, i vanlig språk.',
    'Ett punkt per ting brukeren vil merke.',
  ],
}
```

## 3. Hvilket tall som økes

| Ledd | Når |
| --- | --- |
| MAJOR | Arbeidsflyten legges om slik at den som kan appen må lære den på nytt, eller fortolkningsgrunnlaget byttes ut. Sjelden. |
| MINOR | Appen kan noe den ikke kunne før: ny modul, ny kategori, ny valgmulighet, ny snarvei. |
| PATCH | Retting eller justering av noe som fantes fra før — utseende, ordlyd, tastaturdetaljer, og feil i eksisterende fortolkning. En ren designjustering er stille og får ingen versjon (steg 0). |

Ledd til høyre nullstilles: `0.5.4` → `0.6.0` → `1.0.0`.

## 4. Merker

**Type** — én eller flere:

| Merke | Gjelder |
| --- | --- |
| `Design / layout` | Utseende, plassering, luft, farger, ordlyd i grensesnittet |
| `Funksjonalitet` | Hva appen gjør: taster, flyt, felt, navigasjon |
| `Fag` | Analytter, enheter, grenser, formler, fortolkningsregler, kommentartekster |

`Fag` settes når endringen **kan endre kommentaren eller vurderingen** — også
når den bare retter opp noe som var feil.

### Når skal endringen gi varsel i bjella?

**Hovedregelen er ingen varsling.** Alle endringer føres i versjonsloggen.
Varsler skal informere kliniske farmakologer om det de trenger å vite for
å bruke OUSFAR riktig i sitt kliniske arbeid, ikke om hva utviklerne har
gjort. At en funksjon er ny eller en endring omfattende er ikke tilstrekkelig.

Vurder tre spørsmål:

1. Må klinikeren kjenne endringen for å forstå, utføre eller bruke
   fortolkningen riktig?
2. Har fagsidene fått så vesentlig ny eller endret klinisk funksjonalitet
   at klinikeren bør kjenne til den eller en endret arbeidsmåte?
3. Kan manglende kjennskap til endringen føre til en klinisk relevant
   feil, uriktig vurdering eller pasientsikkerhetsrisiko?

Bruk eksplisitte markører bare når minst ett kriterium er oppfylt:

- **`endrerFortolkning: true`** når endringen faktisk gir andre kommentarer
  eller vurderinger i fortolkningen, eksempelvis endrede regler i koden.
  Obligatorisk varsel. Publisering i selve appen varsles allerede av
  databasen og trenger ikke markøren.
- **`varsleFunksjonsendring: true`** ved vesentlige endringer i hvordan
  fortolkningen brukes, eller større endringer i fagsidenes sentrale
  kliniske funksjonalitet. Valgfritt varsel (på som standard). Eksempler:
  en ny klinisk fortolkningsmetode eller en sentral seksjon som «Analyse
  ved norske laboratorier».
- **`kritiskFagligVarsel: true`** ved kritisk faglig informasjon som kan
  påvirke pasientsikkerhet eller påliteligheten til kliniske konklusjoner,
  også uten funksjonsendring. Obligatorisk varsel.

Design, brukeropplevelse, navigasjon, ytelse, vanlige filtre, intern
administrasjon, rutinefeilrettinger, løpende faglig kuratering og interne
systemendringer varsles normalt ikke. Ved tvil: ikke varsle. Varsle om
det samlede klinisk vesentlige resultatet, ikke hver tekniske delendring.

**`utenVarsel: true`** er for endringer som ikke krever at brukeren oppdaterer
appen, som kodeføring av noe som allerede er rullet ut. Det undertrykker
vanlige funksjonsvarsler, men ikke obligatoriske varsler om endret
fortolkning eller kritisk faglig sikkerhet. De obligatoriske unntakene
krever også oppdatering hos brukere med gammel app. En vanlig endringsloggføring
uten varselmerker kan fortsatt kreve at appen oppdateres. Varsel i bjella
og oppdateringsmelding er to ulike mekanismer (se `docs/varsler.md` og
`docs/oppdatering.md`).

**`gjelder`** — sidene endringen gjelder. Brukerne bes bare om å oppdatere
når de står på en av dem; ellers tas versjonen i bruk når de går til en annen
side eller nullstiller fortolkningen (`docs/oppdatering.md`). Hver føring som
varsles, skal ha den; en test krever det. Et område er siden slik den står i
adressen, uten `#/` og uten seksjonen på siden, og gjelder også sidene under:

| Område | Gjelder |
| --- | --- |
| `fortolkning` | Hele fortolkningen: søket, hver analytt og redigeringen av reglene |
| `fortolkning/thc` | Fortolkningen av én analytt og redigeringen av den (nøkkelen fra adressen) |
| `fortolkning/*/rediger` | Redigeringen av reglene, for alle analytter |
| `stoff` | Alle fagsidene |
| `stoff/bupropion` | Én fagside |
| `sok` | Søkesiden i fagstoffet |
| `stoffregister` | Stoffregisteret |
| `vinduer` | Vinduene som åpnes over sidene, som idéene, varslene og endringsloggen |
| `hele appen` | Noe som står på alle sider, som toppmenyen, sidemenyen og diskusjonene, eller noe felles for dem |

Sett så mange områder som trengs. Gjelder endringen noe som står på alle sider,
eller er du i tvil, bruk `hele appen`. En test kontrollerer at hvert område
finnes, så en skrivefeil ikke lar brukerne stå på en gammel versjon.

**Omfang** — ett merke, vurdert skjønnsmessig. Beskrivelsene er veiledende:

| Merke | Omtrent |
| --- | --- |
| `Minimalt omfang` | Én detalj, merkes bare om man ser etter |
| `Mindre omfang` | Én tydelig endring, ett sted |
| `Moderat omfang` | Flere steder, eller noe man legger merke til med én gang |
| `Større omfang` | Endrer hvordan man arbeider i appen |
| `Betydelig omfang` | Ny modul eller kategori, eller noe som preger hele appen |

## 5. Språk

Føringen leses av legene som bruker appen. Skriv som til en kollega, ikke som
til en utvikler: ingen filnavn, funksjonsnavn, klassenavn eller
PR-nummer. `sammendrag` er én linje og tåler å være abstrakt; `punkter` er det
konkrete.

## 6. Fullfør

1. Sett `version` i `package.json` lik den nye versjonen, og oppdater låsefila
   med den: `npm install --package-lock-only`. Uten det blir versjonen stående
   igjen to steder i `package-lock.json`.
2. Kjør `npm test`. Testen i `src/domain/__tests__/versjon.test.ts` kontrollerer
   rekkefølge, datoer, merker og at `package.json` og `package-lock.json`
   stemmer.

## Vedlikehold

Filen vokser med rundt femten linjer per PR. Blir den upraktisk lang — over
noen hundre føringer — deles den per år (`src/data/endringslogg/2026.ts`) og
settes sammen igjen i `src/data/endringslogg.ts`. Ingenting annet trenger å
endres, siden appen bare leser `ENDRINGSLOGG`.
