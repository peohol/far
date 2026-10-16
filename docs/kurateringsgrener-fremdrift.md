# Kurateringsgrener – arkitekturvalg og fremdrift

Leses av den som fortsetter arbeidet med kurateringsgrenene
(`docs/kurateringsgrener-visjon.md`). Dette er den levende planen: valgene som
er tatt, fasene, PR-ene og **siste sikre punkt**. Oppdateres i hver PR i
prosjektet, så en ny økt kan fortsette herfra alene.

## Siste sikre punkt

| Dato | Punkt |
| --- | --- |
| 2026-10-16 | B1 (1.93.0, PR #231), B2 (1.94.0, PR #232), C (1.95.0, PR #233), D (1.96.0, PR #234) og E1 (1.97.0, grenen `claude/kurateringsagenter`) ferdige og testet; PR-ene er stablet og slås sammen i rekkefølge. Neste: E2. |

Neste steg står øverst i [Fasene](#fasene) med status `pågår` eller `neste`.

## Arkitekturvalg

Valgene er tatt etter kartleggingen av databasen, appen, køen og
agentverktøyene 2026-10-16 (fase A). Endres et valg, endres det her først.

1. **Grenene er en egen lagring ved siden av objektmodellen, ikke en tredje
   tilstand.** Hele objektmodellen (hver tabell, hver unik indeks, publiserings-
   kontrollen i `krev_objekttype` og radsikkerheten) forutsetter nøyaktig to
   tilstander, `utkast` og `publisert`. En gren lagrer i stedet øyeblikksbilder
   av objektene den endrer, i samme form som revisjonene (`innhold`), i skjemaet
   `kuratering`. Ved publisering skrives de inn gjennom den vanlige veien
   (`intern.skriv` og revisjonene), så de samme kontrollene gjelder.
2. **Grenen bygger på en hel sideversjon.** Hver gren peker på sideversjonen
   (manifestet) den ble laget fra. Forhåndsvisningen er grunnversjonen med
   grenens endringer, og nøyaktig det publiseres. Er siden publisert på nytt
   etter forgreningen (også en delt referanse fra en annen side), stopper
   publiseringen med en konflikt; grenen må oppdateres til den nye
   grunnversjonen, og godkjenningen faller bort.
3. **Sideversjoner er manifest, ikke kopier.** Et manifest lister de eksakte
   revisjonene av siden, kortene og referansene den siterer, og de gjeldende
   bivirkningsimportene (`bivirkninger.kilder`). Revisjonene er uforanderlige
   fra før, så ingenting kopieres. En utsatt trigger lager manifestet ved
   slutten av hver transaksjon som publiserer noe en side viser, for hver side
   det gjelder, og bare når det er endret. Sideversjonene fra før systemet
   fantes er én basisversjon per side (`opphav = 'basis'`); ingen eldre
   fabrikeres.
4. **Grenen endrer bare sin egen side.** Den kan lage nye kort, endre og
   fjerne kort på siden, endre panelkildene og lage nye referanser. Den kan
   bruke en publisert referanse uendret, men aldri endre en eksisterende
   referanse, siden den deles med andre sider. Strukturerte
   bivirkningsimporter (SPC) ligger i grenen som importfiler og legges inn ved
   publiseringen.
5. **Publiseringen er én transaksjon** (`kuratering.publiser`): godkjenningen
   gjelder siste revisjon og fingeravtrykket, ingen sperrende kommentarer står
   åpne, de tekniske portene er bestått for revisjonen, grunnversjonen er
   sidens gjeldende, og så skrives alt i rekkefølgen databasen krever
   (referansene, siden, det som fjernes, kortene, importene). Endringsloggen
   får én kuratering med rapporten, og sideversjonen lages i samme
   transaksjon. Feiler noe, er ingenting publisert.
6. **Prøvepublisering er den tekniske porten.** Den samme publiseringen
   kjøres i en del-transaksjon som rulles tilbake, så alle databasens
   kontroller prøves mot produksjonen slik den er nå, uten å endre noe.
7. **Roller.** Agentene har egne identiteter (`kuratering.agenter`) med
   rollene `kurator` og `kontrollor`, og tilgang med et token som bare lagres
   som SHA-256. Administratorer leser grenene, kommenterer, godkjenner,
   publiserer og stanser. Vanlige brukere ser ingenting av grenene. En agent
   kan aldri godkjenne en gren den selv har skrevet. Ingen mennesker
   redigerer en aktiv gren.
8. **Agenttilgangen går gjennom serveren.** Et endepunkt i Vercel (samme
   mønster som synkroniseringene, `src/server/tilgang.ts`) kontrollerer
   tokenet og kaller funksjonene i `kuratering` med den hemmelige nøkkelen.
   Det samme verktøysettet tilbys som MCP for ChatGPT. Kurateringskøen leser
   grenstatus med GitHubs OIDC-token, uten hemmeligheter.
9. **Sanntid er målrettet spørring.** Appen spør etter en liten status
   (revisjon, seksjon, aktivitet) med `useJevnligSjekk`, oftere når «Følg
   agenten» er på. Ingen fagtekst sendes i statusen. Supabase Realtime er
   ikke nødvendig og legges ikke til.
10. **Fagkontrollen bor i appen.** Kommentarer, svar, kontrollrunder,
    godkjenninger, evidensjournal og dekningsmatrise lagres i databasen, bak
    innloggingen. GitHub har bare kode, tester og ikke-sensitive statuser.
11. **Den gamle veien står.** Kurateringsmigrasjonene, malen og
    kurateringskjeden fungerer som før til grenene er prøvd i piloten.

## Fasene

| Fase | Innhold | PR | Status |
| --- | --- | --- | --- |
| A | Kartlegging og arkitekturvalg (dette dokumentet) | – | ferdig |
| B1 | Sideversjoner: manifest ved hver publisering, basisversjon, lesing av en eldre hel side (`docs/faginnhold.md`, «Sideversjoner») | 1.93.0 | ferdig |
| B2 | Kurateringsgrener: lagring, revisjoner, statusmaskin, prøvepublisering og samlet publisering, agentidentiteter og roller (`docs/kurateringsgrener.md`) | 1.94.0 | ferdig |
| C | Forhåndsvisning, banner, sammenligning, versjonsliste og gjenoppretting, arbeidsoversikt (`docs/kurateringsgrener.md`, «Gjenopprettingen» og «I appen») | 1.95.0 | ferdig |
| D | Feltkommentarer, kontrollrunder, godkjenning bundet til revisjon, sperrer (`docs/kurateringsgrener.md`, «Kommentarene») | 1.96.0 | ferdig |
| E1 | Agentnøklene i appen, Claude-kuratorens nøkkel, `status` og «Følg agenten», handlingslista som tabell (`docs/kurateringsgrener.md`, «Agentene» og «I appen») | 1.97.0 | ferdig |
| E2 | Kurateringskøen mot grenene, kuratorprotokollen for Claude og instruksen for ChatGPT som kontrollør | – | neste |
| F | Pilot: citalopram, lurasidon, GHB; deretter køstyrt de novo-runde | – | |

## Hvordan det er bygd (for den som fortsetter)

- Skriveveien er felles: `intern.lagre_objekt`, `intern.publiser_objekt` og
  `intern.opprett_objekt_som` tar forfatteren; `lagre_utkast`, `publiser_utkast`
  og `intern.opprett_objekt` bruker dem med den innloggede administratoren.
- `kuratering.utfor` skriver en gren inn og publiserer den; `kuratering.prov`
  kjører den med `set constraints all immediate` i en del-transaksjon som
  rulles tilbake, og leser forhåndsvisningen med `les_stoff` og
  `les_bivirkninger` før tilbakerullingen.
- Handlingene er `kuratering.h_<navn>(aktor, data)`; `kuratering.handlinger`
  sier hvilke agentene og administratorene har. En ny handling er en ny
  funksjon og et navn i lista.
- Sperrende kommentartråder står i `kuratering.sperrer(gren)`, som
  godkjenningen og publiseringen spør; `til_kontroll` krever at kuratoren har
  svart i hver av dem. Testen «tilbyr agentene nøyaktig de handlingene
  databasen har» holder MCP-verktøyene (`src/kuratering/handlinger.ts`) i takt
  med `kuratering.handlinger`.
- Claude-kuratorens nøkkel ligger i prosjektets delte mappe,
  `/mnt/project-files/.hemmelig/claude-monografkurator.nokkel`, og bare
  SHA-256 av den i repoet. Mangler fila, eller virker ikke nøkkelen, lager en
  administrator en ny i appen, og den legges i fila uten å skrives noe annet
  sted.
- En gren kan bygge på objekter utenfor grunnversjonens manifest (et fjernet
  kort en gjenoppretting tar tilbake): revisjonen står da i tilstanden som
  `grunnrevisjon`, og `kuratering.forventet_revisjon` kontrollerer mot den.
- Appen: `src/kuratering/` (klienten og modellen), `src/components/kuratering/`
  (sidene og listene). En utgave av siden vises med `Stoffside` selv, med
  `utgave`-propen og en kilde der leseren gir utgavens data
  (`Utgavevisning`).

## Avhengigheter som krever Peder

Ingen ennå. Når en oppstår, står den her med nøyaktig hva som trengs.

## Logg

- 2026-10-16: PR #230 slått sammen med visjonen (1.92.8). Codex-funnene om
  delte referanser og SPC-importer i sideversjonene er tatt inn (§3, §7).
- 2026-10-16: B1 sideversjoner (1.93.0): `public.sideversjoner`, utsatte
  triggere på `objektpubliseringer` og `bivirkninger.kilder`,
  `les_sideversjoner` og `les_sideversjon`. Tester i
  `src/__tests__/sideversjoner.test.ts`.
- 2026-10-16: B2 kurateringsgrener (1.94.0): skjemaet `kuratering`
  (agenter, grener, grenrevisjoner, vurderinger, hendelser, dokumenter),
  prøvepublisering, samlet publisering, blindfase, agentinngangen
  `kuratering_agent` og admininngangen `kuratering_admin`. Agenten
  `claude-monografkurator` er lagt til. Tester i
  `src/__tests__/kurateringsgrener.test.ts`.
- 2026-10-16: C visningen (1.95.0): `gjenopprett_versjon`,
  `les_sideversjon_bivirkninger`, opphavet på sideversjonene fra grener;
  versjonssiden, kurateringssiden, versjonslista, arbeidsoversikten og
  meldingen på fagsiden. Tester i `src/__tests__/kurateringsvisning.test.tsx`
  og `kurateringsgrener.test.ts`.
- 2026-10-16: D kommentarene (1.96.0): `kuratering.kommentarer`, trådene i
  `les`, `kommenter`, `lukk_kommentar`, `gjenapne_kommentar` og
  `kommentarer`, sperrende tråder i `sperrer` og `til_kontroll`;
  «Kommentarer» på kurateringssiden. Tester i `kurateringsgrener.test.ts`
  («kommentarene») og `kurateringsvisning.test.tsx`.
- 2026-10-16: E1 agentene (1.97.0): `kuratering.handlingsliste`, `status`,
  nøkkelen til `claude-monografkurator`; agentene og «Lag ny nøkkel» under
  «Kurateringer», «Følg agenten» og markeringen av endrede kort på
  kurateringssiden. Tester i `kurateringsgrener.test.ts` («statusen og
  agentene») og `kurateringsvisning.test.tsx`.
