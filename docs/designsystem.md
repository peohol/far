# Designsystemet og appskallet

OUSFAR bruker designsystemet **OUSFAR Atlas** fra Claude Design. Planen for
hele omleggingen står i `docs/ux-reimagination.md`. Denne filen beskriver
byggeklossene: tokens, stilarkene, ikoner, knapper, flatene og skjemaene,
de modale lagene og den faste toppmenyen, og hvordan tekst i grensesnittet
skrives. Den er for den som skal bygge nye skjermbilder eller endre gamle.

## Tokens

Alle verdier står i `src/styles/tokens.css`. Komponentene bruker tokens og
har ingen egne tall. Mangler en verdi, legges den inn der på riktig nivå.

- **Skrift:** `--skrift-display` (Newsreader, sidetitler og store tall),
  `--skrift-ui` (Public Sans, alt annet) og `--skrift-mono`. Skriftene ligger
  i appen selv (`@fontsource-variable`), ikke hos Google.
- **Størrelser:** `--tekst-display`, `-sidetittel`, `-tall`, `-seksjon`,
  `-lesing` og `-ingress` skalerer med vinduet (`clamp`). `--tekst-ui`,
  `-etikett`, `-liten`, `-meta` og `-merke` er faste.
- **Vekt og linjehøyde:** `--vekt-normal`, `-medium`, `-halvfet`, `-fet`,
  `--linjehoyde-*` og `--sperring-meta` (sperringen i små versaler).
- **Mellomrom:** `--rom-1` til `--rom-10` er 4, 6, 10, 12, 14, 18, 22, 28, 40
  og 56 px. `--rom-side` er margen mot vinduskanten.
- **Runding:** `--runding-merke`, `-felt`, `-knapp`, `-underkort`,
  `-felt-gruppe`, `-kort`, `-panel` og `-pille`.
- **Bredder:** `--bredde-fortolkning` er kolonnen fortolkningsstegene står i.
- **Kanter og høyder:** `--kant`, `--kant-aktiv`, `--kant-tykk`,
  `--fokusring`, `--hoyde-kontroll`, `--hoyde-trykk` (minste trykkflate),
  `--hoyde-toppmeny` og `--hoyde-dokk`.
- **Ikoner:** `--ikon-ui`, `-panel`, `-underpunkt`, `-seksjon`, `-form`,
  `-konsept` og `-plot`, og `--ikon-sirkel` (`-smal` på mobil) for sirkelen rundt
  seksjonsikonet.
- **Lag:** `--lag-innhold` (det som flyter over siden, under toppmenyen og
  mørkleggingen bak sidemenyen), `--lag-toppmeny`, `--lag-popover` og
  `--lag-modal`.
- **Bevegelse:** `--fart-rask`, `-glid`, `-flyt` og `-ikon`, med `--kurve`
  og `--kurve-ikon`. Med `prefers-reduced-motion` er alle `--fart-*` 0 ms.
  Egne overganger skal bruke dem, så de slås av med resten.

### Farger og tema

Fargene er semantiske og finnes i lyst og mørkt tema med de samme navnene.
Temaet settes med `data-tema="lyst"` eller `"moerkt"` på `<html>`, og kan også
settes på et enkelt element.

- **Flater:** `--flate-bunn`, `--flate`, `--flate-hevet`, `--flate-toppmeny`.
- **Tekst:** `--blekk-sterk`, `--blekk`, `--blekk-dempet`.
- **Linjer:** `--linje` (hårlinjer), `--linje-sterk` og `--linje-kontroll`.
  Kanten rundt et skjemafelt skal være `--linje-kontroll`, som holder 3:1 mot
  bakgrunnen. Atlas sin `--linje-sterk` er for svak til det.
- **Aksent:** `--aksent`, `--aksent-2`, `--aksent-flate`, `--paa-aksent`,
  `--fokus`.
- **Merker:** `--fritak-blekk` og `--fritak-flate` for godkjenningsfritak.
- **Nivåer:** `--referanse`, `--toksisk`, `--alvorlig`, `--under` og `--blod`,
  hver med `-blekk`, `-flate` og `-kant`. `-kant` er for kanter og streker som
  må holde 3:1. Farge er aldri alene om å bære betydning: nivået står også i
  tekst eller ikon.

`src/styles/__tests__/palette.test.ts` sjekker kontrasten til alle par som
brukes sammen, i begge temaer. Et nytt fargepar skal inn der.

Logomerket (`src/components/konto/Logomerke.tsx`) er pynt og tegnes med
`--aksent`, `--paa-aksent` og `--logo-punkt`, så det følger temaet.

## Stilarkene

Hvert område har sitt eget stilark i `src/styles/`, så parallelle endringer
ikke møtes i én stor fil. De felles står i `main.tsx`, i denne rekkefølgen:

- `tokens.css` og `base.css`: verdiene, og siden, scenen og stegkolonnen.
- `handlinger.css`: knappene og hurtigtastmerket.
- `flater.css`: panelet, panelhodet, metalinjen, pillene, kommentarteksten,
  varselet, mangellista, de sammenleggbare seksjonene og kopiering for hånd.
- `skjema.css`: avkryssing, feltgruppe, feltrad, felt og bryter.
- `tips.css`: tooltipen.
- `fortolkning.css` og `thc.css`: fortolkningsstegene og THC-modulen.
- `sidemeny.css`, `infoside.css`, `redigering.css`, `ikon.css`,
  `toppmeny.css`, `endringslogg.css`, `konto.css` og `regler.css`.
- `components.css`: bare søket på siden, til det får sin egen fil.

Komponentene i informasjonssiden, seksjonene, referansene, merkene og det
modale laget henter sitt eget stilark selv.

## Ikoner

Ikonene står i `src/components/ikon/`. `register.ts` har tegningene fra
Atlas. Det er data, så et nytt ikon er en ny oppføring der.

```tsx
<Ikon navn="interp" />                         // følger skriftstørrelsen
<Ikon navn="dose" storrelse="seksjon" />       // 36 px, fra --ikon-seksjon
<Ikon navn="tox" storrelse={24} etikett="Toksisk" />
```

- **Størrelse:** `tekst`, `ui`, `underpunkt`, `seksjon`, `konsept`, `plot`,
  et tall i piksler eller en CSS-lengde.
- **Navn:** uten `etikett` er ikonet pynt og skjult for skjermlesere. Da skal
  navnet stå i teksten eller på knappen. Med `etikett` er det et bilde med
  navn.
- **Farger:** hver del av tegningen har en rolle (fyll, linje, prikk) og en
  semantisk farge. Utseendet står i `src/styles/ikon.css`, så ikonene følger
  temaet.
- **Bevegelse:** ikonet spiller en kort animasjon én gang når nærmeste
  `[data-ih]` får peker eller fokus, og første gang det kommer i bildet.
  Ingenting spilles med `prefers-reduced-motion`.

- **Klikk:** delene av tegningen tegnes på nytt hver gang animasjonen
  spilles, også når et museklikk gir knappen fokus. Derfor tar bare selve
  ikonet imot pekeren (`.ikon * { pointer-events: none }`). Ellers ville
  trykket sluppet på et annet element enn det startet på, og klikket blitt
  borte.

Alle ikoner i appen er `Ikon`. Det finnes ingen andre ikonsett.

## Knapper

- **`Ikonknapp`** (`src/components/Ikonknapp.tsx`) er en rund knapp med bare
  ikon. `etikett` er påkrevd og blir både knappens navn og tooltip.
  Variantene er `myk`, `stille`, `aksent` og `kant`, og størrelsene er
  `kontroll` og `liten`. På smale flater er den minst 44 px. `utenTips`
  tar bort tooltipen der den ville havnet under et modalt lag.
- **`Toppmenyknapp`** (`src/components/toppmeny/Toppmenyknapp.tsx`) er en
  pille med ikon og tekst, `primar` eller `sekundar`. På smalere skjermer
  krymper en sekundær knapp til bare ikon.
- **`Button`** (`src/components/Button.tsx`) er knappen i skjemaer og lag:
  `primary`, `subtle` og `kant` (pille med tynn kant, for handlinger på en
  rad, som «Nytt passord» i brukerlista).

Alle handlinger i toppmenyen har ikon.

`Button` med `shortcut` viser tasten i et merke. Knappen som står for tur,
er `primary` med ↵; de andre er `kant`.

## Flater og skjema

- **`Card`** er panelet: hårlinje, stor runding og ingen skygge. `align="start"`
  venstrestiller innholdet.
- **`Panelhode`** (`src/components/Panelhode.tsx`) er overskriften i et panel:
  ikon og kursiv serif. `tone="toksisk"` er for det som mangler.
- **`Metalinje`** (`src/components/Metalinje.tsx`) er linja over et stoffnavn,
  som «KVE · SPFA › Antipsykotika». Med `lenker` er kodene lenker til
  informasjonssiden (`Kodepille`).
- **`StepBar`** er raden øverst i hvert fortolkningssteg. Esc-handlingen står
  alltid der, med ikon og tastemerke.
- **`Kommentarliste`** er kommentarblokkene i modulene: hvor kommentaren skal
  limes inn, teksten skrevet ut og kopiknappen. `Kopibevis` er knappen som
  ble brukt, og som følger med til limsteget.
- **`Details`** er en sammenleggbar seksjon med ikon og pil.
- **Klasser uten egen komponent:** `.kommentartekst` (teksten som limes inn),
  `.notis` (forsiktighet, med `--handling` når den tilbyr handlingen),
  `.mangelliste`, og skjemaklassene `.avkryssinger`/`.avkryssing`,
  `.feltgruppe`, `.feltrad`, `.skjemafelt`, `.inndatafelt` og `.bryter`.

Fargen til et konsentrasjonsbånd går gjennom `--band-farge`: under er
`--under`, innenfor referanseområdet `--referanse`, over og cut-off
`--toksisk`, ringegrensen `--alvorlig`. Nivået står også i ikonet og tallet.

## Tekst i grensesnittet

Planen (§12) skiller mellom to slags tekst:

- **Klinisk innhold:** kommentarene, analyttnavn, enheter, grenser, regler
  og varsler som sier noe faglig, som THC-merknaden om måleusikkerhet under
  påvisningsgrensen. Den endres bare i faglige oppgaver, aldri i et
  designløft.
- **Grensesnittekst:** knapper, overskrifter, instrukser og hjelpetekster.
  Den skal være kort, og ikke gjenta det ikon, etikett eller plassering
  allerede sier.

Slik står grensesnitteksten i fortolkningen (Atlas har de samme ordene):

| Hvor | Tekst |
| --- | --- |
| Søket | «Begynn å skrive navnet på en analytt eller kode.» og «Søket er begrenset til» foran metodepillen |
| Esc-raden | «Bytt analytt», «Endre konsentrasjon», «Endre valg» |
| Panelhoder | «Målt konsentrasjon», «Påvist i denne prøven», «Kommentar(er)», «Til plenum», «Mangler», «Henter reglene», «Visualisering» |
| Limsteget | «Lim inn kommentaren på» og koden, «Husk å ringe!», «Ferdig» |
| Kommentarblokkene | merket («Hovedkommentar»), «Lim inn på» og koden, «Kopier», «Kopiert» |
| THC | «Forrige prøve», «Denne prøven», feltnavnene, «Nullstill», «Trykk ↵ for å nullstille nå», «Forklaring» |
| Kopiering feiler | «Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.» (`KOPIFEIL` i `ManualCopy.tsx`) |

Ryddet bort i omleggingen:

- Tooltipen på «Kopier» når kommentarteksten står skrevet ut rett over.
- «· kan ikke redigeres» ved automatiske kilder i lesemodus. Merknaden står
  bare i redigering, der den betyr noe.

## Merker og modale lag

- **`Merke`** (`src/components/Merke.tsx`) er en liten merkelapp for en
  status, f.eks. «Godkjenningsfritak», «Åpnet herfra» eller «Administrator».
  Tonene er `noytral`, `flate`, `aksent`, `fritak`, `referanse`, `toksisk`
  og `alvorlig`, og hver er et fargepar som `palette.test.ts` måler.
  Betydningen står alltid i teksten.
- **`Modallag`** (`src/components/Modallag.tsx`) er det ene modale laget,
  for endringsloggen, kontoen, brukerlista, historikken, publiseringen og
  preparatvinduet. Det bygger på `<dialog>`: fokusfelle, Escape, trykk på
  bakgrunnen, låst rulling bak og fokuset tilbake. Tittelen er lagets navn,
  og lukkeknappen heter «Lukk» og tittelen, eller `lukketekst`.
  - `ikon`: ikonet i sirkelen foran tittelen.
  - `handling`: en ekstra knapp øverst, som «Opprett bruker». På smale
    flater får den en egen rad under tittelen.
  - `bred`: bredere panel. `tettKropp`: mindre luft rundt innholdet.
  - `autofokus`: en CSS-velger for hvor fokus skal stå når laget åpnes.
  - `meta`, `undertittel` og `merker` gir Atlas-hodet: en linje i versaler,
    ikonet, tittelen i Newsreader og merkene under, på en hevet flate.
  - `ark`: laget blir et ark nedenfra på smale flater.

  Stilen står i `modallag.css`. Endringsloggen og versjonspillen har sin
  egen i `endringslogg.css`.

## Toppmenyen

`src/components/toppmeny/Toppmeny.tsx` er den ene faste menyen øverst. Den er
en svevende pille med delvis gjennomsiktig flate og uskarp bakgrunn. Der
nettleseren ikke kan gjøre bakgrunnen uskarp, er flaten helt dekkende. Fra
venstre inneholder den:

1. sidemenyen
2. globalt fagsøk (`sok`)
3. sidens egne plasser, `sidesok` og `handlinger`
4. et skille
5. hurtigtaster og tema
6. kontoen

### Plassene sidene fyller

Appen står i `ToppmenyKilde`. En side legger innhold i menyen med
`ToppmenyInnhold`:

```tsx
<ToppmenyInnhold spor="handlinger">
  <Toppmenyknapp ikon="interp" variant="primar" …>Åpne fortolkning</Toppmenyknapp>
  <Lukkeknapp onLukk={lukk} />
</ToppmenyInnhold>
```

Innholdet tegnes med en portal. Det står i menyen, men hører fortsatt til
siden, med sidens tilstand og kontekster. Står siden uten toppmeny rundt seg,
som i en test, blir innholdet stående i siden.

- `handlinger`: brukes av stoffsiden til «Åpne fortolkning», «Rediger» og
  «Lukk». I redigeringsmodus står bare redigeringen der: status, «Publiser»
  og «Avslutt redigering» (`Redigeringslinje.tsx`). Publiseringen viser hva
  som blir synlig for alle i et modalt lag før noe publiseres. Stilene for
  redigeringen står i `src/styles/redigering.css`.
- `sidesok`: plassen til søket i den åpne siden. Den er tom foreløpig, og
  stoffsidens eget søk står i siden som før.
- `sok` (en prop på `Toppmeny`): plassen til globalt fagsøk. Feltet er
  klart i `Fagsokfelt.tsx`, med snarveien Ctrl K eller Cmd K. Selve søket
  og rullegardinen kobles til når fagsøket bygges. Snarveien virker ikke i
  et redigeringsfelt eller mens et lag står åpent.

### Høyden og rullingen

`--toppmeny-offset` er menyens høyde med luft under. Alt som skal stå under
menyen, bruker den:

- `.app` har den som luft øverst.
- Ankere i `.scene` har den som `scroll-margin-top`, så en lenke til et anker
  ikke havner under menyen.
- Seksjonene gjør det samme (se `docs/seksjoner.md`).
- Rulling i skript regner fra menyens underkant (`toppmenyensBunn()`).

### Smale flater

Under 760 px bredde gjelder dette:

- Søket får all plassen i pillen.
- Knappene for hurtigtaster og tema viker. Temaet ligger da i kontomenyen.
- Sidens plasser flytter til en **dokk** nederst i vinduet, og siden får
  `--dokk-offset` luft nederst.

### Kontomenyen

`src/components/konto/Kontomeny.tsx` åpnes fra avataren helt til høyre. Den
viser hvem som er logget inn, og fører til:

- profilen
- brukerlista
- endringsloggen
- tema, bare på smale flater
- utlogging

Valgene er en liste med ikon, tekst og eventuelt et hint. Nye konto- og
redigeringsvalg legges inn i den samme lista. Menyen er et lag (`data-lag`),
så appens egne taster ligger i ro mens den står åpen. Escape, et trykk
utenfor eller fokus som går ut av menyen, lukker den.

Innloggingssiden har ingen toppmeny, bare temaknappen. De delene den bruker,
står oppført som åpne i `scripts/kontroller-vegg.mjs`.
