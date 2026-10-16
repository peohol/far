# Kurateringskøen

Leses av monografkuratoren (Claude Code, `docs/kuratorprotokoll.md`) og av den
som endrer køen. Køen er
arbeidslisten kuratoren henter neste stoff fra når den arbeider seg gjennom
stoffregisteret på egen hånd. Det kuratoren gjør ved hver planlagte kjøring,
står kort i `docs/kurateringsko-instruks.md`; her står hvordan køen virker.

Køen gjør ikke noe faglig arbeid. Den holder rede på hvilke stoffer som skal
kurateres, i hvilken rekkefølge, hvem som arbeider med hvilket, og hvor langt
hver kuratering har kommet fram til den er publisert. Kurateringen selv gjøres
av kuratoren med skillen og kuratorjobbene (`docs/kuratorjobber.md`), i en
kurateringsgren i OUSFAR (`docs/kurateringsgrener.md`). Den eldre veien, en
migrasjon i en PR (`docs/monografkuratering.md`), følges fortsatt.

**Repoet er offentlig, og det er køen også.** Køen har bare nøkler, navn,
tall, statuser, datoer, grener, grenenes ID-er og PR-numre. De to frie tekstene kuratoren kan
sende (`fase` og `grunn`, høyst 300 tegn), står på en offentlig gren: skriv
aldri innhold fra fagsidene eller annet som står bak innloggingen der.

## Kort fortalt

- Køen står på grenen **`kurateringsko/tilstand`**. Bare arbeidsflyten
  «Kurateringskø» skriver der. Grenen slås aldri sammen med `main`.
- Kuratoren endrer aldri køen direkte. Den lager en **øktgren**
  `kurateringsko/okt/<noe>` fra `main`, skriver en forespørsel i
  `kurateringsko/foresporsel.json` og committer. Arbeidsflyten behandler den
  og skriver svaret i `kurateringsko/svar.json` på samme gren, som regel innen
  1–5 minutter.
- En reservasjon gir kuratoren et stoff, en oppgave-ID, en jobbgren og en
  kurateringsgren. Høyst én kuratering er reservert om gangen
  (`maks_aktive`). Grener og PR-er som venter på faglig kontroll, teller ikke.
- Køen følger kurateringsgrenen i OUSFAR til den er publisert (eller PR-en til
  den er slått sammen og rullet ut). Da er kurateringen publisert, og stoffet
  får den som sin siste kuratering.

## Filene på køgrenen

| Fil | Hva |
| --- | --- |
| `kurateringsko/neste.json` | Det korte sammendraget: antall per status, de aktive reservasjonene, de neste stoffene i køen med poeng og grunner, PR-ene til gjennomgang, og det som er blokkert. Les denne for å se hvordan køen står |
| `kurateringsko/oversikt.md` | Det samme som en tabell for folk |
| `kurateringsko/ko.json` | Hele køen: hvert stoff med status, modus, prioritet, tallene fra siden, reservasjonen, PR-en, blokkeringene, siste kjøring, siste kuratering og de siste hendelsene |

Hele historikken står i commitene på køgrenen: hver endring er én commit, med
lenken til kjøringen i Actions.

## Statusene

| Status | Betyr |
| --- | --- |
| `klar` | Kan reserveres (når den ikke venter etter en feil, se `tidligst_kl`) |
| `reservert` | En kurator arbeider med det nå, til `reservasjon.frist_kl` |
| `fagarbeid_ferdig` | Kuratoren er ferdig, og PR-en er fortsatt et utkast |
| `venter_godkjenning` | Kurateringsgrenen er sendt til kontroll og venter på kontrolløren (eller PR-en er merket klar til gjennomgang og venter på å bli godkjent og slått sammen) |
| `sammenslatt` | PR-en er slått sammen, men utrullingen til produksjonen er ikke bekreftet ennå |
| `publisert` | Kurateringen er rullet ut, og ingen ny er forfalt |
| `blokkert` | Et menneske må se på det før det kan kurateres (`blokkeringer`) |
| `utenfor` | Ikke aktivt i stoffregisteret (arkivert, i papirkurven, borte), eller utelatt i innstillingene |

Bare `klar` kan reserveres. Et stoff med en gren eller PR køen følger, kan
ikke reserveres før den er publisert, forkastet eller lukket, så samme stoff aldri får to
kurateringer samtidig.

## Modiene

| Modus | Når køen gir den |
| --- | --- |
| `de_novo` | Stoffet er aldri kuratert de novo i runden som gjelder (`de_novo_runde`). Gjelder i dag alle stoffer utenom citalopram |
| `evidensovervaking` | Stoffet er kuratert, og det er gått `evidensovervaking_dager` siden kunnskapsgrensen. Av til den slås på (under) |
| `oppdatering` | Gis aldri av køen; står i historikken for eldre kurateringer funnet i repoet |

Kuratoren kan melde en annen modus enn den reserverte i `fullfort` (`modus`),
hvis det var det som faktisk ble gjort.

## Prioriteringen

Køen gir ut det klare stoffet med flest poeng; grunnene står i klartekst i
`prioritet.grunner`. Ved likt antall poeng går det alfabetisk. Vektene står i
`src/kurateringsko/innstillinger.ts`.

| Grunn | Poeng |
| --- | --- |
| En avbrutt kuratering som skal fortsettes (`gjenoppta`) | 1000 |
| Stoffet står i `forrang` | opptil 500 (den første får mest) |
| Aldri kuratert | 100, og 200 for alder |
| De novo i runden som gjelder | 50 |
| År siden siste kuratering (høyst to) | 100 per år |
| Tomme redaksjonelle seksjoner | opptil 100 (andelen tomme) |
| Elementer uten noen kilde | opptil 50 (andelen) |
| Færre enn fem referanser | 20 |

Tallene fra sidene (elementer, seksjoner med innhold, referanser, elementer
uten kilde) leses med appens egne lesere som testbrukeren (den samme som
funksjonstesten bruker), høyst én gang i døgnet. Bare tallene lagres.

Et stoff som venter etter en feil, står sist til `tidligst_kl`.

## Historikken

- **Oppdagelse.** Nye stoffer i stoffregisteret kommer i køen ved neste
  måling. Et stoff uten publisert fagside blokkeres (`uten_fagside`) til siden
  finnes; den blokkeringen forsvinner av seg selv.
- **Kurateringer i repoet.** Køen leser monografkurateringene blant
  migrasjonene på `main` (kallet `intern.kuratering_start('<stoff>')`) og
  evidensjournalene i `docs/kurateringsjournal/<stoff>.md` (feltene
  «Kurateringsmodus», «Kunnskapsgrense», «Siste fulle kjøring» og
  «Siste de novo-kjøring»). En kuratering som er gjort utenom køen,
  blir kjent for køen. Ved avgrensede oppfølginger brukes journalens
  dato for **siste fulle kjøring** som faglig grunnlinje: en senere
  korreksjon av et kort eller en SPC-import må ikke gjøre at stoffet
  feilaktig settes opp til en ny de novo-kuratering. Den tidligere
  gjennomførte de novo-runden blir bevart til en nyere runde bestilles.
- **Publisering.** Når en PR køen følger, er slått sammen, ser køen etter
  «Produksjonsmigrering» på `main`. Er den vellykket, er kurateringen
  publisert med modus, kunnskapsgrense, de novo-runde og PR. Feilet den, blir
  stoffet blokkert (`utrulling_feilet`) til en ny utrulling lykkes.
- **Feil PR.** En meldt PR som ikke kommer fra kurateringsgrenen, godtas ikke:
  stoffet går tilbake i køen med `gjenoppta` på samme grener, og køen finner
  den riktige PR-en fra grenen selv.
- **Lukket PR.** En PR som lukkes uten å bli slått sammen, blokkerer stoffet
  (`pr_lukket`) til et menneske har sett på det.

## Avbrudd, frister og nye forsøk

- En reservasjon varer i 180 minutter. `forny` forlenger den med 180 minutter
  fra nå, men aldri mer enn 24 timer fra den ble gjort.
- Går fristen ut uten `forny` eller en avslutning, avbrytes reservasjonen
  (`tidsavbrudd`), og stoffet er klart igjen.
- `feilet` gir stoffet tilbake til køen etter seks timer. `frigi` gir det
  tilbake med en gang.
- Etter tre forsøk (`maks_forsok`) uten en ferdig kuratering blir stoffet
  blokkert (`for_mange_forsok`). `frigi` og `blokkert` teller ikke som forsøk.
- Det kuratoren har laget i et avbrutt forsøk, tas vare på i `gjenoppta`:
  oppgaven, grenene, PR-en og siste `fase`. Neste reservasjon av stoffet
  (som kommer først i køen) får de samme grenene og PR-en, så kuratoren
  fortsetter der i stedet for å begynne på nytt. Har kuratoren laget en PR
  fra kurateringsgrenen uten å melde den, finner køen den selv.
- En forespørsel med samme `id` og innhold som den forrige på grenen, gir det
  samme svaret uten å endre noe. En forespørsel som sendes på nytt etter et
  avbrudd, gir derfor aldri to reservasjoner.

## Kurateringsgrenene

Ved hver kjøring leser køen alle kurateringsgrenene i OUSFAR, uten fagtekst
(ID, stoff, art, status, revisjon, runde og tidene), gjennom
`/api/kuratering-ko`. Arbeidsflyten logger inn med GitHubs OIDC-token, så det
finnes ingen hemmelighet å lagre; serveren slipper bare inn «Kurateringskø» på
`main`. Svarer OUSFAR ikke, går kjøringen videre uten grenene og prøver igjen
neste time.

- **Riktig stoff og art.** En gren hører bare til et stoff når den gjelder
  det samme stoffet og har arten kurateringen krever: `de_novo` for en de
  novo-kuratering, `kuratering` for evidensovervåkning og oppdatering. En
  `gren` i `forny` eller `fullfort` som ikke passer, avvises, og reservasjonen
  står som før. Kunne køen ikke se grenen da den ble meldt, kontrolleres den
  når grenene leses: koblingen brytes, oppgaven står i `gjenoppta` uten grenen,
  og stoffet blokkeres (`gren_feil_kobling`) til riktig gren er koblet. En slik
  gren føres aldri som stoffets kuratering, heller ikke når den publiseres.
- **Reservert.** Kuratoren melder grenen med `forny` (`gren`) så snart den er
  åpnet. Har den ikke gjort det, kobler køen den åpne grenen for stoffet til
  reservasjonen selv, eller til et avbrutt forsøk som står uten gren.
- **Til kontroll.** `fullfort` med `gren` avslutter reservasjonen, og køen
  følger grenen (`venter_godkjenning`). Den teller ikke mot `maks_aktive`.
- **Kontrollrundene.** Når kontrolløren har bedt om endringer
  (`tilbakemelding`), godkjent grenen (`godkjent`), eller grenen er tilbake i
  arbeid, gir køen stoffet til kuratoren igjen, først i køen, med grenen og
  grunnen i `gjenoppta`. En kontrollrunde teller ikke som et forsøk.
- **Publisert.** Stoffet får grenen som sin siste kuratering. Det gjelder
  også en gren som er reservert eller står i `gjenoppta` (f.eks. en godkjent
  gren kuratoren publiserte før kjøringen stoppet): reservasjonen avsluttes,
  og kunnskapsgrensen står som ukjent.
- **Stoppet.** En forkastet gren (også en reservert eller i `gjenoppta`) gir
  blokkeringen `gren_forkastet`, en stanset
  gren `gren_stanset`. Finnes det en åpen gren for stoffet som ikke er den køen
  kjenner, blir stoffet blokkert (`annen_gren`) til et menneske har sett på
  det, så samme stoff aldri kurateres i to grener samtidig. `tilbakestill`
  avvises så lenge køen følger en gren.

`neste.json` og `oversikt.md` viser grenen og statusen dens under
`til_gjennomgang`.

## Forespørslene

`kurateringsko/foresporsel.json` på øktgrenen. Alle har `versjon` (`1`),
`id` (ny for hver forespørsel på grenen: bokstaver, tall og `. _ : + -`) og
`handling`. Felt en handling ikke tar, gir `avvist`.

| `handling` | Krever | Tar også | Gjør |
| --- | --- | --- | --- |
| `status` | | | Gir oversikten (det samme som `neste.json`) |
| `forhandsvis` | | `stoff` | Viser hva `reserver` ville gitt, uten å reservere |
| `reserver` | | `stoff` | Reserverer det første stoffet i køen, eller `stoff` (nøkkel eller navn) |
| `forny` | `oppgave` | `fase`, `gren`, `pr`, `jobbgren`, `kurateringsgren` | Forlenger fristen; melder hvor langt kuratoren har kommet, og grenen (eller PR-en) så snart den finnes |
| `fullfort` | `oppgave`, `kunnskapsgrense`, og enten `gren` eller `pr` | `modus`, `fase`, `jobbgren`, `kurateringsgren` | Grenen er sendt til kontroll (eller utkast-PR-en laget); køen følger den videre |
| `feilet` | `oppgave`, `grunn` | `fase` | Noe gikk galt; stoffet kan prøves igjen etter ventetiden |
| `blokkert` | `oppgave`, `grunn` | `fase` | Kurateringen kan ikke gjøres før et menneske har sett på noe |
| `frigi` | `oppgave` | `grunn` | Gir stoffet tilbake uten feil, f.eks. når tiden ikke strekker til |
| `tilbakestill` | `stoff`, `grunn` | | Fjerner blokkeringene og forsøkene for et stoff som ikke er reservert. For et menneske, eller kuratoren når et menneske har bedt om det |

`kunnskapsgrense` er datoen kildesøket gjelder til (`ÅÅÅÅ-MM-DD`). `gren` er
kurateringsgrenens ID i OUSFAR. `pr` er nummeret. `jobbgren` må være under `kuratorjobb/`, `kurateringsgren` under
`kuratering/`.

Eksempler:

```json
{ "versjon": 1, "id": "reserver-1", "handling": "reserver" }
```

```json
{ "versjon": 1, "id": "forny-3", "handling": "forny", "oppgave": "amitriptylin-0001", "fase": "SPC-tabeller kontrollert", "pr": 240 }
```

```json
{ "versjon": 1, "id": "fullfort-1", "handling": "fullfort", "oppgave": "amitriptylin-0001", "gren": "0b5f…", "kunnskapsgrense": "2026-10-20" }
```

## Svaret

`kurateringsko/svar.json` på øktgrenen:

| Felt | Hva |
| --- | --- |
| `foresporsel_id` | ID-en svaret gjelder. Vent til den er din |
| `utfall` | `ok`, `ingen_oppgave` (ingenting å reservere nå) eller `avvist` (forespørselen kunne ikke brukes; grunnen står i `melding`) |
| `melding` | På norsk |
| `oppgave` | Etter `reserver`, `forhandsvis` og `forny`: `oppgave`, `stoff`, `navn`, `modus`, `forsok`, `frist_kl`, `jobbgren`, `kurateringsgren`, `gren`, `pr`, `gjenoppta`, `sist_kuratert`, `maal` (tallene) og `prioritet` |
| `ko` | Etter `status` og `ingen_oppgave`: oversikten |
| `kjoring` | Lenken til kjøringen i Actions |

Svaret er en commit fra arbeidsflyten på øktgrenen. Neste forespørsel
committes oppå den, på samme gren.

## Innstillingene

`src/kurateringsko/innstillinger.ts`, endres i en PR til `main`:

| Innstilling | Nå | Hva |
| --- | --- | --- |
| `maks_aktive` | 1 | Flest reserverte kurateringer samtidig |
| `reservasjon_minutter`, `maks_reservasjon_timer` | 180, 24 | Fristene |
| `maks_forsok`, `ventetid_etter_feil_minutter` | 3, 360 | Nye forsøk |
| `aktive_modi` | `de_novo` | Legg til `evidensovervaking` for å la køen gi ut evidensovervåkning |
| `de_novo_runde` | 1 | Øk for en ny de novo-runde gjennom hele registeret |
| `evidensovervaking_dager` | 180 | Fra kunnskapsgrensen til evidensovervåkningen er forfalt |
| `forrang` | tom | Stoffer som skal først, i rekkefølge, f.eks. for en pilot |
| `utelatt` | `teststoff` | Stoffer køen ikke gir ut, som testsiden |
| `maling_timer` | 20 | Hvor ofte sidene måles |
| `okt_slettes_etter_dager` | 14 | Øktgrener uten aktiv reservasjon slettes etter så lenge |

## Kjøringen

Arbeidsflyten «Kurateringskø» (`.github/workflows/kurateringsko.yml`) kjører:

- når en forespørsel committes på en øktgren (den lille jobben «videresend»
  starter køen på `main`, uten hemmeligheter, som for kuratorjobbene);
- hver time, for fristene, grenene, PR-ene og utrullingene;
- for hånd: Actions → Kurateringskø → Run workflow (med `maal` for å måle
  sidene med en gang).

Kjøringene går én om gangen, og hver behandler alle forespørsler som ikke er
besvart, i den rekkefølgen de ble committet. En kjøring GitHub hopper over,
mister derfor ingenting. Køen leses, endres og skrives tilbake som én commit;
har en annen kjøring skrevet imens, begynner kjøringen på nytt med køen slik
den er nå. Svarene skrives først når køen er lagret. Stopper kjøringen mellom
de to, skriver neste kjøring det samme svaret.

## Sikkerheten

- Køen kjører bare fra `main`, i miljøet `kuratortest`, med den vanlige
  testbrukeren. Den endrer ingenting i databasen. Grenene leser den uten
  fagtekst, gjennom `/api/kuratering-ko`, med et OIDC-token GitHub bare gir
  arbeidsflyten på `main`.
- Arbeidsflyten skriver bare køgrenen og `kurateringsko/svar.json` på
  øktgrenene, og sletter gamle øktgrener. Den slår aldri sammen og godkjenner
  aldri noe.
- Køen publiserer aldri noe. En gren publiseres bare når kontrolløren har
  godkjent nøyaktig den siste revisjonen og prøvepubliseringen er bestått
  (databasen håndhever det). Ingen PR slås sammen automatisk; det gjør et
  menneske etter faglig gjennomgang, som før.
- Testene (`src/__tests__/kurateringsko.test.ts`) prøver hele livsløpet mot
  ekte git-grener: samtidige reservasjoner, gjentatte forespørsler, fornying,
  feil, tidsavbrudd, gjenopptak, gren og PR fram til publisering, kontrollrunder, en kjøring som
  stopper før svaret er skrevet, og to kjøringer som skriver samtidig.

## Koden

| Hvor | Hva |
| --- | --- |
| `.github/workflows/kurateringsko.yml` | Arbeidsflyten: videresendingen og køen |
| `scripts/kurateringsko.ts` | Én kjøring: testbrukeren, repoet og GitHub |
| `src/kurateringsko/modell.ts` | Formen på køen, forespørslene og svarene, grenene og filene |
| `src/kurateringsko/innstillinger.ts` | Innstillingene og vektene |
| `src/kurateringsko/foresporsel.ts` | Lesingen og kontrollen av forespørselen |
| `src/kurateringsko/ko.ts` | Køen som rene funksjoner: status, prioritet, frister, PR-er og handlingene |
| `src/kurateringsko/kjoring.ts` | Kjøringen: les, oppdater, behandle, skriv, svar |
| `src/kurateringsko/maling.ts` | Tallene fra de publiserte sidene, med appens lesere |
| `src/kurateringsko/historikk.ts` | Kurateringene i migrasjonene og journalene |
| `src/kurateringsko/git.ts`, `github.ts` | Grenene, PR-ene og utrullingen |
| `src/kurateringsko/grener.ts` | Kurateringsgrenene i OUSFAR, med OIDC-tokenet |
| `src/kuratering/endepunkt.ts`, `api/kuratering-ko.ts` | `/api/kuratering-ko` og `public.kuratering_kostatus` |
