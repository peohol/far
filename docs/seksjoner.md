# Seksjoner og detaljkort

Stoffsidene viser ikke alt på én gang. De er bygd av **seksjoner** som åpnes og
lukkes som skuffer, og **detaljkort** inne i seksjonene som kan åpnes for seg.
Det er to nivåer, og ikke flere: `seksjon → detaljkort`. Byggeklossene står i
`src/components/seksjoner/` og brukes av alt innhold på siden — OUSFARs eget
faginnhold, fortolkningsreglene og simulatorene, og legemiddeldataene fra
offentlige kilder.

## Slik ser det ut

- **Lukket** viser en seksjon overskriften og en kort oppsummering av hva som
  står i den, f.eks. «Absorpsjon · Distribusjon · Metabolisme» eller
  «12 preparater · 3 legemiddelformer · 6 styrker».
- **Åpnet** viser den innholdet. Oppsummeringen forsvinner, siden innholdet nå
  står der.
- **Detaljkort** i en åpen seksjon er mindre skuffer med sin egen
  oppsummering.
- **Bare én skuff per nivå står åpen.** Åpnes en seksjon, lukkes den som sto
  åpen; åpnes et detaljkort, lukkes de andre kortene i samme seksjon, mens
  seksjonen står åpen. Det gjelder uansett hva som åpner skuffen: et trykk,
  en direktelenke, søket på siden eller nettleserens eget søk. Et detaljkort
  husker at det sto åpent når seksjonen lukkes og åpnes igjen.
- Når brukeren åpner en skuff, ruller siden til toppen av den, under den
  faste toppmenyen. Søsknene som lukkes, lukkes straks, så toppen står stille
  mens siden ruller dit.
- Identiteten øverst på siden, og kritiske varsler, er ikke skuffer. De står
  alltid fram.
- Pilen foran overskriften viser om skuffen er åpen. Hele hodet kan trykkes
  på; knappene i det gjør sin egen jobb. Handlingene i hodet (som «Kilder for
  panelet») virker på innholdet, så de åpner også skuffen; knappene i
  overskriften (referansepillene) gjør det ikke.
- Åpning glir raskt. Den som har bedt om mindre bevegelse i systemet, får
  skuffen åpnet og lukket, og siden rullet, uten glidning.
- Det finnes ingen «Åpne alle». Heller ikke redigeringsmodus åpner alt:
  redaktøren åpner seksjonen som skal redigeres, og en handling i hodet åpner
  seksjonen skjemaet står i.
- Ved utskrift står alt åpent.

## Hvordan det brukes i koden

```tsx
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'

<Seksjon
  id="preparater"                              // fast nøkkel, se under
  tittel={<Uthev tekst="Preparater" />}
  oppsummering="12 preparater · 3 legemiddelformer · 6 styrker"
  tittelTillegg={<Referansepille ider={…} niva="panel" />}   // valgfritt
  handlinger={redigerer && <Button …>Rediger</Button>}       // valgfritt
  apenFraStart={false}                         // lukket er standard
>
  <Detaljkort id="tablett" tittel="Tablett" oppsummering="4 preparater · 10–75 mg">
    …
  </Detaljkort>
</Seksjon>
```

- `id` er en **fast nøkkel**. Den står i direktelenker og i ankeret på siden
  (`panel-<id>`, detaljkort `panel-<seksjon>--<kort>`), og skal ikke endres
  når innholdet endres. Bruk en stabil ID fra kilden, som panelnøkkelen, en
  objekt-ID eller en kode fra legemiddelregisteret — ikke en tekst som kan
  skrives om.
- `tittel` og innholdet går gjennom `Uthev` der tekst skal kunne fremheves av
  søket.
- `oppsummering` sier hva som står i skuffen med innholdets egne ord. Den
  legger ingenting til og tolker ingenting (se `src/faginnhold/oppsummering.ts`
  for `ramsOpp`, `forhandsvisning` og `antall`). Søket fremhever ikke i den.
- `tittelTillegg` er det som står i overskriften etter tittelen og selv kan
  trykkes på. `handlinger` er knappene i hodet. Begge står utenfor knappen
  som åpner og lukker.
- En seksjon i en seksjon, eller et detaljkort utenfor en seksjon eller i et
  annet detaljkort, stopper tegningen med en feil. Trenger innholdet et
  tredje nivå, skal det heller deles opp.
- Innholdet i et detaljkort kan likevel ha en egen liten visning som åpner og
  lukker, når designet ber om det: styrkekortene i «Preparater»
  (`src/components/preparater/`). Den styrer seg selv og er ikke en skuff.
  Skjuler den noe, gjøres det med `hidden="until-found"`, og den åpner seg
  når nettleserens søk finner noe der (`beforematch`) og når `apneTil` sender
  `VIS_HENDELSE` fra elementet som skal vises (`useSkjultTilFunnet`).

Stoffsidens paneler (`src/components/analyttside/Paneler.tsx`) er seksjoner med
panelnøkkelen som `id`; om et panel står åpent fra start, står i `apen` i
`src/faginnhold/paneler.ts`.

## Søk og direktelenker

Innholdet i en lukket skuff står i dokumentet, skjult med
`hidden="until-found"`. Derfor:

- **Søket på siden** fremhever og teller treffene også i lukkede skuffer. En
  lukket skuff med treff sier «2 treff» i hodet. Når brukeren går til et treff
  (Enter, Shift + Enter, eller et av stedene under søkefeltet), åpnes
  seksjonen og detaljkortet treffet står i, og treffet rulles fram og
  markeres. Et sted i et detaljkort gjelder hele kortet, så stedet går også
  til et treff i korttittelen.
- **Nettleserens eget søk** (Ctrl/Cmd + F) finner også teksten, og åpner
  skuffen den står i (hendelsen `beforematch`, i nettlesere som støtter det).
- Skjult innhold er ellers utenfor tabulatorrekkefølgen og skjermleseren.

En **direktelenke** peker på en seksjon eller et detaljkort:

```
#/analytt/AMTNORSUM/farmakokinetikk
#/analytt/AMTNORSUM/farmakokinetikk/<kort-ID>
```

Siden åpner da stedet og ruller dit — også når innholdet først kommer etter at
siden er hentet. Adressene lages med `analyttadresse(kode, sted)` i
`src/domain/rute.ts`. Å åpne og lukke skuffer endrer ikke adressen.

## Styringen for siden

`SeksjonsstyringKilde` (`Seksjonsstyring.tsx`) ligger rundt hele stoffsiden og
holder rede på hvilken skuff som er åpen i hver søskenflokk — skuffene med
samme forelder. Nøkkelen er seksjonens ID, og kortets med `/` imellom.
Tilstanden er *hvilken* skuff som er åpen, ikke om hver enkelt er det, så
regelen om én åpen per nivå kan ikke brytes. `useSeksjonsstyring()` gir:

| | |
| --- | --- |
| `apne(['seksjon', 'kort'])` | Åpner stedet uten å gli, lukker søsknene, og ruller dit |
| `apneTil(element)` | Åpner skuffene elementet står i på samme måte, og ruller det fram |
| `sett(sti, apen)` | Det et trykk gjør: åpner (og ruller til toppen) eller lukker |

Står flere søsken åpne fra start (`apenFraStart`), er det den første som
gjelder. En seksjon uten styringen rundt seg lager sin egen, så detaljkortene
i den følger den samme regelen også andre steder.

Hvor langt ned på siden en skuff legges når siden ruller dit, står i
`seksjoner.css` som `scroll-margin-top: var(--toppmeny-offset, …)`, der
`--toppmeny-offset` er høyden til den faste toppmenyen med luft under.

## Tilgjengelighet

- Overskriften er en knapp i en overskrift (`h2` for seksjoner, `h3` for
  detaljkort) med `aria-expanded` og `aria-controls`. Oppsummeringen og antall
  treff er knyttet til knappen med `aria-describedby`.
- Knappen åpnes og lukkes med Enter og mellomrom, og har god trykkflate på
  mobil.
- Seksjonen er et område (`section`) med overskriften som navn; et detaljkort
  er en gruppe.
