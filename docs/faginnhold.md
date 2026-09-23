# Redigerbart faginnhold i OUSFAR

Leses når noe som har med informasjonssider, laboratorieanalytter,
innholdselementer, referanser, fortolkningskommentarer, revisjoner eller
publisering å gjøre skal endres. Planen og fremdriften står i `docs/analyttsider-og-redigering.md`; her står hvordan
fundamentet faktisk er bygget.

Informasjonssidene (arbeidspakke 3) bygger på dette, og det gjør de enkle
konsentrasjonsreglene også: de er regelsett, og steg 2 i fortolkningen bruker
de publiserte (se `docs/fortolkningsregler.md`). Rusmiddelmodulene, EtG/EtS og
THC-syre står fortsatt i `src/domain/`. `src/__tests__/fortolkningUendret.test.ts`
holder en kontrollsum over all klinisk output modulene kan gi, og passer på at
kjernen og stegene ikke henter noe fra faginnholdet selv.

## Delene

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_faginnhold_fundament.sql` | Tabellene, radsikkerheten og funksjonene |
| `supabase/migrations/*_referanse_objekttype.sql`, `*_referansesystem.sql` | Referansene og koblingene til dem |
| `supabase/migrations/*_analyttsider_lesing.sql` | Lesingen av en hel side, referansebasen og sider etter navn |
| `supabase/migrations/*_enkeltelementer.sql` | At kortene som står én gang i panelet sitt, ikke kan opprettes to ganger |
| `supabase/migrations/*_regelredigering_lesing.sql` | Historikken til ett objekt (`les_historikk`) og regelsettet for én kode |
| `supabase/migrations/*_revisjonskilde.sql` | Kilden i revisjonene, for innhold som er importert |
| `supabase/import/psykofarmaka/` | Importdatasettet for psykofarmakasidene, én fil per analyttkode |
| `src/faginnhold/import.ts`, `psykofarmaka.ts`, `scripts/importer-psykofarmaka.ts` | Kontrollen av datasettet, planen og SQL-en som legger det inn |
| `supabase/migrations/*_psykofarmaka_import_*.sql`, `*_psykofarmaka_kursendring.sql` | Importen slik den ble rullet ut, og kursendringen som tok bort preparatnavnene etterpå |
| `supabase/migrations/*_kommentar_objekttype.sql`, `*_kommentarer.sql` | Fortolkningskommentarene som egne objekter |
| `src/domain/kommentarobjekt.ts` | Formen på en kommentar og kontrollen av den, lik databasens |
| `src/faginnhold/modell.ts` | Formen på innholdet per objekttype, og typene appen bruker |
| `src/faginnhold/lagring.ts`, `lesing.ts` | Kallene appen gjør for å endre og lese, og konflikter gjort om til en egen feil |
| `src/faginnhold/paneler.ts` | Panelene 1–7 og formen på hver elementtype |
| `src/faginnhold/riktekst.ts` | Rikteksten: nodene og merkene som er tillatt, rensing og ren tekst |
| `src/faginnhold/analyttside.ts` | En side satt sammen: panelene, nummereringen og publiseringsrekkefølgen |
| `src/faginnhold/sok.ts` | Indekseringen og søket, for siden og senere hele kunnskapsbasen |
| `src/faginnhold/historikk.ts`, `innholdsfelter.ts` | Historikken: tidslinjen, sammenligningen felt for felt og ord for ord, og feltene hver objekttype deles i |
| `src/components/historikk/` | Historikkvinduet og «Sist redigert», som åpner det |
| `src/domain/analyttkatalog.ts`, `rute.ts` | Kodene som har en side, og adressene til dem |
| `src/components/analyttside/` | Siden, panelene, skjemaene, editoren, referansevelgeren og søket |
| `src/faginnhold/referanser.ts` | Siteringer, nummerering, piller og referanseliste — rene funksjoner |
| `src/components/referanser/` | Referansepillen med boblen, og referanselisten |
| `src/__tests__/faginnhold.test.ts`, `referanser.test.ts`, `analyttsidelesing.test.ts`, `kommentarer.test.ts` | Reglene og lesingen, prøvd mot en ekte database |
| `src/__tests__/analyttside.test.tsx`, `navigasjon.test.tsx`, `analyttsidemodell.test.ts` | Sidene, redigeringen og veiene mellom sidene og fortolkningen |
| `src/__tests__/referansenummerering.test.ts`, `referansepille.test.tsx` | Nummereringen, og pillen med mus, berøring og tastatur |
| `src/__tests__/psykofarmakaimport.test.ts` | Datasettet og importen, prøvd mot en ekte database |
| `src/__tests__/hjelp/testdatabase.ts` | Postgres i minnet, bygd av migrasjonene, og kallene testene gjør |

## Domenet

Tre begreper holdes fra hverandre, som planen krever:

- **Informasjonsside** (`infoside`) — siden om et virkestoff, f.eks.
  Amitriptylin. Har foreløpig bare et navn; innholdet på siden er
  innholdselementer.
- **Laboratorieanalytt** — koden laboratoriet rapporterer, f.eks.
  `AMTNORSUM`. Har nøyaktig én hovedside og en ordnet liste med
  **komponenter**: informasjonssidene for stoffene analysen omfatter. For
  `AMTNORSUM` er hovedsiden Amitriptylin og komponentene amitriptylin og
  nortriptylin. Minst én komponent, ingen to like, og hver kode brukes av bare
  én analytt.
- **Innholdselement** — et kort, felt eller tekststykke på en
  informasjonsside. `panel` og `elementtype` er nøkler (små bokstaver, tall og
  understrek), og `data` er et JSON-objekt hvis form bestemmes av
  elementtypen. Panelene og elementtypene defineres når sidene bygges.
  Rekkefølgen i et panel er `posisjon`, deretter objekt-ID-en. Posisjonen er
  bevisst ikke unik, siden hvert element lagres for seg og et kort som
  flyttes, ellers ville støtt på plassen det skal til.

- **Referanse** — én kilde i den globale referansebasen. Se
  [Referanser](#referanser).
- **Kommentar** — en fortolkningskommentar: teksten som limes inn i
  pasientsvaret. Se [Kommentarer](#kommentarer).

Fortolkningsreglene er egne objekttyper på samme maskineri, én per regeltype.
De enkle konsentrasjonsreglene er objekttypen `intervallregelsett`, beskrevet i
`docs/fortolkningsregler.md`.

## Objekter, revisjoner og tilstander

Alt som kan redigeres, er et **objekt** med stabil ID i
`redigerbare_objekter`. Typen avgjør hvilken tabell innholdet ligger i.

- **Revisjoner** (`objektrevisjoner`): hver endring av innholdet blir en ny
  rad, nummerert fortløpende per objekt fra 1. Raden har et komplett
  øyeblikksbilde av objektet (`innhold`, samme form som det appen sender),
  handlingen (`opprettet`, `endret` eller `gjenopprettet`), bruker-ID-en og
  fornavn og etternavn slik de sto i profilen da. Bruker-ID-en har bevisst
  ingen fremmednøkkel, så historikken står også om kontoen fjernes. Innhold
  som er importert, har i tillegg en `kilde`, f.eks. «Importert fra
  Psykofarmaka.pdf, side 7» (se [Import](#import-fra-en-kilde)).
- **Tilstander** (`objekttilstander`): hvilken revisjon som er **utkastet**
  (arbeidsversjonen) og hvilken som er **publisert**. Innholdet i begge ligger
  som vanlige rader i tabellen for typen, med kolonnen `tilstand` — de samme
  kontrollene gjelder for begge, og det publiserte kan leses som vanlige
  tabeller.
- **Publiseringer** (`objektpubliseringer`): hver publisering, med
  revisjonen som ble publisert, den den erstattet, og hvem.

Revisjoner, publiseringer og objekter kan ikke endres eller slettes av noen —
triggere stopper det også for server-side klienter og migrasjoner. Eneste
unntak er en referanse som aldri har vært publisert eller brukt (se
[Referanser](#referanser)).

`objektstatus` viser gjeldende og publisert revisjon per objekt;
`objekthistorikk` viser alle handlingene samlet, publiseringene medregnet.
Historikken sorteres på revisjon, med publiseringen etter revisjonen den
gjelder.

**Historikkvisningen.** `les_historikk(objekt)` gir hendelsene fra
`objekthistorikk` (hvem, når, handling, kilde) og øyeblikksbildet i hver
revisjon, i ett kall og med radsikkerheten som ellers. «Sist redigert av …»
ved hvert redigerbart objekt åpner historikkvinduet for akkurat det objektet:
tidslinjen, og to visninger av forskjellen mellom en revisjon og den forrige
(eller en valgt eldre) — endringene, med det fjernede rødt og gjennomstreket
og det nye grønt og understreket, og revisjonene side om side. Innholdet
sammenlignes felt for felt (`innholdsfelter`: et regelsett per intervall, et
kort per tekst, en referanse som den vises), og bare fritekst ord for ord.
«Gjenopprett revisjon N» kaller `gjenopprett_revisjon` mot revisjonen
utkastet står på, så en gammel nettleserøkt får en konflikt i stedet for å
skrive over noe.

## Operasjonene

Alt som endrer noe, går gjennom fire databasefunksjoner, og for referansene
en femte, `slett_referanse` (se [Referanser](#referanser)). Hver av dem krever
administrator før noe annet skjer, gjør hele endringen i én transaksjon og
gir tilbake objektets nye status.

| Funksjon | Hva den gjør |
| --- | --- |
| `opprett_utkast(objekttype, innhold)` | Nytt objekt; utkastet blir revisjon 1 |
| `lagre_utkast(objekt, forventet_revisjon, innhold)` | Ny revisjon av utkastet. Uendret innhold gir ingen ny revisjon |
| `gjenopprett_revisjon(objekt, forventet_revisjon, fra_revisjon)` | Ny revisjon med innholdet fra en tidligere. Alt senere blir stående |
| `publiser_utkast(objekt, forventet_revisjon)` | Publiserer utkastet slik det står. Lager ingen ny revisjon |

**Samtidighet.** `forventet_revisjon` er revisjonen brukeren åpnet. Funksjonen
låser utkastet og sammenligner; er det kommet en nyere revisjon i mellomtiden,
avvises kallet med SQLSTATE `PT409`, som data-API-et svarer på med HTTP 409.
Detaljene sier hvilken revisjon som er gjeldende. En annen lagring som kommer
samtidig, venter på låsen og avvises på samme måte. `lagring.ts` gjør dette om
til `Samtidighetskonflikt`.

**Andre feil.** `42501` er manglende rettighet, `22023` ugyldig innhold, og
`PT404` et objekt som ikke finnes; meldingene er skrevet for å vises. `23505`
og `23514` er brudd på en regel i tabellen, med teknisk melding.

**Øyeblikksbildet** som lagres, er alltid det som faktisk havnet i tabellene,
lest tilbake etter skrivingen. Gjenoppretting skriver utkastet på nytt fra et
eldre øyeblikksbilde, og publisering skriver det publiserte av utkastet — begge
gjennom den samme veien som vanlig lagring. Publiseringen avbrytes om det
publiserte ikke blir nøyaktig likt utkastet.

**Rekkefølgen ved publisering.** Det publiserte kan bare peke på det som også
er publisert. En laboratorieanalytt publiseres derfor etter hovedsiden og
komponentene, og et innholdselement etter siden det står på. Ellers avvises
publiseringen, og ingenting blir halvveis publisert.

**Kjente begrensninger.**

- Hver publisering gjelder ett objekt. To analytter kan derfor ikke bytte kode
  med hverandre, og to sider ikke bytte navn, uten et mellomsteg med en
  midlertidig kode eller et midlertidig navn som også må publiseres. Et samlet
  kall som publiserer flere objekter på én gang, hører hjemme der
  publiseringen får et grensesnitt.
- En vanlig bruker ser ikke innholdet i revisjoner som aldri er publisert,
  men kan se at de finnes: numrene på de publiserte revisjonene har hull, og
  en gjenopprettet revisjon viser hvilken revisjon den kom fra.

## Referanser

En referanse er en objekttype som alle andre, med stabil ID, utkast,
publisering, revisjoner og gjenoppretting. Feltene er de samme som i Slaids —
`tittel`, `forfattere`, `aar` og `lenke`, alle tekst — og den vises som
**Tittel · Forfatter(e) · År · Lenke**, uten tomme ledd. Minst ett av tittel,
forfattere og lenke må være fylt ut, og lenken må begynne med `http://` eller
`https://`. DOI, PMID og lignende er ikke egne felt ennå; de kan legges til
senere uten å endre visningen. `arkivert` er et felt i innholdet, så
arkivering er en vanlig revisjon som kan gjøres om.

**Siteringer.** Innholdet viser til referansene med ID-ene, aldri med numre,
på tre nivåer:

| Nivå | Hvor ID-ene står |
| --- | --- |
| `panel` | Informasjonssidens `panelreferanser`: panelnøkkel → ordnet liste |
| `element` | Innholdselementets `referanser`: kortets kilder, ordnet |
| `inline` | Siteringsnoder hvor som helst i elementets `data`: `{"type": "sitering", "attrs": {"referanser": [...]}}` — samme node som i Slaids, med norske navn |

Et panel eller kort viser til hver referanse bare én gang; inline kan samme
referanse stå så mange ganger som teksten trenger. `type: "sitering"` er
dermed reservert i `data`. ID-ene i en siteringsnode skal stå med små
bokstaver, siden appen kjenner igjen referansene på teksten.

Feltene `panelreferanser` og `referanser` kom til etter at typene ble laget.
Uten referanser utelates de i øyeblikksbildet i stedet for å stå tomme. Da har
et objekt uten referanser samme form som før, og innhold fra før
referansesystemet står fortsatt likt revisjonen det peker på.

**Koblingene.** Hver sitering blir en rad i `referansekoblinger`, skrevet av
de samme funksjonene som skriver innholdet og for samme tilstand. Panel- og
kortreferansene lagres der, ikke som JSON; inline-siteringene leses ut av
dataene. Det er koblingene databasen håndhever reglene med:

- En kobling må peke på en referanse. I det publiserte må referansen også
  være publisert — referansen publiseres før det som siterer den.
- En arkivert referanse kan ikke siteres, og en referanse som er sitert, kan
  ikke arkiveres. Det gjelder hver tilstand for seg: skal en publisert
  referanse arkiveres, må innholdet der den er fjernet, publiseres først.
- `referansebruk` viser hvilke sider hver referanse brukes på, og hvor mange
  ganger, i utkastet og i det publiserte.

**Sletting.** `slett_referanse(objekt, forventet_revisjon)` sletter en
referanse for godt — med revisjonene sine — bare når den aldri har vært
publisert og ikke står i noen revisjon av noe annet objekt, heller ikke en
eldre. Alt annet må arkiveres, så historikken aldri peker på noe som er borte.
Slettingen føres i `slettede_referanser` med siste utkast og hvem som slettet.
Det er det eneste unntaket fra at historikken er uforanderlig, og triggeren
slipper det bare gjennom for den ene referansen, i transaksjonen som sletter
den.

**Nummereringen** regnes ut i `src/faginnhold/referanser.ts` når siden vises,
etter første forekomst i leserekkefølgen på akkurat den siden: panelene i den
rekkefølgen siden viser dem (ukjente paneler etter, alfabetisk), kortene etter
posisjon og ID, og teksten i dokumentrekkefølge. Det en beholder siterer —
panelet, kortet — kommer før det som står i den. Samme referanse beholder
nummeret fra første gang, og kan ha ulike numre på ulike sider. Pillene
komprimerer serier på minst tre (`1–3, 5, 9–11`), og referanselisten nederst
er alltid det nummereringen gir.

**Pillen og boblen** (`Referansepille`) åpnes ved peker over, og ved klikk,
trykk, Enter eller mellomrom; et klikk fester den. Escape, et nytt klikk, et
trykk utenfor eller fokus som går videre, lukker den. Boblen står rett etter
knappen i dokumentet, så Tab når lenkene i den, og plasseres som tipsboblene
(`useBobleplassering` i `Tips.tsx`). Pillene og listen henter numrene og
referansene fra `Sidereferanser` rundt siden.

## Kommentarer

Kommentar og regel er ulike objekter (planen, avsnitt 10). En kommentar er
teksten; en regel sier når den brukes. Hver kommentar er et eget objekt med
egen historikk og publisering, og reglene peker på den med ID-en. Samme
kommentar kan brukes av flere regler og regelsett, og en tekst rettes ett
sted.

```ts
{ navn: 'Åpning', tekst: 'THC-syre … er påvist i {nivå} konsentrasjon.', plassholdere: ['{nivå}'] }
```

- **Teksten** er ren tekst på én linje, 1–4000 tegn, uten mellomrom i endene.
  Den limes inn som den står. `navn` er det redigeringen viser, og følger
  ikke med i pasientsvaret.
- **Plassholderne** er hullene en regeltype fyller inn når kommentaren settes
  sammen, som `{nivå}`. Teksten må bruke nøyaktig de plassholderne som er
  oppgitt, ingen flere og ingen færre, og en krøllparentes som ikke hører til
  en plassholder, avvises. Plassholderne lagres sortert, og **kan ikke endres**
  etter at kommentaren er opprettet: alle revisjoner har de samme. Trengs
  andre, lages en ny kommentar. Slik kan en regeltype som har godtatt en
  kommentar, stole på den også etter senere endringer av teksten, uten at
  kommentaren må vite hvem som bruker den. Hvilke plassholdere en regeltype
  godtar, og hvilke den krever, kontrollerer regeltypen selv. Vanlige
  kommentarer har ingen.
- **Koblingen** fra en regel er en `uuid`-kolonne med `intern.krev_objekttype`
  for `'kommentar'`. Den samme kontrollen gjør at det publiserte regelsettet
  bare kan peke på publiserte kommentarer: **kommentarene publiseres før
  regelsettet**. Regelsettet binder ikke en bestemt revisjon av kommentaren;
  fortolkningen bruker den publiserte utgaven av hver.
- **Lesingen.** `les_kommentarer(kommentartilstand, ider)` gir kommentarene i
  én tilstand — alle, eller bare de med ID-ene i `ider` — i samme form som de
  andre lesefunksjonene.

`validerKommentar` i `src/domain/kommentarobjekt.ts` gir de samme feilene som
databasen, med samme ordlyd, så redigeringen kan si fra før lagring.
`kommentarer.test.ts` kjører de samme tilfellene gjennom begge.

## Informasjonssidene

**Adressene.** Hver analyttkode appen kan fortolke, har en side på
`#/analytt/<KODE>` (`src/domain/rute.ts`). Adressen står etter `#`, så
nettleseren alene leser den: siden som lastes, og innloggingsveggen, er de
samme. Hvilke koder som finnes, gir katalogen (`analyttkatalog.ts`), bygd av
de samme søkeoppføringene som søket og sidemenyen. Katalogen sier også hvilken
informasjonsside koden hører til (moderstoffet for sumanalysene), hvilke
stoffer den omfatter, og hvilken fortolkningsmodul «Åpne fortolkning» fører
til.

**Lesingen.** En side leses i ett kall: `les_analyttside(analyttkode,
sidetilstand)` gir laboratorieanalytten, hovedsiden, innholdselementene,
komponentsidene med kodene deres og referansene siden siterer — hvert objekt
som en utgave med revisjonen tilstanden peker på, den publiserte revisjonen,
øyeblikksbildet og hvem som laget det. Lesemodus leser det publiserte;
redigeringsmodus utkastet. Regelsettet for koden (`finn_intervallregelsett`,
se `docs/fortolkningsregler.md`) leses samtidig og står i sidedataene som
`regelsett`; det er sitt eget objekt og peker på koden, ikke på siden.
`les_referanser` gir referansebasen og `finn_infosider` sidene med gitte
navn. Alle disse, og visningen
`objektutgaver` de bygger på, kjører med rettighetene til den som leser, så
radsikkerheten gjelder som ellers.

**Panelene** står i `paneler.ts`, med formen på `data` for hver elementtype:

| Panel | Nøkkel | Elementer |
| --- | --- | --- |
| 1 Identitet | `identitet` | `preparater`: `{ navn: string[] }`, vist alfabetisk |
| 2 Viktige data | `viktige_data` | Ett kort per type — `referanseomrade`, `toksisk_omrade`, `alvorlig_intoksikasjon`, `halveringstid`, `steady_state` — med `{ nedre, ovre, enhet, forbehold }` |
| 3–5 Farmakodynamikk, dosering, indikasjon | `farmakodynamikk`, `dosering`, `indikasjon` | `riktekst`: `{ dokument }` |
| 6 Farmakokinetikk | `farmakokinetikk` | `kinetikkort`: `{ tittel, dokument }`, i rekkefølge |
| 7 Serumkonsentrasjoner | `serumkonsentrasjoner` | `dosetabell`: `{ rader: [{ dose, regime, konsentrasjon, merknad }] }` |

Tallene i panel 2 er tall, ikke tekst. Bare den ene grensen oppgitt vises som
«fra 10» eller «opptil 20», uten å si om grensen er med. Koden, navnet og
kategorien i panel 1 kommer fra de statiske datasettene til siden finnes i
databasen.

**Visningen.** Identiteten står alltid fram. Panel 2–7 er seksjoner som åpnes
og lukkes, og kortene i farmakokinetikken er detaljkort i sin seksjon (se
`docs/seksjoner.md`). En lukket seksjon viser en kort oppsummering med
innholdets egne ord: titlene på datakortene og kinetikkortene, dosene i
tabellen eller begynnelsen av teksten. «Viktige data» står åpent fra start
(`apen` i `paneler.ts`); i redigeringsmodus åpnes alt.

**Rikteksten** er et ProseMirror-dokument, redigert med TipTap som i Slaids.
Tillatt er avsnitt, linjeskift, punkt- og nummererte lister, fet, kursiv,
understreket, senket og hevet skrift, lenker (bare `http(s)`) og siteringer.
Alt leses gjennom `rensDokument` før det vises.

**Redigeringen.** Administratorer får knappen «Rediger». Knappene for å endre
vises først når utkastet er hentet, og alt lagres som utkast mot revisjonen
som ble lest; en konflikt stanser lagringen og sier fra. Preparatnavnene,
hvert datakort, rikteksten i panel 3–5 og tabellen kan bare stå én gang i
panelet sitt (`ENKELTELEMENTER`). Databasen håndhever det med en unik indeks,
så to som oppretter det samme kortet samtidig, ikke begge får det lagret —
den andre får en konflikt.
Første gang noe lagres på en kode uten side, opprettes informasjonssiden og
laboratorieanalytten av katalogens opplysninger; sider med samme navn som
finnes fra før — for eksempel en komponent — gjenbrukes. «Publiser endringene»
viser hva som blir synlig, og publiserer i den rekkefølgen databasen krever
(`publiseringsplan`): referanser, komponentsider, hovedsiden, analytten,
elementene, og til sist regelsettet, med feltene som er endret i det.

Et objekt kan ikke slettes. Et kort som fjernes, flyttes derfor til panelet
`fjernet`: det vises ikke, søkes ikke i og nummereres ikke, men står i
historikken og kan hentes tilbake.

**Søket** (`sok.ts`) er bygd for begge søkene i planen. `indekserSide` gjør én
side om til søkedokumenter — navn, kode, komponenter, preparater,
overskrifter, verdier, tabellrader, fritekst og referanser — hver med stedet
den står (side › panel › kort). `sok` rangerer dokumentene og lager utdrag.
Søket på siden bruker indeksen til å vise hvor treffene står, og fremhever
dem i teksten — også i lukkede seksjoner, som åpnes når brukeren går til et
treff der. Det globale søket skal indeksere alle publiserte sider på samme
måte; det trenger bare en kilde som gir alle sidene, for eksempel en funksjon
ved siden av `les_analyttside`.

## Import fra en kilde

Innhold som finnes i en kilde fra før, legges inn som en kontrollert
datamigrering, ikke for hånd. Først psykofarmakasidene (arbeidspakke 4) fra
`originaldata/Psykofarmaka.pdf`.

**Datasettet** (`supabase/import/psykofarmaka/`) har én fil per analyttkode,
skrevet så tett på kilden at hvert tall kan holdes opp mot den renderte siden:
panelene med de samme nøklene som på siden, tekstene som avsnitt og
punktlister (`_{x}` er senket, `^{x}` hevet skrift og `[tekst](https://…)` en
lenke), og tabellene over serumkonsentrasjoner slik kilden har dem — én
kolonne per dose — som gjøres om til rader. `felles.json` har referansene
flere sider deler. Hva som er hentet og hva som er utelatt, og hvorfor, står i
beskrivelsen av PR-en som la det inn.

- Fra PDF-en: dosering, farmakodynamikk, konsentrasjonsområdene
  (referanseområde, toksisk og komatøs/fatal), farmakokinetikken kort for
  kort og serumkonsentrasjonene ved ulike doser. Ikke ringegrensen og
  måleområdet (de hører til fortolkningen), og ikke «Spørsmål og svar» og
  andre saksnotater, som kan ha pasientopplysninger.
- Fra Felleskatalogen: et kort sammendrag av de godkjente indikasjonene, med
  produktsidene som referanser. Det er redaksjonelt faginnhold som redigeres
  som resten av siden.
- Preparatnavnene fra Felleskatalogen og datoen de ble kontrollert, ble lagt
  inn med importen og så tatt bort igjen (`kursendringSql`, migrasjonen
  `*_psykofarmaka_kursendring.sql`): preparatdata skal hentes fra offentlige
  legemiddeldata, ikke føres for hånd. De står ikke lenger i datasettet, og
  en fil med `preparater` avvises som ukjent felt. Kortene står i
  historikken, i panelet `fjernet`.
- Toksisk område og komatøs/fatal siterer Schulz og Hiemke (og
  Giftinformasjonens side der PDF-en lenker til den), fordi PDF-en oppgir dem
  som grunnlaget for toksisitetsdataene. Referanseområdet har ingen oppgitt
  kilde og får ingen.

**Kontrollen.** `byggImportplan` i `import.ts` stopper på alt som ikke har
formen appen leser — ukjente koder og felt, verdier som ikke er tall, tabeller
med kolonner som ikke går opp, referanser som ikke er definert — og lister
alle feilene samtidig. `psykofarmakaimport.test.ts` kjører hele importen i
testdatabasen.

**Innleggingen.** Importen rulles ut som migrasjoner:
`npm run import:psykofarmaka -- <brukernavn> --migrasjoner <mappe>` lager
filene, som legges inn med `apply_migration` (MCP-ens `execute_sql` har bare
leserettigheter) og så legges i `supabase/migrations/` med versjonen
prosjektet registrerte. De går gjennom de samme funksjonene som appen, som
administratoren som er oppgitt: `opprett_utkast` for hvert objekt, så
`publiser_utkast` i den rekkefølgen databasen krever. Hver revisjon får kilden
sin gjennom innstillingen `far.revisjonskilde`, som bare gjelder
transaksjonen, og som data-API-et ikke kan sette. Finnes ikke administratoren
— som i testdatabasen og i nye grener — gjør migrasjonene ingenting. Først
kommer referansene, deretter én blokk per kode, som hver er én transaksjon. En
kode som alt har en side, hoppes over, og sider og referanser som finnes fra
før, gjenbrukes. Uten `--migrasjoner` skrives den samme SQL-en som én fil, for
SQL-editoren; der stopper den med en feil om administratoren mangler.

Migrasjonene som er kjørt, er historikk og endres aldri; testen låser md5-en
deres til den produksjonen har registrert. Datasettet kan endre seg etter dem
(som da preparatnavnene ble tatt ut), så testen prøver ikke om de kan lages på
nytt, men kjører dem slik produksjonen gjorde — med administratoren
opprettet først — og sjekker at sidene viser nøyaktig det datasettet har nå.

## Tilgang

- Alle innloggede leser det publiserte: publiserte rader, revisjoner som har
  vært publisert, og publiseringene.
- Administratorer leser i tillegg utkastene og hele historikken.
- Ingen har skriverett på tabellene — heller ikke administratorer eller den
  hemmelige nøkkelen. Endringer går bare gjennom funksjonene over, som slår
  opp rollen i profiltabellen med `public.er_admin()`/`intern.krev_admin()`.
- Hjelpefunksjonene ligger i skjemaet `intern`, som ingen av API-rollene har
  tilgang til.
- `anon` har ingen tilgang i det hele tatt.

Sikkerhetsrådgiveren i Supabase vil peke på at de fem funksjonene og
`er_admin()` kjører med eierens rettigheter og kan kalles av innloggede. Det
er bevisst: det er slik skriveretten holdes borte fra tabellene, og hver av
dem krever administrator før noe annet skjer. Å stenge dem for `authenticated`
ville stengt redigeringen.

## Når noe skal endres

**Ny objekttype.** Den nye verdien i `objekttype` legges til i en migrasjon
for seg, siden en ny enum-verdi ikke kan brukes i samme transaksjon. I neste
migrasjon: en tabell med `(objekt_id, tilstand)` som peker på
`objekttilstander`, triggeren
`intern.krev_objekttype` for typen og for koblinger (`objekt_id` er raden
selv, andre kolonner er koblinger til andre objekter), funksjonsparet
`intern.skriv_<type>` og `intern.les_<type>`, radsikkerhet og rettigheter som
for de andre. Resten av maskineriet finner funksjonene på navnet. Legg typen
og formen inn i `src/faginnhold/modell.ts`, og prøv den i testene.

**Nytt felt på en type.** Revisjonene endres aldri, så eldre øyeblikksbilder
mangler feltet. `skriv_<type>` må tåle det — med en standardverdi, f.eks.
gjennom `intern.med_standard` — ellers kan de eldre revisjonene ikke
gjenopprettes. Det feiler i så fall høylytt, ikke i stillhet.

**Testene** kjører alle migrasjonene i en Postgres i minnet (PGlite), med det
Supabase har på plass fra før gjenskapt i `testdatabase.ts`: API-rollene,
standardrettighetene deres i `public`, `auth.uid()` og tabellene migrasjonene
bygger på. Bruker en ny migrasjon noe mer fra Supabase, utvides grunnlaget
der.
