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
- Når brukeren åpner en skuff, ruller siden den fram i det synlige feltet
  mellom den faste toppmenyen og bunnen av vinduet (over dokken på smale
  flater):
  - får den åpne skuffen plass i feltet, midtstilles den;
  - er den høyere enn feltet, legges toppen rett under toppmenyen.

  Siden begynner å rulle straks, etter høyden skuffen er ventet å få, og
  justeres til den virkelige når skuffen har glidd ferdig — med mindre
  brukeren alt har begynt å rulle selv. Søsknene som lukkes, lukkes straks,
  så skuffen står stille mens siden ruller. Nederst på siden kan den ikke
  alltid midtstilles, for siden kan ikke rulles forbi slutten.
  Direktelenker legger fortsatt toppen øverst, og søket midtstiller treffet.
- Identiteten og viktige data øverst på siden, og kritiske varsler, er ikke
  skuffer. De står alltid fram, og å åpne en seksjon lukker dem ikke.
- En seksjon står som en rad med hårlinje over, med seksjonsikonet i en sirkel
  foran overskriften. Detaljkortene står som kort i et rutenett med to eller
  tre kolonner (`skuffrutenett`), og et åpnet kort går over hele bredden.
- Pilen til høyre i hodet viser om skuffen er åpen. Hele hodet kan trykkes
  på; knappene i det gjør sin egen jobb. Handlingene i hodet (som «Kilder for
  panelet») virker på innholdet, så de åpner også skuffen; knappene i
  overskriften (referansepillene) gjør det ikke.
- Åpning glir raskt. Den som har bedt om mindre bevegelse i systemet, får
  skuffen åpnet og lukket, og siden rullet, uten glidning.
- Det finnes ingen «Åpne alle». Heller ikke redigeringsmodus åpner alt:
  redaktøren åpner seksjonen som skal redigeres, og en handling i hodet åpner
  seksjonen skjemaet står i. Selve skjemaet åpnes i et redigeringsvindu over
  siden (`Modallag`), så det får plass også når kortet er smalt.
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
  ikon="prep"                                  // valgfritt, fra ikonregisteret
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
- `ikon` er et navn fra ikonregisteret (`src/components/ikon/register.ts`).
  Det er pynt ved siden av tittelen og skjult for skjermlesere. Stoffsidens
  seksjonsikoner, og ikonene for kortene i farmakokinetikken, velges i
  `src/components/analyttside/panelvisning.ts`: kinetikkortene får ikon etter
  hva overskriften handler om (absorpsjon, halveringstid, CYP …), og et
  generisk ikon når ingen kategori passer, så en ny overskrift aldri feiler.
- En seksjon i en seksjon, eller et detaljkort utenfor en seksjon eller i et
  annet detaljkort, stopper tegningen med en feil. Trenger innholdet et
  tredje nivå, skal det heller deles opp.
- Innholdet i et detaljkort kan likevel ha en egen liten visning som åpner og
  lukker, når designet ber om det: styrkekortene i «Preparater»
  (`src/components/preparater/`). Den styrer seg selv og er ikke en skuff.
  Skjuler den noe, gjøres det med `hidden="until-found"`, og den åpner seg
  når nettleserens søk finner noe der (`beforematch`) og når `apneTil` sender
  `VIS_HENDELSE` fra elementet som skal vises (`useSkjultTilFunnet`).
- Glidningen er felles: `useSkjuling` (`src/hooks/`) skjuler og viser
  innholdet rundt en kropp som glir mellom `grid-template-rows: 0fr` og `1fr`,
  og brukes av skuffene og styrkene i preparatvinduet. Kortene i et rutenett
  som åpnes over hele bredden, flytter seg med `useFlytting` (FLIP): kortet
  vokser dit det skal, og naboene glir til sin nye plass. Klipp innholdet ved
  kroppens kant, ikke radens; mens raden glir, er kroppen høyere enn den.

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
siden er hentet. En lenke til noe som alltid står fram (`#/analytt/KODE/viktige_data`)
ruller bare dit, uten å åpne eller lukke noe. Adressene lages med `analyttadresse(kode, sted)` i
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
| `sett(sti, apen)` | Det et trykk gjør: åpner (og ruller den fram, se over) eller lukker |
| `fastSted(sti, element)` | Melder inn et sted som alltid står fram, så `apne` ruller dit uten å røre skuffene. Brukes gjennom `useFastSted(id, ref)` |

Står flere søsken åpne fra start (`apenFraStart`), er det den første som
gjelder. En seksjon uten styringen rundt seg lager sin egen, så detaljkortene
i den følger den samme regelen også andre steder.

Hvor langt ned på siden en skuff legges når siden ruller dit, står i
`seksjoner.css` som `scroll-margin-block: var(--toppmeny-offset) …`, der
`--toppmeny-offset` er høyden til den faste toppmenyen med luft under. Margen
over og under er også grensene for feltet en åpnet skuff midtstilles i; på
smale flater er margen under `--dokk-offset`. Høyden skuffen får, måles på
innholdet, som bærer `data-skuffinnhold`.

## Tilgjengelighet

- Overskriften er en knapp i en overskrift (`h2` for seksjoner, `h3` for
  detaljkort) med `aria-expanded` og `aria-controls`. Oppsummeringen og antall
  treff er knyttet til knappen med `aria-describedby`.
- Knappen åpnes og lukkes med Enter og mellomrom, og har god trykkflate på
  mobil.
- Seksjonen er et område (`section`) med overskriften som navn; et detaljkort
  er en gruppe.
