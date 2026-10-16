# Kurateringsgrener – arkitekturvalg og fremdrift

Leses av den som fortsetter arbeidet med kurateringsgrenene
(`docs/kurateringsgrener-visjon.md`). Dette er den levende planen: valgene som
er tatt, fasene, PR-ene og **siste sikre punkt**. Oppdateres i hver PR i
prosjektet, så en ny økt kan fortsette herfra alene.

## Siste sikre punkt

| Dato | Punkt |
| --- | --- |
| 2026-10-16 | B1–F2 ferdige: piloten er bestått (citalopram, lurasidon og GHB kuratert i grener, godkjent av ChatGPT, publisert, funksjonstesten grønn). F3 (1.100.0): `bare_forrang` av og `forrang` tom, så køen går gjennom hele registeret; de planlagte kjøringene startes når PR-en er i produksjonen. |

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
| E2 | Kurateringskøen mot grenene (`/api/kuratering-ko` med OIDC, kontrollrundene i køen), kuratorprotokollen for Claude med verktøyene (`docs/kuratorprotokoll.md`, `npm run kurator`, skillen `monografkurator`) og instruksen for ChatGPT som kontrollør (`docs/kontrollorinstruks.md`) | 1.98.0 | ferdig |
| F1 | Piloten i køen: `forrang` citalopram, lurasidon, GHB med `bare_forrang`, så køen ikke gir ut andre stoffer før piloten er bestått | 1.99.0 | ferdig |
| F2 | Piloten: Claude kuraterer de tre i grener, ChatGPT kontrollerer; publisering bare etter godkjenning og bestått prøvepublisering | 1.100.0 | ferdig |
| F3 | De novo-runden: `bare_forrang` av og `forrang` tom, planlagte kjøringer for kuratoren og kontrolløren, godkjenning per stoff | 1.100.0 | pågår |

## Hvordan det er bygd (for den som fortsetter)

- Skriveveien er felles: `intern.lagre_objekt`, `intern.publiser_objekt` og
  `intern.opprett_objekt_som` tar forfatteren; `lagre_utkast`, `publiser_utkast`
  og `intern.opprett_objekt` bruker dem med den innloggede administratoren.
- `kuratering.utfor` skriver en gren inn og publiserer den; `kuratering.prov`
  kjører den med `set constraints all immediate` i en del-transaksjon som
  rulles tilbake, og leser forhåndsvisningen med `les_stoff` og
  `les_bivirkninger` før tilbakerullingen.
- Handlingene er `kuratering.h_<navn>(aktor, data)`; `kuratering.handlingsliste`
  sier hvilke agentene og administratorene har. En ny handling er en ny
  funksjon og en rad der.
- Sperrende kommentartråder står i `kuratering.sperrer(gren)`, som
  godkjenningen og publiseringen spør; `til_kontroll` krever at kuratoren har
  svart i hver av dem. Testen «tilbyr agentene nøyaktig de handlingene
  databasen har» holder MCP-verktøyene (`src/kuratering/handlinger.ts`) i takt
  med `kuratering.handlingsliste`.
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

- Køen kobler en gren til reservasjonen i `oppdaterGrener`
  (`src/kurateringsko/ko.ts`); grenene leses én gang per kjøring
  (`src/kurateringsko/grener.ts`). Kuratorprotokollens dekningsmatrise har de
  samme 37 kontrollpunktene som kurateringsjournalene
  (`src/kuratorprotokoll/dekning.ts`, testet mot `citalopram-dekning.json`).
- Den opprinnelige ChatGPT-kuratorskillen ligger ikke i repoet; protokollen er
  bygd fra journalene, malen og dokumentene. Dukker den opp, tas det
  strengeste kravet inn i `docs/kuratorprotokoll.md`.

## Piloten og runden (F2, F3)

1. Når stabelen er i produksjonen: `npm run kurator -- kall oversikt` med
   Claude-kuratorens nøkkel skal svare (en tom liste er i orden).
2. Kontrolløren er koblet til når `agenter` (admin) viser at
   ChatGPT-monografkuratoren har en nøkkel og har vært innom.
3. Hvert pilotstoff kurateres etter `docs/kurateringsko-instruks.md` med
   skillen `monografkurator`: reserver, `apne` med `art: "de_novo"`, arbeid etter
   `docs/kuratorprotokoll.md`, `til_kontroll`, `fullfort` med `gren`.
   Kontrolløren vurderer; rettingene går i runder til `godkjent`, så
   publiserer kuratoren og kjører funksjonstesten.
4. Piloten er bestått når alle tre er publisert etter godkjenning, med
   bestått prøvepublisering, og funksjonstesten er grønn. Noter funnene i
   loggen her.
5. F3: en PR som slår av `bare_forrang` og tømmer `forrang`, og planlagte
   kjøringer for kuratoren (tidsplanteksten i `docs/kurateringsko-instruks.md`)
   og kontrolløren (`docs/kontrollorinstruks.md`).

## Avhengigheter som krever Peder

1. ~~Slå sammen PR-ene #231–#237~~ (gjort 2026-10-16).
2. ~~ChatGPT-kontrollørens nøkkel og MCP-koblingen~~ (gjort 2026-10-16; i
   ChatGPT heter det nå «Plugins» → «Add custom MCP server», uten
   autentisering, siden nøkkelen står i adressen). Gjenstår: den planlagte
   kjøringen i ChatGPT med tidsplanteksten i `docs/kontrollorinstruks.md`;
   til den finnes, ber Peder ChatGPT om hver kontrollrunde.
3. Publisering til produksjonen krever Peders uttrykkelige ja i Claude-økten
   (sikkerhetssperren); han ga det for piloten 2026-10-16.

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
- 2026-10-16: E2 køen og protokollen (1.98.0): `public.kuratering_kostatus`
  og `/api/kuratering-ko` (OIDC for «Kurateringskø» på `main`); køen følger
  grenene (`gren` i `forny` og `fullfort`, kontrollrundene, `annen_gren`,
  `gren_forkastet`, `gren_stanset`), og bare grener for samme stoff og med
  arten modusen krever (`gren_feil_kobling`); `docs/kuratorprotokoll.md`,
  `docs/kontrollorinstruks.md`, skillen `monografkurator`, `npm run kurator`
  og den nye instruksen for køen. Tester i `kurateringsko.test.ts`
  («kurateringsgrenene i OUSFAR»), `kuratorprotokoll.test.ts`,
  `kurateringsendepunkt.test.ts` og `kurateringsgrener.test.ts`.
- 2026-10-16: F1 piloten i køen (1.99.0): innstillingen `bare_forrang`, og
  `forrang` citalopram, lurasidon, GHB. Tester i `kurateringsko.test.ts`
  («gir bare ut stoffene i forrang under en pilot»); testene bruker egne
  innstillinger uten pilot. `de_novo_runde` er 2, siden citalopram ble
  de novo-kuratert i runde 1 (den første piloten) og ellers ikke kunne gis ut.
- 2026-10-16: Codex-funnene på #231–#237 rettet på laveste gren og flettet
  oppover: blant annet ankrene og avsluttede tråder (D), nøkkelen og
  aktiviteten per gren (E1), og grener køen holder i en reservasjon (E2).
- 2026-10-16: ChatGPTs kontroll (videresendt av Peder) rettet på #232 og
  flettet oppover: godkjenning krever begrunnelse; portene kontrollerer
  innholdet i dokumentene; selvtesten må ha hvert krav og hver port fra
  protokollen nøyaktig én gang, bestått (`kuratering.selvtestfeil`, malen
  `npm run kurator -- tom-selvtest`).
- 2026-10-16: F2 piloten. Kuratorjobben `kuratorjobb/pilot-20261016` hentet
  preparatomtalene; Latuda og Xyrem mangler norsk omtale, og bivirkningene er
  importert fra EMAs norske produktinformasjon. Hvert stoff gikk gjennom
  blindsøk, avstemming, skriving og dokumentene i sin gren og ble sendt til
  kontroll med bestått prøvepublisering, dekning og selvtest. ChatGPT
  godkjente citalopram i første runde og åpnet sperrende tråder for lurasidon
  (4) og GHB (3), som ble besvart og rettet i en ny revisjon. Citalopram er
  publisert (revisjon 5), og funksjonstesten mot den publiserte siden var
  grønn. Funn: køen mistet kunnskapsgrensen når en godkjent gren ble
  publisert, og avviste `fullfort` etterpå (køen leser grenene før
  forespørselen, så det skjer hver gang); rettet i 1.100.0 (kunnskapsgrensen
  følger grenen gjennom kontrollrundene, og et sent `fullfort` godtas).
- 2026-10-16: Piloten bestått. ChatGPT godkjente lurasidon (revisjon 6) og GHB
  (revisjon 8) i kontrollrunde 2; begge er publisert, og funksjonstesten av
  alle tre publiserte sider (`kuratorjobb/publisert-pilot-20261016`) var
  grønn, med alle bivirkningsradene vist. F3 i 1.100.0.
