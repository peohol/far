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

**Navngivingen**: CPIC står som en automatisk, ikke-redigerbar referanse i
referansefeltet til «Farmakogenetikk» (ID `cpic:kilde`), med lenke til
cpicpgx.org, lisensen, releasen og når dataene sist ble kontrollert:
«Utdrag av strukturerte farmakogenetiske anbefalinger fra CPIC, release
v1.60.1 av 12. august 2026, omformet av OUSFAR, lisens CC0 1.0, sist
kontrollert …», med lenke til lisensen og til bruksvilkårene hos ClinPGx, der
CPIC-delen står. Nederst i gruppen står det samme kort. Alt dette leveres av `les_cpic` (`kilde`).

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
| `src/cpic/lesing.ts` | Lesingen appen gjør (`lagCpicleser`), i deler når det er flere enn 200 legemidler |
| `src/cpic/stoffside.ts` | Hva siden viser: utvalget for en side (`cpicFor`), kortene, grupperingen av anbefalingene, oppsummeringen og tekstene søket finner |
| `src/cpic/oppslag.ts` | Oppslaget etter et kjent resultat (se under) |
| `src/cpic/referanser.ts` | De automatiske referansene og meldingen om gamle data |
| `src/components/analyttside/Cpicvisning.tsx`, `Cpicoppslag.tsx` | Gruppen i «Farmakogenetikk», og oppslaget i den |
| `src/__tests__/cpic.test.ts`, `data/cpic-utdrag.json` | Lesingen, kallene, synkroniseringen mot en ekte database og endepunktet, med ekte rader fra CPIC |
| `src/__tests__/cpicvisning.test.ts`, `analyttside.test.tsx` | Kortene, grupperingen, referansene og søket med de ekte radene, og visningen på siden |

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

## Visningen på stoffsiden

CPIC-dataene står i seksjonen «Farmakogenetikk», i gruppen **«Anbefalinger
fra CPIC»**, under de redaksjonelle kortene og over ClinPGx-dataene
(`docs/clinpgx.md`). Gruppen har sin egen overskrift, ingress og kilde, så det
er tydelig hva som er CPICs strukturerte forskrivningsanbefalinger og hva som
er ClinPGx' bredere kunnskapsoversikt. Ingressen sier at anbefalingene gjelder
et allerede kjent resultat, og ikke hvem som bør testes.

Siden leser CPIC-dataene for de samme ClinPGx-ID-ene som koblingen i
«Farmakogenetikk» (`clinpgxkobling`); CPIC oppgir ClinPGx-ID-en for hvert
legemiddel. Visningen avhenger altså ikke av FEST. Kortene for retningslinjene er ikke interaktive (oppslaget over dem er det, se «Oppslaget etter et kjent resultat»):

- **Ett detaljkort per CPIC-retningslinje** (`cpic-<retningslinje-ID>`, f.eks.
  `cpic-100414`), med CPICs navn på retningslinjen som tittel. Oppsummeringen
  er genene med resultattypen, antallet anbefalinger og styrkene. Kortet viser
  - hvert gen og hva CPIC slår opp på for det (fenotype, aktivitetsverdi,
    allelstatus),
  - resultatkategoriene anbefalingene gjelder, per gen,
  - gen–legemiddel-parene med CPIC- og ClinPGx-nivået (og om CPIC har fjernet
    et par, eller ikke bruker genet i anbefalingene),
  - styrkene, populasjonene og CPICs merknad om bruken,
  - anbefalingene, som en liste,
  - lenken til retningslinjen og CPICs flytskjema, og publikasjonene i
    referansefeltet (den nyeste først; en publikasjon ClinPGx alt oppgir på
    siden, samme PMID eller DOI, står én gang).
- **Hver anbefaling** er en rad: betingelsen for hvert gen («CYP2D6 Poor
  Metabolizer, aktivitetsverdi 0.0», «HLA-B*57:01 positive»), styrken og
  anbefalingen. Implikasjonene per gen, kommentarene, populasjonen, typen råd
  og CPICs ID-er for anbefalingene står under «Mer om anbefalingen»
  (`<details>`), så det går an å se nøyaktig hvilke anbefalinger raden står
  for.
- **Sammenslåingen**: anbefalinger som er like i alt annet enn
  aktivitetsverdien for et gen CPIC slår opp på aktivitetsverdi (samme
  fenotype, implikasjoner, anbefaling, styrke, populasjon og kommentarer), står
  i én rad med verdiene listet, stigende. Ellers står hver anbefaling for seg. Ingen rad
  står for en kombinasjon CPIC ikke har, og testene kontrollerer at hver
  anbefaling står nøyaktig én gang.
- **Lange kort deles opp**: har kortet flere enn 12 rader
  (`MAKS_RADER_UTEN_DELING`), står radene i lukkede deler etter resultatet for
  ett gen: blant genene minst halvparten av radene har, det med færrest ulike
  resultater, f.eks.
  «CYP2D6 Poor Metabolizer · 9 anbefalinger · Optional, Strong». Delene er
  `<details>`, som nettleserens søk åpner selv, og en del står åpen mens søket
  på siden har treff i den. Amitriptylin (206 anbefalinger i CPIC) blir 53
  rader i seks deler.
- **Retningslinjer uten strukturerte anbefalinger** (som warfarin) får kortet
  med CPICs merknad og en melding om at veiledningen står i selve
  retningslinjen.
- **Par uten retningslinje** står i ett kort, «Andre gen–legemiddel-par i
  CPIC» (`cpic-andre-par`), som en kompakt tabell med genet, nivåene og
  testingen.

Verdiene vises som CPIC skrev dem, på engelsk. Bare CPICs «n/a» vises ikke
(som kommentar eller aktivitetsverdi for gener som ikke slås opp på den).

Den lukkede seksjonen nevner antallet, f.eks. «32 CPIC-anbefalinger». Siden
sier fra når dataene ikke er hentet ennå, når CPIC ikke har noe for
legemiddelet (med releasen), når lesingen feilet, og når dataene ikke er
kontrollert på over ti døgn. En administrator kan hente CPIC på nytt med
«Hent fra CPIC nå» i redigeringen.

**Søket** på siden og i hele kunnskapsbasen finner oppslagskortet (navnet og
genene), retningslinjens navn,
genene, resultattypene og resultatkategoriene, styrkene, hver anbefaling med
betingelsene, og genene i de andre parene. Implikasjonene og kommentarene er
ikke med, så et treff aldri peker på en tekst som er skjult. Et treff eller en
direktelenke åpner seksjonen og kortet.

## Oppslaget etter et kjent resultat

Øverst i gruppen «Anbefalinger fra CPIC» står detaljkortet **«Slå opp
anbefaling etter kjent resultat»** (`cpic-oppslag`), når CPIC har
anbefalinger for legemidlene på siden. Flyten er legemiddel → gen →
resultat → anbefaling. Det er ikke en pasientjournal eller en genetisk
tolkningsmotor: brukeren kjenner allerede pasientens fortolkede resultat.

- **Valgene**: legemiddelet (bare når siden har flere), så ett valg per gen
  CPIC slår opp på for legemiddelet (`oppslagsnokkel`), med resultatene CPIC
  bruker i anbefalingene: fenotype, allelstatus (HLA) eller andre kategorier,
  også «Indeterminate» og «No Result». For et gen CPIC slår opp på
  aktivitetsverdi kommer et valg til for verdien, når fenotypen har flere.
  Genene står i retningslinjens rekkefølge, resultatene i CPICs rekkefølge,
  eller etter aktivitetsverdien.
- **Treffet**: en anbefaling vises bare når hvert gen i CPICs oppslagsnøkkel
  er valgt, med verdien CPIC har. Et gen som ikke er valgt, fylles aldri
  inn; kortet sier hvilke gener som mangler. En kombinasjon CPIC ikke har,
  gir meldingen om at CPIC ikke har noen anbefaling for den.
- **Aktivitetsverdien**: er bare fenotypen valgt, vises anbefalingen bare når
  CPIC har en anbefaling for hver aktivitetsverdi fenotypen kan ha, og den
  samme for alle (samme sammenslåing som i kortene: likt i alt annet enn
  aktivitetsverdien). Hvilke verdier fenotypen kan ha, står i CPICs
  resultatliste (`genresultater` fra `les_cpic`, CPICs `gene_result`), ikke i
  anbefalingene som kontrolleres. Slik kan ikke en verdi CPIC mangler
  anbefaling for, forsvinne fra kontrollen. Kjenner ikke resultatlisten
  fenotypen, må verdien alltid velges. Unntaket er resultater der verdien CPIC
  slår opp på er selve resultatet, som «No Result». Ellers sier kortet at
  verdien må velges, og hvorfor: anbefalingen avhenger av den (f.eks.
  fenytoin med CYP2C9 Intermediate Metabolizer, 1.0 eller 1.5), CPIC mangler
  anbefaling for noen av verdiene, eller verdiene kan ikke kontrolleres. En
  anbefaling gjelder aldri en verdi CPIC ikke har den for.
- **Populasjonene** (fenytoin, klopidogrel, atomoksetin, vorikonazol …) står
  hver for seg, merket med populasjonen.
- **Hvorfor**: hver anbefaling står med styrken, implikasjonene,
  kommentarene, CPIC-release og kilde, og «Hvorfor denne anbefalingen»: hva
  som ble valgt for hvert gen, hvilke aktivitetsverdier i CPIC det svarer
  til, valgte gener anbefalingen ikke bygger på, og CPICs ID-er for
  anbefalingene og retningslinjen.
- **Personvern**: valgene står bare i komponentens tilstand. De lagres ikke,
  sendes ikke noe sted og står ikke i adressen. Ingen pasientidentifikatorer.

Logikken er rene funksjoner i `src/cpic/oppslag.ts` (`oppslagsgrunnlag`,
`slaOpp`), testet mot ekte CPIC-rader for fenytoin og amitriptylin
(`src/__tests__/cpicoppslag.test.ts`, `data/cpic-oppslag-utdrag.json`),
blant annet at hver anbefaling finnes med sine egne verdier, og at et treff
aldri er en anbefaling med andre verdier. Kortet er
`src/components/analyttside/Cpicoppslag.tsx`. Søket finner kortet på navnet
og genene. Diplotype → resultat (F) er ikke med ennå: resultatet velges slik
det står i svaret.

## Hva som bygger på dette

Visningen på stoffsiden (D, over), oppslaget etter et kjent resultat (E),
diplotype → resultat (F) og varsling om endringer (G) leser dette laget.
Ingen av dem skriver til det; nye lesefunksjoner legges i en egen migrasjon
med samme rettighetsmønster.
