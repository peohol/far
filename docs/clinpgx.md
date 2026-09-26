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

### Koblingene som er lagt inn

De publiserte stoffsidene som er koblet til et virkestoff i FEST, ble koblet
til ClinPGx med en migrasjon (`stoffsider_clinpgx_kobling`), laget fra
listene i `src/faginnhold/clinpgxkoblinger.ts` med
`scripts/lag-clinpgxkoblinger.ts`. Hver kobling går via virkestoffet siden
er koblet til i FEST, og er tatt med bare når to uavhengige kjennetegn stemmer:
ATC-koden FEST og ClinPGx har felles, og det engelske navnet (likt, et synonym
i ClinPGx, eller en annen skrivemåte av samme virkestoff). Et navn alene er
ikke nok; da står siden ukoblet med grunnen, og kan kobles for hånd når det er
bekreftet at det er samme legemiddel. Forslagene i redigeringen viser
kandidaten.

Migrasjonen legger inn kortet slik redigeringen gjør, publisert, med kilden
«Koblet til kjemikaliet i ClinPGx» i historikken. Den hopper over en side som
alt har en ClinPGx-kobling, også i et utkast, så den aldri overskriver en
redaksjonell kobling, og et kjemikalie hvis virkestoff siden ikke (lenger) er
koblet til i FEST. Den kan kjøres igjen uten å gjøre noe. Stoffsider uten
FEST-kobling (som kodein, tramadol og benzodiazepinene) er ikke med; de må
kobles til FEST først. Testene kontrollerer at tabellene under er lik listene.
Kontrollert mot ClinPGx 26. september 2026.

| Stoffside | FEST-virkestoff | ATC | ClinPGx-navn | ClinPGx-ID | Grunnlag |
| --- | --- | --- | --- | --- | --- |
| Amfetamin | Deksamfetamin (Dexamfetamine) | N06BA02 | dextroamphetamine | PA449269 | Samme ATC-kode (N06BA02). Engelsk navn er synonym i ClinPGx. |
| Amfetamin | Lisdeksamfetamin (Lisdexamfetamine) | N06BA12 | lisdexamfetamine | PA164748975 | Samme ATC-kode (N06BA12). Samme navn. |
| Amisulprid | Amisulprid (Amisulpride) | N05AL05 | amisulpride | PA162565877 | Samme ATC-kode (N05AL05). Samme navn. |
| Amitriptylin | Amitriptylin (Amitriptyline) | N06AA09 | amitriptyline | PA448385 | Samme ATC-kode (N06AA09). Samme navn. |
| Aripiprazol | Aripiprazol (Aripiprazole) | N05AX12 | aripiprazole | PA10026 | Samme ATC-kode (N05AX12). Samme navn. |
| Atomoksetin | Atomoksetin (Atomoxetine) | N06BA09 | atomoxetine | PA134688071 | Samme ATC-kode (N06BA09). Samme navn. |
| Brekspiprazol | Brekspiprazol (Brexpiprazole) | N05AX16 | brexpiprazole | PA166160053 | Samme ATC-kode (N05AX16). Samme navn. |
| Citalopram | Citalopram (Citalopram) | N06AB04 | citalopram | PA449015 | Samme ATC-kode (N06AB04). Samme navn. |
| Doksepin | Doksepin (Doxepin) | N06AA12 | doxepin | PA449409 | Samme ATC-kode (N06AA12). Samme navn. |
| Duloksetin | Duloksetin (Duloxetine) | N06AX21 | duloxetine | PA10066 | Samme ATC-kode (N06AX21). Samme navn. |
| Escitalopram | Escitalopram (Escitalopram) | N06AB10 | escitalopram | PA10074 | Samme ATC-kode (N06AB10). Samme navn. |
| Fenobarbital | Fenobarbital (Phenobarbital) | N03AA02 | phenobarbital | PA450911 | Samme ATC-kode (N03AA02). Samme navn. |
| Fenytoin | Fenytoin (Phenytoin) | N03AB02 | phenytoin | PA450947 | Samme ATC-kode (N03AB02). Samme navn. |
| Flunitrazepam | Flunitrazepam (Flunitrazepam) | N05CD03 | flunitrazepam | PA164781320 | Samme ATC-kode (N05CD03). Samme navn. |
| Fluoksetin | Fluoksetin (Fluoxetine) | N06AB03 | fluoxetine | PA449673 | Samme ATC-kode (N06AB03). Samme navn. |
| Flupentiksol | Flupentiksol (Flupentixol) | N05AF01 | flupenthixol | PA10268 | Samme ATC-kode (N05AF01). Annen skrivemåte: ClinPGx skriver flupenthixol. |
| Fluvoksamin | Fluvoksamin (Fluvoxamine) | N06AB08 | fluvoxamine | PA449690 | Samme ATC-kode (N06AB08). Samme navn. |
| Haloperidol | Haloperidol (Haloperidol) | N05AD01 | haloperidol | PA449841 | Samme ATC-kode (N05AD01). Samme navn. |
| Hydroksyrisperidon | Paliperidon (Paliperidone) | N05AX13 | paliperidone | PA163518919 | Samme ATC-kode (N05AX13). Samme navn. |
| Karbamazepin | Karbamazepin (Carbamazepine) | N03AF01 | carbamazepine | PA448785 | Samme ATC-kode (N03AF01). Samme navn. |
| Kariprazin | Kariprazin (Cariprazine) | N05AX15 | cariprazine | PA166177476 | Samme ATC-kode (N05AX15). Samme navn. |
| Klomipramin | Klomipramin (Clomipramine) | N06AA04 | clomipramine | PA449048 | Samme ATC-kode (N06AA04). Samme navn. |
| Klorprotiksen | Klorprotiksen (Chlorprothixene) | N05AF03 | chlorprothixene | PA164781400 | Samme ATC-kode (N05AF03). Samme navn. |
| Klozapin | Klozapin (Clozapine) | N05AH02 | clozapine | PA449061 | Samme ATC-kode (N05AH02). Samme navn. |
| Kvetiapin | Kvetiapin (Quetiapine) | N05AH04 | quetiapine | PA451201 | Samme ATC-kode (N05AH04). Samme navn. |
| Lamotrigin | Lamotrigin (Lamotrigine) | N03AX09 | lamotrigine | PA450164 | Samme ATC-kode (N03AX09). Samme navn. |
| Levetiracetam | Levetiracetam (Levetiracetam) | N03AX14 | levetiracetam | PA450206 | Samme ATC-kode (N03AX14). Samme navn. |
| Litium | Litiumion (Lithium ion) | N05AN01 | lithium | PA450243 | Samme ATC-kode (N05AN01). Annen skrivemåte: ClinPGx kaller virkestoffet lithium, FEST litiumion. |
| Lurasidon | Lurasidon (Lurasidone) | N05AE05 | lurasidone | PA166129557 | Samme ATC-kode (N05AE05). Samme navn. |
| Metylfenidat | Metylfenidat (Methylphenidate) | N06BA04 | methylphenidate | PA450464 | Samme ATC-kode (N06BA04). Samme navn. |
| Mianserin | Mianserin (Mianserin) | N06AX03 | mianserin | PA134687937 | Samme ATC-kode (N06AX03). Samme navn. |
| Mirtazapin | Mirtazapin (Mirtazapine) | N06AX11 | mirtazapine | PA450522 | Samme ATC-kode (N06AX11). Samme navn. |
| Nortriptylin | Nortriptylin (Nortriptyline) | N06AA10 | nortriptyline | PA450657 | Samme ATC-kode (N06AA10). Samme navn. |
| Okskarbazepin | Okskarbazepin (Oxcarbazepine) | N03AF02 | oxcarbazepine | PA450732 | Samme ATC-kode (N03AF02). Samme navn. |
| Olanzapin | Olanzapin (Olanzapine) | N05AH03 | olanzapine | PA450688 | Samme ATC-kode (N05AH03). Samme navn. |
| Paliperidon (hydroksyrisperidon) | Paliperidon (Paliperidone) | N05AX13 | paliperidone | PA163518919 | Samme ATC-kode (N05AX13). Samme navn. |
| Paroksetin | Paroksetin (Paroxetine) | N06AB05 | paroxetine | PA450801 | Samme ATC-kode (N06AB05). Samme navn. |
| Perfenazin | Perfenazin (Perphenazine) | N05AB03 | perphenazine | PA450882 | Samme ATC-kode (N05AB03). Samme navn. |
| Petidin | Petidin (Pethidine) | N02AB02 | meperidine | PA450369 | Samme ATC-kode (N02AB02). Annen skrivemåte: ClinPGx bruker det amerikanske navnet meperidine. |
| Risperidon | Risperidon (Risperidone) | N05AX08 | risperidone | PA451257 | Samme ATC-kode (N05AX08). Samme navn. |
| Sertindol | Sertindol (Sertindole) | N05AE03 | sertindole | PA164784002 | Samme ATC-kode (N05AE03). Samme navn. |
| Sertralin | Sertralin (Sertraline) | N06AB06 | sertraline | PA451333 | Samme ATC-kode (N06AB06). Samme navn. |
| Topiramat | Topiramat (Topiramate) | N03AX11 | topiramate | PA451728 | Samme ATC-kode (N03AX11). Samme navn. |
| Trimipramin | Trimipramin (Trimipramine) | N06AA06 | trimipramine | PA451791 | Samme ATC-kode (N06AA06). Samme navn. |
| Valproat | Valproinsyre (Valproic acid) | N03AG01 | valproic acid | PA451846 | Samme ATC-kode (N03AG01). Samme navn. |
| Venlafaksin | Venlafaksin (Venlafaxine) | N06AX16 | venlafaxine | PA451866 | Samme ATC-kode (N06AX16). Samme navn. |
| Vortioksetin | Vortioksetin (Vortioxetine) | N06AX26 | vortioxetine | PA166122595 | Samme ATC-kode (N06AX26). Samme navn. |
| Ziprasidon | Ziprasidon (Ziprasidone) | N05AE04 | ziprasidone | PA451974 | Samme ATC-kode (N05AE04). Samme navn. |
| Zuklopentiksol | Zuklopentiksol (Zuclopenthixol) | N05AF05 | zuclopenthixol | PA452629 | Samme ATC-kode (N05AF05). Samme navn. |

Ukoblet:

| Stoffside | FEST-virkestoff | ATC i FEST | Kandidat i ClinPGx | ATC i ClinPGx | Hvorfor ukoblet |
| --- | --- | --- | --- | --- | --- |
| Gabapentin | Gabapentin (Gabapentin) | N02BF01 | gabapentin (PA449720) | N03AX12 | Samme navn, men ulik ATC-kode i FEST og ClinPGx. |
| Ketobemidon | Ketobemidon (Ketobemidone) | – | ketobemidone (PA166211241) | – | Bare navnet stemmer: verken FEST eller ClinPGx har ATC-kode for stoffet. |
| Levomepromazin | Levomepromazin (Levomepromazine) | N05AA02 | levomepromazine (PA134687942) | – | Bare navnet stemmer: ClinPGx har ingen ATC-kode for stoffet. |
| O-desmetylvenlafaksin | Desvenlafaksin (Desvenlafaxine) | – | desvenlafaxine (PA165958374) | N06AX23 | Bare navnet stemmer: FEST har ingen preparater med stoffet, og dermed ingen ATC-kode. |

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

## Ikke bygd, og CPIC

Bevisst utelatt her: velger for genotype eller diplotype, pasientspesifikke
anbefalinger, doseringsbeslutninger og kobling til pasientdata. De
strukturerte CPIC-dataene (allelfunksjon, diplotype → fenotype, anbefalinger)
er et eget lag med egen synkronisering, beskrevet i `docs/cpic.md`.
