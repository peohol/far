# Oppdatering til en ny versjon

Leses når noe ved meldingen om en ny versjon skal endres, eller når en ny del
av appen har tilstand som bør overleve en oppdatering.

## Hva brukeren merker

Når en ny versjon er lagt ut, og den har en føring i endringsloggen som
krever oppdatering (`varsles` i versjonsmodellen), står det en melding
nederst i vinduet:
«En ny versjon av OUSFAR er klar», med knappen «Oppdater nå». Den forsvinner
ikke av seg selv og kan ikke lukkes. Står et vindu åpent, ligger meldingen i
det. «Oppdater nå» laster siden på nytt, og det brukeren holdt på med kommer
tilbake: vinduene som sto åpne, skjemaer som var halvveis skrevet, valgene i
fortolkningen, åpne seksjoner og hvor langt ned siden og vinduet var rullet.

Oppdateringsmeldingen er teknisk og **ikke et varsel i bjella**. Vanlige
versjonsendringer kan kreve oppdatering selv om de ikke bør gi eget
funksjonsvarsel (se `docs/varsler.md`).

Meldingen står bare når den nye versjonen berører siden brukeren er på. Hver
føring i endringsloggen sier hvilke sider den gjelder (`gjelder`, se
`docs/endringslogg.md`), og `versjon.json` har med de nyeste føringene og
sidene deres. Berører ingen av føringene etter versjonen som kjører, siden,
står ingen melding. Da tas den nye versjonen i bruk i stillhet i neste rolige
øyeblikk:

- når brukeren går til en annen side (en seksjon på siden eller søket teller
  ikke), eller
- når fortolkningen nullstilles.

Siden lastes da på nytt når brukeren har latt appen være i et sekund etterpå,
uten rulleplassen fra siden hen forlot. Begynner hen å skrive, klikke eller
rulle før det, venter appen til neste rolige øyeblikk, så ingen tastetrykk går
tapt; står et vindu åpent, venter den også. Er siden hen nå står på, berørt,
kommer meldingen.

Meldingen kommer alltid når det ikke lar seg avgjøre hvilke sider som er
berørt: en føring uten `gjelder`, et bygg fra før feltet fantes, en versjon som
er for gammel til å stå blant de nyeste føringene i fila, eller en versjon som
er trukket tilbake. Endringer i `vinduer` gir meldingen bare mens et vindu
står åpent, og på innloggingssiden gir bare `hele appen` meldingen.

En stille designjustering (uten føring) eller en føring med `utenVarsel` gir
ingen melding og ingen oppdatering i stillhet; brukeren får den neste gang
siden lastes. Unntaket er når en del av appen ikke lar seg laste fordi filene
til bygget som kjører, er byttet ut: da kommer meldingen for et hvilket som
helst nytt bygg, uansett side.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `vite.config.ts` (`versjonsfil`) | Gir bygget en identitet (commiten på Vercel) og legger den med versjonsnummeret og versjonen det skal oppdateres til (`oppdateringsversjon`), i `versjon.json` |
| `src/oppdatering/versjon.ts` | Leser `versjon.json` og avgjør om det er en ny versjon: når versjonen det skal oppdateres til, er en annen enn den som kjører |
| `src/oppdatering/sider.ts` | Hvilke sider en ny versjon berører, siden brukeren er på (meldt av `App.tsx`), og de rolige øyeblikkene |
| `src/components/Oppdateringsmelding.tsx` | Meldingen og oppdateringen i stillhet. Spør hvert minutt mens fanen er synlig, når fanen får fokus, og når en del av appen ikke lar seg laste |
| `src/oppdatering/bevaring.ts` | Bildet av det som tas vare på, i fanens `sessionStorage`, og rullingen tilbake |
| `src/oppdatering/Bevaring.tsx` | `useBevart`, `Bevaringsomrade` og `Bevaringseier` (brukeren det hører til, satt i `Port.tsx`) |

`versjon.json` ligger utenfor innloggingsveggen, sammen med meldingen, så den
virker også på innloggingssiden. Fila sier bare hvilket bygg og hvilke
versjoner som er lagt ut, og hvilke sider de nyeste føringene gjelder.

## Å ta vare på ny tilstand

Tilstand brukeren ville savnet etter en oppdatering — et vindu som står åpent,
et skjema, et valg — bruker `useBevart(navn, start)` i stedet for `useState`.

- Navnet må være entydig i appen. Det settes sammen med `Bevaringsomrade`
  rundt, så et skjema kan bruke korte navn: fagsiden er området
  `stoff:<slug>`, og et redigeringsvindu på den `rediger:<id>@<revisjon>`.
- Bare ren JSON tas vare på. Et `Map` eller et objekt som skal leses tilbake
  til noe annet (som analytten i fortolkningen), får en `Bevaringsform`.
  Det som ikke tåler JSON og ikke har en form, blir stående igjen i stedet
  for å komme tilbake ødelagt.
- En verdi kommer tilbake én gang, de første to minuttene etter oppstarten.
  En effekt som nullstiller noe når et vindu åpnes, kan la det stå når den
  tredje verdien fra `useBevart` sier at det kom fra forrige versjon.
- Et utkast som lagres mot en revisjon, tas vare på under den revisjonen. Har
  noen andre lagret i mellomtiden, kommer vinduet tilbake uten det gamle
  utkastet, så det aldri skrives over noe nyere.
- Et skjema som sammenligner med utgangspunktet for å se om noe er endret,
  tar vare på utgangspunktet også, så et utkast som kom tilbake, fortsatt
  regnes som ulagret.

Det som tas vare på, ligger bare i fanen, og slettes så snart den nye
versjonen har lest det. Det hører til brukeren som var logget inn: er en annen
logget inn når den nye versjonen starter (økten gikk ut, og noen andre logget
inn i den samme fanen), kastes alt, også hvor langt siden var rullet. Rullingen
tilbake stopper straks brukeren logger ut eller byttes ut.
