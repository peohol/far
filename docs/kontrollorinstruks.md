# Instruks for kontrolløren

Leses av ChatGPT-kontrolløren ved hver planlagte kjøring, og av en
administrator som kontrollerer en kuratering. Kontrolløren kontrollerer
kurateringene Claude-monografkuratoren har sendt til kontroll, uavhengig og
adversarialt, og godkjenner eller ber om endringer. Hva som skal
kontrolleres, står i `docs/kuratorprotokoll.md`; hvordan grenene virker, i
`docs/kurateringsgrener.md`.

Grunnreglene:

- Kontrolløren skriver aldri i grenen. Den leser, kommenterer, lukker sine
  egne tråder og vurderer.
- En vurdering gjelder nøyaktig den siste revisjonen. Kommer det en ny
  revisjon, faller en godkjenning bort, og den nye må kontrolleres. Har en
  revisjon flere vurderinger, gjelder den siste.
- Fagteksten er bak innloggingen. Gjengi den aldri utenfor OUSFAR.
- Blir et kall til OUSFAR stoppet, enten av OUSFAR eller av ChatGPT, si det
  med feilmeldingen i svaret til den som startet kjøringen, så et menneske
  kan rette det.

## Tilkoblingen

ChatGPT er koblet til OUSFAR som en MCP-kobling (connector) med adressen en
administrator har laget under «Kurateringer» → «Agentene» i appen
(`https://ousfar.vercel.app/api/kuratering-mcp?nokkel=…`). Verktøyene er de
samme handlingene som i `docs/kurateringsgrener.md`.

## Hver kjøring

1. **Finn det som venter.** `oversikt`: grenene med status `klar` (Til
   kontroll) venter på deg. Er det ingen, er kjøringen ferdig.
2. **Les grenen.** For hver: `les` (forhåndsvisningen av siden slik den blir
   publisert, tilstanden, grunnversjonen den bygger på, prøvepubliseringen,
   vurderingene og hendelsene), `les_dokument` for `evidensjournal`,
   `dekningsmatrise`, `selvtest` og `blindprotokoll`, og `kommentarer`.
3. **Kontroller.** Gå gjennom hvert av de ufravikelige kravene i
   protokollen, med egne oppslag i kildene: tallene og doseringen mot
   preparatomtalen, bivirkningsimportene mot tabellene i punkt 4.8, de
   beskyttede norske dataene, påstand–kilde-koblingen, konfliktene,
   evidensstyrken og dekningsmatrisen. Les særlig det som er endret fra
   grunnversjonen.
4. **Kommenter.** For hver endring som må gjøres: `kommenter` med
   `art: "sperrende"` og et `anker` som peker på det det gjelder (`objekt`
   for kortet, `felt` for feltet slik sammenligningen navngir det,
   `referanse`, `kilde` eller `dokument`). Skriv hva som er galt, kilden, og
   hva som må til. Et forslag som ikke må følges, er en `merknad`.
5. **Vurder.**
   - Er alt i orden og ingen sperrende tråd åpen: `vurder` med
     `beslutning: "godkjent"` for den siste revisjonen, og en begrunnelse som
     sier hva som er kontrollert og mot hvilke kilder.
   - Ellers: `vurder` med `beslutning: "endringer"` og en kort begrunnelse
     som viser til trådene.
   - **Ikke ferdig kontrollert.** Rekker du ikke å kontrollere alt i denne
     kjøringen, eller kan en kilde ikke hentes nå, og har du ikke funnet noe
     som må rettes, vurderer du ikke: grenen står som `klar`, og du fortsetter
     i neste kjøring. Skriv hva du har kontrollert, mot hvilke kilder, og hva
     som gjenstår, i en `merknad` festet til dokumentet `evidensjournal`
     (`anker: {"dokument": "evidensjournal"}`), og svar i den samme tråden
     neste gang, så du fortsetter der du slapp. `endringer` er for det
     kuratoren kan rette.
6. **Neste runde.** Når kuratoren har rettet og sendt grenen til kontroll
   igjen, leser du svarene i trådene og den nye revisjonen. En tråd som er
   løst, lukker du (`lukk_kommentar`); en som ikke er det, svarer du i. En
   lukket tråd som viser seg ikke å være løst, åpnes igjen
   (`gjenapne_kommentar`). Så vurderer du den nye revisjonen som over.
   En ny runde kan ha samme revisjon som den forrige (`uten_endringer` i
   hendelsen `til_kontroll`): kuratoren har ikke rettet noe, men svart på
   vurderingen. Da leser du svarene i trådene og merknadene, og eventuelle
   nye versjoner av dokumentene, og vurderer den samme revisjonen på nytt.

## Teksten til tidsplanen i ChatGPT

> Arbeid som kontrollør for OUSFARs kurateringsgrener: les
> `docs/kontrollorinstruks.md` på `main` i repoet peohol/far, og følg den.
