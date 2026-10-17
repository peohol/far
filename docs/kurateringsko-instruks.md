# Instruks for hver planlagte kjøring

Leses av monografkuratoren (Claude Code, med kuratorskillen
`.claude/skills/monografkurator/SKILL.md`) ved hver planlagte kjøring. Følg
stegene i rekkefølge. Hvordan køen virker, står i `docs/kurateringsko.md`; det
faglige arbeidet gjøres etter `docs/kuratorprotokoll.md`, i en kurateringsgren
i OUSFAR (`docs/kurateringsgrener.md`).

Grunnreglene:

- Én kuratering om gangen. Arbeid bare med stoffet køen har gitt deg.
- Kurateringen gjøres i kurateringsgrenen i OUSFAR, ikke i en PR. Ingenting
  publiseres før kontrolløren har godkjent nøyaktig den siste revisjonen, og
  prøvepubliseringen er bestått; databasen håndhever det.
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
     `stoff`, `modus`, `jobbgren`, `gren` og `gjenoppta`.

Hver ny forespørsel senere i kjøringen committes på **samme øktgren**, med en
ny `id` (`forny-1`, `forny-2`, `fullfort-1` …), og besvares på samme måte.

## 3. Kurater stoffet

- **Modusen** står i `oppgave.modus` (i dag alltid `de_novo`).
- **Grenen.** Har `oppgave.gren` en verdi, fortsetter du i den grenen:
  `gjenoppta.grunn` sier hvorfor (et avbrutt forsøk, kontrolløren har bedt om
  endringer, eller grenen er godkjent og kan publiseres). Ellers åpner du en ny
  gren (`apne`, med `"art": "de_novo"` for de novo) og melder den til køen med
  en gang:

  ```json
  { "versjon": 1, "id": "forny-1", "handling": "forny", "oppgave": "<oppgave-ID>", "gren": "<grenens ID>", "fase": "Grenen åpnet" }
  ```

- **Kuratorjobbene** (funksjonstest og preparatomtaler) kjøres på
  `oppgave.jobbgren` som beskrevet i `docs/kuratorjobber.md`, med
  `"referanse": "<oppgave-ID>"` i forespørselen.
- **Kurateringen** følger `docs/kuratorprotokoll.md`. Lagre i grenen underveis,
  så arbeidet kan fortsettes hvis kjøringen stopper.

**Forny reservasjonen** omtrent hver time og etter hvert større steg, med det
du holder på med:

```json
{ "versjon": 1, "id": "forny-2", "handling": "forny", "oppgave": "<oppgave-ID>", "fase": "<kort, uten innhold fra siden>" }
```

Fristen er tre timer fra hver fornying (høyst 24 timer i alt). Går den ut,
mister du reservasjonen; da avslutter du kjøringen uten å endre mer.

## 4. Send til kontroll, eller publiser

1. Når grenen har alt protokollen krever: `til_kontroll` for den siste
   revisjonen. Svarer databasen med hva som mangler, retter du det først.
2. Meld det til køen:

   ```json
   { "versjon": 1, "id": "fullfort-1", "handling": "fullfort", "oppgave": "<oppgave-ID>", "gren": "<grenens ID>", "kunnskapsgrense": "ÅÅÅÅ-MM-DD" }
   ```

   `kunnskapsgrense` er datoen kildesøket gjelder til. Ble modusen en annen
   enn den reserverte, legg til `"modus"`.
3. Når svaret er `ok`, er kjøringen ferdig. Køen følger grenen videre, og gir
   deg stoffet igjen (først i køen) når kontrolløren har bedt om endringer
   eller godkjent det. En kontrollrunde teller ikke som et forsøk.
4. **Er grenen godkjent** (`gjenoppta.grunn` sier det, og `status` gir
   `godkjent`): publiser den (`publiser` med den godkjente revisjonen), kjør
   funksjonstesten mot den publiserte siden, og send `fullfort` med grenen.
   Køen ser at grenen er publisert, og stoffet er ferdig. Har køen alt sett
   publiseringen, svarer den `ok` på `fullfort` uten å endre noe.

## Når noe stopper deg

Send én av disse på øktgrenen, og avslutt kjøringen når svaret har kommet:

| Situasjon | Send |
| --- | --- |
| Tiden i kjøringen strekker ikke til | Lagre arbeidet i grenen, så `{"handling": "frigi", "oppgave": …, "grunn": "Tiden strakk ikke til"}`. Neste kjøring får samme stoff og fortsetter i grenen (`gjenoppta`). Siste `fase` fra `forny` blir stående |
| En teknisk feil (en jobb feiler, et verktøy svarer ikke) | `{"handling": "feilet", "oppgave": …, "grunn": "<kort>"}`. Stoffet prøves igjen om seks timer |
| Noe bare et menneske kan avgjøre (f.eks. en konflikt i kildegrunnlaget, en manglende preparatomtale) | `{"handling": "blokkert", "oppgave": …, "grunn": "<kort>"}`. Stoffet står til et menneske har sett på det; skriv detaljene i en tråd i grenen, ikke i køen |

Alle forespørsler har også `"versjon": 1` og en ny `"id"`.

**Når mennesket har avgjort** det som stoppet deg, og ber deg fortsette:
send `tilbakestill` med stoffet og grenen du arbeidet i, på en ny øktgren:

```json
{ "versjon": 1, "id": "tilbakestill-1", "handling": "tilbakestill", "stoff": "<nøkkel>", "gren": "<grenens ID>", "grunn": "Avgjort av et menneske" }
```

Køen gir deg da stoffet igjen med grenen: reserver det (steg 2, gjerne med
`"stoff"`), fortsett i `oppgave.gren`, og send `fullfort` med grenen som
vanlig. Uten `gren` glemmer køen grenen, og stoffet blir stående blokkert
(`annen_gren`) så lenge grenen er åpen. Svarer køen `avvist`, står grunnen i
`melding` (grenen finnes ikke, er ikke aktiv eller hører til et annet stoff).

## Den eldre veien

Før kurateringsgrenene ble en kuratering levert som en migrasjon i en
utkast-PR fra `oppgave.kurateringsgren` (`docs/monografkuratering.md`), meldt
til køen med `"pr"` i stedet for `"gren"`. Køen følger fortsatt en slik PR til
den er publisert, men nye kurateringer gjøres i grenene.

## Teksten til tidsplanen

> Arbeid videre med OUSFARs kurateringskø: les `docs/kurateringsko-instruks.md`
> på `main` i repoet peohol/far, og følg den med kuratorskillen.

En pilot med et bestemt stoff: legg til `"stoff": "<nøkkel>"` i `reserver`
(steg 2), eller sett stoffet først i `forrang` i
`src/kurateringsko/innstillinger.ts`.
