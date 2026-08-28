# far

Verktøy for å kommentere farmakologiske analyser. Man søker opp en analytt,
velger hvilket konsentrasjonsbånd svaret havner i, og får den tilhørende
kommentaren kopiert til utklippstavlen — hele veien med tastaturet.

Appen dekker psykofarmaka, antihypertensiver, THC-syre i urin, stoffene med
ruspotensial i serum og etanolmarkørene EtG og EtS.

## Kom i gang

```bash
npm install
npm run dev        # utviklingsserver
npm run build      # typesjekk + produksjonsbygg til dist/
npm test           # enhetstester, inkludert kontrastmåling av paletten
npm run data       # bygger datasettene på nytt fra kildene i originaldata/
```

`npm run data` bygger `src/data/analytter.json` (fra `kommentarer.pdf`),
`src/data/rusmidler.json` (fra `rusmidler.md`) og
`src/data/antihypertensiver.json` (fra `AHT.docx`). Datasettene er sjekket inn,
så det trengs bare når kildene endres. PDF-lesingen krever Python 3 med
`pdfplumber` (`pip install pdfplumber`); markdown- og Word-lesingen krever
ingenting ekstra.

## Slik brukes appen

| Steg | Hva som skjer | Taster |
| --- | --- | --- |
| 1 | Begynn å skrive navnet på en analytt eller kode | hvilken som helst bokstav |
| — | Åpne og lukke sidemenyen, når som helst | `Ctrl + M` |
| — | Begrense søket til en analysemetode | `Alt + 1` … `Alt + 5` |
| 2 | Velg blant alternativene som passer søket — er det bare ett igjen, går appen videre til det av seg selv | `1`–`9` og `0`, eller `Enter`/`Space` |
| 3 | Velg hvilket konsentrasjonsbånd svaret havner i — kommentaren kopieres | `1`–`4` |
| 4 | Lim inn kommentaren på analyttkoden som vises — båndknappen som ble brukt, står over kortet som bevis | `Enter`/`Space` avslutter og nullstiller |

To grupper oppføringer tar en annen vei fra steg 2, til hver sin
fortolkningsmodul i stedet for til konsentrasjonsbåndene: **THC-syre** (kode
`IRCAK`), se [THC-syre i urin](#thc-syre-i-urin-ircak), og **stoffene med
ruspotensial i serum**, se
[Stoffer med ruspotensial i serum](#stoffer-med-ruspotensial-i-serum). Begge
bygger svaret av flere spørsmål og blir derfor stående i sitt eget bilde til
man bytter analytt.

**EtG og EtS i urin** går de samme tre stegene som psykofarmaka, men velger
hva som er påvist i stedet for et konsentrasjonsbånd i steg 3, og kan gi to
kommentarer i limsteget. Se [EtG og EtS i urin](#etg-og-ets-i-urin).

Menyknappen øverst til venstre åpner sidemenyen, som er den andre veien inn:
der ligger alle analysemetodene med virkestoffene sine, og et trykk på et
virkestoff går rett til kommenteringsmodulen. Menyen styrer også hvilken
analysemetode søket leter i. Se
[Sidemenyen og analysemetodene](#sidemenyen-og-analysemetodene).

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
`Enter` og `Space` gjør alltid det samme: velger alternativet, kopierer
kommentaren, går videre. Mellomrom har den jobben bare der tasten ikke alt har
en — står fokus på en knapp, i en avkryssing eller i et tekstfelt, trykker,
huker av og skriver den som før, slik at avkryssingene i modulene fortsatt tas
med `Tab` og `Space`. Reglene ligger samlet i `src/domain/tastatur.ts`.

Feltene som tar en konsentrasjon tar tall og bare tall: bokstaver, mellomrom og
fortegn slipper ikke inn, verken tastet eller limt inn. Både komma og punktum
godtas som desimaltegn, som ellers i appen. Det gjør to ting. En konsentrasjon
kan ikke bli stående med et tegn som gjør at fortolkningen ikke får lest den,
og mellomrom er ledig til å bekrefte mens man står i feltet — så en modul som
bare venter på tall, lar seg fullføre med mellomrom alene.

Knappen med tastatursymbol øverst til høyre viser hurtigtastmerkene i UI-et.
Den er av som standard; tastene virker uansett. Tallene på søkealternativene
står alltid, siden de endrer seg fra søk til søk.

Appen står i mørkt tema som standard. Knappen ved siden av bytter til lyst, og
valget huskes til neste gang.

## Struktur

```
scripts/build_data.py       Leser kommentarer.pdf og bygger psykofarmakadatasettet
scripts/build_rusmidler.py  Leser rusmidler.md og bygger rusmiddeldatasettet
scripts/build_antihypertensiver.py
                            Leser AHT.docx og bygger antihypertensivdatasettet
src/data/analytter.json     Generert datasett (sjekket inn)
src/data/rusmidler.json     Generert datasett (sjekket inn)
src/data/antihypertensiver.json
                            Generert datasett (sjekket inn)
src/data/aliaser.json       Håndholdte ekstra søkeord per analyttkode
src/data/endringslogg.ts    Endringsloggen appen viser (håndholdt)
src/types.ts                Datamodellen
src/state.ts                Tilstandsmaskinen for stegene
src/domain/                 Bånd, klassifisering, søk, navn, fargespredning, kontrast,
                            analysemetodene og menytreet (analysemetoder.ts),
                            referansetallene analyttkortet viser (piller.ts),
                            tooltipplassering (tipsplassering.ts), flukten til
                            kopibeviset (flytting.ts), THC-fortolkning (thc.ts) med
                            figurgrunnlaget (thcPlot.ts), rusmiddelfortolkning (rus.ts),
                            EtG/EtS-fortolkning (etg.ts), formen på en kommentar med
                            koden den skal limes inn på (kommentar.ts), tastereglene
                            (tastatur.ts), tallfeltene (tallfelt.ts) og
                            versjonsformatet (versjon.ts)
docs/endringslogg.md        Rutinen for å føre loggen ved hver endring
src/hooks/                  Tastatur, tema, hurtigtastmerker, utklippstavle,
                            kopieringen av kommentarene (useKommentarflyt.ts)
src/components/             Stegene, sidemenyen (Sidemeny.tsx), kommentarblokkene
                            (Kommentarliste.tsx), felles
                            kort/pille/knapp/tallfelt/tooltip/ikoner
src/styles/                 tokens.css (design) + base.css + components.css
```

Alt som gjentar seg — farger, avstander, skriftstørrelser, knapper,
hurtigtastmerker, ikonrammen, tooltipene — er definert ett sted og gjenbrukt. Nye analytter
krever ingen kodeendring: de kommer med når kilden bygges på nytt. Nye steg
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

### Sidemenyen og analysemetodene

Hver analytt hører til en **analysemetode** — koden analysen rekvireres med —
og de fleste metodene er delt i **kategorier**. Begge deler står på analytten i
datasettet, ikke i en liste i koden:

| Metode | Hva den er | Kategorier |
| --- | --- | --- |
| `SPFA` | Antidepressiver og antipsykotika i serum | Antidepressiver, antipsykotika, stemningsstabiliserende |
| `SRUS` | Stoffer med ruspotensial i serum | Benzodiazepiner og Z-hypnotika, cannabinoider, opioider, sentralstimulerende |
| `UCAK` | THC-syre i urin | ingen |
| `UETGHB` | Etanolmetabolitter i urin | ingen |
| `AHT` | Antihypertensiver | ACE-hemmere, aldosteronantagonister, alfa- og betablokkere, alfablokkere, ARB, betablokkere, diuretika, kalsiumantagonister |

Metoden og kategorien står sammen i **én pille** øverst i analyttkortet, over
analyttkoden: «SPFA › Antidepressiver». De hører sammen — kategorien betyr
ingenting uten metoden — og deler derfor pille i stedet for å stå som to.
Analyttkoden beholder aksentfargen sin under. Pillen bærer ingen forklaring:
de som kommenterer analysene kjenner kodene sine, og hva en kode betyr står i
sidemenyen for den som trenger det.

Hver metode har **én farge**, gitt av plassen i `ANALYSEMETODER` og slått opp
med `metodefarger()`. Den samme fargen bærer skuffen i menyen, pillen i
analyttkortet, pillen i søket og menyknappen når filteret står på metoden, så
SPFA er den samme fargen overalt. Fargene kommer fra det samme settet som
søkealternativene bruker, og kontrasten deres måles i
`domain/__tests__/optionColours.test.ts`.

Sidemenyen bygges av de samme søkeoppføringene som søket leter i
(`byggMeny()` i `src/domain/analysemetoder.ts`), så listene kan ikke komme i
utakt med det appen faktisk kan kommentere. Én skuff per metode, én av gangen
åpen. Virkestoffene står alfabetisk, og bryteren «Vis kategorier» slår
kategoriskillene av og lister dem i én bolk i stedet. Bryteren og
«Inkluder alle analysemetoder» står fast øverst i panelet — de gjelder hele
lista og skal ikke kunne rulles bort fra den.

Én linje per **analyttkode**: en sumanalyse som `AMTNORSUM` er én linje, mens
en modul som dekker flere koder — diazepamgruppen, morfin og kodein, EtG og
EtS — får én linje per virkestoff, som alle fører til den samme modulen.

Radioknappen til venstre for en metode begrenser søket til den metoden;
«Inkluder alle analysemetoder» slår filteret av. `Alt + 1` … `Alt + 5` gjør det
samme uten å åpne noe: tallet er metodens plass i lista, den samme som gir den
fargen, og `metodesnarvei()` leser begge av det ene registeret. Snarveiene
virker overalt i appen — også mens menyene står åpne, siden det er der metodene
vises — men ikke mens endringsloggen fanger tastaturet. Filteret gjelder bare søket:
menyen viser alltid alt, og et virkestoff kan velges derfra uansett hva
filteret står på. Et filter som står på, kan gjøre at en analytt man vet
finnes ikke dukker opp i søket, så det vises to steder utenfor menyen:
menyknappen utvider seg til en pille med metodekoden i metodens farge
(«≡ SPFA»), og under søkealternativene står «Søket er begrenset til» med den
samme pillen — også når søket gir treff.

Den pillen er samtidig knappen som endrer filteret. Et trykk åpner en liten
meny med alle metodene som piller under hverandre — med hurtigtasten sin ved
siden av — og «Skru av filter» nederst, slik at man kan bytte metode eller slå
filteret av uten å gå veien om sidemenyen.

Menyen legger seg under pillen når den får plass der, ellers på den siden som
har mest plass; får den ikke plass på noen av dem, ruller den innenfor plassen
den har. Målingen gjøres på den ferdig oppsatte menyen og ikke på et anslag, så
ingen av valgene kan havne utenfor vinduet. `Esc`, et trykk utenfor, eller å
tabulere seg ut lukker den — det siste fordi knappene bak er dekket av
klikkflaten, men ikke av tastaturet. Den er et lag over appen på samme måte som
sidemenyen, så talltastene i søket ikke velger et alternativ bak den mens den
står åpen.

Menyknappen åpner menyen og blir liggende skjult bak panelet til det lukkes
igjen; panelet har sin egen lukkeknapp øverst til høyre. `Ctrl + M` åpner og
lukker, `Esc` lukker, og det gjør også et trykk hvor som helst på
hovedinnholdet.

Menyen er et lag over appen, som endringsloggen: `data-lag` sier fra til
`lagLiggerOver()`, slik at appens egne taster ligger i ro mens den står åpen.

### Versjon og endringslogg

Appen versjoneres etter SemVer. Versjonen står som en liten pille nederst til
høyre i vinduet, og et klikk på den åpner endringsloggen: én skuff per endring,
merket med dato og versjon, med en kort beskrivelse og merker for hva slags
endring det var og hvor stor den var. Skuffen foldes ut til en punktliste i
vanlig språk. Bare én skuff står åpen av gangen.

Føringene ligger i `src/data/endringslogg.ts`, nyest først, og versjonen appen
viser er den øverste føringen der — de to kan derfor ikke komme i utakt.
`package.json` holdes lik av en test. Formen på en føring er definert i
`src/domain/versjon.ts`, og rutinen for å legge inn en ny står i
[`docs/endringslogg.md`](docs/endringslogg.md).

Loggen er en `<dialog>` med `showModal()`, så fokusfelle, Escape og inert
bakgrunn kommer fra nettleseren selv. Appens egne taster hører fortsatt etter
på vinduet, og holdes i ro av `lagLiggerOver()` i `src/hooks/useKeyboard.ts` —
uten den ville `Esc` både lukket loggen og sendt appen et steg tilbake. Den
samme vakten gjelder sidemenyen, som sier fra med `data-lag`.

## Datasettet for psykofarmaka

De fire tabellene i `kommentarer.pdf` er slått sammen til én post per analytt
(35 stykker), med kode, navn, delanalytter, gruppe, enhet, referanseområde,
måleområde, ringegrense og de tre nivåene med hver sin kommentar.

Analysemetoden er `SPFA` for alle, og kategorien er overskriften analytten står
under i referansetabellen — antidepressiver, antipsykotika eller
stemningsstabiliserende.

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
Tallet CSS-en er dimensjonert etter — den bredeste etiketten datasettene gir —
holdes i sjakk av en test. Bredden måles i siffer: tallene står med
tabellbreddstall, mens komma, mellomrom og tankestrek er smale.

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

## Datasettet for antihypertensiver

Tabellen i `originaldata/AHT.docx` har tre rader per analytt — én per
kommentar — og 25 analytter. Kilden oppgir **fem** konsentrasjonsintervaller,
mens appen har tre knapper, så intervallene slås sammen:

| Knapp | Slått sammen av | Enalaprilat |
| --- | --- | --- |
| under | «Under nedre teknisk måleområde» + `L` | `< 1` + `1–9` → `< 10` |
| innenfor | «Terapiområdet» + `H` | `10–300` + `301–1199` → `10 – 1199` |
| over | «Toksisk konsentrasjon» | `≥ 1200` |

`L` og `H` er kildens merker for lav og høy konsentrasjon innenfor
måleområdet, og de har samme kommentar som intervallet de hører til: `L` deler
kommentar med «under måleområdet», `H` med terapiområdet. Derfor kan de slås
sammen uten at noen kommentar går tapt.

Bumetanid og furosemid er unntakene. De har verken `L` eller `H`, og kilden
kaller mellomintervallet «Innenfor» i stedet for «Terapiområdet» fordi de ikke
har noe definert terapiområde. De får derfor de samme tre knappene, men ingen
terapiområdepille.

Kategorien har **ingen ringegrense**. Ingen antihypertensiv analytt deler et
bånd i to eller får en ringepåminnelse i limsteget.

### Legemiddelgruppene

`AHT.docx` har ingen inndeling i legemiddelgrupper. Inndelingen sidemenyen
viser, er gjort én gang av klinikeren ved å lese suffiksene i
virkestoffnavnene: `-pril(at)` ACE-hemmere, `-renon` aldosteronantagonister,
`-ilol`/`-alol` alfa- og betablokkere, doksazosin alfablokker, `-sartan` ARB,
`-olol` betablokkere, `-id` diuretika, og resten kalsiumantagonister.

Suffiksene var en engangsnøkkel og er ikke en regel som gjelder videre.
Resultatet står derfor som en oppslagsliste (`KATEGORI` i
`scripts/build_antihypertensiver.py`) og utledes ikke av navnet; et nytt
virkestoff må føres inn manuelt, og byggeskriptet stopper hvis noen mangler.
Losartansyre er verdt å merke seg: den ender på `-syre` og ikke på `-sartan`,
men er den virksomme metabolitten av losartan og ført som ARB.

### Referansetallene på analyttkortet

Der psykofarmaka viser referanseområde og ringegrense, viser antihypertensiver
tre andre tall. Hvilke piller en analytt får, leses av datasettet og ikke av
gruppenavnet; reglene ligger i `src/domain/piller.ts` og er dekket av tester.

| Pille | Hvor tallet kommer fra |
| --- | --- |
| Påvisningsgrense | Tallet under «Under nedre teknisk måleområde» |
| Terapiområde | «Terapiområdet» slik kilden oppgir det — smalere enn båndet, som også dekker `H` |
| Toksisk | Samme tall som det øverste båndet begynner på |

Enheten står bare på den første pillen, som ellers i appen. Den toksiske pillen
bærer fargen til det øverste båndet, så pillen og knappen leses som det samme
tallet.

| Analytt | Piller | Bånd |
| --- | --- | --- |
| ENAT (Enalaprilat) | 1 nmol/L · `10 – 300` · `≥ 1200` | `< 10` · `10 – 1199` · `≥ 1200` |
| EPLR (Eplerenon, desimaler) | 2 nmol/L · `3,5 – 350` · `≥ 1400` | `< 3,5` · `3,5 – 1399,9` · `≥ 1400` |
| BUME (Bumetanid, uten terapiområde) | 10 nmol/L · `≥ 1600` | `< 10` · `10 – 1599` · `≥ 1600` |

Kanrenon er den aktive metabolitten av spironolakton, og det er moderstoffet
som står på rekvisisjonen. Analytten har derfor «spironolakton» som søkeord i
`src/data/aliaser.json`. Enalaprilat, ramiprilat og losartansyre trenger
ingenting tilsvarende: navnene begynner på moderstoffet, og søket treffer på
begynnelsen av navnet.

### Rettelser gjort i teksten

Alle rettelser ligger i `meta.rettelser` i `src/data/antihypertensiver.json`,
med kilde og begrunnelse, så de kan etterprøves mot Word-dokumentet.

| Type | Fra | Til | Antall |
| --- | --- | --- | --- |
| desimaltegn | `2.5`, `12.5`, `1.25` | `2,5`, `12,5`, `1,25` | 12 |
| ordlyd | `basert på bruk 5–40 mg daglig` | `basert på bruk av 5–40 mg daglig` | 9 |
| mellomrom | dobbelt mellomrom, hardt mellomrom og mellomrom i enden | vanlige enkle mellomrom | 3 |
| setningsrekkefølge | «… Kanrenon er den aktive metabolitten av spironolakton. Farmakokinetiske avvik? …» | «… Farmakokinetiske avvik? Kanrenon er den aktive metabolitten av spironolakton. …» | 1 |
| klinikerrettelse | FURO/innenfor: gjentakelsen av «under»-teksten | den korte formen bumetanid har for «innenfor» | 1 |

Punktum er byttet til komma **bare** mellom to siffer, så `ous.labfag.no` står
urørt. «av» er lagt til fordi de 60 andre radene i kilden har det og setningen
mangler preposisjonen uten det.

De to siste rettelsene er innholdsmessige og gjort etter direkte
tilbakemelding fra klinikeren, ikke maskinelt utledet som resten: kanrenons
metabolittsetning er flyttet til å stå etter begge spørsmålene, slik
enalaprilat, ramiprilat og losartansyre har det, og furosemids
«innenfor»-kommentar — som i kilden var en ordrett gjentakelse av
«under»-teksten — er byttet til den korte formen bumetanid har for det samme
tilfellet. Begge er merket `klinikerrettelse`/`setningsrekkefølge` i
`meta.rettelser` og skiller seg dermed fra de tekniske rettelsene.

### Uavklarte forhold i kilden

Disse lot seg ikke rette maskinelt og er ikke tatt stilling til av
klinikeren. De ligger i `meta.avvik` i datasettet.

| Kode | Type | Forhold |
| --- | --- | --- |
| VALS | overlapp | `L` slutter på 301, men terapiområdet begynner på 300. Appen lar båndet «under» slutte rett før 300. |
| BUME | overlapp | «Innenfor» slutter på 1600, toksisk begynner på 1600. Appen sier toksisk. |
| FURO | overlapp | «Innenfor» slutter på 40000, toksisk begynner på 40000. Appen sier toksisk. |
| FURO | påvisningsgrense | «Innenfor» er oppgitt som `1–40000`, men påvisningsgrensen er 50. Appen lar båndet begynne på 50. |
| KAND | overlapp | Terapiområdet slutter på 200, `H` begynner på 199. |
| VER | overlapp | Terapiområdet slutter på 400, `H` begynner på 40 — trolig 401. |

De to siste overlappene ligger inne i båndet «innenfor», som dekker
terapiområdet og `H` under ett. De endrer derfor ingen kommentar.

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
nytt i stedet for å kopiere. `Space` gjør det samme som `Enter` der tasten er
ledig — i tallfeltene, i datofeltene og på sikkerhetsmarginen — og trykker
fortsatt knappen, huker av avkryssingen eller folder ut «Forklaring» man står
på, så alt lar seg betjene med tastaturet som før. `Esc` går tilbake til søket.

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
   avgjøre» til «har vært inntatt». Er forrige prøve fortolket [under
   påvisningsgrensen](#forrige-prøve-uten-thc-syre), erstattes de to første
   konklusjonene av hver sin egen tekst.
4. **Mer enn 60 døgn** mellom prøvene setter forrige prøve til side (K21):
   kommentaren blir som om ingen tidligere prøve fantes, og modulen sier fra
   om hvorfor. Det samme skjer, uten notis, når «Ingen tidligere prøve
   tilgjengelig» er huket av.

### Forrige prøve uten THC-syre

Ble THC-syre rapportert som «ikke påvist» i forrige prøve, finnes det ingen
utskillelse å regne på, og modulen har to veier videre.

**IRCAK 0.** Tastes 0 i forrige prøve, må enhver påvisning i denne prøven komme
av et inntak etter den prøven, og kommentaren sier det — som ved kategori 4,
uansett hvor lav konsentrasjonen er nå. Det finnes ingen prosentvis endring fra
0, så figuren og forklaringen uteblir. 60-dagersregelen går foran: en prøve som
er for gammel til å sammenlignes med, er det uansett hva den viste.

**Under cut-off.** Er urinen svært fortynnet, kan THC-syre havne under
påvisningsgrensen selv om den er der, og en senere og mer konsentrert prøve kan
komme over grensen igjen uten at noe nytt er inntatt. Labsystemet har da et
internt THC-syretall, men kreatininkorrigerer det ikke. Avkryssingen «Under
cut-off» øverst i «Forrige prøve» bytter derfor IRCAK-feltet ut med **UCAK**
(THC-syre) og **NKRE** (kreatinin); IRCAK regnes ut som `UCAK/NKRE` og vises
rett under feltene. Fortolkningen går som ellers, med to forskjeller:

- **Måleusikkerheten legges 50 % høyere til grunn** (`USIKKERHET_UNDER_CUTOFF`).
  Faktoren ganges inn i log-standardavviket, altså i spredningen korreksjonen
  leses av i, så konklusjonen blir mer forsiktig. Et banner over
  sikkerhetsmarginen sier fra om det. Uten sikkerhetsmargin har den ingen
  virkning: medianen i fordelingen flytter seg ikke av at spredningen blir
  større.
- **Konklusjonen mot forrige prøve får sin egen ordlyd** — to tekster som ikke
  finnes i regnearket, men er bestilt av eieren. Ligger endringen innenfor det
  forventede, forklarer kommentaren at prøven ble rapportert som «ikke påvist»
  selv om nivået kan svinge over og under påvisningsgrensen uten nytt inntak.
  Ligger den mellom kurvene, sier den at inntakstidspunktet ikke kan avgjøres.
  Er inntaket sikkert nytt, brukes den vanlige kommentaren uendret — da er det
  ikke noe mer å forklare.

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

Benzodiazepiner og Z-hypnotika, cannabis, opioider og sentralstimulerende
stoffer kommenteres etter tabellene i `originaldata/rusmidler.md`. Søkes ett av
stoffene opp, går appen til fortolkningsmodulen for det i stedet for til
konsentrasjonsbåndene.

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

De fire fellesmodulene er `DIAZ · DMI · OXA`, `TRAM · OTRAM`, `KOD · MOR` og
`AMF1 · MAF1`. De tretten andre stoffene har hver sin modul med bare seg selv.

Analysemetoden er `SRUS` for alle, og kategorien er overskriften stoffet står
under i kilden. Det ene unntaket er «Cannabis», som heter «Cannabinoider» i
appen etter ønske fra klinikeren; oversettelsen står i `KATEGORI` i
`scripts/build_rusmidler.py`, og skriptet stopper hvis kilden får en overskrift
uten kategori.

### Slik brukes modulen

Modulen spør om det den trenger for å velge riktig kommentar, og ikke om noe
annet:

| Modul | Hva den spør om |
| --- | --- |
| Ett stoff | Ingenting — kommentaren er gitt |
| Fellesmodul | Hvilke av stoffene som er påvist i denne prøven |
| Diazepam-gruppen | I tillegg de målte konsentrasjonene, når alle tre er påvist |
| Kodein og morfin | I tillegg de målte konsentrasjonene, når begge er påvist |

Har en fellesmodul flere stoffer å krysse av, bærer hver avkryssing sitt eget
talltast — `1` for det første stoffet, `2` for det andre og så videre — så et
helt sett kan hukes av uten mus. Konsentrasjonsfeltene bruker de samme tastene
til å taste inn tall, og der har feltet forrang: tastene huker ikke av noe når
et konsentrasjonsfelt står fokusert.

Resultatkortet viser én blokk per kommentar, i den rekkefølgen de skal limes
inn, med analyttkoden i store bokstaver — det er den som må leses av og
handles på. Gjelder en tilleggskommentar to koder, står begge i den samme
blokka, så den bare kopieres én gang. `Enter` og `Space` kopierer den som står
for tur, og merket `↵` flytter seg til den neste; når alt er kopiert, tar de
deg tilbake til søket. Er tallene fylt inn, går altså hele kommenteringen på
mellomrom alene, uten å flytte hendene fra feltene. Hver blokk har også sin
egen kopiknapp, og kvitteres med det samme blinket som i båndsteget pluss et
«Kopiert» som blir stående, så det synes hva som gjenstår når kommentarene tas
én av gangen.

Kopieringen henter fram knappene den gjelder. Kommentaren kopieres gjerne fra
et felt lenger oppe, og knappen som står for tur kan ligge under skjermkanten,
så siden hopper slik at knappen som ble brukt står i bildet når blinket kommer,
og slik at den neste knappen kommer til syne med det samme — den er ladet og
kopierer den siste kommentaren ved neste tastetrykk, og det skal gå fram uten
at man må lete etter den. Er alt kopiert, er det «Ferdig» som hentes fram.
Hoppet er umiddelbart og ikke jevnt: blinket festes til knappen i
vindukoordinater, og en rulling som fortsatt glir ville løsrevet kvitteringen
fra knappen den gjelder.

Er det noe å velge mellom, står kommentarteksten framme i blokka: da kan
valget bli feil, og den som limer inn skal kunne lese hva som faktisk havner
på utklippstavlen. Er det bare én kommentar uansett — som for alprazolam eller
metadon — er teksten unødig støy på skjermen, og henger i stedet på
kopiknappen som en tooltip. Koden vises begge veier.

Skrives en kommentar ut i sin helhet — her og i THC-modulen — står den i kursiv
med en loddrett linje til venstre, samme konvensjon overalt i appen. Det skal
aldri være tvil om at teksten er den kliniske kommentaren og ikke appens egne
ord.

Selve kopieringen — hvilken kommentar som står for tur, kvitteringene, `Enter`
og hoppet som henter knappene fram — ligger i `src/hooks/useKommentarflyt.ts`
og deles med limsteget i EtG- og EtS-modulen, slik at de to oppfører seg likt.
Blokkene i denne modulen står i `src/components/Kommentarliste.tsx`.

### Reglene modulen følger

**Diazepam, N-desmetyldiazepam og oksazepam.** Diazepam og desmetyldiazepam
vurderes alltid samlet, med kommentaren under diazepam når begge er påvist.
Oksazepam har sin egen kommentar, men er også en metabolitt av diazepam, og
kilden har en felles kommentar for alle tre. Den brukes når alle tre er påvist
og oksazepam utgjør høyst 10 % av summen av diazepam og desmetyldiazepam; over
10 % kommenteres oksazepam for seg. Derfor spør modulen om konsentrasjonene når
alle tre er påvist, regner ut andelen og viser i et banner hvilken side av
10 %-grensen den falt på.

**Kodein og morfin.** Hver for seg har de hver sin standardkommentar. Er begge
påvist, avgjør forholdet mellom konsentrasjonene hvilken kommentar som gjelder:

| Morfin av kodein | Hva som skjer |
| --- | --- |
| Under 20 % | Høy kodein, lav morfin: kombinasjonskommentaren på `KOD`, henvisningen på `MOR` |
| 20–100 % | Gråsone. Kilden har ingen standardkommentar, og appen tilbyr ingenting å kopiere — den sier at saken skal tas opp i plenum, og viser kildens råd om utgangspunktet |
| Over 100 % | Ordinær kombinasjon: den utvidede kodeinkommentaren på `KOD` og morfinets egen på `MOR` |

Det er ikke fastsatt noen absolutt konsentrasjonsgrense for hva som er høy
kodein og lav morfin; det er forholdet mellom tallene som brukes. Derfor
spiller enheten ingen rolle, verken her eller i diazepam-gruppen.

**Amfetamin og metamfetamin.** Hver for seg har de hver sin kommentar. Er begge
påvist, går fellesskommentaren på metamfetamin — den forklarer nettopp at
amfetamin alene kan komme fra legemidler — og amfetamin får henvisningen dit.

### Rettelser gjort i teksten

Rettelsene ligger i `meta.rettelser` i `src/data/rusmidler.json`, med kilde og
begrunnelse, så de kan etterprøves mot dokumentet.

| Type | Fra | Til | Antall |
| --- | --- | --- | --- |
| tankestrek | `40-120`, `2-10`, `600-1200`, `300-600`, `100-800`, `10-40`, `30-70`, `4-8` | `40–120`, `2–10`, `600–1200`, `300–600`, `100–800`, `10–40`, `30–70`, `4–8` | 8 |
| tegnsetting | `Se kommentar for diazepam i serum`, `Se kommentar for metamfetamin i serum` | samme med avsluttende punktum | 2 |

Som ellers i appen er bindestrek byttet til tankestrek **bare** mellom to tall.
`O-desmetyltramadol`, `N-desmetyldiazepam` og `LAR-behandling` står urørt. De
to punktumene mangler i kilden fordi en plasseringsinstruks i klammer står der
punktumet ellers ville stått; de samme kommentarene har det andre steder.

Uthevinger, plasseringsinstrukser i klammer og linjeskift som er blitt til
doble mellomrom, er notasjon rundt teksten og ikke en del av kommentaren.
Byggeskriptet fjerner dem, og en test holder kommentarene opp mot det: ingen av
dem inneholder `*`, `[` eller `]`, doble mellomrom eller mangler sluttegn.

### Uavklarte forhold i kilden

| Hvor | Forhold |
| --- | --- |
| Diazepam-gruppen | Kilden knytter fellesskommentaren til at alle tre stoffene er påvist. Er oksazepam påvist sammen med bare ett av de to andre, sier den ingenting, og appen kommenterer stoffene hver for seg — og sier fra om at den gjør det. |
| Diazepam-gruppen | Overskriften på kombinasjonsraden er forkortet til «OXA ≤ DIAZ + DMI», mens teksten over tabellen sier «OXA ≤ 10 % av summen DIAZ + DMI» to ganger. Appen følger teksten. |
| Tramadol | Analytt- og kodecellen i tramadolraden har mistet linjeskiftet sitt, så «Tramadol» og «O-desmetyltramadol» står som ett ord. Byggeskriptet ser bort fra mellomrom når det sammenligner, så artefakten stopper ikke byggingen — men en celle som sier noe annet, gjør det. |

## EtG og EtS i urin

Etylglukuronid (`UETGS`) og etylsulfat (`UETS`) er omdannelsesprodukter av
etanol, og de vurderes alltid sammen. Derfor deler de én modul: det spiller
ingen rolle om man søker på `EtG`, `EtS`, hele navnet, koden eller på «etanol»
eller «alkohol» — alt fører til den samme fortolkningen.

Modulen spør om én ting: hva som er påvist i denne prøven. Det gjør den til det
samme valget som konsentrasjonsbåndene er for psykofarmaka, og steget er bygd
av de samme knappene: ett tilfelle per knapp, valgt med et klikk eller med
tallet sitt, og kommentaren kopiert i det knappen trykkes. Så kommer limsteget,
med knappen som ble brukt stående over kortet som bevis. `Esc` går tilbake til
valget, `Enter` og `Space` avslutter.

| Tast | Tilfelle | Hva som skjer |
| --- | --- | --- |
| `1` | Begge påvist | Fortolkningen kopieres og skal på `UETS`. I limsteget står også henvisningen «Se kommentar for EtS i urin.», som skal på `UETGS` |
| `2` | EtG påvist | Kommentaren kopieres og skal på `UETGS`. `UETS` får ingen kommentar |
| `3` | EtS påvist | Den samme kommentaren kopieres og skal på `UETS`. `UETGS` får ingen kommentar |

Skillet er klinisk. Er begge påvist, viser funnet at etanol er inntatt. Er bare
den ene påvist, kan funnet være forenlig med inntak — men det kan også komme
etter alkoholfri vin eller øl og andre mat- og drikkevarer, og kommentaren sier
det. Teksten for de to enkelttilfellene er derfor den samme; det er bare koden
den limes inn på som skiller dem.

Er begge påvist, hører det to kommentarer til valget, og begge står i
limsteget med hver sin kode. Hovedkommentaren ligger alt på utklippstavlen —
den ble kopiert da knappen ble trykket — og `Enter` eller `Space` tar
tilleggskommentaren og deretter avslutningen, slik at kommenteringen går på
tastaturet alene. Kommentarteksten står under koden i begge kortene: med to
kommentarer i bildet må det gå fram hvilken som hører til hvilken kode.

Tallmerkene på de tre knappene står alltid, uavhengig av innstillingen for
hurtigtastmerker. Modulen er tre knapper og ingenting annet, og tastene er den
raskeste veien gjennom den.

Knappene låner ikke fargene fra konsentrasjonsbåndene. Nivåfargene betyr noe
klinisk i resten av appen, og et tilfelle her er ikke et nivå; knappene har
derfor samme form som båndknappene, men en nøytral farge.

> **Ordlyden i kommentarene** er bestilt av den som eier appen, og skal ikke
> endres uten at eieren uttrykkelig har bedt om det og bekreftet den nye
> ordlyden. Tekstene står i `src/domain/etg.ts`, og testene holder dem tegn for
> tegn.

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

Sidemenyen er merket som `<nav>` med navn, menyknappen melder om den er åpen
med `aria-expanded` og om snarveien med `aria-keyshortcuts`, og radioknappene
er ekte radioknapper i en gruppe med navn, så filteret kan settes med
piltastene. Hver metode melder sin egen `Alt`-snarvei på samme måte, både i
sidemenyen og i filtermenyen. Skuffene melder seg med `aria-expanded` og `aria-controls`, og
innholdet i en lukket skuff er satt usynlig når glidningen er over, så det
verken nås med tabulator eller leses opp.

Fordi menyknappen blir liggende skjult bak panelet, tar panelet selv imot
fokuset når menyen åpnes, og tabulator går rundt inne i det så lenge den står
åpen — fokus skal ikke kunne havne på noe man ikke ser. Lukking gir fokus
tilbake til menyknappen, som da er synlig igjen. `Esc` lukker menyen, og appens
egne taster ligger i ro så lenge den står åpen.

Endringsloggen åpner med den nyeste føringen fokusert, ikke med lukkeknappen,
så `Enter` folder ut det man kom for i stedet for å lukke loggen igjen med det
samme. Innholdet i en lukket skuff er satt usynlig når glidningen er over, så
det verken nås med tabulator eller leses opp.

Kvitteringen for kopieringen meldes i tillegg som statusbeskjed, siden blinket
er rent visuelt. Uten bevegelse blir kvitteringen stående stille i stedet for å
sprette fram, og beviset over lim-inn-kortet står ferdig landet i stedet for å
fly. Beviset sier med skjult tekst hva det er — «Kopiert kommentar for» foran
båndet — så det ikke blir en løsrevet tallrekke for den som ikke ser fargen og
ikonet.
