# Farmakogenetikk fra ClinPGx

Leses når noe som har med ClinPGx-dataene i seksjonen «Farmakogenetikk» på
stoffsidene skal endres: koblingen, synkroniseringen, visningen eller søket.
Mønsteret er det samme som for FEST (`docs/legemiddeldata.md`), og det som
står der om prinsippene, gjelder også her.

Dataene er **referanseinformasjon**. OUSFAR viser hva ClinPGx har registrert
for et legemiddel, ikke råd for en bestemt pasient.

## Kilden og lisensen

| | |
| --- | --- |
| Kilde | [ClinPGx](https://www.clinpgx.org) (PharmGKB, CPIC og PharmCAT samlet), Stanford University |
| API | `https://api.clinpgx.org/v1`, OpenAPI i `/openapi.json`. Åpent, uten nøkkel |
| Lisens | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Kilden skal navngis, lisensen oppgis, og det som bygger på dataene, deles under samme lisens |
| Grense | Høyst to kall i sekundet; ClinPGx svarer 429 på flere |
| Forbehold | ClinPGx skriver at API-et er under utvikling, og at parametre og svar kan endres. `api.pharmgkb.org` skal slås av |

Kontrollert 26.09.2026 mot API-ets forside og OpenAPI-beskrivelsen.

**Navngivingen.** ClinPGx står som en automatisk, ikke-redigerbar referanse i
referansefeltet til «Farmakogenetikk» (ID `clinpgx:kilde`), med lisensen og
når dataene sist ble hentet: «Farmakogenetiske data fra ClinPGx, lisens
CC BY-SA 4.0, sist hentet …». Nederst i seksjonen står det diskret at dette
er referanseinformasjon fra ClinPGx, og når det sist ble hentet.

**Deling på samme vilkår** gjelder det som bygger på ClinPGx-dataene, altså
det seksjonen viser fra dem. OUSFARs redaksjonelle innhold er et eget verk ved
siden av og berøres ikke. Derfor kopieres ClinPGx-data aldri inn i det
redaksjonelle innholdet eller i referansebasen.

## Hva som hentes

| Hva | Endepunkt | Hva OUSFAR leser ut |
| --- | --- | --- |
| Kjemikaliet | `/data/chemical/{id}?view=max` | ID, navn, ATC-kodene (fra `linkOuts`), typer |
| Retningslinjer (guideline annotations) | `/data/guidelineAnnotation?relatedChemicals.accessionId={id}&view=base` | ID, organisasjonen (CPIC, DPWG …), gener, legemidler, sammendraget som ren tekst, merknadene (dosering, alternativt legemiddel, annen veiledning, barn), publikasjonene |
| Farmakogenetiske preparatomtaler (drug labels) | `/data/label?…` | Det samme, med myndigheten (FDA, EMA …) og ClinPGx' vurdering av testing («Actionable PGx» …) |
| Kliniske annotasjoner (summary annotations) | `/data/summaryAnnotation?…` | Accession-ID og tall-ID, evidensnivå (1A–4), gen, variant eller haplotyper, rsID, genotype → fenotype, type, sykdom, retningslinjer og preparatomtaler den henger sammen med, poengsum |

Alle nivåene lagres. Siden viser 1A og 1B først og samler resten i ett kort.

Svarene følger JSend. «Ingen treff» kommer som 404 med «No results matching
criteria.» og er en tom liste, ikke en feil. Kildefeltet kommer med store
bokstaver («CPIC»), selv om OpenAPI-beskrivelsen har små. Sammendragene
kommer bare som HTML i `view=base`; de gjøres om til ren tekst
(`htmlTilTekst`), og OUSFAR viser aldri HTML fra ClinPGx.

## Datamodellen

Et eget lag ved siden av faginnholdet, i skjemaet `clinpgx`, som ingen av
API-rollene har tilgang til (`supabase/migrations/*_clinpgx.sql`):

| Tabell | Innhold |
| --- | --- |
| `synkroniseringer` | Hver kjøring: status (`pagar`, `fullfort`, `delvis`, `feilet`), cron eller manuell, antall og feil |
| `kjemikalier` | Kjemikaliene sidene er koblet til: det leste, svaret slik det kom (`raa`), siste henting, siste feil, og om ClinPGx fortsatt har det |
| `annotasjoner` | Retningslinjer, preparatomtaler og kliniske annotasjoner, lest (`data`) og som de kom (`raa`) |
| `kjemikalie_annotasjoner` | Hvilke annotasjoner ClinPGx ga for hvert kjemikalie sist |

Funksjonene i `public`:

| Funksjon | Hvem | Hva |
| --- | --- | --- |
| `clinpgx_start_synk`, `clinpgx_koblede_kjemikalier`, `clinpgx_lagre_kjemikalie`, `clinpgx_kjemikalie_feilet`, `clinpgx_fullfor_synk`, `clinpgx_avbryt_synk` | Serveren (`service_role`) | Synkroniseringen |
| `les_farmakogenetikk(kjemikalie_ider)` | Innloggede | Alt siden trenger for opptil 200 kjemikalier, uten rådataene |
| `clinpgx_status()` | Innloggede | De 20 siste kjøringene |

Koden:

| Hvor | Hva |
| --- | --- |
| `src/clinpgx/modell.ts` | Formen OUSFAR lagrer, lesingen av svarene og av det lagrede, evidensnivåene, adressene hos ClinPGx |
| `src/clinpgx/api.ts` | Kallene: én kø, avstand mellom kallene, nye forsøk ved 429 og serverfeil |
| `src/clinpgx/synk.ts`, `lager.ts` | Synkroniseringen og databasekallene den gjør |
| `src/clinpgx/endepunkt.ts`, `api/clinpgx-synk.ts`, `api/clinpgx-sok.ts` | Serverendepunktene |
| `src/clinpgx/lesing.ts` | Lesingen appen gjør |
| `src/clinpgx/stoffside.ts` | Rekkefølgen i seksjonen, detaljkortene, oppsummeringen, tekstene søket finner, forslagene til kobling |
| `src/clinpgx/referanser.ts` | De automatiske referansene og meldingen om gamle data |
| `src/components/analyttside/Farmakogenetikkpanel.tsx`, `useFarmakogenetikk.ts` | Seksjonen |
| `src/__tests__/clinpgx.test.ts`, `analyttside.test.tsx` | Lesingen, synkroniseringen mot en ekte database, endepunktene, søket og visningen |

## Koblingen

En stoffside kobles til ett eller flere kjemikalier i ClinPGx med
**accession-ID-en** (PA…), i elementet `clinpgxkobling` i panelet
`farmakogenetikk`: `{ kjemikalier: [{ clinpgx_id, navn }] }`. Navnet er det
ClinPGx hadde da kjemikaliet ble valgt. Koblingen er redaksjonelt innhold som
alt annet på siden, med utkast, publisering og historikk, og står én gang per
side (`ENKELTELEMENTER` og indeksen i databasen).

Administratoren kobler i redigeringsmodus. Oppslaget går til OUSFARs server
(`/api/clinpgx-sok`, bare for administratorer), som spør ClinPGx på ID-en
eller det nøyaktige engelske navnet. Søket begynner på det engelske navnet FEST
har for sidens virkestoff. Et treff med samme ATC-kode som sidens preparater,
eller samme engelske navn som i FEST, merkes som **forslag** — men ingenting
kobles før administratoren har valgt og lagret. Et navn alene lager aldri en
kobling.

Etter lagringen hentes dataene med en gang, så siden ikke venter på den
ukentlige kjøringen. Synkroniseringen henter koblinger både i utkast og
publisert, så dataene er klare når koblingen publiseres. En kobling som er
fjernet fra siden, hentes ikke.

## Synkroniseringen

- **Ukentlig**: Vercel kaller `GET /api/clinpgx-synk` mandag 02:30 UTC med
  `CRON_SECRET`. Egen jobb, atskilt fra FEST, som går hver natt 04:15.
- **Manuelt**: en administrator trykker «Hent fra ClinPGx nå» ved koblingen,
  som gjør `POST /api/clinpgx-synk` med sin egen innlogging og
  `{ "kjemikalier": ["PA…"] }` (høyst 20). Serveren sjekker `er_admin()` med
  brukerens token.

Én kjøring om gangen. Kjemikaliene hentes ett og ett — de som aldri er hentet
først, så de eldste — med fire kall hver, i kø med minst 0,6 s mellom
kallene. Blir tiden knapp (240 av Vercels 300 sekunder), stopper jobben før
neste kjemikalie og henter resten neste gang.

**Feil**:

- Alt for ett kjemikalie byttes inn i én transaksjon, eller ikke i det hele
  tatt.
- Feiler et kall, eller avviser databasen svaret, noteres feilen på
  kjemikaliet, og det som lå der fra før, står. Kjøringen blir `delvis`.
- Har en type minst fire annotasjoner fra før og svaret gir under
  halvparten, avvises byttet: et nesten tomt svar er oftere en feil hos
  kilden enn at kunnskapen er borte.
- Svarer ClinPGx at kjemikaliet ikke finnes, merkes det (`finnes = false`),
  og siden sier at koblingen bør kontrolleres. Dataene fra før står.
- Et objekt uten ID hoppes over alene og telles (`forkastet`). Ukjente felt
  overses. Øk `PARSERVERSJON` når lesingen endres.

Hver kjøring logges i `clinpgx.synkroniseringer`, og en feilet kjøring gir
502, så den også synes i Vercel.

## Visningen

Seksjonen «Farmakogenetikk», i denne rekkefølgen:

1. **De redaksjonelle kortene**, som før. Står det bare ett, åpnes det av seg
   selv bare når ClinPGx ikke har noe ved siden av.
2. **Retningslinjer**: ett detaljkort per retningslinje, CPIC først, så DPWG.
   Tittelen er organisasjonen og genene («CPIC · CYP2B6, CYP2C19»); kortet
   har sammendraget, organisasjonen, genene, merknadene, lenken til ClinPGx
   og publikasjonene i referansefeltet.
3. **Farmakogenetiske preparatomtaler**: som retningslinjene, FDA først, med
   vurderingen av testing.
4. **Kliniske annotasjoner**, dempet: ett kort per annotasjon med nivå 1A
   eller 1B, sterkest først, og ett kort «Lavere evidensnivå» med resten i en
   kompakt tabell.

Den lukkede seksjonen oppsummerer genene og organisasjonene, f.eks.
«CYP2D6 · CYP2C19 · CPIC + DPWG», og så titlene på de redaksjonelle kortene.

Siden sier fra når et kjemikalie ikke er hentet ennå, når ClinPGx ikke har
noe, når siste henting feilet (feilmeldingen bare i redigeringsmodus), og når
dataene er over ti døgn gamle. Nettleseren leser bare OUSFARs kopi, aldri
ClinPGx.

**Søket** på siden og i hele kunnskapsbasen finner organisasjonen, genene,
testingen og sammendraget i hver retningslinje og preparatomtale, varianten,
genene, nivået og typen i de sterkeste annotasjonene, og genene og variantene
i de svakere. Et treff åpner seksjonen og detaljkortet
(`clinpgx-PA…`, `clinpgx-klinisk-PA…`, `clinpgx-lavere-evidens`).

## Begrensninger

- API-et kan endres uten varsel. Lesingen tåler det meste, rådataene lagres,
  og loggen viser om svarene plutselig ikke kan leses.
- Navnesøket i ClinPGx er nøyaktig og på engelsk; norske navn gir ingen treff.
  ID-en virker alltid.
- Sammendragene er på engelsk, som hos ClinPGx.
- Preparatomtalene i ClinPGx er amerikanske, europeiske og andre myndigheters,
  ikke de norske (SPC fra DMP står under «Preparater»).
- ATC-kodene i ClinPGx er ikke alltid fullstendige, så et forslag kan mangle
  selv om kjemikaliet er riktig.

## Ikke bygd, og hva som venter på CPIC

Bevisst utelatt: velger for genotype eller diplotype, pasientspesifikke
anbefalinger, doseringsbeslutninger og kobling til pasientdata. Det krever
CPICs egne tabeller for allelfunksjon, diplotype → fenotype og anbefalinger
(CPIC API, `api.cpicpgx.org`), og en egen faglig vurdering av hvordan slike
råd skal vises. Det er neste arbeidspakke, ikke en utvidelse av denne.
