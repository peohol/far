# Kurateringsgrener – arkitekturvalg og fremdrift

Leses av den som fortsetter arbeidet med kurateringsgrenene
(`docs/kurateringsgrener-visjon.md`). Dette er den levende planen: valgene som
er tatt, fasene, PR-ene og **siste sikre punkt**. Oppdateres i hver PR i
prosjektet, så en ny økt kan fortsette herfra alene.

## Siste sikre punkt

| Dato | Punkt |
| --- | --- |
| 2026-10-16 | Fase B1 (sideversjoner, 1.93.0) ferdig på grenen `claude/sideversjoner`. Neste: B2. |

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
| B2 | Kurateringsgrener: lagring, revisjoner, statusmaskin, prøvepublisering og samlet publisering, agentidentiteter og roller | – | pågår |
| C | Forhåndsvisning, banner, sammenligning, versjonsliste og gjenoppretting, arbeidsoversikt | – | |
| D | Feltkommentarer, kontrollrunder, godkjenning bundet til revisjon, sperrer | – | |
| E | Agentendepunkt (HTTP og MCP), kø mot grener, «Følg agenten», kuratorprotokollen for Claude | – | |
| F | Pilot: citalopram, lurasidon, GHB; deretter køstyrt de novo-runde | – | |

## Avhengigheter som krever Peder

Ingen ennå. Når en oppstår, står den her med nøyaktig hva som trengs.

## Logg

- 2026-10-16: PR #230 slått sammen med visjonen (1.92.8). Codex-funnene om
  delte referanser og SPC-importer i sideversjonene er tatt inn (§3, §7).
- 2026-10-16: B1 sideversjoner (1.93.0): `public.sideversjoner`, utsatte
  triggere på `objektpubliseringer` og `bivirkninger.kilder`,
  `les_sideversjoner` og `les_sideversjon`. Tester i
  `src/__tests__/sideversjoner.test.ts`.
