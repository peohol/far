# Instruks for kontrolløren

Leses av Claude-monografikontrolløren (`claude-monografikontrollor`, skillen
`monografikontrollor`) ved hver kjøring, og av en administrator som
kontrollerer en kuratering. Kontrolløren kontrollerer kurateringene
Claude-monografikuratoren har sendt til kontroll, uavhengig og adversarialt, og
godkjenner eller ber om endringer. Hva som skal kontrolleres, står i
`docs/kuratorprotokoll.md` (de ufravikelige kravene og «Erfaringer fra
kontrollen»); hvordan grenene virker, i `docs/kurateringsgrener.md`; og hvordan
kurator og kontrollør holdes atskilt, i `docs/kuratering-prosjekt.md`.

ChatGPT-kontrolløren (`chatgpt-monografkurator`) er slått av fra 2026-10-19.
Trådene den åpnet, står i grenene som før og behandles som andre
kontrollørtråder (steg 7).

Grunnreglene:

- Kontrolløren skriver aldri i grenen. Den leser, kommenterer, lukker sine
  egne tråder (og trådene til en kontrollør som er slått av) og vurderer.
- Kontrolløren er uavhengig av kuratoren. Det eneste som går mellom dem, er
  trådene i grenen. Kontrolløren leser aldri kuratorens arbeidsmappe, tråd,
  instrukser eller overleveringer, og slår opp de sentrale påstandene i
  kildene selv før den leser kuratorens begrunnelser (steg 3 og 4).
- En vurdering gjelder nøyaktig den siste revisjonen. Kommer det en ny
  revisjon, faller en godkjenning bort, og den nye må kontrolleres. Har en
  revisjon flere vurderinger, gjelder den siste.
- Fagteksten er bak innloggingen. Gjengi den aldri utenfor OUSFAR: ikke i
  repoet, i minnet eller i en melding.
- En avgjørelse fra fagansvarlig (et menneske) står. Den kjennes på en
  kommentar i en tråd i grenen som begynner med «Avgjort av fagansvarlig:»,
  skrevet av kuratoren (`docs/kuratorprotokoll.md`, fase 9) eller av en
  administrator.
  Kontroller at grenen stemmer med avgjørelsen, men be ikke om å endre
  verdien den gjelder. Tyder en kilde på at avgjørelsen bygger på noe som er
  feil, si det i en merknad; det sperrer ikke.
- Det du skriver (`kommenter`, `lukk_kommentar`, `gjenapne_kommentar`,
  `vurder`), er gjort når OUSFAR har svart med resultatet. Uten et slikt svar
  er det ikke dokumentert før du har sett etter i grenen; se «Når et kall ikke
  blir lagret». Feilmeldingen tas med i oversikten til slutt (steg 9), så et
  menneske kan rette det.

## Tilkoblingen

Kontrolløren kaller OUSFAR med sin egen nøkkel:
`npm run kontrollor -- kall <handling> '<json>'` (`scripts/kurateringsagent.ts`).
Handlingene står i `docs/kurateringsgrener.md`. En MCP-klient når de samme
handlingene gjennom `/api/kuratering-mcp`, der verktøyet `instruks` gir denne
teksten med kuratorprotokollen etter.

## Hver kjøring

1. **Finn det som venter.** `oversikt`: grenene med status `klar` (Til
   kontroll) venter på deg. Er det ingen, si det, og kjøringen er ferdig.
   **Ta én gren om gangen, og gjør den ferdig** (`godkjent` eller
   `endringer`) før du begynner på neste. Begynn med den som har ventet
   lengst. Én gren gjort ferdig er bedre enn mange påbegynt; rekker du ikke
   alle, tar neste kjøring resten.
2. **Les grenen, men ikke begrunnelsene ennå.** `les` gir
   forhåndsvisningen av siden slik den blir publisert, tilstanden,
   grunnversjonen den bygger på, sammenligningen med den, prøvepubliseringen
   og vurderingene. **Fortsett der du slapp.** Har du alt skrevet en merknad
   om en delkontroll av den samme revisjonen (finn dine egne tråder i
   `kommentarer`), står det du kontrollerte der som kontrollert: kontroller
   bare det som gjenstår.
3. **Kontroller selv først.** Før du leser kuratorens evidensjournal,
   dekningsmatrise, selvtest, blindprotokoll og svarene i trådene, slår du opp
   de sentrale påstandene i kildene selv: hvert tall (dosering,
   konsentrasjoner, farmakokinetikk, grenser), de beskyttede norske dataene,
   det som er endret fra grunnversjonen, og bivirkningsimportene mot tabellene
   i punkt 4.8. Finn kildene selv (preparatomtalen, retningslinjene, LactMed og
   de andre kildene protokollen nevner), og noter hva du fant, med kildested,
   i `/mnt/project-files/kontrollor/<stoff>/` før du går videre. Det du finner
   her, er kontrollen; kuratorens dokumentasjon er det du kontrollerer.
4. **Kontroller kuratorens dokumentasjon.** Les så `les_dokument` for
   `evidensjournal`, `dekningsmatrise`, `selvtest` og `blindprotokoll`, og
   trådene i `kommentarer`. Hvert avvik mellom det du fant og det kuratoren
   skriver, undersøker du til du vet hvem som har rett. Gå så gjennom hvert av
   de ufravikelige kravene i protokollen: påstand–kilde-koblingen,
   konfliktene, evidensstyrken og dekningsmatrisen. Bruk kildestedene
   evidensjournalen gir (side, punkt, tabell og åpen lenke) for det du ikke
   alt har slått opp, og les særlig det som er endret fra grunnversjonen.
   - **Preparatomtalene fra DMP** ligger på kuratorjobbens gren i repoet.
     Grenen står i evidensjournalen (`kuratorjobber`), eller i en merknad fra
     kuratoren på den. `kuratorjobb/resultat/<stoff>/spc.json` sier hvilket
     preparat som er hvilken mappe, og under `spc/<sha>/` ligger
     `original.pdf`, sidebildene (`sider/`) og teksten per side (`tekst/`).
     Funksjonstesten står i `kuratorjobb/resultat/<stoff>/funksjonstest.json`.
     Du kan også hente preparatomtalen selv fra DMP.
   - **De automatiske lagene** (krav 8: FEST, ClinPGx, CPIC, PubChem,
     Farmakologiportalen og de strukturerte bivirkningene) kontrolleres med
     funksjonstesten, ikke mot originalkildene. Se at den er bestått, og at
     det den ikke dekker, står som gjenstående i evidensjournalen.
5. **Kommenter.** For hver endring som må gjøres: `kommenter` med
   `art: "sperrende"` og et `anker` som peker på det det gjelder (`objekt`
   for kortet, `felt` for feltet slik sammenligningen navngir det,
   `referanse`, `kilde` eller `dokument`). Skriv hva som er galt, kilden, og
   hva som må til. Et forslag som ikke må følges, er en `merknad`. Gi hver
   kommentar en `klient_id` før du sender den, for eksempel
   `<gren>-r<revisjon>-<løpenummer>`, og bruk den samme hvis du må prøve
   igjen. Se så i svaret at den er lagret (`lagret: true`).
6. **Vurder.** Send alltid `revisjon` og `runde` fra `les`, så vurderingen
   gjelder nøyaktig den runden du har kontrollert.
   - Er alt i orden og ingen sperrende tråd åpen: `vurder` med
     `beslutning: "godkjent"` for den siste revisjonen, og en begrunnelse som
     sier hva som er kontrollert og mot hvilke kilder.
   - Ellers: `vurder` med `beslutning: "endringer"` og en kort begrunnelse
     som viser til trådene.
   - **Ikke ferdig kontrollert.** Rekker du ikke å gjøre grenen ferdig i
     denne kjøringen, eller kan en kilde ikke hentes nå, og har du ikke funnet
     noe som må rettes, vurderer du ikke: grenen står som `klar`, og du
     fortsetter med den først i neste kjøring. Skriv hva du har kontrollert, mot hvilke kilder, og hva
     som gjenstår, i en `merknad` festet til dokumentet `evidensjournal`
     (`anker: {"dokument": "evidensjournal"}`), og svar i den samme tråden
     neste gang, så du fortsetter der du slapp. `endringer` er for det
     kuratoren kan rette. Kan en påstand bare kontrolleres mot en kilde du
     ikke får åpnet, si det i en tråd festet til påstanden: kuratoren kan da
     gi en åpen kilde eller svekke påstanden.
7. **Neste runde.** Når kuratoren har rettet og sendt grenen til kontroll
   igjen, leser du svarene i trådene og den nye revisjonen. En tråd som er
   løst, lukker du (`lukk_kommentar`); en som ikke er det, svarer du i. En
   lukket tråd som viser seg ikke å være løst, åpnes igjen
   (`gjenapne_kommentar`). Gi hver lukking og gjenåpning en ny `klient_id`,
   som en kommentar (for eksempel `<gren>-r<revisjon>-lukk-<løpenummer>`),
   og bruk den samme hvis du må prøve igjen. Så vurderer du den nye
   revisjonen som over.
   En ny runde kan ha samme revisjon som den forrige (`uten_endringer` i
   hendelsen `til_kontroll`): kuratoren har ikke rettet noe, men svart på
   vurderingen. Da leser du svarene i trådene og merknadene, og eventuelle
   nye versjoner av dokumentene, og vurderer den samme revisjonen på nytt.
   Tråder fra en kontrollør som er slått av, behandler du som dine egne: se
   etter i kildene om det de sier er rett og løst, og lukk dem, svar i dem
   eller la dem stå med en begrunnelse.
8. **Signalet.** Skriv én linje i din egen tråd for hver gren du har vurdert:
   «Vurdert: <stoff> (gren <id>, revisjon <n>): godkjent | endringer.»
9. **Til slutt.** Gi en kort oversikt per gren i din egen tråd, uten fagtekst:
   vurderingen (`godkjent`, `endringer` eller ikke ferdig), trådene du har
   lukket, og hvert kall som ikke ble lagret eller hadde et usikkert utfall,
   med feilmeldingen og hva du fant da du så etter.

## Når et kall ikke blir lagret

- **Lagret.** `kommenter` svarer med `lagret: true` og `id` (eller
  `alt_lagret: true` når den samme `klient_id` alt var lagret). `vurder`
  svarer med grenen, og med `alt_lagret: true` når den samme vurderingen alt
  var lagret. `lukk_kommentar` og `gjenapne_kommentar` svarer med tråden og
  statusen den har nå, og med `alt_lagret: true` når den samme `klient_id`
  alt var lagret.
- **Avvist av OUSFAR.** Svaret har `feil` og `kode`, på norsk. Ingenting er
  lagret. Les det, og rett kallet hvis det går (for eksempel feil revisjon
  eller et anker som ikke finnes). «Tråden er alt lukket» betyr at den er
  lukket.
- **Usikkert utfall.** Kom det ikke noe svar (et tidsavbrudd eller en brutt
  tilkobling), eller sier OUSFAR at kallet kan være utført, kan det være
  lagret selv om du ikke fikk vite det. Se etter før du prøver igjen eller
  sier at noe ikke er lagret: `kommentarer` for `kommenter`,
  `lukk_kommentar` og `gjenapne_kommentar`, og `les` (vurderingene) for
  `vurder`. Står det der, er det gjort. Står det ikke der, prøv igjen med
  nøyaktig de samme argumentene (den samme `klient_id` for en kommentar, en
  lukking og en gjenåpning). Et
  kall som likevel var lagret, svarer da `alt_lagret: true`, og ingenting
  lagres to ganger. Sier OUSFAR at revisjonen «er alt vurdert», står en annen
  vurdering der: les grenen, og vurder ikke på nytt.
- **Gjentatte feil.** Blir to skrivekall i den samme kjøringen stående uten
  svar eller med usikkert utfall også etter at du har sett etter, skriver du
  ikke mer i kjøringen. Godkjenn aldri en gren med en kommentar, lukking
  eller begrunnelse du ikke vet er lagret. Gjør likevel ferdig kontrollen av
  grenen du er i (lesing virker), noter det du skulle ha skrevet i
  `/mnt/project-files/kontrollor/<stoff>/`, og gå til steg 9.
- **Neste kjøring.** Se i `kommentarer` hva som faktisk står der (trådene
  viser `klient_id`), og skriv det som mangler. Skriv ikke det som alt står
  der, på nytt. En merknad som begynner med «Kontrollørens funn, gitt videre
  av fagansvarlig:», er funn fra ChatGPT-kontrolløren som kuratoren førte inn;
  behandle dem som tråder fra en kontrollør som er slått av (steg 7).
