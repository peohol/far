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
| 2 | Velg blant alternativene som passer søket — er det bare ett igjen, går appen videre til det av seg selv | `1`–`9` og `0`, eller `Enter`/`Space` |
| 3 | Velg hvilket konsentrasjonsbånd svaret havner i — kommentaren kopieres | `1`–`4` |
| 4 | Lim inn kommentaren på analyttkoden som vises | `Enter`/`Space` avslutter og nullstiller |

Én oppføring i søket tar en annen vei: **THC-syre** (kode `IRCAK`) går fra
steg 2 til sin egen fortolkningsmodul i stedet for til konsentrasjonsbåndene —
se [THC-syre i urin](#thc-syre-i-urin-ircak).

Smalner søket inn til én eneste analytt, er valget i praksis allerede tatt, og
appen går videre uten at det trengs et tastetrykk til. Det skjer bare i selve
overgangen fra noe annet enn ett alternativ til ett: kommer man tilbake med
«Bytt analytt» eller `Esc`, blir søket stående som det var uten å sende
brukeren rett inn igjen, og å skrive videre på det gjør heller ingenting. Ny
sjanse får man når søket igjen gir noe annet enn ett alternativ — ved å slette
tilbake til flere alternativer, eller tømme feltet helt. Det siste er veien inn
igjen når det bare fantes ett alternativ hele veien, slik det gjør når bare én
analytt passer den aller første bokstaven som skrives.

Alternativene i steg 2 setter moderstoffet størst og sterkest — rein hvit i
mørkt tema, rein svart i lyst. Analyttkoden beholder plassen sin øverst, men
står i en liten pille i samme farge som tallmerket, og metabolittene i en
sumanalyse står under moderstoffet med mindre og dempet skrift. Koden og
metabolittene er stort sett mindre kjent enn moderstoffet, så det er
moderstoffet som skal kunne leses av på et blikk.

Peker eller tastaturfokus på et bånd viser kommentaren som blir kopiert, i et
tips over knappene. Når kommentaren er kopiert, kvitteres det med et blink ved
knappen som ble brukt. Blinket starter der og fortsetter et lite øyeblikk inn i
neste steg, så det rekker å bli sett uten å holde igjen arbeidsflyten. Tiden
står som `BLINK` og `STEGBYTTE` øverst i `src/App.tsx`.

`Esc` angrer ett steg av gangen og beholder det som er skrevet i steget foran.
`Enter` og `Space` gjør alltid det samme.

Knappen med tastatursymbol øverst til høyre viser hurtigtastmerkene i UI-et.
Den er av som standard; tastene virker uansett. Tallene på søkealternativene
står alltid, siden de endrer seg fra søk til søk.

Appen står i mørkt tema som standard. Knappen ved siden av bytter til lyst, og
valget huskes til neste gang.

## Struktur

```
scripts/build_data.py     Leser kommentarer.pdf og bygger datasettet
src/data/analytter.json   Generert datasett (sjekket inn)
src/data/aliaser.json     Håndholdte ekstra søkeord per analyttkode
src/types.ts              Datamodellen
src/state.ts              Tilstandsmaskinen for stegene
src/domain/               Bånd, klassifisering, søk, navn, fargespredning, kontrast,
                          THC-fortolkning (thc.ts) og figurgrunnlaget (thcPlot.ts)
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

Båndene er én sammenhengende skala, og et bånd som havner alene på linje to
leses lett som noe annet enn de andre. Knappene deler derfor bredden i kortet
likt mellom seg og krymper skriften i stedet for å bryte raden. Grensen går der
tallene ville blitt for små til å leses; da brytes raden heller enn å klippe et
intervall, men det skjer først på skjermer smalere enn en mobil på høykant.
Tallet CSS-en er dimensjonert etter — den lengste etiketten datasettet gir —
holdes i sjakk av en test.

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

## THC-syre i urin (IRCAK)

Søkes «THC-syre» eller «IRCAK» opp, går appen til en egen fortolkningsmodul i
stedet for til konsentrasjonsbåndene. Modulen er en nettutgave av regnearket
`originaldata/THC-COOH.xlsm` og vurderer om det har skjedd et nytt
cannabisinntak, ved å sammenligne kreatininkorrigert THC-syrekonsentrasjon
(IRCAK) i to prøver — eller, uten en tidligere prøve, ved å fortolke
konsentrasjonen i den aktuelle prøven alene. Regnearket er fasit: kurver,
grenser og kommentartekster er hentet derfra, og testene i
`src/domain/__tests__/thc.test.ts` holder koden opp mot verdier lest rett ut
av regnearkets celler.

Modulen brukes gjerne mange prøver på rad, og flyten er lagt opp etter det.
Kommentaren regnes ut fortløpende mens feltene fylles; i det den lar seg regne
ut, slipper feltet man står i fokus, og kommentaren rulles øverst i vinduet.
Skjemaet er da ferdig utfylt, og et felt som blir stående fokusert utenfor
bildet stjeler bare tastetrykk. Kopiering kvitteres med det samme blinket som
i båndsteget, ruller tilbake til feltene og legger et lite tilbud under
nullstill-knappen i hjørnet: «Trykk ↵ for å nullstille nå». Enter tar
tilbudet, alt annet — en annen tast, et klikk, et rull — takker nei og rydder
det bort. Kan kommentaren ikke regnes ut, viser et Mangler-kort hva som
gjenstår, etter mønster fra det frittstående THC-COOH-verktøyet, og
kopier-knappen vises først når det finnes en kommentar å kopiere.

Er «Ingen tidligere prøve tilgjengelig» huket av, skjules feltene for forrige
prøve og prøvedatoen for denne prøven — datoene brukes bare til å telle døgn
mellom prøvene, så uten en tidligere prøve spørres det ikke etter dem.

`Enter` gjør bare én ting i modulen: kopierer kommentaren. Det ene unntaket er
tilbudet over — står «Trykk ↵ for å nullstille nå», tar `Enter` det i stedet.
Tasten fanges på vinduet før feltene og knappene ser den, så den gjør det samme
uansett hvor fokus står; ellers ville et fokusert datofelt åpnet kalenderen på
nytt i stedet for å kopiere. `Space` trykker fortsatt knappen — eller folder ut
«Forklaring» — man står på, så alt lar seg betjene med tastaturet som før, og
`Esc` går tilbake til søket.

Piltastene opp/ned hopper mellom kortene i modulen i stedet for å rulle, og
kortet man hopper til midtstilles i vinduet (`src/hooks/useKortHopp.ts`, klar
til gjenbruk i senere moduler). De lar feltene være i fred når fokus står i
et av dem. Musehjulet ruller som vanlig — det er den eneste veien gjennom et
kort som er høyere enn vinduet, slik det utfoldede forklaringskortet lett
blir. I hele appen gjelder dessuten at et klikk på selve flaten til et kort
ruller det til midten av vinduet, når det finnes noe å rulle.

Slik regner den, med regnearkets cellereferanser i parentes
(arket «Innstillinger og beregninger»):

1. **Endringen mellom prøvene** korrigeres for måleusikkerhet: i stedet for
   den målte endringen brukes 10 %-kvantilen i en lognormalfordeling rundt
   den (B22–B25, CV 0,2 for THC-syre og 0,05 for kreatinin). Personen får
   tvilens fordel — bare endringer som er for høye selv med usikkerheten
   trukket fra, teller som over.
2. **Tre utskillelseskurver** — grønn (sporadisk bruk), gul (grønn med dobbel
   amplitude) og rød (tregeste dokumenterte utskillelse) — leses av der
   forrige prøve ligger, og gir forventet endring frem til denne prøven
   (rad 29–63). Kurvene er bi-eksponentielle tilpasninger fra
   Modellering-arket, skalert med konverteringsfaktoren i H19.
3. **Kategorien** (B65) telles opp etter hvilke kurver den korrigerte
   endringen ligger over, med et trinn ekstra når kronisk bruk ikke legges
   til grunn, og **kommentaren** settes sammen av regnearkets tekstformler
   (J23–J30): konsentrasjonsnivået lav/middels høy/høy etter grensene 20 og
   40 (M21), og konklusjonen fra «ikke nødvendigvis» via «vanskelig å
   avgjøre» til «har vært inntatt».
4. **Mer enn 60 døgn** mellom prøvene setter forrige prøve til side (K21):
   kommentaren blir som om ingen tidligere prøve fantes, og modulen sier fra
   om hvorfor. Det samme skjer, uten notis, når «Ingen tidligere prøve
   tilgjengelig» er huket av.

Visualiseringen viser de tre kurvene konklusjonen leses av — «Normal
utskillelse» (grønn), «Moderat utskillelse» (gul) og «Treg utskillelse»
(rød) — som prosentvis endring fra forrige prøve, med begge prøvene som
punkter. Navnene i legenden bærer hvert sitt tips om hva profilen står for.
Figuren vises bare når fortolkningen faktisk er gjort mot en tidligere prøve
og det er minst ett døgn mellom prøvene.

> Her viker figuren bevisst fra regnearkets egen graf, som tegner den lilla
> mellomkurven («Kronisk, typisk») i stedet for den gule. Den lilla kurven er
> ikke med i konklusjonen (`B65` teller `B64`/`C64`/`D64` — grønn, gul, rød),
> så regnearkets graf viste en kurve kommentaren aldri leste av og utelot den
> som avgjør. Figuren skal speile fortolkningen: havner punktet for denne
> prøven over eller under en kurve, er det den samme sammenligningen som
> velger kommentar. Ligger forrige prøve lavt, er grønn og gul kommet ned i
> den flate halen og faller likt; da ligger de to øverst i hverandre i
> figuren, slik grensene faktisk gjør.

Under figuren ligger en sammenleggbar «Forklaring» som viser grunnlaget for
fortolkningen med prøvens egne tall — dager, målt og korrigert endring,
grensene og vurderingen. Sammenleggbare seksjoner åpner og lukker seg jevnt
og legger seg øverst i vinduet når de er ferdig åpnet, klare til å leses
(`src/components/Details.tsx`), slik `<details>` skal gjøre overalt i appen.

> **Ordlyden i kommentarene** er rettsmedisinske formuleringer hentet tegn
> for tegn fra regnearket, og skal ikke endres uten at den som eier appen
> uttrykkelig har bedt om det og bekreftet den nye ordlyden. Ett bevisst
> avvik er bestilt og bekreftet av eieren: «5-7 dager» skrives med
> tankestrek, «5–7 dager».

## Tilgjengelighet

Appen følger WCAG 2.1 AA, som er kravet i forskrift om universell utforming av
IKT: alle hurtigtaster er meldt med `aria-keyshortcuts` og kan vises i UI-et,
alt kan betjenes med tastatur, fokusmarkeringen er synlig overalt, nivået går
fram av både farge, ikon og tall — ikke farge alene — og animasjoner slås av
ved `prefers-reduced-motion`. `npm test` måler kontrasten i begge temaer mot
tokens.css, så en fargeendring som bryter kravet slår ut i testene.

Tipset med kommentaren vises både ved peker og ved tastaturfokus, og er knyttet
til knappen med `aria-describedby`, slik at skjermlesere får den samme teksten.
Kvitteringen for kopieringen meldes i tillegg som statusbeskjed, siden blinket
er rent visuelt. Uten bevegelse blir kvitteringen stående stille i stedet for å
sprette fram.
