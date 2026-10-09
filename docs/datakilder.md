# Endringer og driftstatus for datakildene

Leses når noe som har med endringsloggen for datakildene eller driftstatusen
for FEST, ClinPGx, CPIC, PubChem og Farmakologiportalen skal endres: hva som regnes som en klinisk
endring, hva som logges, eller panelet «Datakilder». Kildene selv står i
`docs/legemiddeldata.md`, `docs/clinpgx.md`, `docs/cpic.md`, `docs/kjemi.md` og
`docs/farmakologiportalen.md`.

Formålet er at en administrator skal se om synkroniseringene går som de skal,
og hva som faktisk er endret i kildene siden forrige vellykkede henting — og
kunne spore en endring tilbake til kjøringen, releasen og kildens egen
merknad. Ingenting her vises for sluttbrukerne, og det sendes ingen varsler.

## Hva som logges

Triggere på datatabellene i skjemaene `clinpgx`, `cpic`, `pubchem` og
`farmakologiportalen` ser radene før og
etter hvert bytte og skriver til `datakilder.endringer`
(`supabase/migrations/*_datakilder_endringer.sql`). Synkroniseringsfunksjonene
er ikke endret; alt som bytter inn data, logges likt. Triggerne kjører i samme
transaksjon som byttet, så et bytte som avvises (for lite, ødelagt, henger ikke
sammen), etterlater ingenting i loggen.

| Art | Når |
| --- | --- |
| `grunnlag` | Første gang noe hentes: et kjemikalie i ClinPGx, en type i CPIC, forbindelsene i PubChem. Én føring med antallet, ikke én per objekt |
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
  typen `endring`, og nye føringer der logges som metadata;
- PubChem: parserversjonene før og etter, når OUSFARs lesing er endret. Er
  svaret fra PubChem det samme og bare lesingen ny, er endringen metadata.
- Farmakologiportalen: det samme, med parserversjonene. Etiketten for en
  analyse er navnet, laboratoriet og prøvematerialet.

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
| PubChem | forbindelse | `tittel`, `iupac`, `monoisotopisk_masse` |
| Farmakologiportalen | enhet, prøvemateriale, institusjon, laboratorium | alt |
| Farmakologiportalen | komponent | alt, unntatt `molvekt`, `cas` og `gruppe` |
| Farmakologiportalen | analyse | `navn`, `kode`, `akkreditert`, `laboratorium`, `institusjon` |

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
  objekt som ikke kan leses eller har en annen form enn ventet
  (strukturkontrollen), byttes ikke inn.
- **PubChem** (`docs/kjemi.md`): det som består kontrollen, i én
  transaksjon. En forbindelse der PubChem oppgir en annen InChIKey eller formel
  enn koblingen ble kontrollert mot, byttes ikke inn (konflikt), og mangler
  mange i svaret eller kan de ikke leses, byttes ingenting inn.
- **Farmakologiportalen** (`docs/farmakologiportalen.md`): alt eller
  ingenting. Hver type må ha minst 80 % av radene fra før (komponenter og
  analyser 90 %), og strukturkontrollen avviser lister der felt lesingen
  bygger på, mangler i mer enn 5 % av radene.
- **FEST** (`docs/legemiddeldata.md`): alt eller ingenting. Hver type må ha
  minst 80 % av radene fra før, og strukturkontrollen avviser et uttrekk der
  sentrale felt eller koblinger plutselig er borte fra nesten alle postene.

Strukturkontrollene er heuristiske sikkerhetsnett mot sannsynlige brudd i
kildenes format, ikke en garanti for at enhver endring oppdages; hva de ikke
fanger, står i dokumentet for hver kilde.

Det som likevel forsvinner — en retningslinje for mye, en anbefaling som er
borte — er en `fjernet`-føring, klinisk, og synes i panelet.

## Driftstatusen

`datakilder_status(antall)` (bare administratorer; andre får 42501) gir de ti
siste kjøringene per kilde (FEST, ClinPGx, CPIC, PubChem, Farmakologiportalen) med antallet kliniske
endringer, metadata og grunnlag (FEST: radene i `antall`), siste kjente release og versjon per kilde (fra en vellykket kjøring,
også når den siste ikke fikk dem oppgitt), og de siste endringene per kilde
(200 som standard, høyst 1000), så en stor release i den ene kilden ikke
skyver den andre ut.

I appen: adminmenyen → «Datakilder» (bare for administratorer,
`src/components/konto/Datakilder.tsx`). Per kilde:

- tilstanden (`src/datakilder/status.ts`, `vurderKilder`): **Feilet** når
  siste kjøring feilet, med feilteksten fra kjøringen; **Se over** når den var
  delvis (med feilene per kjemikalie), har stått uferdig i over en halvtime,
  eller når siste vellykkede henting er eldre enn intervallet og ett døgn til.
  Intervallet leses av cron-uttrykket i `vercel.json`: for FEST hver natt, så
  to døgn; for ClinPGx, CPIC og PubChem hver uke, så åtte døgn.
  Farmakologiportalen kjøres av GitHub Actions og har intervallet i
  `KILDEOPPSETT` (hver natt, så to døgn). Meldingen ved en feil
  følger måten kilden byttes inn på (`etterFeil` og `beholdt` i
  `KILDEOPPSETT`). I FEST og CPIC står dataene fra siste vellykkede henting;
  for FEST sier panelet at OUSFAR fortsatt bruker siste gyldige FEST-data. I
  ClinPGx kan kjemikalier som ble hentet før feilen, være oppdatert;
- siste vellykkede henting, releasen (CPIC) og versjonen: parserversjonen
  (ClinPGx, PubChem, Farmakologiportalen), skjemaversjonen (CPIC) eller datoen DMP laget uttrekket (FEST);
- «Til vurdering»: det siste vellykkede kjøring ikke kunne koble sikkert
  (`antall.uavklarte`), i PubChem forbindelsene uten verifisert kobling. For
  Farmakologiportalen også rapporten fra kjøringen (`antall.merknader`):
  koblinger som ikke stemmer lenger, ulike molekylvekter, ukjente
  prøvematerialer og enheter, og henvisninger som ikke henger sammen
  (`antall.brudd`);
- de siste kjøringene, med hvem som utløste dem (den nattlige eller ukentlige
  jobben, eller en administrator);
- ClinPGx, CPIC, PubChem og Farmakologiportalen: de kliniske endringene, nyest først, med feltene, sporet og
  verdiene før og etter; metadataene når de slås på. FEST logger ikke hver
  endring; kjøringene viser hvor mange rader som ble nye, endret og utgått;
- «Hent nå», som gjør det samme som den planlagte jobben med
  administratorens innlogging (`POST /api/legemiddeldata-synk`,
  `/api/clinpgx-synk`, `/api/cpic-synk`, `/api/pubchem-synk` eller
  `/api/farmakologiportalen-synk`). `CRON_SECRET` og
  `SUPABASE_SECRET_KEY` blir på serveren.

## Koden

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_datakilder_endringer.sql` | Skjemaet `datakilder`, reglene, triggerne og `datakilder_status` |
| `supabase/migrations/*_fest_i_datakilder.sql` | FEST i `datakilder_status`, og `utlost_av` på FEST-kjøringene |
| `supabase/migrations/*_pubchem.sql` | PubChem i reglene, loggen og `datakilder_status` |
| `supabase/migrations/*_farmakologiportalen.sql` | Farmakologiportalen i reglene, loggen og `datakilder_status` |
| `src/datakilder/status.ts` | Lesingen av statusen, vurderingen, tekstene for en endring, «Hent nå» |
| `src/components/konto/Datakilder.tsx`, `src/styles/datakilder.css` | Panelet |
| `src/__tests__/clinpgx.test.ts`, `cpic.test.ts`, `kjemi.test.ts`, `farmakologiportalen.test.ts` | Endringsloggen, mot en ekte database, for hver kilde |
| `src/__tests__/datakilder.test.ts`, `datakildevisning.test.tsx` | Lesefunksjonen, tilgangen, vurderingen og panelet |
| `src/__tests__/legemiddeldata.test.ts` | FEST-feil i statusen, og «Hent nå» for FEST |

## Begrensninger

- En annotasjon i ClinPGx som endres, logges én gang, uten kjemikaliet; hvilke
  legemidler den gjelder, står i dataene. At den kommer til eller forsvinner
  fra et kjemikalie, logges per kjemikalie.
- ClinPGx har ingen releaser. Sporet er kjøringen, tidspunktet og ClinPGx'
  egen merknad om annotasjonen.
- En regel om hva som er klinisk er et skjønn; ved tvil er feltet klinisk.
- Loggen ryddes ikke. Den vokser bare når kildene endres.
- FEST har ingen endringslogg per objekt; bare antallet nye, endrede og
  utgåtte rader per kjøring.
