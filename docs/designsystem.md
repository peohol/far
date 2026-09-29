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
  Egne overganger skal bruke dem, så de slås av med resten. Det gjelder også
  bevegelse i JavaScript: `useFlytting` leser `--fart-flyt` og `--kurve`.

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
- `skjema.css`: avkryssing, feltgruppe, feltrad, felt, bryter og trinnbryter.
- `tips.css`: tooltipen.
- `fortolkning.css` og `thc.css`: fortolkningsstegene og THC-modulen.
- `sidemeny.css`, `infoside.css`, `redigering.css`, `ikon.css`,
  `toppmeny.css`, `endringslogg.css`, `konto.css` og `regler.css`.
- `sok.css`: fagsøkets rullegardin, søkesiden, søket på siden og
  fremhevingen av treff i teksten (`.sidetreff`).

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
- **`Metalinje`** (`src/components/Metalinje.tsx`) er linja over et stoffnavn
  i fortolkningen, som «KVE · SPFA › Antipsykotika». Med `lenker` er kodene
  lenker til informasjonssiden (`Kodepille`). På informasjonssiden har linja
  over navnet i stedet kategoriene fra stoffregisteret («Antidepressiver ›
  SSRI»), og under navnet står analyttkoden som pille (`pille--kode`, en knapp
  til fortolkningen) og «Inngår i» med `Metodepille`.
- **`StepBar`** er raden øverst i hvert fortolkningssteg. Esc-handlingen står
  alltid der, med ikon og tastemerke.
- **`Kommentarliste`** er kommentarblokkene i modulene: hvor kommentaren skal
  limes inn, teksten skrevet ut og kopiknappen. `Kopibevis` er knappen som
  ble brukt, og som følger med til limsteget.
- **`Details`** er en sammenleggbar seksjon med ikon og pil.
- **`Trinnbryter`** (Atlas `MarginScale`) er noen få faste valg side om side,
  der en knott glir til valget. Valget trykkes eller dras dit; en usynlig
  skala under tar tastaturet og skjermleserne. Brukes til sikkerhetsmarginen
  i THC-modulen.
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

Resten av grensesnitteksten:

| Hvor | Tekst |
| --- | --- |
| Toppmenyen | «Søk i fagstoff» med «Ctrl K», «På siden» med «Ctrl B», «Åpne fortolkning» (stoffsiden), «Åpne stoffside» (fortolkningen), «Rediger», «Lukk» |
| Redigering | statuspillen «Redigerer · …» («ingen upubliserte endringer», «utkast med N endringer», «alt er publisert»), «Publiser», «Avslutt redigering», «Publiser endringene», «Publiser nå» |
| Panelene i redigering | «Rediger», «Legg til», «Legg til kort», «Koble til legemiddeldataene», «Kilder for panelet», «Rediger reglene», «Lagre utkast», «Avbryt» |
| Viktige data | «Konsentrasjoner i serum», «Kinetikk», «Ikke oppgitt» |
| Fagsøket | «↑ ↓ velg · Enter åpne · Esc lukk», «Vis alle treff (N)», «Ingen treff i fagstoffet.» |
| Søkesiden | «Søk i fagstoff», fanene «Alle», «Stoff», «Preparater», «Tekst», «Referanser», og gruppen «I teksten» |
| Toppmenyen, høyre side | «Idéer», «Administrasjon» med «Brukere» og «Datakilder», og kontomenyen med «Endre navn og profilbilde», «Preferanser» («Vis hurtigtaster», «Mørkt tema») og «Logg ut» |
| Versjonspillen | klokka og versjonen, «Vis endringslogg» |

Hurtigtastmerkene vises ikke i søkefeltene på smale flater: der er det
sjelden et tastatur.

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
  for endringsloggen, kontoen, brukerlista, historikken, publiseringen,
  preparatvinduet og redigeringsskjemaene på stoffsiden. Det bygger på `<dialog>`: fokusfelle, Escape, trykk på
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
  - `fot`: en rad nederst som står fast mens kroppen ruller, som knappene i
    et skjema (koble dem til skjemaet med `form`).
  - `vedLukking`: spørres før laget lukkes med Escape, lukkeknappen eller et
    trykk utenfor; gir den `false`, blir laget stående.

  Redigeringsskjemaene på stoffsiden (`Skjemaramme` i `Skjemaer.tsx`) åpnes
  alltid i laget, med ikonet til det som redigeres. Har brukeren endret noe,
  spør vinduet før det lukkes uten å lagre.

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
5. idéene og, bare for administratorer, adminmenyen (`verktoy`)
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
  redigeringen står i `src/styles/redigering.css`. Fortolkningen bruker den
  til «Åpne stoffside» mens en modul med egen stoffside er valgt (`App.tsx`);
  søkesiden til «Lukk».
- `sidesok`: plassen til søket i den åpne siden. Stoffsiden legger sitt
  kompakte søk her (`Sidesok.tsx`, snarveien Ctrl B eller Cmd B). Det vokser
  mens det brukes, og antallet treff og stedene de står, vises under feltet.
  I dokken dekker det hele dokken mens det har fokus.
- `sok` (en prop på `Toppmeny`): globalt fagsøk. Appen legger `Fagsok`
  (`src/components/sok/`) her: feltet fra `Fagsokfelt.tsx` med snarveien
  Ctrl K eller Cmd K, og en rullegardin med de beste treffene. Mens fokus står
  i fagsøket, er det et lag over appen (`data-lag="fagsok"`), så det som
  skrives, ikke når tastene i siden bak. Ctrl/Cmd K og Ctrl/Cmd B virker
  likevel derfra, så man kan gå rett mellom de to søkene. Snarveiene virker
  ikke i et redigeringsfelt eller mens et annet lag står åpent.

### Når plassen ikke strekker til

Hvor mye plass søkene får, kommer an på hva siden legger i menyen. Fagsøket
har forrang, og menyen viker i denne rekkefølgen, så ingenting noen gang
flyter inn over noe annet:

- Under 1024 px krymper de sekundære handlingene og søket på siden til
  runde ikonknapper. Står det et søk i søket på siden, er kanten i
  aksentfargen.
- Fagsøket svarer på sin egen bredde (et spørrefelt, `@container fagsok`),
  ikke vinduets. Snarveimerket viker først. Til slutt står bare lupen igjen,
  og mens søket da brukes, legger feltet seg over sidens handlinger i full
  bredde. Innholdet i feltet klippes i kanten.
- Søket på siden tar plassen fra fagsøket mens det brukes, og krymper selv
  heller enn å skyve resten av menyen ut av pillen.
- Rullegardinen og treffpanelet er aldri smalere enn `--bredde-sokepanel`.

### Høyden og rullingen

`--toppmeny-offset` er menyens høyde med luft under. Alt som skal stå under
menyen, bruker den:

- `.app` har den som luft øverst.
- Ankere i `.scene` har den som `scroll-margin-top`, så en lenke til et anker
  ikke havner under menyen. Det samme gjelder alt som kan få fokus, så
  tabulering aldri legger fokus bak menyen (eller bak dokken på smale flater).
- Seksjonene gjør det samme (se `docs/seksjoner.md`).
- Rulling i skript regner fra menyens underkant (`toppmenyensBunn()`).

### Smale flater

Under 760 px bredde gjelder dette:

- Søket får all plassen i pillen.
- Skillet viker. Nedtrekksmenyene henger ved vinduets høyre kant.
- Sidens plasser flytter til en **dokk** nederst i vinduet, og siden får
  `--dokk-offset` luft nederst. Søket på siden står som en rund lupeknapp til
  det brukes, og hovedhandlingen korter teksten heller enn å skyve de andre
  ut av vinduet. Har siden verken søk eller hovedhandling (søkesiden), er
  dokken bare så bred som knappene.
- Fortolkningen har ingen dokk. «Åpne stoffside» står bare i toppmenyen på
  brede flater; på smale fører kodepillen i steget til stoffsiden.

### Idéene, adminmenyen og kontoen

Helt til høyre står tre knapper:

- **Idéer** (`src/components/ideer/Ideknapp.tsx`) åpner idéene. Har noen
  kommentert noe brukeren ikke har sett, står det en prikk på knappen.
- **Administrasjon** (`src/components/konto/Adminmeny.tsx`), bare for
  administratorer: brukerne og datakildene.
- **Kontoen** (`src/components/konto/Kontomeny.tsx`), avataren: hvem som er
  logget inn, «Endre navn og profilbilde», «Preferanser» og «Logg ut».
  «Preferanser» er en skuff i menyen med bryterne for hurtigtastene og det
  mørke temaet (`Bryter`), og glir opp som skuffene ellers (`useSkjuling`).

Adminmenyen og kontoen bygger på `Nedtrekksmeny`
(`src/components/toppmeny/Nedtrekksmeny.tsx`), med valgene som `Menyvalg`.
Nye valg legges inn der. Menyen er et lag (`data-lag`), så appens egne taster
ligger i ro mens den står åpen. Escape, et trykk utenfor eller fokus som går
ut av menyen, lukker den.

Endringsloggen åpnes bare fra versjonspillen nederst til høyre. På smale
flater med dokk legger pillen seg over dokken.

Innloggingssiden har ingen toppmeny, bare temaknappen. De delene den bruker,
står oppført som åpne i `scripts/kontroller-vegg.mjs`.
