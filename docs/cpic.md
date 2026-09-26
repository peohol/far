# Strukturerte farmakogenetiske data fra CPIC

Leses når noe som har med CPIC-dataene å gjøre skal endres: synkroniseringen,
datamodellen, lesingen, eller visningen og oppslaget som bygger på dem.
Mønsteret er det samme som for FEST (`docs/legemiddeldata.md`) og ClinPGx
(`docs/clinpgx.md`), og det som står der om prinsippene, gjelder også her.

ClinPGx gir den brede kunnskapsoversikten på stoffsiden (retningslinjer,
preparatomtaler, kliniske annotasjoner). CPIC-laget gir det strukturerte:
hvilke gen–legemiddel-par CPIC har vurdert, hvilke genetiske resultater en
anbefaling gjelder, selve anbefalingen og styrken. Dataene er
**referanseinformasjon**: de beskriver hva CPIC anbefaler når et
farmakogenetisk resultat allerede er kjent, ikke hvem som bør testes.

## Kilden og lisensen

| | |
| --- | --- |
| Kilde | [CPIC](https://cpicpgx.org) (Clinical Pharmacogenetics Implementation Consortium), en del av ClinPGx |
| API | `https://api.cpicpgx.org/v1`: PostgREST rett over CPIC-databasen, Swagger 2.0-beskrivelse på samme adresse. Åpent, uten nøkkel |
| Lisens | CC0 1.0, ifølge CPIC-delen av [bruksvilkårene hos ClinPGx](https://www.clinpgx.org/page/dataUsagePolicy) (`cpicpgx.org/license` sender dit). CPIC ber om å bli kreditert, og om at URL, dato og versjon oppgis for data fra CPICs database og API |
| Grense | CPIC oppgir ingen. OUSFAR gjør ett kall om gangen med 0,3 s pause, og henter store tabeller i sider |
| Versjon | CPIC publiserer releaser av databasen på GitHub ([cpicpgx/cpic-data](https://github.com/cpicpgx/cpic-data/releases)), uten fast plan, som regel etter at en retningslinje er publisert. API-et er den levende databasen og kan ha små rettinger som kommer med i neste release |

Kontrollert 26.09.2026 mot API-et og ekte kall: siste release var v1.60.1
(12.08.2026), skjemaversjon 82. Lisensteksten er den PR #93 (arbeidspakke A)
fant i bruksvilkårene; CPIC-dataene hentes rett fra CPICs API, ikke gjennom
ClinPGx-API-et, og er derfor CPIC-data under CC0.

**Navngivingen** hører til visningen (arbeidspakke D): CPIC, lenke til
cpicpgx.org, release og når dataene sist ble hentet. Alt dette leveres av
`les_cpic` (`kilde`).

## Hva som hentes

Hele databasen, som ett uttrekk. Tabellene er små, bortsett fra diplotypene.

| Type i OUSFAR | Tabell i CPIC | Rader 26.09.2026 | Hva OUSFAR leser ut |
| --- | --- | --- | --- |
| `legemiddel` | `drug` | 324 | ID («RxNorm:704»), navn, ClinPGx-ID, RxNorm, DrugBank, ATC, UMLS, retningslinje, flytskjema |
| `gen` | `gene` | 132 | Symbol, ClinPGx-, HGNC-, NCBI- og Ensembl-ID, **oppslagsmetode** (`PHENOTYPE`, `ACTIVITY_SCORE` eller `ALLELE_STATUS`), merknader |
| `retningslinje` | `guideline` | 29 | ID, navn, URL, gener, ClinPGx-ID, CPICs merknad om bruken |
| `par` | `pair` | 635 | Gen, legemiddel, retningslinje, om genet brukes i anbefalingene, CPIC- og ClinPGx-nivå, PMID-er, om paret er fjernet og hvorfor |
| `anbefaling` | `recommendation` | 2 115 | Betingelsene per gen, anbefalingen, klassifiseringen (styrken), populasjonen, kommentarene, typen råd |
| `genresultat` | `gene_result` | 101 | Genet, resultatet (fenotype eller allelstatus), aktivitetsverdien, EHR-prioriteten, konsultasjonsteksten |
| `genresultat_oppslag` | `gene_result_lookup` | 208 | Allelfunksjonene eller aktivitetsverdiene som gir resultatet |
| `diplotype` | `gene_result_diplotype` | 112 820 | Diplotypen og hvilket oppslag (og dermed resultat) den hører til |
| `allel` | `allele` | 1 378 | Genet, navnet, funksjonen, klinisk funksjon, aktivitetsverdien, evidensen |
| `alleldefinisjon` | `allele_definition` | 1 354 | PharmVar-ID, om allelet er referansesekvensen eller en strukturell variant |
| `publikasjon` | `publication` | 1 155 | Retningslinjen, tittelen, forfatterne, tidsskriftet, året, PMID, PMCID, DOI |
| `term` | `term` | 17 | CPICs standardiserte termer for resultater |
| `endring` | `change_log` | 907 | CPICs egen endringslogg for dataene (ID-en lager OUSFAR av innholdet) |

Ikke hentet: eksempeltekstene for beslutningsstøtte (`test_alert`), som
handler om når det bør testes, allelfrekvensene utover det som ligger i
rådataene, og posisjonene til variantene.

**Verdiene er CPICs egne.** Fenotyper, aktivitetsverdier, allelstatus,
anbefalingstekster, klassifiseringer og nivåer står som CPIC skrev dem, også
«n/a», «No Result» og «Indeterminate». Bare feltnavnene er OUSFARs
(`src/cpic/modell.ts`). Oversettelse til norsk, om det skal gjøres, hører til
visningen og må ikke endre hva som slås opp på.

### Anbefalingene og betingelsene

En anbefaling gjelder ett legemiddel i én retningslinje og har én betingelse
per gen den bygger på. Hver betingelse har det CPIC slår opp på
(`oppslagsverdi`, fra CPICs `lookupkey`), og det den gjelder i klartekst:

- **fenotype** (f.eks. CYP2C19 «Poor Metabolizer»),
- **aktivitetsverdi** (CYP2D6, CYP2C9 og DPYD slås opp på den, f.eks. «1.0»),
- **allelstatus** (HLA-A, HLA-B og IFNL3, f.eks. «HLA-B*57:01 positive»),

og implikasjonen for genet. Hvilken av dem som gjelder for et gen, står i
genets `oppslagsmetode`. Modellen har ingen forutsetning om ett gen, én
CYP-fenotype eller én type resultat: amitriptylin har to gener (CYP2D6 på
aktivitetsverdi, CYP2C19 på fenotype), abakavir ett HLA-gen på allelstatus, og
MT-RNR1 og G6PD egne resultatkategorier. Oppslaget på den eksakte
kombinasjonen går på `oppslagsnokkel` (gen → oppslagsverdi), slik CPIC selv
anbefaler.

Noen retningslinjer har ingen strukturerte anbefalinger i CPIC: warfarin
(følger ikke en enkel oversettelse; CPICs merknad står i `bruksmerknad`),
metadon, ondansetron/tropisetron og peginterferon ved kontrollen. Da finnes
retningslinjen og parene, men ingen anbefalinger, og visningen må si det.

### Fra diplotype til resultat

Diplotype → `genresultat_oppslag` → `genresultat`: diplotypen «*1/*17» for
CYP2C19 hører til et oppslag (to allelfunksjoner), som gir resultatet «Rapid
Metabolizer». For gener som slås opp på aktivitetsverdi, har resultatet også
aktivitetsverdien anbefalingen slås opp på. Diplotypene er CPICs egne; OUSFAR
regner ingenting ut selv. Hvor komplett dette er på tvers av genene, er
arbeidspakke F sin sak.

## Datamodellen

Et eget lag i skjemaet `cpic`, som ingen av API-rollene har tilgang til
(`supabase/migrations/*_cpic.sql`). CPIC-tabellene er ikke kopier av
ClinPGx-tabellene; koblingen til ClinPGx og legemiddelidentiteten går gjennom
identifikatorene CPIC oppgir (`clinpgx_id`, RxNorm, ATC).

| Tabell | Innhold |
| --- | --- |
| `entiteter` | Typene, hvor mye mindre et nytt uttrekk kan være (80 %), og kontrollsummen og parserversjonen ved siste bytte |
| `synkroniseringer` | Hver kjøring: status (`pagar`, `fullfort`, `uendret`, `feilet`), cron eller manuell, release, release-dato, skjemaversjon, tellingen per type, feilen |
| `innlasting` | Mellomlageret under innlasting |
| én tabell per type | `cpic_id`, `cpic_versjon` (CPICs versjonsnummer for raden), `data` (lest), `raa` (som CPIC ga den; ikke for diplotypene), `hash`, `forst_sett_kl`, `sist_endret_kl`, `sist_sett_synk`, `utgatt_kl`, og nøklene oppslagene bruker som egne kolonner (f.eks. `legemiddel_id`, `gen`, `clinpgx_id`) |
| `henvisninger` | Hvilke typer som viser til hvilke, for sammenhengskontrollen |
| `anbefalingsbetingelser` (visning) | Én rad per aktiv anbefaling og gen |

Rader slettes aldri. En rad som er borte fra CPIC, får `utgatt_kl`, og en som
endres, får ny `sist_endret_kl`. Sammen med `cpic_versjon` og CPICs egen
endringslogg er det grunnlaget for å se hva som er endret mellom kjøringene.

Funksjonene i `public`:

| Funksjon | Hvem | Hva |
| --- | --- | --- |
| `cpic_forrige_synk`, `cpic_start_synk`, `cpic_last_inn`, `cpic_fullfor_synk`, `cpic_avbryt_synk` | Serveren (`service_role`) | Synkroniseringen |
| `les_cpic(clinpgx_ider)` | Innloggede | For opptil 200 legemidler (etter ClinPGx-ID): legemidlene, parene (også fjernede, merket), retningslinjene med publikasjonene, anbefalingene, genene og de mulige resultatene for dem, og `kilde` (release og skjemaversjon fra siste vellykkede kjøring som fikk dem oppgitt, når dataene sist ble endret og kontrollert). Uten rådataene |
| `cpic_status()` | Innloggede | De 20 siste kjøringene |

Koden:

| Hvor | Hva |
| --- | --- |
| `src/cpic/modell.ts` | Typene, lesingen av radene, hvilke tabeller som hentes |
| `src/cpic/api.ts` | Kallene: sider, kontroll av antallet, nye forsøk, release og skjemaversjon |
| `src/cpic/synk.ts`, `lager.ts` | Synkroniseringen og databasekallene den gjør |
| `src/cpic/endepunkt.ts`, `api/cpic-synk.ts` | Serverendepunktet |
| `src/server/tilgang.ts` | Cron-hemmeligheten, administratorsjekken og oppkoblingen, felles med ClinPGx |
| `src/cpic/lesing.ts` | Lesingen appen gjør (`lagCpicleser`) |
| `src/__tests__/cpic.test.ts`, `data/cpic-utdrag.json` | Lesingen, kallene, synkroniseringen mot en ekte database og endepunktet, med ekte rader fra CPIC |

## Synkroniseringen

- **Ukentlig**: Vercel kaller `GET /api/cpic-synk` tirsdag 02:45 UTC med
  `CRON_SECRET`. Egen jobb, atskilt fra FEST og ClinPGx.
- **Manuelt**: en administrator kan be om det samme med
  `POST /api/cpic-synk` og sin egen innlogging (`lagCpicleser(...).hent()`).
  Serveren sjekker `er_admin()` med brukerens token.

Én kjøring om gangen. Kjøringen leser først skjemaversjonen fra API-et og
siste release fra GitHub (feiler GitHub, lagres dataene uten release), så hver
tabell hel. Antallet rader som kom, må stemme med antallet API-et oppga
(`Prefer: count=exact`), ellers avbrytes kjøringen. Hver type får en
kontrollsum; er den den samme som ved forrige bytte, med samme parser, lastes
typen ikke inn igjen. En kjøring uten endringer tar noen sekunder og skriver
ingenting utenom loggen (`uendret`).

**Byttet** (`cpic_fullfor_synk`) er alt eller ingenting, i én transaksjon:

- Hver type som er lastet inn, må ha like mange rader som meldt, og minst
  80 % av radene som er aktive i dag. Ellers avvises uttrekket: et nesten tomt
  svar er oftere en feil hos kilden enn at kunnskapen er borte.
- En type meldt uendret må ha samme kontrollsum og parserversjon som ved
  siste bytte.
- Etter byttet må hver henvisning fra en aktiv rad treffe en aktiv rad
  (`henvisninger`: par → gen, anbefaling → legemiddel, diplotype → oppslag
  osv.). Ellers avvises alt.

Feiler noe — et kall, lesingen, en kontroll — merkes kjøringen `feilet`,
mellomlageret tømmes, og det som lå der fra før, står. Endepunktet svarer da
502, så feilen også synes i Vercel. En rad som ikke kan leses, hoppes over
alene og telles (`forkastet`). Ukjente kolonner overses. Øk `PARSERVERSJON`
når lesingen endres.

Første kjøring mot hele CPIC tok om lag 20 sekunder i testdatabasen, og
dataene tar om lag 50 MB, det meste diplotypene.

## Begrensninger

- API-et kan endres uten varsel. Lesingen tåler det meste, rådataene lagres,
  og kontrollene avviser et uttrekk som plutselig ser annerledes ut.
- Releasen er siste publiserte release da dataene ble hentet. API-et kan ha
  rettinger som ennå ikke er i en release; skjemaversjonen og CPICs
  endringslogg viser dem.
- Tekstene er på engelsk, som hos CPIC.
- Anbefalingene gjelder et allerede kjent resultat. OUSFAR utleder aldri et
  resultat som mangler, og en kombinasjon som ikke står i CPIC, har ingen
  anbefaling.

## Hva som bygger på dette

Visningen på stoffsiden (D), oppslaget etter et kjent resultat (E),
diplotype → resultat (F) og varsling om endringer (G) leser dette laget.
Ingen av dem skriver til det; nye lesefunksjoner legges i en egen migrasjon
med samme rettighetsmønster.
