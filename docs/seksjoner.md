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
- Identiteten øverst på siden, og kritiske varsler, er ikke skuffer. De står
  alltid fram.
- Pilen foran overskriften viser om skuffen er åpen. Hele hodet kan trykkes
  på; knappene i det (redigering, referansepiller) gjør sin egen jobb.
- Åpning og lukking glir raskt. Den som har bedt om mindre bevegelse i
  systemet, får skuffen åpnet og lukket uten glidning.
- «Åpne alle» og «Lukk alle» står i verktøylinja. I redigeringsmodus åpnes
  alt, så redaktøren ser hele siden.
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
  markeres.
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
holder rede på hvilke skuffer som er åpne, med seksjonens ID — og kortets, med
`/` imellom — som nøkkel. `useSeksjonsstyring()` gir:

| | |
| --- | --- |
| `apne(['seksjon', 'kort'])` | Åpner stedet og ruller dit |
| `apneTil(element)` | Åpner skuffene elementet står i, og ruller det fram |
| `settAlle(true/false)` | Åpner eller lukker alle, også skuffer som kommer til senere |
| `alleApne` | Om alle skuffene på siden er åpne |

Uten styringen rundt seg holder hver skuff tilstanden selv, så seksjonene kan
også brukes andre steder.

## Tilgjengelighet

- Overskriften er en knapp i en overskrift (`h2` for seksjoner, `h3` for
  detaljkort) med `aria-expanded` og `aria-controls`. Oppsummeringen og antall
  treff er knyttet til knappen med `aria-describedby`.
- Knappen åpnes og lukkes med Enter og mellomrom, og har god trykkflate på
  mobil.
- Seksjonen er et område (`section`) med overskriften som navn; et detaljkort
  er en gruppe.
