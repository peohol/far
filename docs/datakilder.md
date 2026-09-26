# Endringer og driftstatus for ClinPGx og CPIC

Leses når noe som har med endringsloggen eller driftstatusen for de
farmakogenetiske datakildene skal endres: hva som regnes som en klinisk
endring, hva som logges, eller panelet «Datakilder». Kildene selv står i
`docs/clinpgx.md` og `docs/cpic.md`.

Formålet er at en administrator skal se om synkroniseringene går som de skal,
og hva som faktisk er endret i kildene siden forrige vellykkede henting — og
kunne spore en endring tilbake til kjøringen, releasen og kildens egen
merknad. Ingenting her vises for sluttbrukerne, og det sendes ingen varsler.

## Hva som logges

Triggere på datatabellene i skjemaene `clinpgx` og `cpic` ser radene før og
etter hvert bytte og skriver til `datakilder.endringer`
(`supabase/migrations/*_datakilder_endringer.sql`). Synkroniseringsfunksjonene
er ikke endret; alt som bytter inn data, logges likt. Triggerne kjører i samme
transaksjon som byttet, så et bytte som avvises (for lite, ødelagt, henger ikke
sammen), etterlater ingenting i loggen.

| Art | Når |
| --- | --- |
| `grunnlag` | Første gang noe hentes: et kjemikalie i ClinPGx, en type i CPIC. Én føring med antallet, ikke én per objekt |
| `ny` | Et objekt som ikke fantes, eller som var utgått og er tilbake (`spor.tilbake`). I ClinPGx: en annotasjon som er kommet til et kjemikalie |
| `endret` | Et objekt der noe er ulikt: de leste dataene, eller bare rådataene |
| `fjernet` | Et objekt som er borte fra kilden (CPIC: merket utgått). I ClinPGx: en annotasjon som ikke lenger gjelder kjemikaliet |

Hver føring har kjøringen (`synk_id`), typen, kildens ID, i ClinPGx
kjemikaliet den gjelder (`kontekst`), en etikett i klartekst (legemiddelet og
genresultatene for en CPIC-anbefaling, genet og allelet for et allel, ellers
navnet), feltene som er endret, verdiene før og etter i de feltene, og `spor`:

- ClinPGx: kildens egen siste merknad om annotasjonen (`history` i svaret:
  dato, type og tekst, f.eks. «Updated recommendation»);
- CPIC: CPICs versjonsnummer for raden før og etter. Releasen og
  skjemaversjonen står på kjøringen. CPICs egen endringslogg synkroniseres som
  typen `endring`, og nye føringer der logges som metadata.

Rådataene ligger fortsatt i tabellene, og kjøringene i
`clinpgx.synkroniseringer` og `cpic.synkroniseringer`.

## Klinisk eller metadata

Avgjøres deterministisk av feltene som er endret, med reglene i
`datakilder.feltregler`:

1. Regelen for feltet, ellers for typen (`felt = '*'`), ellers **klinisk**.
   Et felt uten regel — også et nytt felt fra kilden — regnes altså som
   klinisk, så ingenting havner blant metadataene av seg selv.
2. En endring er klinisk når minst ett endret felt er klinisk.
3. Et felt som bare finnes på den ene siden, er en endring i OUSFARs lesing
   (ny `PARSERVERSJON`), ikke i kilden, og teller som metadata.
4. Er de leste dataene like og bare rådataene ulike, er det metadata
   (`raa.<felt>`), f.eks. ny historikk hos ClinPGx, et felt OUSFAR ikke leser
   på et kjemikalie, eller en kolonne OUSFAR ikke leser i CPIC.
5. At noe kommer til eller forsvinner, følger regelen for typen.

Metadata er i dag:

| Kilde | Type | Felt |
| --- | --- | --- |
| ClinPGx | kjemikalie | alt, unntatt `finnes` (at kjemikaliet er borte fra ClinPGx, er klinisk) |
| ClinPGx | retningslinje, preparatomtale | `navn`, `legemidler`, `litteratur` |
| ClinPGx | klinisk annotasjon | `nummer`, `navn`, `poeng`, `legemidler`, `retningslinjer`, `preparatomtaler` |
| CPIC | legemiddel | alt, unntatt `retningslinje_id` |
| CPIC | gen | alt, unntatt `oppslagsmetode` |
| CPIC | retningslinje | `navn`, `url`, `clinpgx_id` |
| CPIC | par | `pmid`, `clinpgx_niva` |
| CPIC | genresultat_oppslag | `beskrivelse` |
| CPIC | allel | `pmid` |
| CPIC | alleldefinisjon, publikasjon, term, endring | alt |

Alt annet er klinisk: anbefalingene med betingelser, klassifisering,
populasjon og kommentarer; genresultatene og diplotypene; allelfunksjonene;
parene; retningslinjenes gener og bruksmerknad; i ClinPGx sammendraget,
genene, flaggene for dosering og alternativ, testingen, evidensnivået,
varianten og fenotypene. Endres en regel, gjøres det i en ny migrasjon, og
tabellen over oppdateres.

## Vern mot ødelagte svar

Det som ligger fra før, står når en ny henting er ødelagt eller åpenbart
ufullstendig:

- **CPIC** (`docs/cpic.md`): alt eller ingenting. Antallet rader må stemme
  med det API-et oppgir, hver type må ha minst 80 % av radene fra før, og
  uttrekket må henge sammen.
- **ClinPGx** (`docs/clinpgx.md`): ett kjemikalie om gangen. En type med
  minst fire annotasjoner kan ikke falle under halvparten, og et svar med ett
  objekt som ikke kan leses, byttes ikke inn.

Det som likevel forsvinner — en retningslinje for mye, en anbefaling som er
borte — er en `fjernet`-føring, klinisk, og synes i panelet.

## Driftstatusen

`datakilder_status(antall)` (bare administratorer; andre får 42501) gir de ti
siste kjøringene per kilde med antallet kliniske endringer, metadata og
grunnlag, siste kjente release og versjon per kilde (fra en vellykket kjøring,
også når den siste ikke fikk dem oppgitt), og de siste endringene per kilde
(200 som standard, høyst 1000), så en stor release i den ene kilden ikke
skyver den andre ut.

I appen: kontomenyen → «Datakilder» (bare for administratorer,
`src/components/konto/Datakilder.tsx`). Per kilde:

- tilstanden (`src/datakilder/status.ts`, `vurderKilder`): **Feilet** når
  siste kjøring feilet; **Se over** når den var delvis, har stått uferdig i
  over en halvtime, eller når siste vellykkede henting er eldre enn intervallet
  og ett døgn til. Intervallet leses av cron-uttrykket i `vercel.json`.
  Meldingen ved en feil følger måten kilden byttes inn på (`etterFeil` i
  `KILDEOPPSETT`). I CPIC står dataene fra siste vellykkede henting. I ClinPGx
  kan kjemikalier som ble hentet før feilen, være oppdatert;
- siste vellykkede henting, releasen (CPIC) og versjonen;
- de siste kjøringene;
- de kliniske endringene, nyest først, med feltene, sporet og verdiene før og
  etter; metadataene når de slås på;
- «Hent nå», som gjør det samme som den ukentlige jobben med
  administratorens innlogging (`POST /api/clinpgx-synk` eller
  `/api/cpic-synk`).

## Koden

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_datakilder_endringer.sql` | Skjemaet `datakilder`, reglene, triggerne og `datakilder_status` |
| `src/datakilder/status.ts` | Lesingen av statusen, vurderingen, tekstene for en endring, «Hent nå» |
| `src/components/konto/Datakilder.tsx`, `src/styles/datakilder.css` | Panelet |
| `src/__tests__/clinpgx.test.ts`, `cpic.test.ts` | Endringsloggen, mot en ekte database, for hver kilde |
| `src/__tests__/datakilder.test.ts`, `datakildevisning.test.tsx` | Lesefunksjonen, tilgangen, vurderingen og panelet |

## Begrensninger

- En annotasjon i ClinPGx som endres, logges én gang, uten kjemikaliet; hvilke
  legemidler den gjelder, står i dataene. At den kommer til eller forsvinner
  fra et kjemikalie, logges per kjemikalie.
- ClinPGx har ingen releaser. Sporet er kjøringen, tidspunktet og ClinPGx'
  egen merknad om annotasjonen.
- En regel om hva som er klinisk er et skjønn; ved tvil er feltet klinisk.
- Loggen ryddes ikke. Den vokser bare når kildene endres.
