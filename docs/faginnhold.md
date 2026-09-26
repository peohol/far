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
| `supabase/migrations/*_analyttsider_samlet_lesing.sql` | Alle sidene i én tilstand i ett kall, for søket i hele kunnskapsbasen |
| `supabase/migrations/*_enkeltelementer.sql` | At kortene som står én gang i panelet sitt, ikke kan opprettes to ganger |
| `supabase/migrations/*_regelredigering_lesing.sql` | Historikken til ett objekt (`les_historikk`) og regelsettet for én kode |
| `supabase/migrations/*_kommentar_objekttype.sql`, `*_kommentarer.sql` | Fortolkningskommentarene som egne objekter |
| `src/domain/kommentarobjekt.ts` | Formen på en kommentar og kontrollen av den, lik databasens |
| `supabase/migrations/*_revisjonskilde.sql` | Kilden i revisjonene, for innhold som er importert |
| `supabase/import/psykofarmaka/` | Importdatasettet for psykofarmakasidene, én fil per analyttkode |
| `src/faginnhold/import.ts`, `psykofarmaka.ts`, `scripts/importer-psykofarmaka.ts` | Kontrollen av datasettet, planen og SQL-en som legger det inn |
| `supabase/migrations/*_psykofarmaka_import_*.sql`, `*_psykofarmaka_kursendring.sql` | Importen slik den ble rullet ut, og kursendringen som tok bort preparatnavnene etterpå |
| `supabase/import/tdm/`, `src/faginnhold/tdm.ts`, `scripts/importer-tdm.ts` | Referanseområdene og TDM-kortene fra referanseområdeprosjektet og Tidsskriftet, og SQL-en som legger dem til på sidene |
| `supabase/migrations/*_tdm_referanseomrader_*.sql` | Den importen slik den ble rullet ut |
| `supabase/import/rettinger/`, `src/faginnhold/rettinger.ts`, `scripts/lag-rettinger.ts`, `supabase/migrations/*_rettinger.sql` | Rettinger av rader i tabellene over serumkonsentrasjoner, med kilden og begrunnelsen |
| `supabase/import/oppdateringer/`, `src/faginnhold/kortoppdateringer.ts`, `scripts/lag-kortoppdateringer.ts` | Oppdateringer av kort på sidene etter en nyere kilde, som de nasjonale referanseområdene for antiepileptika fra 2017 |
| `supabase/migrations/*_scenarioregelsett*.sql`, `*_rusregler_import.sql`, `*_scenarioregler_lesing.sql` | Scenarioregelsettene for analytter som vurderes samlet, importen av rusmiddelreglene og lesingen fortolkningen gjør (`docs/scenarioregler.md`) |
| `src/faginnhold/modell.ts` | Formen på innholdet per objekttype, og typene appen bruker |
| `src/faginnhold/lagring.ts`, `lesing.ts` | Kallene appen gjør for å endre og lese, og konflikter gjort om til en egen feil |
| `src/faginnhold/paneler.ts` | Panelene 1–7 og formen på hver elementtype |
| `src/faginnhold/riktekst.ts` | Rikteksten: nodene og merkene som er tillatt, rensing og ren tekst |
| `src/faginnhold/analyttside.ts` | En side satt sammen: panelene, nummereringen og publiseringsrekkefølgen |
| `src/faginnhold/sok.ts` | Indekseringen, rangeringen og søket, for siden og hele kunnskapsbasen |
| `src/faginnhold/globaltSok.ts` | Lesingen og indekseringen av hele kunnskapsbasen for det globale søket |
| `src/legemiddeldata/stoffside.ts` | Hvor preparatene og interaksjonene står på siden, og tekstene søket finner der |
| `src/faginnhold/historikk.ts`, `innholdsfelter.ts` | Historikken: tidslinjen, sammenligningen felt for felt og ord for ord, og feltene hver objekttype deles i |
| `src/components/historikk/` | Historikkvinduet og «Sist redigert», som åpner det |
| `src/domain/analyttkatalog.ts`, `rute.ts` | Kodene som har en side, og adressene til dem |
| `src/components/analyttside/` | Siden, panelene, skjemaene, editoren, referansevelgeren og søket |
| `src/faginnhold/referanser.ts` | Siteringer, nummerering, piller og referanseliste, for redaksjonelle og automatiske referanser — rene funksjoner |
| `src/legemiddeldata/referanser.ts` | De automatiske referansene fra FEST |
| `src/clinpgx/referanser.ts` | De automatiske referansene fra ClinPGx (se `docs/clinpgx.md`) |
| `src/components/referanser/` | Referansepillen med boblen, referansefeltet og referanselisten |
| `src/__tests__/faginnhold.test.ts`, `referanser.test.ts`, `analyttsidelesing.test.ts`, `kommentarer.test.ts` | Reglene og lesingen, prøvd mot en ekte database |
| `src/__tests__/analyttside.test.tsx`, `navigasjon.test.tsx`, `analyttsidemodell.test.ts` | Sidene, redigeringen og veiene mellom sidene og fortolkningen |
| `src/__tests__/referansenummerering.test.ts`, `referansepille.test.tsx` | Nummereringen, og pillen med mus, berøring og tastatur |
| `src/__tests__/festreferanser.test.ts`, `referansefelt.test.tsx` | FEST-referansene, referansefeltet, listen og at editoren aldri tilbyr en automatisk kilde |
| `src/__tests__/psykofarmakaimport.test.ts`, `tdmimport.test.ts`, `rettinger.test.ts`, `kortoppdateringer.test.ts` | Datasettene, importene, rettingene og oppdateringene, prøvd mot en ekte database |
| `src/__tests__/hjelp/testdatabase.ts` | Postgres i minnet, bygd av migrasjonene, og kallene testene gjør |

## Domenet

Tre begreper holdes fra hverandre, som planen krever:

- **Informasjonsside** (`infoside`) — siden om et virkestoff, f.eks.
  Amitriptylin. Har foreløpig bare et navn; innholdet på siden er
  innholdselementer. En side trenger ingen laboratorieanalytt: et stoff
  laboratoriet ikke har noen kode for, kan likevel ha en side (se
  [Informasjonssidene](#informasjonssidene)).
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

- **Intervallregelsett** (`intervallregelsett`) — de enkle
  konsentrasjonsreglene for én analyttkode. Regelsettet peker på kommentarene i
  stedet for å ha sin egen kopi. Se `docs/fortolkningsregler.md`.
- **THC-syreregelsett** (`thc_regelsett`) — reglene for THC-syre i urin som
  ett objekt: kurvene, grensene og hvilken kommentar hver tekstbolk bruker
  lagres, publiseres og gjenopprettes samlet. Tekstene er kommentarer. Det
  finnes bare ett. Se `docs/thc-syre.md`.

Regelsettene for de øvrige regeltypene er egne objekttyper, én per regeltype,
på samme maskineri.

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
| `lagre_intervallregelsett(objekt, forventet_revisjon, innhold, kommentarer)` | Et regelsett og de nye og endrede kommentarene det bruker, i én transaksjon (`docs/fortolkningsregler.md`) |
| `lagre_scenarioregelsett(objekt, forventet_revisjon, innhold, kommentarer)` | Det samme for et scenarioregelsett (`docs/scenarioregler.md`) |

`opprett_utkast` går gjennom `intern.opprett_objekt(type, id, innhold)`, som
også brukes når ID-en alt er gitt: en import med faste ID-er, eller en ny
kommentar som reglene i samme lagring peker på.

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
kortet, panelet — kommer etter det som står i den, fordi det vises i
referansefeltet nederst i beholderen: teksten i et kort før kortets kilder,
kortene før panelets. Samme referanse beholder nummeret fra første gang, og
kan ha ulike numre på ulike sider. Pillene komprimerer serier på minst tre
(`1–3, 5, 9–11`), og referanselisten nederst er alltid det nummereringen gir.

**Visningen.** Inline-siteringer er hevede piller i teksten. Kildene for et
helt kort eller panel står i et eget, avgrenset **referansefelt** nederst i
beholderen («Kilder» og pillen, `Referansefelt`), aldri i overskriften eller
teksten. Referanselisten nederst på siden er det eneste stedet hele
referanseteksten står fast; ellers står den i boblen.

**Pillen og boblen** (`Referansepille`) åpnes ved peker over, og ved klikk,
trykk, Enter eller mellomrom; et klikk fester den. Escape, et nytt klikk, et
trykk utenfor eller fokus som går videre, lukker den. Boblen står rett etter
knappen i dokumentet, så Tab når lenkene i den, og plasseres som tipsboblene
(`useBobleplassering` i `Tips.tsx`). Pillene, feltene og listen henter
numrene og referansene fra `Sidereferanser` rundt siden.

### Automatiske referanser

Referansene har to opphav i samme nummerering, samme bobler og samme liste:

| Opphav | Hvor de kommer fra | Redigering |
| --- | --- | --- |
| Redaksjonell | Objekter i databasen, som over | Redigeres, arkiveres og slettes gjennom den vanlige arbeidsflyten |
| Automatisk | Lages av data OUSFAR henter fra andre, hver gang siden vises (`automatisk` på `Referanse`) | Aldri: de er ikke objekter, kan ikke velges i referansevelgeren (der står de låst når søket treffer dem) og forsvinner av seg selv når kilden ikke lenger har dem |

De automatiske kildene er FEST (`src/legemiddeldata/referanser.ts`) og
ClinPGx (`src/clinpgx/referanser.ts`, se `docs/clinpgx.md`). FEST:

- **FEST selv** (ID `fest:kilde`) står i referansefeltet til «Preparater» og
  «Interaksjoner». Sporbarheten NLOD krever — uttrekket kopien bygger på og
  når den sist ble kontrollert — er ikke referansetekst: den står diskret i
  feltet ved pillen og under referansen i listen, med «kan ikke redigeres».
- **DMPs referanser for hver interaksjon** står i referansefeltet nederst i
  interaksjonens detaljkort. ID-en er `fest:` og en kontrollsum av teksten og
  lenken DMP har gitt, så samme referanse får samme nummer uansett hvor mange
  interaksjoner som viser til den, og samme ID ved neste synkronisering.

ClinPGx står på samme måte i referansefeltet til «Farmakogenetikk»
(`clinpgx:kilde`, med lisensen CC BY-SA 4.0 og når dataene sist ble hentet,
og med lenke til lisensen og bruksvilkårene i referanselisten),
og publikasjonene ClinPGx oppgir, i detaljkortet til hver retningslinje og
preparatomtale (`clinpgx:` og en kontrollsum). `slaSammenAutomatiske` i
`src/faginnhold/referanser.ts` slår kildene sammen for siden.

`referanseunivers` i `src/faginnhold/analyttside.ts` slår de redaksjonelle og
de automatiske sammen for siden. Automatiske elementer kommer etter de
redaksjonelle i panelet, og automatiske panelreferanser etter panelets
redaksjonelle. Redaksjonelt innhold kan ikke sitere en automatisk referanse;
databasen kjenner dem ikke.

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

**Stoffsider uten kode.** Et stoff uten analyttkode kan ha en side på
`#/stoff/<navn>`: en informasjonsside som verken er hovedside eller komponent
for noen analytt (visningen `stoffsider_uten_kode`). Den har de samme panelene,
men ingen kode i identiteten, ingen «Åpne fortolkning» og ingen regelsett.
Sidemenyen lister dem i skuffen «Stoffer uten labkode», fra databasen
(`les_stoffsidenavn`); redaktørene ser også dem som ikke er publisert, og kan
åpne en ny side med et navn derfra. Et navn som hører til en kode i katalogen,
fører til siden for koden. Får stoffet en kode senere, opprettes
laboratorieanalytten med siden som finnes som hovedside, og siden leses
gjennom koden som de andre.

**Lesingen.** En side leses i ett kall: `les_analyttside(analyttkode,
sidetilstand)` gir laboratorieanalytten, hovedsiden, innholdselementene,
komponentsidene med kodene deres og referansene siden siterer — hvert objekt
som en utgave med revisjonen tilstanden peker på, den publiserte revisjonen,
øyeblikksbildet og hvem som laget det. Lesemodus leser det publiserte;
redigeringsmodus utkastet. Regelsettet for koden (`finn_intervallregelsett`,
se `docs/fortolkningsregler.md`) leses samtidig, med kommentarobjektene det
peker på, og står i sidedataene som `regelsett`; det er sitt eget objekt og
peker på koden, ikke på siden.
`les_stoffside(sidenavn, sidetilstand)` gir siden for et stoff uten kode på
samme form, med `analytt` som `null` — eller siden for koden, når navnet er
hovedside for en. `les_referanser` gir referansebasen og `finn_infosider`
sidene med gitte navn. Alle disse, og visningen
`objektutgaver` de bygger på, kjører med rettighetene til den som leser, så
radsikkerheten gjelder som ellers.

**Panelene** står i `paneler.ts`, med formen på `data` for hver elementtype.
Tabellen står i den rekkefølgen siden viser panelene (`PANELER`, som også
styrer søket og nummereringen av referansene):

| Panel | Nøkkel | Elementer |
| --- | --- | --- |
| Identitet | `identitet` | Ingen; koden, navnet og kategorien kommer fra siden og katalogen |
| Viktige data | `viktige_data` | Ett kort per type — `referanseomrade`, `toksisk_omrade`, `alvorlig_intoksikasjon` (gruppen konsentrasjoner), `halveringstid`, `steady_state` (gruppen kinetikk). Konsentrasjonene har `{ nedre, ovre, enhet }`; t½ og tss har `{ former: [{ form, typisk, min, maks, enhet }] }`, én rad per legemiddelform |
| Farmakodynamikk, indikasjon | `farmakodynamikk`, `indikasjon` | `riktekst`: `{ dokument }` |
| Preparater | `preparater` | `legemiddelkobling`: `{ virkestoff: [{ fest_id, navn }] }` — hvilke virkestoff i legemiddeldataene siden viser preparatene for (se `docs/legemiddeldata.md`) |
| Dosering | `dosering` | `riktekst`: `{ dokument }` |
| Farmakokinetikk | `farmakokinetikk` | `kinetikkort`: `{ tittel, dokument }`, i rekkefølge |
| Farmakogenetikk | `farmakogenetikk` | `kinetikkort`: `{ tittel, dokument }`, i rekkefølge (som regel ett, «CYP-enzymer (substrat)»); `clinpgxkobling`: `{ kjemikalier: [{ clinpgx_id, navn }] }` — hvilke kjemikalier i ClinPGx siden viser retningslinjene, preparatomtalene og de kliniske annotasjonene for, under kortene (se `docs/clinpgx.md`) |
| Interaksjoner | `interaksjoner` | `riktekst`: `{ dokument }`, øverst; under den interaksjonene fra FEST for koblingen i «Preparater» |
| Terapeutisk legemiddelmonitorering (TDM) | `tdm` | `kinetikkort`: `{ tittel, dokument }`, i rekkefølge — prøvetakingstidspunkt, grunnlaget for referanseområdet, tolkning og indikasjoner for måling |
| Serumkonsentrasjoner | `serumkonsentrasjoner` | `dosetabell`: `{ rader: [{ dose, regime, konsentrasjon, merknad }] }`. Kildene står på panelet, ikke på tabellen |

Tallene i viktige data er tall, ikke tekst. Bare den ene grensen oppgitt vises
som «> 10» eller «opptil 20», uten å si om grensen er med. t½ og tss viser
«typisk (min–maks)», bare den typiske verdien eller bare området, per
legemiddelform side om side; formen kan stå tom når det bare er én. Det
tidligere feltet `forbehold` vises ikke lenger, men står i eldre revisjoner,
og t½/tss uten `former` leses som ett område eller én typisk verdi. Koden, navnet og
kategorien i identiteten kommer fra de statiske datasettene til siden finnes
i databasen.

**Visningen.** Identiteten og viktige data står alltid fram øverst
(`Identitetspanel.tsx`, `ViktigeData.tsx`). Viktige data har ingen synlig
tittel, men er et område med navnet for skjermlesere; kortene står i to
grupper (`DATAKORTGRUPPER`), med konseptikon og etikett på hvert kort, og
halveringstid og tid til steady state vises som t₁/₂ og tₛₛ. De andre panelene
er seksjoner som åpnes og lukkes, og kortene i farmakokinetikken, farmakogenetikken og TDM er detaljkort
i sin seksjon (se `docs/seksjoner.md`). En lukket seksjon viser en kort
oppsummering med innholdets egne ord: titlene på kinetikkortene, dosene i
tabellen eller begynnelsen av teksten. Redigeringsmodus åpner ikke alt;
redaktøren åpner seksjonen som skal redigeres.

Hvordan innholdet tegnes, endrer aldri hva som står der:

- **Dosering** vises som ett kort per avsnitt når hvert avsnitt begynner med
  en kort etikett og et kolon («Immediate release: (25) 50–800 mg» blir kortet
  «Immediate release» med verdien under). Ellers vises teksten som den er
  (`src/faginnhold/doseringskort.ts`).
- **Serumkonsentrasjonene** vises som i kilden: én tabell per stoff med
  dosene som kolonner og antall prøver, 10-persentil, median og 90-persentil
  som rader, og referanseområdeprosjektet i en egen liten tabell.
  `src/faginnhold/serumtabell.ts` leser de lagrede radene tilbake til den
  formen, og godtar en rad bare når teksten den ville skrevet, er nøyaktig den
  som er lagret. En rad som er redigert til noe annet, vises som en vanlig rad
  med tekstene sine.

**Rikteksten** er et ProseMirror-dokument, redigert med TipTap som i Slaids.
Tillatt er avsnitt, linjeskift, punkt- og nummererte lister, fet, kursiv,
understreket, senket og hevet skrift, lenker (bare `http(s)`) og siteringer.
Alt leses gjennom `rensDokument` før det vises.

**Redigeringen.** Administratorer får knappen «Rediger». Knappene for å endre
vises først når utkastet er hentet, og alt lagres som utkast mot revisjonen
som ble lest; en konflikt stanser lagringen og sier fra. Koblingen til
legemiddeldataene, hvert datakort, rikteksten i tekstpanelene og tabellen kan bare stå én gang i
panelet sitt (`ENKELTELEMENTER`). Databasen håndhever det med en unik indeks,
så to som oppretter det samme kortet samtidig, ikke begge får det lagret —
den andre får en konflikt.
Første gang noe lagres på en kode uten side, opprettes informasjonssiden og
laboratorieanalytten av katalogens opplysninger; sider med samme navn som
finnes fra før — for eksempel en komponent — gjenbrukes. På en stoffside uten
kode opprettes bare informasjonssiden, med navnet fra adressen. «Publiser endringene»
viser hva som blir synlig, og publiserer i den rekkefølgen databasen krever
(`publiseringsplan`): referanser, komponentsider, hovedsiden, analytten,
elementene, og til sist regelsettet, med feltene som er endret i det.

Et objekt kan ikke slettes. Et kort som fjernes, flyttes derfor til panelet
`fjernet`: det vises ikke, søkes ikke i og nummereres ikke, men står i
historikken og kan hentes tilbake.

**Søket** (`sok.ts`) er bygd for begge søkene i planen. `indekserSide` gjør én
side om til søkedokumenter — navn, kode, aliaser, komponenter, preparatene og
interaksjonene fra legemiddeldataene, overskrifter, verdier, tabellrader,
fritekst og referanser — hver med stedet den står (side › panel › kort).
`sok` rangerer dokumentene og lager utdrag. Søket på siden bruker indeksen til
å vise hvor treffene står, og fremhever dem i teksten — også i lukkede
seksjoner, som åpnes når brukeren går til et treff der.

**Rangeringen** er fast og forklarbar, uten uklar likhetssøk. Alle ordene i
søket må treffe; æ, ø og å leses som a, o og a, og aksenter og store
bokstaver teller ikke. Først avgjør feltet, i planens rekkefølge
(`docs/ux-reimagination.md`, 6.2): stoffnavn og kode, så alias og komponent,
preparatnavn, overskrifter, verdier og tabeller, fritekst og til sist
referanser. Innen samme felt kommer en tekst som begynner med søket foran en
der søket begynner et ord, og den foran en der det står inne i et ord. Ellers
står treffene i sidens rekkefølge.

**Søket i hele kunnskapsbasen** (`globaltSok.ts`) indekserer alle de
publiserte sidene med den samme `indekserSide`, så det finner det samme som
søket på hver side. Lesingen er fire kall uansett antall sider:
`les_analyttsider` gir alle sidene på samme form som `les_analyttside`, med
referansene én gang, og `les_stoffsider` stoffsidene uten kode på samme form; `les_legemidler` gir legemiddeldataene for alle
koblingene, og hver side får sin del av dem (`utvalgFor`); `les_interaksjoner`
gir interaksjonene, delt i flere kall bare om nøklene er flere enn databasen
tar imot. Kan ikke legemiddeldataene leses, indekseres faginnholdet likevel,
og kan ikke stoffsidene uten kode leses, indekseres resten.
`sokGlobalt` gir det beste treffet per sted, og lar ord som ikke står i
teksten, stå i navnet eller koden til siden: «sertralin metabolisme» finner
kortet «Metabolisme» på sertralinsiden. Aliasene til kodene gis av appen fra
analyttkatalogen. Deler flere koder én side, indekseres siden én gang. Appen
gir også alle kodene i katalogen: en kode som ingen publisert
informasjonsside viser, har likevel en analyttside (med fortolkningsreglene),
og indekseres med navnet og komponentene fra katalogen, som siden viser.

Hvert treff har stedet det står: siden, seksjonen, ankeret på siden og — når
teksten står i et detaljkort — nøkkelen til kortet. `sokeadresse` gjør stedet
om til direktelenken, `#/analytt/<KODE>/<seksjon>/<kort>`, eller
`#/stoff/<navn>/<seksjon>/<kort>` for et stoff uten kode (se
`docs/seksjoner.md`). En stoffside uten kode indekseres under navnet, og
treffet viser «Stoffside uten labkode» der de andre viser koden og metoden.

**Fagsøket** i toppmenyen (`src/components/sok/`) bruker dette uten egen
rangering. Indeksen hentes når appen har tid til overs etter at den er
åpnet (`useNaarLedig`), eller første gang noen søker før det
(`useSokeindeks`), og hentes på nytt neste gang når en administrator går ut
av en stoffside, der noe kan være publisert. Det kan søkes før alt er
hentet: `lesSokeindeks` gir først en indeks over katalogen, så over
faginnholdet på sidene, og til sist med preparatene, interaksjonene og
ClinPGx, som er det tregeste å hente. Hentingen går i bakgrunnen og står
ikke i lasteindikatoren (`src/auth/aktivitet.ts`); søket viser selv at mer
er på vei. Utdraget til et treff lages først når treffet vises, så et kort
søk som treffer det meste, ikke blir tregt. `treffgruppe` deler treffene i
stoff, preparater, tekst og referanser, i rangeringens rekkefølge;
`treffvisning.ts` lager tittelen, stien og utdraget. Rullegardinen viser de
første treffene, og søkesiden (`#/sok?q=…`) alle, gruppert og med filter.
En referanse står på siden selv, så den vises som egen gruppe bare når
siden ikke alt er med som stoff.

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

**Referanseområder og TDM.** `supabase/import/tdm/` bygger på tre kilder:
sluttrapporten fra referanseområdeprosjektet (2008), Helland mfl. om
vanedannende legemidler (Tidsskriftet 2016) og Frost mfl. om
sentralstimulerende legemidler (Tidsskriftet 2019), og prøvetakingen per
legemiddelform (depotinjeksjon, depottabletter) fra fortolkningskommentarene i FAR. Filene har samme form som
psykofarmakafilene, pluss `kilde` (hva revisjonene sier de er importert fra,
i stedet for dokument og sider, som da kan utelates) og panelet `tdm`. Den importen *utvider*
sidene (`finnesFraFor = 'utvid'` i `importSql`): en side som mangler, lages;
et kort som mangler (samme panel, type og tittel), legges til; et
referanseområde med nøyaktig de samme tallene får kildene det mangler; og et
referanseområde med andre tall røres ikke, men meldes. Verdier som avviker fra
det som står på sidene, rettes altså aldri av importen — de avgjøres av en
fagperson og rettes for seg. `npx vite-node scripts/importer-tdm.ts --
<brukernavn> <mappe>` lager migrasjonene.

**Stoffsider uten kode.** `supabase/import/stoffsider/` har stoffene de samme
kildene gir anbefalinger for, men som appen ikke har noen analyttkode for:
antiepileptika, sertindol og litium fra rapporten, ketobemidon, petidin og
flunitrazepam fra Helland mfl., og atomoksetin og metylfenidat fra Frost mfl.
(de nasjonale områdene fra 2019, med rapportens tidligere område i
grunnlaget). Filene har `side` (navnet på siden) i stedet for `kode`; importen
lager da bare informasjonssiden, og en fil med navnet til en side i katalogen
avvises. Den utvider en side som finnes, som TDM-importen. `npx vite-node
scripts/importer-stoffsider.ts -- <brukernavn> <mappe>` lager migrasjonene
(`src/faginnhold/stoffsider.ts`). Indikasjonene deres står for seg i
`supabase/import/indikasjoner/` (bare `indikasjon`, sammendraget av
preparatomtalene i Felleskatalogen med dem som referanser). Filene legges inn
i omganger (`INDIKASJONSIMPORTER` i `src/faginnhold/indikasjoner.ts`), hver
med sin migrasjon og datoen de ble hentet, så en ny omgang ikke endrer
migrasjonene som er kjørt: `scripts/importer-indikasjoner.ts -- <brukernavn>
<migrasjon> <mappe>`. En fil kan gjelde en side med analyttkode (`kode`), som
amfetaminsiden (AMF1), med indikasjonene for deksamfetamin og
lisdeksamfetamin. Et indikasjonskort som alt står på siden, røres ikke. Har
Felleskatalogen ingen preparatomtale for stoffet, sier kortet det.

**Rettinger.** En feil i det som ble importert, rettes med en rettingsfil i
`supabase/import/rettinger/`: kilden, og per retting koden, raden slik den
står, feltene som endres (eller `null` for å ta bort raden) og hvorfor.
`npx vite-node scripts/lag-rettinger.ts -- <brukernavn> <fil> <utfil>` lager
migrasjonen. Bare en rad som står nøyaktig som oppgitt, rettes; hver retting
blir en ny, publisert revisjon med «Rettet etter <kilde>: <hvorfor>» i
historikken, og en tabell som blir tom, tas bort fra siden. Importdatasettet
røres ikke: det viser hva som ble importert.

**Oppdateringer etter en nyere kilde.** Når en nyere kilde gir andre verdier
eller ny kunnskap, føres den inn med en oppdateringsfil i
`supabase/import/oppdateringer/`: kilden, referansene den bruker (en som
mangler, legges inn), og per oppdatering siden (`kode` eller `side`), panelet,
kortet (datakorttypen, eller overskriften i et kortpanel), innholdet slik det
står (`fra`), det nye (`til`, eller `null` for å ta kortet bort), kildene som
legges til først og tas bort, og hvorfor. `npx vite-node
scripts/lag-kortoppdateringer.ts -- <brukernavn> <fil> <utfil>` lager
migrasjonen. Som for rettingene oppdateres bare et kort som står nøyaktig som
oppgitt og ikke har et upublisert utkast, med «Oppdatert etter <kilde>:
<hvorfor>» i historikken, og importdatasettene røres ikke. Den første gjelder
de felles nasjonale referanseområdene for antiepileptika (Reimers mfl.,
Tidsskr Nor Legeforen 2017): områdene for topiramat og okskarbazepin,
grunnlaget på alle antiepileptikasidene og lamotrigin, og området for
klonazepam ved epilepsi.

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

**Flyttall.** Supabase-prosjektet skriver flyttall med 15 gjeldende sifre
(`extra_float_digits = 0`), og øyeblikksbildet — som også det publiserte
skrives av — får da bare 15. Et `les_<type>` som gjør `float8` om til JSON,
skal derfor ha `set extra_float_digits = 1`, som gir den korteste eksakte
skrivemåten. Testdatabasen har samme innstilling som prosjektet.

**Nytt felt på en type.** Revisjonene endres aldri, så eldre øyeblikksbilder
mangler feltet. `skriv_<type>` må tåle det — med en standardverdi, f.eks.
gjennom `intern.med_standard` — ellers kan de eldre revisjonene ikke
gjenopprettes. Det feiler i så fall høylytt, ikke i stillhet.

**Testene** kjører alle migrasjonene i en Postgres i minnet (PGlite), med det
Supabase har på plass fra før gjenskapt i `testdatabase.ts`: API-rollene,
standardrettighetene deres i `public`, `auth.uid()` og tabellene migrasjonene
bygger på. Bruker en ny migrasjon noe mer fra Supabase, utvides grunnlaget
der.
