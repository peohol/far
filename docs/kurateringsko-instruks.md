# Instruks for hver planlagte kjøring

Leses av ChatGPT-monografkuratoren ved hver planlagte kjøring. Følg stegene i
rekkefølge. Hvordan køen virker, står i `docs/kurateringsko.md`; det faglige
arbeidet gjøres med kuratorskillen og `docs/monografkuratering.md`, som før.

Grunnreglene:

- Én kuratering om gangen. Arbeid bare med stoffet køen har gitt deg.
- Lag bare **utkast-PR-er** (draft). Slå aldri sammen, godkjenn aldri, og merk
  aldri en PR som klar til gjennomgang. Det gjør et menneske.
- Repoet er offentlig. I køens felt `fase` og `grunn` står bare korte,
  tekniske beskrivelser (f.eks. «SPC-tabeller kontrollert»), aldri innhold
  fra fagsidene eller annet bak innloggingen.
- Endre aldri `kurateringsko/tilstand` eller `svar.json` selv.

## 1. Se om det er noe å gjøre

Les `kurateringsko/neste.json` på grenen `kurateringsko/tilstand`.

- Står det noe i `aktive`, pågår en kuratering allerede. Avslutt kjøringen
  uten å gjøre noe mer; reservasjonen går ut av seg selv hvis den er forlatt.
- Er `neste` tom, er det ingenting å kuratere nå. Avslutt.

## 2. Reserver neste stoff

1. Lag grenen `kurateringsko/okt/<ÅÅÅÅMMDD-TTMMSS>` (UTC-tiden nå) fra `main`.
2. Commit `kurateringsko/foresporsel.json` på den:

   ```json
   { "versjon": 1, "id": "reserver-1", "handling": "reserver" }
   ```

3. Vent på svaret: les `kurateringsko/svar.json` på øktgrenen omtrent hvert
   minutt til `foresporsel_id` er `reserver-1`. Det tar vanligvis 1–5
   minutter. Har det ikke kommet etter ti minutter, start arbeidsflyten
   «Kurateringskø» på `main` (Run workflow) og vent ti minutter til. Kommer det
   fortsatt ikke, avslutt kjøringen; køen svarer ved neste timekjøring.
4. Les `utfall`:
   - `ingen_oppgave` eller `avvist`: avslutt kjøringen. Grunnen står i `melding`.
   - `ok`: `oppgave` har det du trenger. Noter `oppgave.oppgave` (oppgave-ID-en),
     `stoff`, `modus`, `jobbgren`, `kurateringsgren`, `pr` og `gjenoppta`.

Hver ny forespørsel senere i kjøringen committes på **samme øktgren**, med en
ny `id` (`forny-1`, `forny-2`, `fullfort-1` …), og besvares på samme måte.

## 3. Kurater stoffet

- **Modusen** står i `oppgave.modus` (i dag alltid `de_novo`). Kurater etter
  den, med kuratorskillen.
- **Fortsetter du et avbrutt forsøk** (`oppgave.gjenoppta` er ikke `null`):
  `jobbgren`, `kurateringsgren` og eventuelt `pr` er de samme som sist, og
  `gjenoppta.fase` sier hvor langt det kom. Fortsett på grenen og i PR-en som
  finnes; lag ikke nye.
- **Kuratorjobbene** (funksjonstest og preparatomtaler) kjøres på
  `oppgave.jobbgren` som beskrevet i `docs/kuratorjobber.md`, med
  `"referanse": "<oppgave-ID>"` i forespørselen.
- **Kurateringen** (migrasjonen, testen og journalen) lages på
  `oppgave.kurateringsgren`, fra `main` hvis grenen ikke finnes. Commit
  arbeidet underveis, så det kan fortsettes hvis kjøringen stopper.

**Forny reservasjonen** omtrent hver time og etter hvert større steg, med det
du holder på med:

```json
{ "versjon": 1, "id": "forny-1", "handling": "forny", "oppgave": "<oppgave-ID>", "fase": "<kort, uten innhold fra siden>" }
```

Fristen er tre timer fra hver fornying (høyst 24 timer i alt). Går den ut,
mister du reservasjonen; da avslutter du kjøringen uten å endre mer.

## 4. Lag utkast-PR-en

1. Lag en **draft**-PR fra `oppgave.kurateringsgren` til `main` (eller bruk
   `oppgave.pr` hvis den finnes).
2. Meld PR-en til køen med en gang, med `forny` og `"pr": <nummer>`, så den
   ikke blir laget på nytt hvis kjøringen stopper.
3. Når fagarbeidet er ferdig og PR-en har alt den skal ha, send:

   ```json
   { "versjon": 1, "id": "fullfort-1", "handling": "fullfort", "oppgave": "<oppgave-ID>", "pr": <nummer>, "kunnskapsgrense": "ÅÅÅÅ-MM-DD" }
   ```

   `kunnskapsgrense` er datoen kildesøket gjelder til. Ble modusen en annen
   enn den reserverte, legg til `"modus"`.
4. Når svaret er `ok`, er kjøringen ferdig. Køen følger PR-en videre: til
   gjennomgang, sammenslåing og publisering.

## Når noe stopper deg

Send én av disse på øktgrenen, og avslutt kjøringen når svaret har kommet:

| Situasjon | Send |
| --- | --- |
| Tiden i kjøringen strekker ikke til | Commit arbeidet på kurateringsgrenen, så `{"handling": "frigi", "oppgave": …, "grunn": "Tiden strakk ikke til"}`. Neste kjøring får samme stoff og fortsetter (`gjenoppta`). Siste `fase` fra `forny` blir stående |
| En teknisk feil (en jobb feiler, et verktøy svarer ikke) | `{"handling": "feilet", "oppgave": …, "grunn": "<kort>"}`. Stoffet prøves igjen om seks timer |
| Noe bare et menneske kan avgjøre (f.eks. en konflikt i kildegrunnlaget, en manglende preparatomtale) | `{"handling": "blokkert", "oppgave": …, "grunn": "<kort>"}`. Stoffet står til et menneske har sett på det; skriv detaljene i PR-en eller journalen på kurateringsgrenen, ikke i køen |

Alle forespørsler har også `"versjon": 1` og en ny `"id"`.

## Teksten til tidsplanen i ChatGPT

> Arbeid videre med OUSFARs kurateringskø: les `docs/kurateringsko-instruks.md`
> på `main` i repoet peohol/far, og følg den.

En pilot med et bestemt stoff: legg til `"stoff": "<nøkkel>"` i `reserver`
(steg 2), eller sett stoffet først i `forrang` i
`src/kurateringsko/innstillinger.ts`.
