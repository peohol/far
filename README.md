# far

Verktøy for å kommentere farmakologiske analyser. Man søker opp en analytt,
velger hvilket konsentrasjonsbånd svaret havner i, og får den tilhørende
kommentaren kopiert til utklippstavlen — hele veien med tastaturet.

## Kom i gang

```bash
npm install
npm run dev        # utviklingsserver
npm run build      # typesjekk + produksjonsbygg til dist/
npm test           # enhetstester, inkludert kontrastmåling av paletten
npm run data       # bygger src/data/analytter.json på nytt fra kommentarer.pdf
```

`npm run data` krever Python 3 med `pdfplumber` (`pip install pdfplumber`).
Datasettet er sjekket inn, så det trengs bare når PDF-en endres.

## Slik brukes appen

| Steg | Hva som skjer | Taster |
| --- | --- | --- |
| 1 | Begynn å skrive navnet på en analytt eller kode | hvilken som helst bokstav |
| 2 | Velg blant alternativene som passer søket | `1`–`9` og `0`, eller `Enter`/`Space` når det bare er ett igjen |
| 3 | Velg hvilket konsentrasjonsbånd svaret havner i — kommentaren kopieres | `1`–`4` |
| 4 | Lim inn kommentaren på analyttkoden som vises | `Enter`/`Space` avslutter og nullstiller |

`Esc` angrer ett steg av gangen og beholder det som er skrevet i steget foran.
`Enter` og `Space` gjør alltid det samme.

Knappen med tastatursymbol øverst til høyre viser hurtigtastmerkene i UI-et.
Den er av som standard; tastene virker uansett. Tallene på søkealternativene
står alltid, siden de endrer seg fra søk til søk.

## Struktur

```
scripts/build_data.py     Leser kommentarer.pdf og bygger datasettet
src/data/analytter.json   Generert datasett (sjekket inn)
src/data/aliaser.json     Håndholdte ekstra søkeord per analyttkode
src/types.ts              Datamodellen
src/state.ts              Tilstandsmaskinen for de tre stegene
src/domain/               Bånd, klassifisering, søk, fargespredning, kontrast
src/hooks/                Tastatur, tema, hurtigtastmerker, utklippstavle
src/components/           Stegene, felles kort/pille/knapp/ikoner
src/styles/               tokens.css (design) + base.css + components.css
```

Alt som gjentar seg — farger, avstander, skriftstørrelser, knapper,
hurtigtastmerker, ikonrammen — er definert ett sted og gjenbrukt. Nye analytter
krever ingen kodeendring: de kommer med når PDF-en bygges på nytt. Nye steg
legges til ved å utvide `Stage` i `src/state.ts` og skrive én komponent til.

## Datasettet

De fire tabellene i `kommentarer.pdf` er slått sammen til én post per analytt
(35 stykker), med kode, navn, delanalytter, gruppe, enhet, referanseområde,
måleområde, ringegrense og de tre nivåene med hver sin kommentar.

Referanseområde, måleområde og ringegrense står bare på én av de tre radene i
PDF-en, men gjelder alle tre, og blir fylt ut på alle nivåene.

PDF-en bryter lange ord midt i ordet uten bindestrek fordi kolonnene er smale
(«likevektskonsentrasjo» / «n.»). Ekte mellomrom er bevart i tegnstrømmen, så
en linje som slutter på mellomrom var et ordskille og en linje som slutter på
en bokstav var et tvunget orddelingsbrudd. Rekonstruksjonen er derfor eksakt.

### Klassifisering og bånd

Grensene kommer fra «Under»- og «Over»-kolonnene i referansetabellene, som
til sammen dekker hele tallinjen:

```
konsentrasjon < nedreGrense   → under
konsentrasjon ≥ ovreGrense    → over
ellers                        → innenfor
```

`domain/bands.ts` deler den samme tallinjen i knappene brukeren velger mellom.
Utgangspunktet er de tre nivåene, og i tillegg deles et nivå i to der
ringegrensen går tvers gjennom det, slik at «ring rekvirenten» blir et eget
valg. Knappene er derfor utledet av analyttens egne tall, ikke hardkodet:

| Analytt | Bånd |
| --- | --- |
| AMTNORSUM (ringegrense = over-grensen) | `< 10` · `10 – 1799` · `≥ 1800` 📞 |
| ZUKLO (ringegrense over) | `< 1` · `1 – 78` · `79 – 100` · `≥ 101` 📞 |
| DOKSUM (ringegrense under) | `< 20` · `20 – 1000` · `1001 – 1099` 📞 · `≥ 1100` 📞 |
| FLUP (desimaler) | `< 0,6` · `0,6 – 35` · `35,1 – 35,9` 📞 · `≥ 36` 📞 |

Faller ringegrensen sammen med starten på «over» — som den gjør for 32 av 35
analytter — ville delingen gitt et bånd med én eneste verdi; da slås den
sammen til ett rødt bånd i stedet. Testene holder båndene opp mot `classify`,
så de to kan ikke komme i utakt.

### Rettelser gjort i teksten

Alle rettelser ligger også i `meta.rettelser` i `src/data/analytter.json`, med
kilde og begrunnelse, så de kan etterprøves mot PDF-en.

| Type | Fra | Til | Antall |
| --- | --- | --- | --- |
| stavefeil | `ecitalopram` | `escitalopram` | 1 |
| stavefeil | `dehydroariprazol` | `dehydroaripiprazol` | 3 |
| tankestrek | `12-24`, `0-2`, `20-60`, `1,5-6` osv. | `12–24`, `0–2`, `20–60`, `1,5–6` | 189 |
| typografi | `+/-` | `±` | 2 |
| artefakt | løst `B` i referanseområdet for KLOZ | fjernet | 1 |

Bindestrek er byttet til tankestrek **bare** mellom to tall. `O-desmetyl­venla­faksin`
og andre bindestreker i navn står urørt.

### Uavklarte forhold i kilden

Disse lot seg ikke rette maskinelt. De ligger i `meta.avvik` i datasettet.

| Kode | Type | Forhold |
| --- | --- | --- |
| LAM | overlapp | Innenfor slutter på 75, Over starter på 75 — verdien 75 dekkes av begge. Appen sier Over. |
| BREK | overlapp | Innenfor slutter på 600, Over starter på 600. Appen sier Over. |
| KARSUM | overlapp | Innenfor slutter på 300, Over starter på 300. Appen sier Over. |
| ZUKLO | overlapp | Innenfor slutter på 79, Over starter på 79. Appen sier Over. |
| FLUP | hull | Innenfor slutter på 34, Over starter på 36 — 34–36 er udefinert. Appen sier Innenfor. |
| FLUP | ringegrense | Ringegrensen (35) er lavere enn grensen for Over (36). Kommentarraden sier dessuten `> 36` der referansetabellen sier `≥ 36`. |
| DOKSUM | ringegrense | Ringegrensen (1000) er lavere enn grensen for Over (1100). |
| FLUOSUM, VENSUM, ARISUM, KLORP, LMP | måleområde | Måleområdet stopper lavere enn ringegrensen. For KLORP og LMP står dette uttrykkelig i PDF-en («Obs lavere enn ringegrense»). |

Lamotrigin er oppgitt med stjerne på alle tallene i PDF-en, uten at fotnoten
finnes i dokumentet. Datasettet tolker det som at analytten måles i **µmol/L**
mens alle de andre måles i nmol/L, og setter `enhet` deretter.

## Tilgjengelighet

Appen følger WCAG 2.1 AA, som er kravet i forskrift om universell utforming av
IKT: alle hurtigtaster er meldt med `aria-keyshortcuts` og kan vises i UI-et,
alt kan betjenes med tastatur, fokusmarkeringen er synlig overalt, nivået går
fram av både farge, ikon og tall — ikke farge alene — og animasjoner slås av
ved `prefers-reduced-motion`. `npm test` måler kontrasten i begge temaer mot
tokens.css, så en fargeendring som bryter kravet slår ut i testene.
