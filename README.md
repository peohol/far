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
npm run data       # bygger datasettene på nytt fra PDF-ene i originaldata/
```

`npm run data` krever Python 3 med `pdfplumber` (`pip install pdfplumber`), og
bygger både `src/data/analytter.json` (fra `kommentarer.pdf`) og
`src/data/rusmidler.json` (fra `rusmidler.pdf`). Datasettene er sjekket inn, så
det trengs bare når PDF-ene endres.

## Slik brukes appen

| Steg | Hva som skjer | Taster |
| --- | --- | --- |
| 1 | Begynn å skrive navnet på en analytt eller kode | hvilken som helst bokstav |
| 2 | Velg blant alternativene som passer søket — er det bare ett igjen, går appen videre til det av seg selv | `1`–`9` og `0`, eller `Enter`/`Space` |
| 3 | Velg hvilket konsentrasjonsbånd svaret havner i — kommentaren kopieres | `1`–`4` |
| 4 | Lim inn kommentaren på analyttkoden som vises — båndknappen som ble brukt, står over kortet som bevis | `Enter`/`Space` avslutter og nullstiller |

To grupper oppføringer tar en annen vei fra steg 2, til hver sin
fortolkningsmodul i stedet for til konsentrasjonsbåndene: **THC-syre** (kode
`IRCAK`), se [THC-syre i urin](#thc-syre-i-urin-ircak), og **stoffene med
ruspotensial i serum**, se
[Stoffer med ruspotensial i serum](#stoffer-med-ruspotensial-i-serum).

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

Peker eller tastaturfokus på et bånd viser kommentaren som blir kopiert, i en
tooltip over den knappen den gjelder. Når kommentaren er kopiert, kvitteres det med et blink ved
knappen som ble brukt. Blinket starter der og fortsetter et lite øyeblikk inn i
neste steg, så det rekker å bli sett uten å holde igjen arbeidsflyten. Tiden
står som `BLINK` og `STEGBYTTE` øverst i `src/App.tsx`.

Blinket sier at noe ble kopiert, men ikke hva. Derfor følger selve knappen med
videre: den flyter opp fra plassen sin og lander rett over «Lim inn kommentaren
på»-kortet, i samme farge, med samme ikon og samme tall. Der blir den stående
som bevis på hvilken kommentar som faktisk ligger på utklippstavlen — et ekstra
sikkerhetsledd før den limes inn — og bærer fortsatt kommentarteksten som en
tooltip, så den kan leses en siste gang. Hurtigtastmerket blir igjen i
båndsteget: tasten valgte båndet, og har ingen jobb når kommentaren alt er
kopiert.

Flukten er målt, ikke gjettet. Beviset tegnes der det skal ende, måles, og
settes tilbake til ruten knappen sto i; når transformen glir bort, flyter
knappen på plass. Regnestykket ligger i `src/domain/flytting.ts` og er dekket av
tester. Skalaen leses av høyden og ikke av bredden — båndknappene deler bredden
i kortet likt mellom seg og er bredere enn innholdet sitt, mens høyden bare
kommer av skriften — så ikonet og tallene står i samme størrelse på samme sted i
det beviset tar over. Tiden står som `--fart-flyt` i `src/styles/tokens.css`, og
er kort nok til at blinket fortsatt står når knappen lander.

`Esc` angrer ett steg av gangen og beholder det som er skrevet i steget foran.
`Enter` og `Space` gjør alltid det samme.

Knappen med tastatursymbol øverst til høyre viser hurtigtastmerkene i UI-et.
Den er av som standard; tastene virker uansett. Tallene på søkealternativene
står alltid, siden de endrer seg fra søk til søk.

Appen står i mørkt tema som standard. Knappen ved siden av bytter til lyst, og
valget huskes til neste gang.

## Struktur

```
scripts/build_data.py       Leser kommentarer.pdf og bygger psykofarmakadatasettet
scripts/build_rusmidler.py  Leser rusmidler.pdf og bygger rusmiddeldatasettet
src/data/analytter.json     Generert datasett (sjekket inn)
src/data/rusmidler.json     Generert datasett (sjekket inn)
src/data/aliaser.json       Håndholdte ekstra søkeord per analyttkode
src/types.ts                Datamodellen
src/state.ts                Tilstandsmaskinen for stegene
src/domain/                 Bånd, klassifisering, søk, navn, fargespredning, kontrast,
                            tooltipplassering (tipsplassering.ts), flukten til
                            kopibeviset (flytting.ts), THC-fortolkning (thc.ts) med
                            figurgrunnlaget (thcPlot.ts) og rusmiddelfortolkning (rus.ts)
src/hooks/                  Tastatur, tema, hurtigtastmerker, utklippstavle
src/components/             Stegene, felles kort/pille/knapp/tooltip/ikoner
src/styles/                 tokens.css (design) + base.css + components.css
```

Alt som gjentar seg — farger, avstander, skriftstørrelser, knapper,
hurtigtastmerker, ikonrammen, tooltipene — er definert ett sted og gjenbrukt. Nye analytter
krever ingen kodeendring: de kommer med når PDF-en bygges på nytt. Nye steg
legges til ved å utvide `Stage` i `src/state.ts` og skrive én komponent til.

### Tooltip

Appen har ett tooltipsystem, i `src/components/Tips.tsx`. Tekst som bærer en
forklaring, markeres med prikkestrek, og forklaringen vises både ved peker og
ved tastaturfokus.

```tsx
// Vanlig tekst med forklaring bak seg:
<Tips forklaring="Hva dette betyr">Navnet</Tips>

// Når tipset skal henge på noe som allerede har en jobb, som en knapp:
const tips = useTips('Hva knappen gjør')
<button {...tips.props}>…</button>
{tips.forklaring}
```

Boblen tegnes i en portal rett på `<body>` og ligger fast til vinduet. Derfor
er den ikke bundet av bredden, høyden eller `overflow` til beholderen teksten
står i — en lang kommentar kan stå over en smal knapp uten å bli klippet.
Fargene er snudd i forhold til resten av appen: svart boble med hvit skrift i
lyst tema, hvit boble med svart skrift i mørkt.

Boblen står midtstilt over teksten når det er plass. Er det ikke plass over,
faller den ned under, og nær en sidekant skyves den innover — pilen blir
stående igjen ved teksten, så det fortsatt går fram hva boblen hører til.
Reglene ligger i `src/domain/tipsplassering.ts` og er dekket av tester;
`TipsLag` i `src/main.tsx` er selve laget og må ligge rundt hele appen.

## Datasettet for psykofarmaka

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
   den målte endringen leses et kvantil i en lognormalfordeling rundt den av
   (B22–B25, CV 0,2 for THC-syre og 0,05 for kreatinin). Personen får tvilens
   fordel — bare endringer som er for høye selv med usikkerheten trukket fra,
   teller som over. Hvor langt ut i fordelingen som leses av, styres av
   [sikkerhetsmarginen](#sikkerhetsmarginen).
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

### Sikkerhetsmarginen

Regnearket har sikkerheten fast på 0,9 (B5). Her er den en skala med tre stopp
nederst i inndatakortet, og står på 90 % når appen lastes:

| Stopp | Kvantil som leses av | Faktor | Hva det betyr |
| --- | --- | --- | --- |
| Ingen | 50 % | 1 | Medianen er den målte verdien selv. Målingene tolkes rett fram, uten kompensasjon for usikkerhet. |
| 90 % | 10 % | ≈ 0,688 | Regnearkets egen sikkerhet. |
| 99 % | 1 % | ≈ 0,508 | Ekstra forsiktig, til de spesielle tilfellene. |

Marginen slår gjennom alle stedene fortolkningen bruker den korrigerte
endringen: kategorien og dermed kommentaren, punktet for denne prøven i
figuren, og tallene og ordlyden i «Forklaring». Overskriften over skalaen har
prikkestrek og bærer forklaringen på hva marginen er, i to bolker — hvorfor en
målt endring ikke er den sanne, og hva marginen gjør med den. Bolkene legger
seg ved siden av hverandre når det er plass, så boblen ikke blir en søyle.

Skalaen vises bare når det finnes en tidligere prøve å sammenligne med. Uten
en slik prøve regnes ingen endring ut, og marginen har ingenting å gjøre —
samme grunn som prøvedatoene skjules av.

### Visualiseringen

Visualiseringen viser de tre kurvene konklusjonen leses av — «Normal
utskillelse» (grønn), «Moderat utskillelse» (gul) og «Treg utskillelse»
(rød) — som prosentvis endring fra forrige prøve, med begge prøvene som
punkter. Navnene i legenden bærer hvert sitt tips om hva profilen står for.
Figuren vises bare når fortolkningen faktisk er gjort mot en tidligere prøve
og det er minst ett døgn mellom prøvene.

Punktet for denne prøven er den korrigerte endringen, siden det er den
konklusjonen leses av, og flytter seg derfor når sikkerhetsmarginen endres.

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
fortolkningen med prøvens egne tall, delt i fire bolker med hver sin
overskrift: hvor stor endringen mellom målingene er, hvorfor den målte
endringen ikke er den sanne, hva som var å vente uten et nytt inntak, og
konklusjonen. Brødteksten rykkes inn under overskriften sin, så det synes hva
som hører sammen. Sammenleggbare seksjoner åpner og lukker seg jevnt
og legger seg øverst i vinduet når de er ferdig åpnet, klare til å leses
(`src/components/Details.tsx`), slik `<details>` skal gjøre overalt i appen.

> **Ordlyden i kommentarene** er rettsmedisinske formuleringer hentet tegn
> for tegn fra regnearket, og skal ikke endres uten at den som eier appen
> uttrykkelig har bedt om det og bekreftet den nye ordlyden. Ett bevisst
> avvik er bestilt og bekreftet av eieren: «5-7 dager» skrives med
> tankestrek, «5–7 dager».

## Stoffer med ruspotensial i serum

Benzodiazepiner og Z-hypnotika, THC, og opioider måles i serum og kommenteres
etter tabellene i `originaldata/rusmidler.pdf`. Søkes ett av stoffene opp, går
appen til fortolkningsmodulen for det i stedet for til konsentrasjonsbåndene.

Kategorien skiller seg fra psykofarmaka på tre måter, og modulen er bygd rundt
dem:

- **Kommentaren varierer ikke med konsentrasjonen.** Det finnes én kommentar
  per stoff uansett hvor svaret ligger, så det er ingen bånd å velge mellom.
- **Noen stoffer fortolkes samlet.** Da legges hele kommentaren på én
  analyttkode, og de andre får en kort tilleggskommentar som henviser dit.
  Hvilken kode som bærer hovedkommentaren avhenger av hva som er påvist: er
  både tramadol og O-desmetyltramadol påvist, ligger den under tramadol; er
  bare O-desmetyltramadol påvist, ligger den der.
- **Stoffer som tolkes sammen deler én modul.** Diazepam,
  N-desmetyldiazepam og oksazepam fører alle tre til den samme modulen, enten
  man søker på navnet eller på koden, og alternativet i søket viser alle kodene
  modulen dekker.

De tre fellesmodulene er `DIAZ · DMI · OXA`, `TRAM · OTRAM` og `KOD · MOR`. De
elleve andre stoffene har hver sin modul med bare seg selv.

### Slik brukes modulen

Modulen spør om det den trenger for å velge riktig kommentar, og ikke om noe
annet:

| Modul | Hva den spør om |
| --- | --- |
| Ett stoff | Ingenting — kommentaren er gitt |
| Fellesmodul | Hvilke av stoffene som er påvist i denne prøven |
| Diazepam-gruppen | I tillegg de målte konsentrasjonene, når oksazepam er påvist sammen med minst ett av de to andre |
| Kodein og morfin | I tillegg om det er høy kodein og lav morfin, når begge er påvist |

Resultatkortet viser én blokk per kommentar, i den rekkefølgen de skal limes
inn, med analyttkoden i store bokstaver — det er den som må leses av og
handles på. `Enter` kopierer den som står for tur, og merket `↵` flytter seg
til den neste; når alt er kopiert, tar `Enter` deg tilbake til søket. Hver
blokk har også sin egen kopiknapp, og kvitteres med det samme blinket som i
båndsteget pluss et «Kopiert» som blir stående, så det synes hva som gjenstår
når kommentarene tas én av gangen.

Er det noe å velge mellom, står kommentarteksten framme i blokka: da kan
valget bli feil, og den som limer inn skal kunne lese hva som faktisk havner
på utklippstavlen. Er det bare én kommentar uansett — som for alprazolam eller
metadon — er teksten unødig støy på skjermen, og henger i stedet på
kopiknappen som en tooltip. Koden vises begge veier.

### Reglene modulen følger

**Diazepam, N-desmetyldiazepam og oksazepam.** Diazepam og desmetyldiazepam
vurderes alltid samlet, med kommentaren under diazepam når begge er påvist.
Oksazepam har sin egen kommentar, men er også en metabolitt av diazepam, og
kilden har en felles kommentar for alle tre. Den brukes når oksazepam utgjør
under 10 % av summen av diazepam og desmetyldiazepam; ellers kommenteres
oksazepam for seg. Derfor spør modulen om konsentrasjonene når oksazepam er
påvist sammen med minst ett av de andre, regner ut andelen og sier hvilken vei
den falt. Bare forholdet mellom tallene teller, så enheten spiller ingen rolle.

**Kodein og morfin.** Hver for seg har de hver sin standardkommentar. Er begge
påvist, har kilden to kombinasjonskommentarer, og valget mellom dem er en
faglig vurdering ingen formel dekker. Modulen viser kildens egen veiledning —
kodein skyldes i de fleste tilfeller inntak av kodein, med mindre morfinet er
svært høyt eller det er påvist MAM — og lar den vurderingen tas med én
avkryssing. Uten avkryssing gjelder kildens standardtilfelle:
kombinasjonskommentaren på kodein, og morfinets egen kommentar på morfin.

### Rettelser gjort i teksten

Rettelsene ligger i `meta.rettelser` i `src/data/rusmidler.json`, med kilde og
begrunnelse, så de kan etterprøves mot PDF-en.

| Type | Fra | Til | Antall |
| --- | --- | --- | --- |
| tankestrek | `40-120`, `2-10`, `4-6`, `8-12`, `600-1200`, `300-600` | `40–120`, `2–10`, `4–6`, `8–12`, `600–1200`, `300–600` | 6 |
| typografi | `> 10%` | `> 10 %` | 1 |

Som ellers i appen er bindestrek byttet til tankestrek **bare** mellom to tall.
`O-desmetyltramadol`, `N-desmetyldiazepam`, `LAR-behandling` og `heroin-inntak`
står urørt. Kommentartekstene er ellers gjennomgått uten at det ble funnet
stavefeil.

### Uavklarte forhold i kilden

| Hvor | Forhold |
| --- | --- |
| Diazepam-gruppen | Kilden sier at fellesskommentaren brukes når oksazepam er `< 10 %`, og at standardkommentarene brukes når den er `> 10 %`. Nøyaktig 10 % dekkes ikke av noen av dem. Appen bruker standardkommentarene der, så fellesskommentaren bare brukes der kilden uttrykkelig sier at den skal. |
| Diazepam-gruppen | Kombinasjonsraden er skrevet for alle tre stoffene. Er oksazepam påvist sammen med bare ett av de to andre, regner appen 10 %-regelen av det som faktisk er påvist. |
| Høy kodein, lav morfin | Tilleggskommentaren står i kilden som «Høy kodein, lav morfin. Se kommentar for kodein i serum.» De tre andre tilleggskommentarene i dokumentet er bare henvisningen. Appen kopierer teksten uendret; skal den første setningen bort, er den en overskrift og ikke kommentartekst. |
| Sentralstimulerende | Kategorien hører med, men PDF-en har bare tabeller for benzodiazepiner og Z-hypnotika, THC og opioider. De sentralstimulerende stoffene er derfor ikke lagt inn — kommentartekstene deres finnes ikke i kildedokumentet. |

## Tilgjengelighet

Appen følger WCAG 2.1 AA, som er kravet i forskrift om universell utforming av
IKT: alle hurtigtaster er meldt med `aria-keyshortcuts` og kan vises i UI-et,
alt kan betjenes med tastatur, fokusmarkeringen er synlig overalt, nivået går
fram av både farge, ikon og tall — ikke farge alene — og animasjoner slås av
ved `prefers-reduced-motion`. `npm test` måler kontrasten i begge temaer mot
tokens.css, så en fargeendring som bryter kravet slår ut i testene.

Tooltipene vises både ved peker og ved tastaturfokus, og teksten er knyttet til
elementet med `aria-describedby` — den ligger skjult hos ankeret, ikke bare i
boblen, så skjermlesere får den uansett om boblen står framme. Ingen forklaring
i appen er ren museinformasjon. Sikkerhetsmarginen meldes med navnet på stoppet skalaen
står på og ikke med plassen i rekka (`aria-valuetext`), og forklaringen bak
overskriften er knyttet til både overskriften og selve skalaen.
I rusmiddelmodulen heter alle knappene «Kopier» på skjermen, der merkelappen
over dem sier hvilken kommentar de gjelder. For skjermlesere sier hver knapp
hele sitt eget navn — «Kopier tilleggskommentar» — så de kan skilles fra
hverandre uten å lese omgivelsene.

Kvitteringen for kopieringen meldes i tillegg som statusbeskjed, siden blinket
er rent visuelt. Uten bevegelse blir kvitteringen stående stille i stedet for å
sprette fram, og beviset over lim-inn-kortet står ferdig landet i stedet for å
fly. Beviset sier med skjult tekst hva det er — «Kopiert kommentar for» foran
båndet — så det ikke blir en løsrevet tallrekke for den som ikke ser fargen og
ikonet.
