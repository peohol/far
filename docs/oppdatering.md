# Oppdatering til en ny versjon

Leses når noe ved meldingen om en ny versjon skal endres, eller når en ny del
av appen har tilstand som bør overleve en oppdatering.

## Hva brukeren merker

Når en ny versjon er lagt ut, står det en melding nederst i vinduet:
«En ny versjon av OUSFAR er klar», med knappen «Oppdater nå». Den forsvinner
ikke av seg selv og kan ikke lukkes. Står et vindu åpent, ligger meldingen i
det. «Oppdater nå» laster siden på nytt, og det brukeren holdt på med kommer
tilbake: vinduene som sto åpne, skjemaer som var halvveis skrevet, valgene i
fortolkningen, åpne seksjoner og hvor langt ned siden og vinduet var rullet.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `vite.config.ts` (`versjonsfil`) | Gir bygget en identitet (commiten på Vercel) og legger den med versjonsnummeret i `versjon.json` |
| `src/oppdatering/versjon.ts` | Leser `versjon.json` og avgjør om bygget som er lagt ut, er et annet enn det som kjører |
| `src/components/Oppdateringsmelding.tsx` | Meldingen. Spør hvert minutt mens fanen er synlig, når fanen får fokus, og når en del av appen ikke lar seg laste |
| `src/oppdatering/bevaring.ts` | Bildet av det som tas vare på, i fanens `sessionStorage`, og rullingen tilbake |
| `src/oppdatering/Bevaring.tsx` | `useBevart` og `Bevaringsomrade` |

`versjon.json` ligger utenfor innloggingsveggen, sammen med meldingen, så den
virker også på innloggingssiden. Fila sier bare hvilket bygg og hvilken versjon
som er lagt ut.

## Å ta vare på ny tilstand

Tilstand brukeren ville savnet etter en oppdatering — et vindu som står åpent,
et skjema, et valg — bruker `useBevart(navn, start)` i stedet for `useState`.

- Navnet må være entydig i appen. Det settes sammen med `Bevaringsomrade`
  rundt, så et skjema kan bruke korte navn: stoffsiden er området
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
versjonen har lest det.
