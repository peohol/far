# Farmakogenetikk fra ClinPGx

Leses når noe som har med ClinPGx-dataene i seksjonen «Farmakogenetikk» på
fagsidene skal endres: koblingen, synkroniseringen, visningen eller søket.
Mønsteret er det samme som for FEST (`docs/legemiddeldata.md`), og det som
står der om prinsippene, gjelder også her.

Dataene er **referanseinformasjon**. OUSFAR viser hva ClinPGx har registrert
for et legemiddel, ikke råd for en bestemt pasient.

## Kilden og lisensen

| | |
| --- | --- |
| Kilde | [ClinPGx](https://www.clinpgx.org) (PharmGKB, CPIC og PharmCAT samlet), Stanford University |
| API | `https://api.clinpgx.org/v1` (OpenAPI 3.0.1 i `https://api.clinpgx.org/openapi.json`, «ClinPGx REST API» versjon 1.0). Åpent, uten nøkkel |
| Lisens | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), ifølge både API-ets forside og bruksvilkårene. Ikke CC BY-NC-SA |
| Bruksvilkår | [Data Usage Policy](https://www.clinpgx.org/page/dataUsagePolicy) (versjon 10 ved kontrollen). Se under |
| Grense | Høyst to kall i sekundet; ClinPGx svarer 429 på flere. Svarene har ingen rate limit-hoder |
| Forbehold | ClinPGx skriver at endepunktene er «pretty stable», men at parametre og svar kan endres mens API-et utvikles, og at den endelige versjonen varsles på bloggen. Det gamle vertsnavnet `api.pharmgkb.org` skulle slås av 20.07.2026 og svarte ikke ved kontrollen |

**Hva lisensen og bruksvilkårene sier.** Gjengitt fra bruksvilkårene, uten
juridisk vurdering utover det de sier:

- *Navngiving*: ClinPGx/PharmGKB skal krediteres, det skal lenkes til
  lisensen, og det skal sies fra om det er gjort endringer.
- *Deling på samme vilkår*: den som endrer, bearbeider, gjenbruker eller på
  annen måte forandrer ClinPGx-data, skal dele bidragene sine under samme
  lisens.
- *Vilkår for bruk* (i tillegg til lisensen): dataene er for forskningsformål;
  brukeren godtar å bruke dem til forskning og ikke med sikte på å tilby hele
  eller deler av dataene for salg som en kommersiell vare, og å ta hensyn til
  at nøyaktigheten ikke kan garanteres. Retningslinjene er ment å støtte
  klinikerens beslutning, og ansvaret for behandlingen ligger hos helsepersonellet.
- *CPIC-innhold* har egne vilkår på samme side: CC0 1.0, med ønske om at CPIC
  krediteres, og at det oppgis URL, dato og versjon for data fra CPICs
  database og API. Det gjelder CPICs egne data; det OUSFAR henter fra
  ClinPGx-API-et, er ClinPGx-data under lisensen over.

**Navngivingen i OUSFAR.** ClinPGx står som en automatisk, ikke-redigerbar
referanse i referansefeltet til «Farmakogenetikk» (ID `clinpgx:kilde`): «Utdrag
av farmakogenetiske data fra ClinPGx, omformet av OUSFAR, lisens CC BY-SA 4.0,
sist hentet …». «Omformet» er det lisensen krever om endringer: OUSFAR viser
et utvalg av feltene og gjør HTML om til ren tekst. I referanselisten nederst
på siden står i tillegg lenkene «Lisens: CC BY-SA 4.0» og «Bruksvilkår hos
ClinPGx» (`CLINPGX_LENKER` i `src/clinpgx/referanser.ts`). Nederst i seksjonen
står det diskret at dette er referanseinformasjon fra ClinPGx, og når det
sist ble hentet.

**Hva som omfattes av delingen på samme vilkår**, sier kilden ikke noe mer
presist om enn det som står over, og det er ikke vurdert juridisk her. Det
OUSFAR gjør i praksis, er å holde ClinPGx-dataene atskilt: de vises bare som
eget, merket innhold i seksjonen, og kopieres aldri inn i det redaksjonelle
innholdet eller i referansebasen. Om noe mer enn det seksjonen viser fra
ClinPGx må deles på samme vilkår, er et spørsmål for en jurist, ikke for koden.

### Kontrollen 26.09.2026

Kontrollert mot API-ets forside, bruksvilkårene (versjon 10), OpenAPI-beskrivelsen
og med ekte kall:

- Lisensen er CC BY-SA 4.0 begge steder, ikke CC BY-NC-SA 4.0. Bruksvilkårenes
  «ikke for salg som kommersiell vare» står ved siden av lisensen, som vilkår
  for bruk, ikke som en del av den.
- Vertsnavnet er `api.clinpgx.org`, og OpenAPI oppgir `https://api.clinpgx.org/v1`.
- Endepunktene og parametrene OUSFAR bruker, finnes uendret i OpenAPI:
  `/data/chemical/{id}` og `/data/chemical` (`name`, `view`), og
  `/data/guidelineAnnotation`, `/data/label` og `/data/summaryAnnotation`
  (`relatedChemicals.accessionId`, `view`).
- Ekte kall for sertralin, aripiprazol, karbamazepin, amitriptylin og fenytoin
  ga alle feltene OUSFAR leser, og lesingen i `src/clinpgx/modell.ts` fikk ut
  ID, gener, sammendrag, publikasjoner og evidensnivå for alle
  retningslinjene og de kliniske annotasjonene. Én preparatomtale (fenytoin)
  hadde verken sammendrag eller testvurdering; det tåles allerede. «Ingen
  treff» er fortsatt en tom liste.

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
| `les_farmakogenetikk_sok(kjemikalie_ider)` | Innloggede | Det samme uten allelfenotypene, legemidlene og litteraturen, til søket i hele kunnskapsbasen |
| `clinpgx_status()` | Innloggede | De 20 siste kjøringene |

Koden:

| Hvor | Hva |
| --- | --- |
| `src/clinpgx/modell.ts` | Formen OUSFAR lagrer, lesingen av svarene og av det lagrede, evidensnivåene, adressene hos ClinPGx |
| `src/clinpgx/api.ts` | Kallene: én kø, avstand mellom kallene, nye forsøk ved 429 og serverfeil |
| `src/clinpgx/synk.ts`, `lager.ts` | Synkroniseringen og databasekallene den gjør |
| `src/clinpgx/endepunkt.ts`, `api/clinpgx-synk.ts`, `api/clinpgx-sok.ts` | Serverendepunktene |
| `.github/workflows/clinpgx-synk.yml` | Den ukentlige jobben, i så mange omganger som trengs |
| `src/clinpgx/lesing.ts` | Lesingen appen gjør |
| `src/clinpgx/stoffside.ts` | Rekkefølgen i seksjonen, detaljkortene, oppsummeringen, tekstene søket finner, forslagene til kobling |
| `src/clinpgx/referanser.ts` | De automatiske referansene og meldingen om gamle data |
| `src/components/stoffside/Farmakogenetikkpanel.tsx`, `useFarmakogenetikk.ts` | Seksjonen |
| `src/__tests__/clinpgx.test.ts`, `stoffside.test.tsx` | Lesingen, synkroniseringen mot en ekte database, endepunktene, søket og visningen |

## Koblingen

En fagside kobles til ett eller flere kjemikalier i ClinPGx med
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

### Dekningen for alle fagsidene

Hver publiserte fagside har nøyaktig én ClinPGx-status i
`src/faginnhold/clinpgxdekning.ts`, med grunnen:

| Status | Betyr |
| --- | --- |
| `koblet` | Koblet til ClinPGx og verifisert |
| `krever_kuratering` | ClinPGx har et relevant objekt, men koblingen må velges for hånd |
| `ikke_i_clinpgx` | ClinPGx har ikke noe relevant objekt |
| `metabolitt` | Metabolitt eller analytisk komponent; kobles ikke automatisk til moderstoffet |
| `uavklart` | Krever faglig vurdering |

Testene (`clinpgxdekning.test.ts`) kjører alle migrasjonene og krever at
listen er lik de publiserte sidene. En ny fagside feiler altså testene til
den har fått en status. Sider som lages i redigeringen, fanges ikke av
testene; der viser koblingen forslag som før.

**Koblingene** legges inn med migrasjoner (`stoffsider_clinpgx_kobling`,
`stoffsider_clinpgx_dekning`, `ghb_ketamin_clinpgx_kobling` og
`antihypertensiver_clinpgx_kobling`), laget fra listene i
`src/faginnhold/clinpgxkoblinger.ts` med `scripts/lag-clinpgxkoblinger.ts`.
En kobling er bare tatt med når navnet og minst ett uavhengig kjennetegn til
stemmer:

- ATC-koden (fra FEST, eller fra WHO når FEST ikke har preparater med
  stoffet), eller
- en identifikator ClinPGx viser til, kontrollert mot registeret selv:
  RxNorm (RxCUI for virkestoffet), PubChem (CID), ChEBI eller InChIKey
  (esketamin, der ClinPGx bare har PubChem og ingen ATC-kode).

Et navn alene er ikke nok. Er siden ikke koblet til FEST, er navnene og
ATC-koden fra virkestoffet med samme norske navn i FEST, og koblingen krever
i tillegg en identifikator i et annet register. FEST er altså et godt
grunnlag der det finnes, men ikke et krav.

Den første migrasjonen tar et kjemikalie bare med når den publiserte siden
er koblet til virkestoffet i FEST, og det gjør også de for GHB- og
ketaminsiden og antihypertensivsidene, som FEST-koblingen deres kommer foran. Den andre krever ikke det: alle koblingene
der har en identifikator i et annet register, og FEST-koblingene til noen av
sidene (levomepromazin, O-desmetylvenlafaksin) er laget i produksjonen uten
en migrasjon i repoet. Da gir migrasjonene det samme resultatet i en database
bygd fra repoet alene.

En **metabolitt** kobles ikke til moderstoffet: oversikten sier hvilket
moderstoff og hvilke objekter ClinPGx har for metabolitten selv, og det er en
faglig vurdering hva siden skal vise. Unntaket er en metabolitt som selv er
et legemiddel med egen ATC-kode (paliperidon, desvenlafaksin); den kobles
til sitt eget kjemikalie som andre legemidler.

Migrasjonene legger inn kortet slik redigeringen gjør, publisert, med kilden
«Koblet til kjemikaliet i ClinPGx» i historikken. De hopper over en side som
alt har en ClinPGx-kobling, også i et utkast, så de aldri overskriver en
redaksjonell kobling, og de kan kjøres igjen uten å gjøre noe. Testene
kontrollerer at oversikten under er lik listene. Kontrollert mot ClinPGx,
WHOs ATC-register, RxNorm, PubChem og ChEBI 26. september 2026, og
antihypertensivene mot ClinPGx 30. september 2026.

| Status | Sider |
| --- | --- |
| Koblet til ClinPGx og verifisert | 93 |
| Relevant objekt finnes i ClinPGx, men krever kuratert kobling | 4 |
| ClinPGx har ikke relevant objekt | 0 |
| Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | 9 |
| Uavklart, krever faglig vurdering | 0 |
| Til sammen | 106 |

Koblet:

| Fagside | FEST-virkestoff | Siden koblet til FEST | ClinPGx-navn | ClinPGx-ID | Grunnlag | Migrasjon |
| --- | --- | --- | --- | --- | --- | --- |
| Amfetamin | Deksamfetamin (Dexamfetamine) | ja | dextroamphetamine | PA449269 | Samme ATC-kode (N06BA02). Engelsk navn er synonym i ClinPGx. | stoffsider_clinpgx_kobling |
| Amfetamin | Lisdeksamfetamin (Lisdexamfetamine) | ja | lisdexamfetamine | PA164748975 | Samme ATC-kode (N06BA12). Samme navn. | stoffsider_clinpgx_kobling |
| Amisulprid | Amisulprid (Amisulpride) | ja | amisulpride | PA162565877 | Samme ATC-kode (N05AL05). Samme navn. | stoffsider_clinpgx_kobling |
| Amitriptylin | Amitriptylin (Amitriptyline) | ja | amitriptyline | PA448385 | Samme ATC-kode (N06AA09). Samme navn. | stoffsider_clinpgx_kobling |
| Aripiprazol | Aripiprazol (Aripiprazole) | ja | aripiprazole | PA10026 | Samme ATC-kode (N05AX12). Samme navn. | stoffsider_clinpgx_kobling |
| Atomoksetin | Atomoksetin (Atomoxetine) | ja | atomoxetine | PA134688071 | Samme ATC-kode (N06BA09). Samme navn. | stoffsider_clinpgx_kobling |
| Brekspiprazol | Brekspiprazol (Brexpiprazole) | ja | brexpiprazole | PA166160053 | Samme ATC-kode (N05AX16). Samme navn. | stoffsider_clinpgx_kobling |
| Citalopram | Citalopram (Citalopram) | ja | citalopram | PA449015 | Samme ATC-kode (N06AB04). Samme navn. | stoffsider_clinpgx_kobling |
| Doksepin | Doksepin (Doxepin) | ja | doxepin | PA449409 | Samme ATC-kode (N06AA12). Samme navn. | stoffsider_clinpgx_kobling |
| Duloksetin | Duloksetin (Duloxetine) | ja | duloxetine | PA10066 | Samme ATC-kode (N06AX21). Samme navn. | stoffsider_clinpgx_kobling |
| Escitalopram | Escitalopram (Escitalopram) | ja | escitalopram | PA10074 | Samme ATC-kode (N06AB10). Samme navn. | stoffsider_clinpgx_kobling |
| Fenobarbital | Fenobarbital (Phenobarbital) | ja | phenobarbital | PA450911 | Samme ATC-kode (N03AA02). Samme navn. | stoffsider_clinpgx_kobling |
| Fenytoin | Fenytoin (Phenytoin) | ja | phenytoin | PA450947 | Samme ATC-kode (N03AB02). Samme navn. | stoffsider_clinpgx_kobling |
| Flunitrazepam | Flunitrazepam (Flunitrazepam) | ja | flunitrazepam | PA164781320 | Samme ATC-kode (N05CD03). Samme navn. | stoffsider_clinpgx_kobling |
| Fluoksetin | Fluoksetin (Fluoxetine) | ja | fluoxetine | PA449673 | Samme ATC-kode (N06AB03). Samme navn. | stoffsider_clinpgx_kobling |
| Flupentiksol | Flupentiksol (Flupentixol) | ja | flupenthixol | PA10268 | Samme ATC-kode (N05AF01). Annen skrivemåte: ClinPGx skriver flupenthixol. | stoffsider_clinpgx_kobling |
| Fluvoksamin | Fluvoksamin (Fluvoxamine) | ja | fluvoxamine | PA449690 | Samme ATC-kode (N06AB08). Samme navn. | stoffsider_clinpgx_kobling |
| Haloperidol | Haloperidol (Haloperidol) | ja | haloperidol | PA449841 | Samme ATC-kode (N05AD01). Samme navn. | stoffsider_clinpgx_kobling |
| Hydroksyrisperidon | Paliperidon (Paliperidone) | ja | paliperidone | PA163518919 | Samme ATC-kode (N05AX13). Samme navn. | stoffsider_clinpgx_kobling |
| Karbamazepin | Karbamazepin (Carbamazepine) | ja | carbamazepine | PA448785 | Samme ATC-kode (N03AF01). Samme navn. | stoffsider_clinpgx_kobling |
| Kariprazin | Kariprazin (Cariprazine) | ja | cariprazine | PA166177476 | Samme ATC-kode (N05AX15). Samme navn. | stoffsider_clinpgx_kobling |
| Klomipramin | Klomipramin (Clomipramine) | ja | clomipramine | PA449048 | Samme ATC-kode (N06AA04). Samme navn. | stoffsider_clinpgx_kobling |
| Klorprotiksen | Klorprotiksen (Chlorprothixene) | ja | chlorprothixene | PA164781400 | Samme ATC-kode (N05AF03). Samme navn. | stoffsider_clinpgx_kobling |
| Klozapin | Klozapin (Clozapine) | ja | clozapine | PA449061 | Samme ATC-kode (N05AH02). Samme navn. | stoffsider_clinpgx_kobling |
| Kvetiapin | Kvetiapin (Quetiapine) | ja | quetiapine | PA451201 | Samme ATC-kode (N05AH04). Samme navn. | stoffsider_clinpgx_kobling |
| Lamotrigin | Lamotrigin (Lamotrigine) | ja | lamotrigine | PA450164 | Samme ATC-kode (N03AX09). Samme navn. | stoffsider_clinpgx_kobling |
| Levetiracetam | Levetiracetam (Levetiracetam) | ja | levetiracetam | PA450206 | Samme ATC-kode (N03AX14). Samme navn. | stoffsider_clinpgx_kobling |
| Litium | Litiumion (Lithium ion) | ja | lithium | PA450243 | Samme ATC-kode (N05AN01). Annen skrivemåte: ClinPGx kaller virkestoffet lithium, FEST litiumion. | stoffsider_clinpgx_kobling |
| Lurasidon | Lurasidon (Lurasidone) | ja | lurasidone | PA166129557 | Samme ATC-kode (N05AE05). Samme navn. | stoffsider_clinpgx_kobling |
| Metylfenidat | Metylfenidat (Methylphenidate) | ja | methylphenidate | PA450464 | Samme ATC-kode (N06BA04). Samme navn. | stoffsider_clinpgx_kobling |
| Mianserin | Mianserin (Mianserin) | ja | mianserin | PA134687937 | Samme ATC-kode (N06AX03). Samme navn. | stoffsider_clinpgx_kobling |
| Mirtazapin | Mirtazapin (Mirtazapine) | ja | mirtazapine | PA450522 | Samme ATC-kode (N06AX11). Samme navn. | stoffsider_clinpgx_kobling |
| Nortriptylin | Nortriptylin (Nortriptyline) | ja | nortriptyline | PA450657 | Samme ATC-kode (N06AA10). Samme navn. | stoffsider_clinpgx_kobling |
| Okskarbazepin | Okskarbazepin (Oxcarbazepine) | ja | oxcarbazepine | PA450732 | Samme ATC-kode (N03AF02). Samme navn. | stoffsider_clinpgx_kobling |
| Olanzapin | Olanzapin (Olanzapine) | ja | olanzapine | PA450688 | Samme ATC-kode (N05AH03). Samme navn. | stoffsider_clinpgx_kobling |
| Paliperidon | Paliperidon (Paliperidone) | ja | paliperidone | PA163518919 | Samme ATC-kode (N05AX13). Samme navn. | stoffsider_clinpgx_kobling |
| Paroksetin | Paroksetin (Paroxetine) | ja | paroxetine | PA450801 | Samme ATC-kode (N06AB05). Samme navn. | stoffsider_clinpgx_kobling |
| Perfenazin | Perfenazin (Perphenazine) | ja | perphenazine | PA450882 | Samme ATC-kode (N05AB03). Samme navn. | stoffsider_clinpgx_kobling |
| Petidin | Petidin (Pethidine) | ja | meperidine | PA450369 | Samme ATC-kode (N02AB02). Annen skrivemåte: ClinPGx bruker det amerikanske navnet meperidine. | stoffsider_clinpgx_kobling |
| Risperidon | Risperidon (Risperidone) | ja | risperidone | PA451257 | Samme ATC-kode (N05AX08). Samme navn. | stoffsider_clinpgx_kobling |
| Sertindol | Sertindol (Sertindole) | ja | sertindole | PA164784002 | Samme ATC-kode (N05AE03). Samme navn. | stoffsider_clinpgx_kobling |
| Sertralin | Sertralin (Sertraline) | ja | sertraline | PA451333 | Samme ATC-kode (N06AB06). Samme navn. | stoffsider_clinpgx_kobling |
| Topiramat | Topiramat (Topiramate) | ja | topiramate | PA451728 | Samme ATC-kode (N03AX11). Samme navn. | stoffsider_clinpgx_kobling |
| Trimipramin | Trimipramin (Trimipramine) | ja | trimipramine | PA451791 | Samme ATC-kode (N06AA06). Samme navn. | stoffsider_clinpgx_kobling |
| Valproat | Valproinsyre (Valproic acid) | ja | valproic acid | PA451846 | Samme ATC-kode (N03AG01). Samme navn. | stoffsider_clinpgx_kobling |
| Venlafaksin | Venlafaksin (Venlafaxine) | ja | venlafaxine | PA451866 | Samme ATC-kode (N06AX16). Samme navn. | stoffsider_clinpgx_kobling |
| Vortioksetin | Vortioksetin (Vortioxetine) | ja | vortioxetine | PA166122595 | Samme ATC-kode (N06AX26). Samme navn. | stoffsider_clinpgx_kobling |
| Ziprasidon | Ziprasidon (Ziprasidone) | ja | ziprasidone | PA451974 | Samme ATC-kode (N05AE04). Samme navn. | stoffsider_clinpgx_kobling |
| Zuklopentiksol | Zuklopentiksol (Zuclopenthixol) | ja | zuclopenthixol | PA452629 | Samme ATC-kode (N05AF05). Samme navn. | stoffsider_clinpgx_kobling |
| Gabapentin | Gabapentin (Gabapentin) | ja | gabapentin | PA449720 | ATC-kode N02BF01 i FEST, N03AX12 i ClinPGx. Samme RxNorm 25480. Samme navn: WHO flyttet gabapentin fra N03AX12 til N02BF01 i 2023; ClinPGx har fortsatt den gamle koden. | stoffsider_clinpgx_dekning |
| Ketobemidon | Ketobemidon (Ketobemidone) | ja | ketobemidone | PA166211241 | Samme PubChem 10101 og ChEBI CHEBI:6125. Samme navn: Verken FEST eller ClinPGx har ATC-kode for stoffet, og det er ikke i RxNorm. | stoffsider_clinpgx_dekning |
| Levomepromazin | Levomepromazin (Levomepromazine) | ja | methotrimeprazine | PA164743234 | Samme ATC-kode (N05AA02). Samme RxNorm 6852. Annen skrivemåte: ClinPGx bruker det amerikanske navnet methotrimeprazine. ClinPGx har også «levomepromazine» (PA134687942), uten ATC-kode og med RxNorm for maleatsaltet (160372); det er ikke valgt. | stoffsider_clinpgx_dekning |
| O-desmetylvenlafaksin | Desvenlafaksin (Desvenlafaxine) | ja | desvenlafaxine | PA165958374 | Samme ATC-kode (N06AX23). Samme RxNorm 734064. Samme navn: FEST har ingen preparater med stoffet; ATC-koden er WHOs. O-desmethylvenlafaxine er synonym i ClinPGx. | stoffsider_clinpgx_dekning |
| Alprazolam | Alprazolam (Alprazolam) | nei | alprazolam | PA448333 | Samme ATC-kode (N05BA12). Samme RxNorm 596. Samme navn. | stoffsider_clinpgx_dekning |
| Buprenorfin | Buprenorfin (Buprenorphine) | nei | buprenorphine | PA448685 | Samme ATC-kode (N02AE01). Samme RxNorm 1819. Samme navn. | stoffsider_clinpgx_dekning |
| Diazepam | Diazepam (Diazepam) | nei | diazepam | PA449283 | Samme ATC-kode (N05BA01). Samme RxNorm 3322. Samme navn. | stoffsider_clinpgx_dekning |
| Fentanyl | Fentanyl (Fentanyl) | nei | fentanyl | PA449599 | Samme ATC-kode (N02AB03). Samme RxNorm 4337. Samme navn. | stoffsider_clinpgx_dekning |
| Klonazepam | Klonazepam (Clonazepam) | nei | clonazepam | PA449050 | Samme ATC-kode (N03AE01). Samme RxNorm 2598. Samme navn. | stoffsider_clinpgx_dekning |
| Kodein | Kodein (Codeine) | nei | codeine | PA449088 | Samme ATC-kode (R05DA04). Samme RxNorm 2670. Samme navn. | stoffsider_clinpgx_dekning |
| Metadon | Metadon (Methadone) | nei | methadone | PA450401 | Samme ATC-kode (N07BC02). Samme RxNorm 6813. Samme navn. | stoffsider_clinpgx_dekning |
| Morfin | Morfin (Morphine) | nei | morphine | PA450550 | Samme ATC-kode (N02AA01). Samme RxNorm 7052. Samme navn. | stoffsider_clinpgx_dekning |
| Nitrazepam | Nitrazepam (Nitrazepam) | nei | nitrazepam | PA10242 | Samme ATC-kode (N05CD02). Samme RxNorm 7440. Samme navn. | stoffsider_clinpgx_dekning |
| Oksazepam | Oksazepam (Oxazepam) | nei | oxazepam | PA450731 | Samme ATC-kode (N05BA04). Samme RxNorm 7781. Samme navn. | stoffsider_clinpgx_dekning |
| Oksykodon | Oksykodon (Oxycodone) | nei | oxycodone | PA450741 | Samme ATC-kode (N02AA05). Samme RxNorm 7804. Samme navn. | stoffsider_clinpgx_dekning |
| Tramadol | Tramadol (Tramadol) | nei | tramadol | PA451735 | Samme ATC-kode (N02AX02). Samme RxNorm 10689. Samme navn. | stoffsider_clinpgx_dekning |
| Zolpidem | Zolpidem (Zolpidem) | nei | zolpidem | PA451976 | Samme ATC-kode (N05CF02). Samme RxNorm 39993. Samme navn. | stoffsider_clinpgx_dekning |
| Zopiklon | Zopiklon (Zopiclone) | nei | zopiclone | PA10236 | Samme ATC-kode (N05CF01). Samme RxNorm 40001. Samme navn. | stoffsider_clinpgx_dekning |
| GHB | Natriumoksybat (Sodium Oxybate) | ja | sodium oxybate | PA166236501 | ATC-kode N07XX04 i FEST, N01AX11 i ClinPGx. Samme RxNorm 9899 og PubChem 23663870. Samme navn: WHO har to ATC-koder for natriumoksybat: N07XX04 (Xyrem) og N01AX11 (anestetikum), som ClinPGx bruker. | ghb_ketamin_clinpgx_kobling |
| Ketamin | Ketamin (Ketamine) | ja | ketamine | PA450144 | Samme ATC-kode (N01AX03). Samme RxNorm 6130 og PubChem 3821. Samme navn. | ghb_ketamin_clinpgx_kobling |
| Ketamin | Esketamin (Esketamine) | ja | esketamine | PA166364961 | Samme PubChem 182137 og InChIKey YQEZLKZALYSWHR-ZDUSSCGKSA-N. Samme navn: ClinPGx har ingen ATC-kode for esketamin (FEST har N01AX14 for Ketanest og N06AX27 for Spravato). InChI-en ClinPGx oppgir, er S-enantiomeren, lik PubChems for esketamin. | ghb_ketamin_clinpgx_kobling |
| Amlodipin | Amlodipin (Amlodipine) | ja | amlodipine | PA448388 | Samme ATC-kode (C08CA01). Samme navn. | antihypertensiver_clinpgx_kobling |
| Atenolol | Atenolol (Atenolol) | ja | atenolol | PA448499 | Samme ATC-kode (C07AB03). Samme navn. | antihypertensiver_clinpgx_kobling |
| Bendroflumetiazid | Bendroflumetiazid (Bendroflumethiazide) | ja | bendroflumethiazide | PA448563 | Samme ATC-kode (C03AA01). Samme RxNorm 1369. Samme navn: FEST har bendroflumetiazid bare sammen med kalium (Centyl med kaliumklorid, C03AB01); ATC-koden er den WHO og ClinPGx har for virkestoffet alene. | antihypertensiver_clinpgx_kobling |
| Bisoprolol | Bisoprolol (Bisoprolol) | ja | bisoprolol | PA448641 | Samme ATC-kode (C07AB07). Samme navn. | antihypertensiver_clinpgx_kobling |
| Bumetanid | Bumetanid (Bumetanide) | ja | bumetanide | PA448682 | Samme ATC-kode (C03CA02). Samme navn. | antihypertensiver_clinpgx_kobling |
| Diltiazem | Diltiazem (Diltiazem) | ja | diltiazem | PA449334 | Samme ATC-kode (C08DB01). Samme navn: ClinPGx har også C05AE03 (diltiazem i salve mot analfissur). | antihypertensiver_clinpgx_kobling |
| Doksazosin | Doksazosin (Doxazosin) | ja | doxazosin | PA449407 | Samme ATC-kode (C02CA04). Samme navn. | antihypertensiver_clinpgx_kobling |
| Enalapril | Enalapril (Enalapril) | ja | enalapril | PA449456 | Samme ATC-kode (C09AA02). Samme navn. | antihypertensiver_clinpgx_kobling |
| Eplerenon | Eplerenon (Eplerenone) | ja | eplerenone | PA164749044 | Samme ATC-kode (C03DA04). Samme navn. | antihypertensiver_clinpgx_kobling |
| Furosemid | Furosemid (Furosemide) | ja | furosemide | PA449719 | Samme ATC-kode (C03CA01). Samme navn. | antihypertensiver_clinpgx_kobling |
| Hydroklortiazid | Hydroklortiazid (Hydrochlorothiazide) | ja | hydrochlorothiazide | PA449899 | Samme ATC-kode (C03AA03). Samme navn. | antihypertensiver_clinpgx_kobling |
| Irbesartan | Irbesartan (Irbesartan) | ja | irbesartan | PA450084 | Samme ATC-kode (C09CA04). Samme navn. | antihypertensiver_clinpgx_kobling |
| Kandesartan | Kandesartancileksetil (Candesartan cilexetil) | ja | candesartan | PA448765 | Samme ATC-kode (C09CA06). Samme RxNorm 214354. Engelsk navn er synonym i ClinPGx: FEST har forløperen kandesartancileksetil; «Candesartan cilexetil» er synonym for candesartan i ClinPGx. | antihypertensiver_clinpgx_kobling |
| Karvedilol | Karvedilol (Carvedilol) | ja | carvedilol | PA448817 | Samme ATC-kode (C07AG02). Samme navn. | antihypertensiver_clinpgx_kobling |
| Labetalol | Labetalol (Labetalol) | ja | labetalol | PA164743150 | Samme ATC-kode (C07AG01). Samme navn. | antihypertensiver_clinpgx_kobling |
| Lerkanidipin | Lerkanidipin (Lercanidipine) | ja | lercanidipine | PA164769058 | Samme ATC-kode (C08CA13). Samme navn. | antihypertensiver_clinpgx_kobling |
| Lisinopril | Lisinopril (Lisinopril) | ja | lisinopril | PA450242 | Samme ATC-kode (C09AA03). Samme navn. | antihypertensiver_clinpgx_kobling |
| Losartan | Losartan (Losartan) | ja | losartan | PA450268 | Samme ATC-kode (C09CA01). Samme navn. | antihypertensiver_clinpgx_kobling |
| Metoprolol | Metoprolol (Metoprolol) | ja | metoprolol | PA450480 | Samme ATC-kode (C07AB02). Samme navn. | antihypertensiver_clinpgx_kobling |
| Nifedipin | Nifedipin (Nifedipine) | ja | nifedipine | PA450631 | Samme ATC-kode (C08CA05). Samme navn. | antihypertensiver_clinpgx_kobling |
| Ramipril | Ramipril (Ramipril) | ja | ramipril | PA451223 | Samme ATC-kode (C09AA05). Samme navn. | antihypertensiver_clinpgx_kobling |
| Spironolakton | Spironolakton (Spironolactone) | ja | spironolactone | PA451483 | Samme ATC-kode (C03DA01). Samme navn. | antihypertensiver_clinpgx_kobling |
| Telmisartan | Telmisartan (Telmisartan) | ja | telmisartan | PA451605 | Samme ATC-kode (C09CA07). Samme navn. | antihypertensiver_clinpgx_kobling |
| Valsartan | Valsartan (Valsartan) | ja | valsartan | PA451848 | Samme ATC-kode (C09CA03). Samme navn. | antihypertensiver_clinpgx_kobling |
| Verapamil | Verapamil (Verapamil) | ja | verapamil | PA451868 | Samme ATC-kode (C08DA01). Samme navn. | antihypertensiver_clinpgx_kobling |

Ikke koblet:

| Fagside | Status | ClinPGx | Grunn |
| --- | --- | --- | --- |
| Bupropion | Relevant objekt finnes i ClinPGx, men krever kuratert kobling | Kandidater: bupropion (PA448687) | Fagsiden gjelder virkestoffet bupropion; laboratoriet måler metabolitten hydroksybupropion (HBUP). ClinPGx har bupropion som eget kjemikalie; koblingen er ikke lagt inn ennå. |
| CBD | Relevant objekt finnes i ClinPGx, men krever kuratert kobling | Kandidater: cannabidiol (PA166175791) | Siden ble laget 27. september 2026 for å vise Epidyolex fra FEST. ClinPGx har cannabidiol (kontrollert samme dag); koblingen er ikke lagt inn ennå. |
| Dehydroaripiprazol | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: aripiprazole (PA10026), side: Aripiprazol. Metabolitten selv: dehydroaripiprazole (PA166170895) | Aktiv metabolitt av aripiprazol. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner. |
| Desmetyldoksepin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: doxepin (PA449409), side: Doksepin. Metabolitten selv: desmethyldoxepin (PA166131337) | Aktiv metabolitt av doksepin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner. |
| Desmetylkariprazin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: cariprazine (PA166177476), side: Kariprazin. Metabolitten selv: desmethyl cariprazine (PA166356841) | Aktiv metabolitt av kariprazin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner. |
| Desmetylklomipramin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: clomipramine (PA449048), side: Klomipramin. Metabolitten selv: desmethyl clomipramine (PA166131507) | Aktiv metabolitt av klomipramin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner. |
| Desmetylmianserin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: mianserin (PA134687937), side: Mianserin. Metabolitten selv: – | Metabolitt av mianserin. ClinPGx har ikke metabolitten som eget kjemikalie. |
| Didesmetylkariprazin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: cariprazine (PA166177476), side: Kariprazin. Metabolitten selv: didesmethyl cariprazine (PA166356881) | Aktiv metabolitt av kariprazin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner. |
| Hydroksybupropion | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: bupropion (PA448687), side: Bupropion. Metabolitten selv: hydroxybupropion (PA166226561), 4-hydroxybupropion (PA166170175) | Komponenten HBUP måler, ikke en egen fagside. Aktiv metabolitt av bupropion. ClinPGx har to kjemikalier for metabolitten, begge uten annotasjoner. |
| Norfluoksetin | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: fluoxetine (PA449673), side: Fluoksetin. Metabolitten selv: r-norfluoxetine (PA166131377), s-norfluoxetine (PA166131313) | Aktiv metabolitt av fluoksetin. ClinPGx har bare de to enantiomerene hver for seg, uten annotasjoner. |
| O-desmetyltramadol | Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet | Moderstoff: tramadol (PA451735), side: Tramadol. Metabolitten selv: o-desmethyltramadol (PA166131379) | Aktiv metabolitt av tramadol. ClinPGx har metabolitten som eget kjemikalie med kliniske annotasjoner; om siden skal vise dem, tramadols data eller begge, er en faglig vurdering. |
| Tapentadol | Relevant objekt finnes i ClinPGx, men krever kuratert kobling | Kandidater: tapentadol (PA166179720) | Siden ble laget 28. september 2026 med indikasjonen og preparatene fra FEST. ClinPGx har tapentadol (kontrollert samme dag); koblingen er ikke lagt inn ennå. |
| THC | Relevant objekt finnes i ClinPGx, men krever kuratert kobling | Kandidater: dronabinol (PA449421) | Siden ble laget 27. september 2026 for å vise Sativex fra FEST. ClinPGx har THC som dronabinol (kontrollert samme dag); koblingen er ikke lagt inn ennå. |

## Synkroniseringen

- **Ukentlig**: GitHub Actions (`.github/workflows/clinpgx-synk.yml`) kaller
  `POST /api/clinpgx-synk` mandag 02:30 UTC med et OIDC-token for
  arbeidsflyten på `main`, som `githubkjoring` i `src/server/tilgang.ts`
  kontrollerer. Ingen hemmelighet å lagre. Den kan også startes for hånd under
  *Actions → ClinPGx*. Egen jobb, atskilt fra FEST, som går hver natt 04:15.
- **Manuelt**: en administrator trykker «Hent fra ClinPGx nå» ved koblingen,
  som gjør `POST /api/clinpgx-synk` med sin egen innlogging og
  `{ "kjemikalier": ["PA…"] }` (høyst 20), eller «Hent nå» i «Datakilder» for
  alle. Serveren sjekker `er_admin()` med brukerens token.

Én kjøring om gangen. Kjemikaliene hentes ett og ett — de som aldri er hentet
først, så de eldste — med fire kall hver, i kø med minst 0,6 s mellom
kallene. Det tar 2–4 sekunder per kjemikalie, så én omgang rekker 60–90 av
dem innenfor Vercels grense.

**Omgangene**: blir tiden knapp (240 av Vercels 300 sekunder), stopper
omgangen før neste kjemikalie, og kjøringen avsluttes som `delvis` med resten
utsatt. Svaret har da `fortsett: <kjøringen>`, og jobben i GitHub Actions og
«Hent nå» i «Datakilder» kaller igjen med `{ "fortsett": <kjøringen> }` til
det er borte (høyst tolv omganger). `clinpgx_fortsett_synk` åpner den samme
kjøringen igjen, og omgangen henter bare kjemikaliene kjøringen ikke har
hentet eller notert en feil på (`sist_synk`), med tellingen lagt til den fra
før. Hver ukentlige kjøring dekker dermed alle kjemikaliene, i én rad i
loggen, hvor mange de enn blir. Bare den nyeste kjøringen kan fortsettes, og
bare innen en time etter at den stoppet. Stopper omgangene underveis, står
kjøringen som `delvis` med det som ble utsatt, og det står først i køen neste
gang. Et utvalg en administrator ba om, fortsettes ikke; det er alltid lite.
En fortsatt kjøring regnes som avbrutt en halvtime etter at siste omgang
startet (`omgang_startet_kl`).

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
- Kan et objekt i svaret ikke leses (f.eks. uten ID), telles det
  (`forkastet`), og kjemikaliet byttes ikke inn: et svar med ett objekt som
  ikke kan leses, har trolig endret form, og da står dataene fra før. Ukjente
  felt overses. Øk `PARSERVERSJON` når lesingen endres.
- Et objekt som kan leses, men har en annen form enn ventet, byttes heller
  ikke inn (`strukturavvik`, se under).

### Strukturkontrollen

At ID-en kan leses, er ikke nok. Lesingen i `modell.ts` gjør et felt som
mangler, om til et tomt felt, så et felt ClinPGx gir nytt navn eller ny form,
ville ellers bare blitt stille tomt — f.eks. evidensnivået eller flagget for
dosering. `src/clinpgx/struktur.ts` kontrollerer derfor rådataene for hvert
objekt før kjemikaliet byttes inn, og skiller mellom

- **feltet finnes, men er tomt** (tom liste, tom tekst): godtas alltid;
- **feltet er borte eller har en helt annen type** (en liste som er blitt
  tekst, gener uten `id` og `symbol`, et objekt uten feltet det ventes å ha,
  eller `null` i et felt ClinPGx alltid gir en verdi): et avvik. Bare de
  valgfrie feltene kan være `null`; ingen av feltene var `null` 26.09.2026.

Bare felt OUSFAR leser, kontrolleres, og bare de ClinPGx sender også når de er
tomme (sett i alle 66 kjemikaliene og 1 179 annotasjonene 26.09.2026):

| Type | Må finnes (kan være tomme, ikke `null`) | Valgfrie (kan mangle eller være `null`), med riktig type |
| --- | --- | --- |
| Kjemikalie | `name` | `types`, `linkOuts` (med `resource`, `resourceId`) |
| Retningslinje | `name`, `source`, `relatedGenes` (med `id`, `symbol`), `relatedChemicals` (med `id`), `literature`, flaggene `dosingInformation`, `alternateDrugAvailable`, `otherPrescribingGuidance`, `pediatric` | `summaryMarkdown` (med `html` eller `markdown`) |
| Preparatomtale | som retningslinjen, og `prescribingGenes` | `summaryMarkdown`, `testing` (med `term`) |
| Klinisk annotasjon | `accessionId`, `name`, `levelOfEvidence` (med `term`), `location` (med `displayName` eller `name`, og `genes`), `types`, `allelePhenotypes` (med `allele`, `phenotype`), `relatedChemicals`, `relatedDiseases`, `relatedGuidelines`, `relatedLabels` | `location.rsid`, `score` |

Har ett objekt avvik, feiler kjemikaliet som ved andre feil: det byttes ikke
inn, dataene fra før står, feilen noteres på kjemikaliet og i kjøringen (f.eks.
«PA451333: Svaret fra ClinPGx har trolig endret form: den kliniske annotasjonen
PA…: levelOfEvidence mangler, ventet objekt. Kjemikaliet er ikke byttet inn;
dataene fra før står.»), og kjøringen blir `delvis`. De andre kjemikaliene
hentes som vanlig. I «Datakilder» står ClinPGx da som «Se over» med feilene.

Kontrollen er et heuristisk sikkerhetsnett mot sannsynlige brudd, ikke en
fullstendig validering av API-et. Den fanger ikke at en verdi har fått ny
betydning med samme navn og type, at ClinPGx slutter å sende objekter (det
fanger vernet mot færre annotasjoner, delvis), eller endringer i felt OUSFAR
ikke leser. Et felt som blir valgfritt hos ClinPGx, stanser kjemikaliene som
mangler det, til kravet endres i `struktur.ts`.

Hver kjøring logges i `clinpgx.synkroniseringer`, og en feilet kjøring gir
502, så den også synes i Vercel og GitHub. Pågår en kjøring allerede, eller
kan den ikke fortsettes, svarer endepunktet 409. Hva som er nytt, endret eller borte siden
forrige henting, og om det er klinisk eller bare metadata, står i
endringsloggen (`docs/datakilder.md`).

## Visningen

Seksjonen «Farmakogenetikk», i denne rekkefølgen:

1. **De redaksjonelle kortene**, som før. Står det bare ett, åpnes det av seg
   selv bare når ClinPGx ikke har noe ved siden av.
   Under dem står CPICs strukturerte anbefalinger for de samme kjemikaliene,
   i en egen gruppe med egen kilde (se `docs/cpic.md`).
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
«CYP2D6 · CYP2C19 · CPIC + DPWG», så antallet CPIC-anbefalinger, og så titlene
på de redaksjonelle kortene.

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
  strukturkontrollen stanser sannsynlige formendringer, og loggen og
  «Datakilder» viser om svarene plutselig ikke kan leses.
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
