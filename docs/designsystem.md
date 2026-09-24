# Designsystemet og appskallet

OUSFAR bruker designsystemet **OUSFAR Atlas** fra Claude Design. Planen for
hele omleggingen står i `docs/ux-reimagination.md`. Denne filen beskriver
byggeklossene: tokens, ikoner, knapper og den faste toppmenyen. Den er for
den som skal bygge nye skjermbilder eller flytte gamle over.

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
- **Runding:** `--runding-merke`, `-felt`, `-underkort`, `-felt-gruppe`,
  `-kort`, `-panel` og `-pille`.
- **Kanter og høyder:** `--kant`, `--kant-aktiv`, `--kant-tykk`,
  `--fokusring`, `--hoyde-kontroll`, `--hoyde-trykk` (minste trykkflate),
  `--hoyde-toppmeny` og `--hoyde-dokk`.
- **Ikoner:** `--ikon-ui`, `-underpunkt`, `-seksjon`, `-form`, `-konsept` og
  `-plot`, og `--ikon-sirkel` (`-smal` på mobil) for sirkelen rundt
  seksjonsikonet.
- **Lag:** `--lag-toppmeny`, `--lag-popover` og `--lag-modal`.
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

### Eldre navn

Stilarkene fra før Atlas bruker eldre navn som `--skrift`, `--tekst-s`,
`--runding-m`, `--skygge`, `--niva-*` og `--merke-*`. De står nederst i
`tokens.css` som aliaser for de nye tokens. Ny kode bruker de nye navnene, og
aliasene fjernes etter hvert som skjermbildene flyttes over.

Mellomromskalaen fikk nye trinn. Alle eksisterende stilark er flyttet over:
gamle `--rom-1` til `-6` heter nå `--rom-2`, `-3`, `-5`, `-7`, `-8` og `-9`.

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

De eldre ikonene i `src/components/icons/` (`SearchIcon`, `CopyIcon` osv.)
tegnes nå med Atlas-ikonene, så gamle skjermbilder har fått de nye tegningene
uten å endres.

## Knapper

- **`Ikonknapp`** (`src/components/Ikonknapp.tsx`) er en rund knapp med bare
  ikon. `etikett` er påkrevd og blir både knappens navn og tooltip.
  Variantene er `myk`, `stille`, `aksent` og `kant`, og størrelsene er
  `kontroll` og `liten`. På smale flater er den minst 44 px.
- **`Toppmenyknapp`** (`src/components/toppmeny/Toppmenyknapp.tsx`) er en
  pille med ikon og tekst, `primar` eller `sekundar`. På smalere skjermer
  krymper en sekundær knapp til bare ikon.

Alle handlinger i toppmenyen har ikon.

## Merker og modale lag

- **`Merke`** (`src/components/Merke.tsx`) er en liten merkelapp for en
  status, f.eks. «Godkjenningsfritak» eller «Åpnet herfra». Tonene er
  `noytral`, `flate`, `aksent`, `fritak`, `referanse`, `toksisk` og
  `alvorlig`, og hver er et fargepar som `palette.test.ts` måler. Betydningen
  står alltid i teksten.
- **`Modallag`** (`src/components/Modallag.tsx`) er det ene modale laget,
  bygget på `<dialog>`: fokusfelle, Escape, trykk på bakgrunnen, låst
  rulling bak og fokuset tilbake. Med `meta`, `ikon`, `undertittel` eller
  `merker` får det Atlas-hodet: en linje i versaler, ikonet i en sirkel,
  tittelen i Newsreader og merkene under, på en hevet flate. Med `ark` blir
  det et ark nedenfra på smale flater. Stilen står i `modallag.css`.

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
  «Lukk».
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
