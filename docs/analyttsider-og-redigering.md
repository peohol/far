# Plan: analyttsider, redigerbart faginnhold og fortolkningsregler

Denne planen beskriver overgangen fra dagens hovedsakelig statiske/hardkodede faginnhold til et redigerbart, kildebelagt og fullt versjonert kunnskapssystem i OUSFAR.

Planen skal brukes som fremdriftssporing. Arbeidspakkene nederst krysses av etter hvert som de er ferdige.

> **Kursendring 23.09.2026.** Preparatnavn og andre legemiddelgrunndata skal ikke lenger kopieres for hånd fra Felleskatalogen. De hentes fra autoritative offentlige legemiddeldata (FEST via Helsedirektoratets HAPI, DMP FHIR eller en kombinasjon) og synkroniseres til en egen, lokal kopi i Supabase (del 23). Stoffsidene går samtidig over til progressiv detaljering: hovedseksjoner som trekkspill med minioppsummering, og detaljkort inne i dem (del 24). Klinisk kuratert innhold forblir OUSFAR-redigert og versjonert.
>
> Der eldre deler av planen sier noe annet, gjelder del 23–25. Erstattede deler er merket **Erstattet**. Arbeidspakke 4 er revidert, og arbeidspakke 8–13 er nye. Del 25 sier hvordan de åpne PR-ene og øktene skal tilpasses.

## Status

- [x] Supabase er etablert.
- [x] Brukersystem med profiler og roller er etablert.
- [x] Arbeidspakke 1: fundament for redigerbart faginnhold.
- [x] Arbeidspakke 2: referansesystem.
- [x] Arbeidspakke 3: analyttsider og navigasjon.
- [ ] Arbeidspakke 4: import av psykofarmakainnhold (revidert 23.09.2026, omarbeides).
- [ ] Arbeidspakke 5: enkle kommentarer og konsentrasjonsregler.
- [ ] Arbeidspakke 6: sammensatte analyttgrupper.
- [ ] Arbeidspakke 7: THC-syre (motor og lagring ferdige; editor og simulator i arbeidspakke 13).
- [ ] Arbeidspakke 8: kartlegging av offentlige legemiddeldatakilder.
- [x] Arbeidspakke 9: seksjoner og detaljkort (progressiv detaljering).
- [ ] Arbeidspakke 10: ekstern legemiddelgrunnmur (lokal kopi og synkronisering).
- [ ] Arbeidspakke 11: preparater fra eksterne data, ende til ende.
- [ ] Arbeidspakke 12: flere legemiddeldata der kildene er gode nok.
- [ ] Arbeidspakke 13: regelvisninger og simulatorer i seksjonsarkitekturen.

---

## 1. Mål

OUSFAR skal utvikles fra et fortolkningsverktøy med innhold i kode og statiske datafiler til et internt farmakologisk kunnskaps- og beslutningsstøttesystem der:

- hver analytt har en egen informasjonsside
- fortolkningskommentarer og etter hvert fortolkningsregler lagres i Supabase
- faglig innhold kan redigeres direkte i UI
- endringer er versjonerte, attribuert til bruker og reversible
- innhold kan kildebelegges på flere nivåer
- referanser lagres sentralt og gjenbrukes på tvers av appen
- fortolkningsmodulene bruker samme publiserte datagrunnlag som redigeringsgrensesnittet
- søk fungerer både på én analyttside og på tvers av hele kunnskapsbasen

Arbeidet skal bygges trinnvis. Enkle konsentrasjonsregler, sammensatte rusmiddelregler og THC-syre skal ikke presses inn i én felles regeleditor.

---

## 2. Domenemodellen må skille tre begreper

Dette skillet er grunnleggende og må ligge i fundamentet.

### 2.1 Informasjonsside / virkestoff

Dette er siden brukeren leser om, for eksempel:

- Amitriptylin
- Nortriptylin
- Sertralin
- Risperidon

Siden inneholder farmakologi, preparatnavn, dosering, referanseområder, kommentarer osv.

### 2.2 Laboratorieanalytt

Dette er det laboratoriet faktisk analyserer og rapporterer, med kode som `AMTNORSUM`, `NOR`, `KVE` osv.

Én laboratorieanalytt kan representere flere kjemiske komponenter.

Eksempel:

- `AMTNORSUM`: hovedside = Amitriptylin; analysen omfatter amitriptylin + nortriptylin.
- `NOR`: hovedside = Nortriptylin.

Datamodellen skal derfor ikke anta at «én analyttkode = ett virkestoff».

For sumanalyser skal siden kunne opplyse hvilke komponenter analysen omfatter og lenke til andre relevante informasjonssider.

### 2.3 Fortolkningsmodul

Dette er logikken som bestemmer hvilken eller hvilke kommentarer som skal brukes.

For enkle analytter svarer én fortolkningsmodul omtrent til én laboratorieanalytt. For andre gjør den ikke det.

Eksempel: diazepam, N-desmetyldiazepam og oksazepam har egne analyttkoder og informasjonssider, men inngår i felles fortolkningslogikk.

---

## 3. Navigasjon

### Sidemenyen

Analyttoppføringene i venstremenyen skal etter hvert åpne informasjonssiden for analytten, ikke starte samme fortolkningsflyt som hovedsøket.

Eksisterende inndeling etter analysemetode og kategori beholdes.

Hovedsidens søk kan fortsatt være inngangen til fortolkningsarbeidsflyten.

### Fra fortolkningsmodulen

Analyttkodepillene gjøres klikkbare.

Eksempel:

`AMTNORSUM` -> informasjonssiden for AMTNORSUM/Amitriptylin.

For moduler som omfatter flere koder, skal hver kode kunne føre til sin egen informasjonsside.

### Fra informasjonssiden

Siden bør ha en sekundær handling «Åpne fortolkning» slik at det er enkelt å gå begge veier.

Alle informasjonssider bør ha egne URL-er slik at de kan bokmerkes og åpnes direkte.

---

## 4. Oppbygning av informasjonssiden

Innholdet i panelene under beholdes, men vises fra arbeidspakke 9 som **hovedseksjoner** i modellen for progressiv detaljering (del 24): lukket med en minioppsummering, åpnet med innholdet og eventuelle detaljkort. «Panel» og «hovedseksjon» betyr det samme i resten av planen. Preparatene blir en egen hovedseksjon med data fra de eksterne kildene (del 23).

### Panel 1 - Identitet

Vis:

1. Analyttkode som pille.
2. Legemiddelkategori som pille, med samme kategorier som dagens sidemeny.
3. Virkestoff/analyttnavn som hovedoverskrift.
4. ~~Preparatnavn, alfabetisk sortert.~~ **Erstattet 23.09.2026:** preparatene vises i hovedseksjonen «Preparater», med data fra de eksterne kildene, gruppert som legemiddelform → preparat → styrker (del 23 og 24).

~~Preparatnavn skal lagres som strukturerte enkeltoppføringer, ikke som én kommaseparert fritekst.~~ **Erstattet:** preparatnavn er ikke lenger et manuelt redigerbart element (`{ navn: string[] }`). De er strukturerte rader i den synkroniserte kopien av kildedataene.

Identiteten og kritiske varsler skjules ikke i en lukket seksjon.

For sumanalyser skal sammenhengen mellom kode og komponenter forklares tydelig uten å gjøre alle komponentene til hovedanalytt.

### Panel 2 - Viktige data

Panelet skal ligge høyt og være laget for rask avlesning.

Separate datakort for:

- Referanseområde
- Toksisk område
- Alvorlig/dødelig intoksikasjon, når oppgitt
- Halveringstid, t1/2
- Tid til steady state, t_ss

Verdiene skal så langt kildene tillater det lagres som strukturerte data, ikke fritekst.

Et område bør eksempelvis kunne representeres med nedre grense, øvre grense og enhet. Forbehold lagres separat.

### Panel 3 - Farmakodynamikk

Fritekst med begrenset riktekstformatering og referanser.

### Panel 4 - Dosering

Fritekst med begrenset riktekstformatering.

### Panel 5 - Indikasjon

Kortfattet redaksjonell oppsummering av de godkjente indikasjonene.

Hvis ulike preparater har ulike indikasjoner, skal dette representeres korrekt.

**Revidert 23.09.2026:** indikasjonssammendraget er OUSFAR-redigert klinisk innhold, med vanlige kildehenvisninger og vanlig revisjonshistorikk, som annen riktekst. Det har ingen egen «sist kontrollert mot Felleskatalogen»-dato. Sammendragene som ble skrevet i arbeidspakke 4, beholdes der de er faglig nyttige. Gir de eksterne kildene senere strukturerte indikasjoner eller lenker til preparatomtalen (arbeidspakke 8 og 12), vises de ved siden av sammendraget, ikke i stedet for det.

### Panel 6 - Farmakokinetikk

Underkategoriene fra `originaldata/Psykofarmaka.pdf` representeres som separate kort slik at hvert element kan redigeres og kildebelegges separat.

### Panel 7 - Serumkonsentrasjoner ved ulike doser

Dette bør lagres som strukturert tabell/data, ikke som én stor riktekst:

- dose
- doseringsregime
- serumkonsentrasjon
- eventuelle betingelser/merknader

---

## 5. Redigeringsmodell

Siden skal normalt være i lesemodus.

Redigerbare felt og kort får diskrete redigeringshandlinger. UI skal fortsatt først og fremst fremstå som et oppslagsverk, ikke et administrasjonspanel.

### Fritekst

Bruk samme grunnteknologi som i Slaids der det passer.

Relevant formatering:

- fet
- kursiv
- eventuelt understreking
- senket/hevet skrift
- punktliste
- nummerert liste
- lenke
- symboler
- referanser

Ikke gi fri kontroll over fontstørrelse, farger eller justering. Vanlig fritekst skal være venstrejustert og visuelt konsistent.

### Fortolkningskommentarer

Kommentarer som kopieres til laboratoriesystemet skal fortsatt være ren tekst.

Formatering, referanser og historikk vises rundt kommentaren i OUSFAR, men følger ikke med ved kopiering.

---

## 6. Referansesystem

Slaids brukes som modell.

Hovedprinsippet er:

- en referanse lagres én gang med stabil ID
- siteringer lagrer referanse-ID-er, aldri synlige nummer
- nummereringen beregnes dynamisk ved visning

### Global referansebase

Én referanse lagres ett sted i Supabase og kan brukes:

- flere steder på samme side
- på flere kort/paneler
- på flere analyttsider

Redigering av referansen oppdaterer visningen overalt den brukes.

Formatet skal følge Slaids:

**Tittel · Forfatter(e) · År · Lenke**

DOI, PMID eller andre identifikatorer kan senere lagres som egne metadata uten å endre visningsformatet.

### Nummerering

Nummeret lagres aldri på selve referansen.

På hver analyttside beregnes nummereringen etter første forekomst på akkurat den siden.

Samme kilde kan derfor være referanse 2 på én side og referanse 7 på en annen.

Rekkefølgen må være deterministisk etter faktisk leseorden:

panelrekkefølge -> kortrekkefølge -> forekomst i innholdet.

### Referansepiller

Vis som i Slaids, for eksempel:

`1-3, 5, 9-11`

visuelt som superscript/pille. Sammenhengende serier på minst tre komprimeres til intervall.

Popover må fungere både med hover og klikk/trykk/tastatur.

### Referanser på flere nivåer

Standardiser tre nivåer:

1. Inline i riktekst.
2. På et kort/innholdselement.
3. På et helt panel når det faktisk er naturlig.

### Dynamisk referanseliste

Nederst på siden genereres automatisk en liste over alle referansene som faktisk brukes på siden, i samme rekkefølge som de dynamiske numrene.

Listen redigeres aldri manuelt.

### Referansemodul

Den globale modulen bør vise:

- alle referanser
- søk
- hvilke sider referansen brukes på
- antall forekomster
- redigering
- historikk

En referanse som er i bruk skal ikke hard-slettes. Den må først kobles fra eller arkiveres.

---

## 7. Versjonering og sporbarhet

Dette skal være en grunnfunksjon i datamodellen.

### Sist redigert

Ved hvert redigerbart element vises diskret:

**Sist redigert av Ola Nordmann 22.09.2026 kl. 14:32**

Et trykk åpner historikken for akkurat dette elementet.

### Endringsvisning

Modalen skal minst ha to visninger:

1. Forrige og gjeldende versjon side om side.
2. Diff-visning med slettet innhold rødt/gjennomstreket og nytt innhold grønt.

Strukturerte data skal få strukturert diff fremfor å bli tvunget inn i tekstlig diff.

### Full historikk

Hver revisjon inneholder minst:

- tidspunkt
- stabil bruker-ID
- brukerens navn slik det var på endringstidspunktet
- type handling
- komplett snapshot av objektet etter endringen
- eventuell kobling til revisjonen den ble gjenopprettet fra

Komplette snapshots foretrekkes fremfor å være avhengig av en kjede av små differanser. Dataene er små, og gjenoppretting blir tryggere.

### Gjenoppretting

«Gjenopprett denne versjonen» lager en ny revisjon.

Senere historikk slettes aldri.

For regelsett skal hele regelsettet gjenopprettes atomisk.

---

## 8. Beskyttelse mot samtidig redigering

Flere brukere kan åpne samme innhold samtidig. En gammel nettleserøkt må ikke kunne overskrive nyere endringer lydløst.

Hvert redigerbart objekt skal derfor ha et revisjonsnummer eller tilsvarende versjonsmarkør.

Lagring skal bare lykkes dersom klientens forventede revisjon fortsatt er gjeldende.

Ved konflikt skal brukeren få beskjed om at innholdet er endret i mellomtiden og kunne sammenligne før ny lagring.

---

## 9. Kommentarer og enkle konsentrasjonsregler

Dagens psykofarmakakommentarer basert på konsentrasjonsbånd blir første redigerbare regeltype.

### UI

Reglene vises som en ordnet serie intervaller, eksempelvis:

| Konsentrasjon | Kommentar | Ekstra handling |
| --- | --- | --- |
| < 10 | ... | |
| 10 til < 1800 | ... | |
| >= 1800 | ... | Ring rekvirent |

Hvert intervall kobles til en kommentar.

### Tilsluttende intervaller

Brukeren skal ikke redigere både øvre grense på én rad og nedre grense på neste uavhengig.

Man redigerer selve skillepunktet mellom intervallene.

Da kan UI garantere at det aldri oppstår hull.

Datamodellen bør bruke en entydig matematisk konvensjon, eksempelvis:

- nedre grense inkludert
- øvre grense ekskludert
- første og siste intervall har åpen ende

Dette fjerner intern avhengighet av presentasjonsdetaljer som «1799» versus «1800».

### Validering

Et regelsett kan ikke publiseres dersom:

- intervaller overlapper
- et område mangler
- grensene ikke er stigende
- et intervall mangler kommentar
- nødvendig enhet eller annen parameter mangler

Validering skal også ligge server-side.

---

## 10. Kommentar og regel er ulike objekter

En kommentar er teksten.

En regel beskriver når teksten brukes.

De skal ikke være samme databaseobjekt.

Dette gjør at én kommentar kan gjenbrukes av flere regler uten å dupliseres.

Eksempel: dagens «Til stede under cut-off» består av en innledning pluss den ordinære kommentaren for innenforområdet. Dette bør modelleres eksplisitt som sammensatt utdata fremfor å lagre en nesten identisk kopi av hele kommentaren.

På samme måte bør «ring rekvirent» være en egenskap/handling ved en regel, ikke være bakt inn i hvordan selve intervallet lagres.

---

## 11. Sammensatte analytter og felles fortolkning

Dette får en egen arbeidspakke.

Dagens kode viser flere ulike problemtyper:

- Diazepam/N-desmetyldiazepam/oksazepam: påvist-status + 10 %-grense.
- Tramadol/O-desmetyltramadol: kommentarplassering avhenger av hvilke som er påvist.
- Kodein/morfin: forholdstall avgjør mellom flere utfall, inkludert eksplisitt gråsone uten standardkommentar.
- Amfetamin/metamfetamin: ulik hoved-/tilleggskommentar når begge er påvist.

Det bør ikke bygges én generell visuell programmeringseditor for alt dette i første omgang.

### Anbefalt UI-modell

Representer slike regelsett som scenarier.

Eksempel:

**Scenario: alle tre påvist og OXA <= 10 % av DIAZ + DMI**

Vilkår:

- DIAZ påvist
- DMI påvist
- OXA påvist
- OXA / (DIAZ + DMI) <= 0,10

Resultat:

- hovedkommentar X -> DIAZ
- tilleggskommentar Y -> DMI og OXA

### Trinnvis overgang

1. Flytt kommentarene til Supabase og gjør tekstene redigerbare.
2. Behold kompleks valglogikk i kode midlertidig.
3. Vis reglene på analyttsiden i lesbar form.
4. Lag spesialiserte editorer for regelparametrene senere.

### Test regelen

Komplekse regler bør ha en innebygd simulator:

- velg påviste analytter
- legg inn eksempelverdier
- se hvilke kommentarer som ville blitt valgt
- se hvor kommentarene ville blitt plassert

Samme prinsipp bør etter hvert brukes på enkle konsentrasjonsregler.

---

## 12. THC-syre

THC-syre holdes utenfor første regelredigeringsprosjekt.

Her inngår blant annet:

- prøvetidspunkter
- kreatininkorrigerte verdier
- tidligere prøve
- bruksmønster
- utskillelseskurver
- terskelvurderinger
- dynamisk sammensatte kommentarer

Dette er en egen regelmotor.

Analyttsiden kan opprettes tidligere, men redigering av THC-reglene skal få egen arbeidspakke/PR.

---

## 13. Utkast og publisering

Innhold som påvirker fortolkningen skal ikke nødvendigvis tre i kraft idet en bruker trykker «Lagre».

Minst følgende bør støtte:

**Utkast -> Publisert**

Dette gjelder særlig:

- kommentarer
- regler
- grenseverdier
- annet innhold som fortolkningsmodulene bruker direkte

Brukeren skal kunne redigere og teste uten at aktive fortolkninger straks bruker det nye innholdet.

Ved publisering vises en kort oppsummering av endringene.

Regler kan bare publiseres når all validering passerer.

Dersom full utkast/publisering senere viser seg unødvendig tungt for rent oppslagsinnhold, kan den begrenses til klinisk operativt innhold.

---

## 14. Roller og rettigheter

Dagens system har rollene `user` og `admin`.

Første modell:

- `user`: kan lese publisert innhold
- `admin`: kan redigere og publisere

Hvis fagpersoner senere skal redigere uten å administrere brukere, kan en egen `editor`-rolle innføres.

Rettigheter skal håndheves server-side/Supabase, ikke bare i UI.

---

## 15. Import av Psykofarmaka.pdf

`originaldata/Psykofarmaka.pdf` skal behandles som en kontrollert datamigrering.

Arbeidsflyt:

1. Render PDF-en side for side.
2. Ekstraher tekst og tabellstruktur maskinelt.
3. Koble hvert legemiddel til riktig informasjonsside.
4. Map underoverskrifter og felter til den nye strukturen.
5. Sammenhold tall, områder, enheter, symboler og tabeller visuelt mot de renderte sidene.
6. Bygg et maskinlesbart importdatasett.
7. Valider importdatasettet.
8. Legg det inn som første versjon i Supabase.

Den renderte PDF-siden er fasit dersom tekstuttrekk og visuell side er uenige.

Første revisjon bør så langt mulig vise:

**Importert fra Psykofarmaka.pdf**

med kilde og side/posisjon.

---

## 16. Felleskatalogen

**Erstattet 23.09.2026** av del 23 (eksterne legemiddeldata).

Den opprinnelige planen var å hente preparatnavn og indikasjoner for hånd fra Felleskatalogen, lagre dem som vanlig redigerbart innhold og vise datoen de sist ble kontrollert. Den modellen brukes ikke lenger:

- Permanente preparatnavnlister kopiert fra Felleskatalogen bygges ikke.
- «Sist kontrollert mot Felleskatalogen» er ikke en vedlikeholdsmodell for preparatnavn. Aktualiteten er tidspunktet for siste vellykkede synkronisering fra kilden.
- Preparatnavn og andre legemiddelgrunndata kommer fra autoritative, strukturerte kilder, synkronisert server-side.

Det som består: indikasjonssammendragene er redaksjonelt klinisk innhold (panel 5). Felleskatalogen kan fortsatt siteres som referanse, som enhver annen kilde.

---

## 17. Søk

Det skal finnes to forskjellige søk.

### Søk på siden

Finner tekst i den åpne analyttsiden og fremhever treff.

Søket indekserer innholdet, ikke det som tilfeldigvis er åpent på skjermen. Treff i lukkede seksjoner og detaljkort finnes derfor også. Når brukeren går til et treff, åpnes riktig hovedseksjon og eventuelt riktig detaljkort, og siden ruller til treffet og markerer det (del 24). Eksterne data på siden, som preparatnavn og styrker, er med i søket.

### Søk i hele kunnskapsbasen

Søker minst i:

- analyttnavn
- laboratoriekoder
- aliaser
- preparatnavn (fra de eksterne dataene)
- paneloverskrifter
- fritekstinnhold
- eventuelt kommentarinnhold

Treff bør peke til riktig nivå, for eksempel:

**Sertralin -> Farmakokinetikk -> Metabolisme**

med relevant tekstutdrag og direkte navigasjon.

---

## 18. Konseptuell datamodell

Endelig SQL bestemmes ved implementering, men domenet skal minst kunne representere følgende som separate konsepter:

| Objekt | Ansvar |
| --- | --- |
| Informasjonsside/virkestoff | Den kliniske siden brukeren leser |
| Laboratorieanalytt | Kode, måleegenskaper og kobling til hovedside |
| Analyttkomponent | Hvilke stoffer en sumanalyse faktisk omfatter |
| Fortolkningsmodul | Hvilke analyttkoder som behandles i samme logikk |
| Innholdselement | Kort, felt eller fritekst på analyttsiden |
| Kommentar | Ren tekst som kan kopieres |
| Regelsett | Samlingen av regler som avgjør kommentarvalg |
| Regel | Ett intervall/scenario og dets utdata |
| Referanse | Én global kilde med stabil ID |
| Referansekobling | Kobler kilde til innholdselement |
| Revisjon | Historisk snapshot av et redigert logisk objekt |
| Hendelse | Opprettet, endret, publisert, gjenopprettet osv. |

Eksterne legemiddeldata (del 23) er et eget lag ved siden av dette, med minst:

| Objekt | Ansvar |
| --- | --- |
| Eksternt kildeobjekt | Én rad per substans, legemiddel, pakning osv. fra kilden, med kildens stabile ID, uendret slik den ble hentet |
| Synkroniseringskjøring | Når kilden sist ble hentet, om det lyktes, og hva som ble nytt, endret og utgått |
| Stoffkobling | Eksplisitt kobling fra en informasjonsside til én eller flere eksterne substans-ID-er, med rolle og hvem som bekreftet den |
| Lokalt tillegg / lokal skjuling | OUSFARs egne unntak, lagret for seg, aldri som endring av den importerte raden |

Tabellene bestemmes i arbeidspakke 10, ut fra det arbeidspakke 8 finner i de faktiske kildene, ikke ut fra antatte API-felter.

Unngå å redusere alt til én stor, uvalidert JSON-kolonne. Bruk strukturerte tabeller/kolonner for data med klare invarianter; JSON kan brukes der selve domenet faktisk er variabelt.

---

## 19. Det som egentlig er data, skal ikke gjemmes i fritekst

Strukturerte felt passer blant annet for:

- referanseområde
- toksisk område
- alvorlig/dødelig konsentrasjon
- halveringstid
- steady-state-tid
- preparatnavn, styrker og legemiddelformer (fra de eksterne dataene, del 23)
- konsentrasjonsintervaller
- serumkonsentrasjoner ved dose

Riktekst brukes til det som faktisk er prosa:

- farmakodynamikk
- farmakokinetiske forklaringer
- doseringsbeskrivelse
- indikasjonssammendrag

---

## 20. Migrering fra dagens hardkodede kommentarer

Bytt ikke datakilde i ett sprang.

Foreslått overgang:

1. Importer dagens kommentarer og regler til Supabase.
2. Behold dagens statiske data som fasit midlertidig.
3. Sammenlign automatisk resultatene fra dagens fortolkningskode med de nye databasebaserte reglene.
4. Test alle grenseverdier og verdier rett på hver side av grensene.
5. Når resultatene er identiske, byttes produksjonsmodulene til Supabase.
6. De gamle statiske kommentarene fjernes først etterpå.

---

## 21. Tester og sikkerhetsregler

Før et regelsett kan tas i bruk, skal systemet automatisk kontrollere minst:

- ingen hull mellom konsentrasjonsintervaller
- ingen overlapp
- korrekt behandling av eksakt grenseverdi
- gyldig enhet
- alle mulige tilfeller gir definert utfall eller eksplisitt «manuell vurdering»
- alle refererte kommentarer finnes
- ingen arkivert/deaktivert referanse brukes som aktiv kilde
- gjenoppretting gir et gyldig regelsett
- ny Supabase-motor gir samme resultat som dagens motor før overgang

Komplekse regelsett skal i tillegg ha testtilfeller som dekker alle grener.

---

## 22. Designprinsipper

Informasjonssiden skal primært fremstå som et oppslagsverk.

Derfor:

- redigeringskontroller er diskrete frem til de brukes
- kort med ett eller få tall bruker større, sentrert typografi
- prosa er mindre og venstrejustert
- eksisterende visuelle system beholdes
- analysemetode/kategori/analyttkode bruker eksisterende pillelogikk
- innhold organiseres i tydelige paneler/kort
- kilder, historikk og redigering er lett tilgjengelig uten å dominere siden
- siden viser ikke alt fullt ut samtidig: hovedseksjonene er trekkspill med minioppsummering, og detaljer ligger i detaljkort (del 24)

---

## 23. Eksterne legemiddeldata

*Ny 23.09.2026. Erstatter del 16.*

### Mål

OUSFAR bruker autoritative offentlige legemiddeldata som synkroniserte grunndata så langt det er faglig og teknisk fornuftig, i stedet for å kopiere dem for hånd.

Kandidatkildene er:

- Helsedirektoratets åpne legemiddeldata, hovedsakelig basert på FEST og oppgitt å oppdateres daglig, blant annet gjennom HAPI (legemidler, pakninger, virkestoff, ATC).
- DMPs FHIR-tjeneste med strukturert legemiddelinformasjon.

Vi bruker den kilden eller kombinasjonen som faktisk gir best og mest stabil dekning. Det avgjøres i arbeidspakke 8 ut fra faktiske svar og dokumentasjon, ikke på forhånd.

### Hva som hentes

Når kildene faktisk støtter det, og dataene har en plausibel nytte i OUSFAR:

- preparatnavn
- virkestoff/substans med stabile ID-er
- styrker
- legemiddelformer
- administrasjonsveier
- pakninger og pakningsstørrelser
- markedsstatus
- ATC
- lenker til preparatomtale/produktside
- reseptstatus
- byttbarhet
- deling, knusing, åpning og annen administrasjonsinformasjon
- andre relevante strukturerte grunndata
- strukturert interaksjonsinformasjon, dersom det finnes en egnet autoritativ kilde

Data tas ikke inn bare fordi de finnes.

### Hva som forblir OUSFAR-redigert

Klinisk kuratert innhold forblir redigert og versjonert i OUSFAR, med modellen i del 5–8 og 13: referanseområder, toksiske områder, klinisk dosering, farmakokinetiske og farmakodynamiske vurderinger, serumkonsentrasjoner, indikasjonssammendrag, kommentarer og fortolkningsregler. Unntak gjøres bare når det finnes en klart bedre autoritativ modell for et konkret felt, og det besluttes da for det feltet.

### Arkitektur

- **Ingen kall fra nettleseren til kildene.** Nettleseren leser bare den lokale kopien i Supabase.
- **Server-side synkronisering** til en lokal kopi i Supabase: kildens stabile ID på hver rad, kildedataene i strukturerte tabeller, og tidspunktet for siste vellykkede synkronisering.
- **Idempotent:** samme kildedata to ganger gir samme resultat. Nye, endrede og utgåtte produkter håndteres eksplisitt; et utgått produkt merkes som utgått, det slettes ikke lydløst.
- **Siste gyldige data beholdes** når kilden feiler eller svarer med noe ufullstendig. En feilet kjøring registreres, men erstatter ikke det som var.
- **Hemmeligheter** (API-nøkler og tjenestenøkkelen som skriver til databasen) finnes bare server-side, aldri i klienten eller i repoet.
- **Eget lag.** De eksterne dataene skrives ikke som revisjoner av det redaksjonelle faginnholdet (del 7) og går ikke gjennom utkast/publisering. Sporbarheten er kilden, kildens ID og synkroniseringskjøringen.
- **Lokale unntak**, hvis de blir nødvendige: `eksterne data + lokale tillegg − lokale skjulinger`. Tilleggene og skjulingene er egne, versjonerte OUSFAR-objekter. Den importerte originalraden muteres aldri.
- **Kildeangivelse** og lisensvilkår følges slik arbeidspakke 8 dokumenterer dem, og vises på siden der dataene brukes.

Hvor jobben kjører (for eksempel en planlagt serverfunksjon eller en planlagt jobb i Supabase), velges i arbeidspakke 10 ut fra kildenes størrelse, format og autentisering.

### Stabil kobling mellom stoffsider og eksterne data

Koblingen mellom en informasjonsside og de eksterne dataene er eksplisitt: informasjonssiden peker på én eller flere eksterne substans-ID-er, med en rolle. Den matches aldri bare på tekstnavn.

- Navnelikhet kan gi **forslag**, men en kobling tas i bruk først når en administrator har bekreftet den. Usikre koblinger gjøres ikke automatisk.
- **Salter og estere** (f.eks. hydroklorid, dekanoat) knyttes til siden for virkestoffet, med saltformen synlig på preparatet.
- **Metabolitter** (f.eks. nortriptylin fra amitriptylin, O-desmetylvenlafaksin fra venlafaksin) får bare preparater når metabolitten selv er et markedsført virkestoff, og da på sin egen side. Moderstoffets preparater vises ikke som metabolittens.
- **Sumanalyser** (f.eks. `AMTNORSUM`) viser preparatene for hovedsidens virkestoff. Komponentene har sine egne sider med sine egne preparater.
- **Kombinasjonspreparater og flere virkestoffer** vises på siden for hvert virkestoff de inneholder, tydelig merket som kombinasjon med de øvrige virkestoffene.
- **Samme virkestoff i flere former** grupperes etter legemiddelform (del 24).

## 24. Progressiv detaljering: seksjoner og detaljkort

*Ny 23.09.2026.*

Stoffsidene viser ikke alt innhold fullt ut samtidig. Én generell, gjenbrukbar modell brukes for hele siden:

1. **Hovedseksjon**, vist som en trekkspillskuff.
2. **Minioppsummering**, som alltid synes når skuffen er lukket.
3. **Utvidet innhold**, når skuffen åpnes.
4. **Detaljkort**, valgfrie, inne i den åpne skuffen, som selv kan åpnes.

Høyst to nivåer: hovedseksjon → detaljkort. Det bygges ikke dypere trekkspillhierarkier.

Eksempel:

`Preparater`
`12 preparater · 3 legemiddelformer · 6 styrker`

Åpnet:

- Tablett — 4 preparater · 10–75 mg
- Mikstur — …
- Injeksjon — …

Et åpnet detaljkort viser de konkrete preparatene, styrkene og eventuelt pakningene. Hovedregelen for preparater er `legemiddelform → preparat → styrker`, med pakninger og annen detaljinformasjon i detaljkortene.

### Bruk

Samme modell brukes for OUSFARs eget innhold og for de eksterne dataene: Viktige data, Dosering, Farmakodynamikk, Farmakokinetikk, Serumkonsentrasjoner, Fortolkning/regler, Preparater, og interaksjoner og andre dynamiske seksjoner når de kommer. Regelvisninger og simulatorer (arbeidspakke 5–7) bruker også denne modellen, ikke egne, store panelvarianter (arbeidspakke 13).

Identiteten (panel 1) og kritiske varsler skjules ikke.

### Krav

- **Minioppsummeringen** avledes av innholdet der det er mulig (antall, spenn, nøkkeltall), slik at den ikke kan bli stående utdatert.
- **Animasjon:** rask og diskret åpning og lukking, og ingen animasjon når brukeren har valgt redusert bevegelse (`prefers-reduced-motion`).
- **Adresser:** hver hovedseksjon og hvert detaljkort har en stabil adresse under sidens adresse (`#/analytt/<KODE>`). En direktelenke åpner riktig seksjon og eventuelt detaljkort og ruller dit.
- **Søk på siden** finner innhold i lukkede seksjoner og detaljkort, og åpner, ruller til og markerer treffet (del 17).
- **Referanser:** nummereringen følger fortsatt leseordenen (del 6), uavhengig av hva som er åpent eller lukket.
- **Redigering:** redigeringshandlingene ligger i den åpne seksjonen. Å gå til redigering av et element åpner seksjonen det står i.
- **Tastatur, mobil og skjermleser:** hovedseksjoner og detaljkort åpnes og lukkes med tastaturet, har riktig tilstand for skjermlesere (åpen/lukket, hva knappen styrer) og fungerer med berøring på små skjermer. Eksisterende hurtigtaster og kort-hopp bevares.
- **Lyst og mørkt tema** støttes som resten av appen.
- **Klinisk betydning endres ikke** når dagens sider flyttes over i modellen. Det er de samme dataene, vist på en ny måte.

## 25. Koordinering av pågående arbeid

*Ny 23.09.2026. Oppdateres når PR-ene slås sammen eller lukkes.*

### Felles regler

- **Migrasjoner som alt er kjørt i produksjon, endres aldri.** Alle migrasjonene i de åpne PR-ene under er kjørt mot produksjonsdatabasen, men ingen av dem er på `main` ennå. De skal inn på `main` byte-identiske. Endringer i data eller skjema som alt er i produksjon, gjøres med nye migrasjoner.
- **`20260923064740_revisjonskilde.sql`** ligger byte-identisk i #35 og #37. Den PR-en som slås sammen først, tar den inn; den andre beholder den identiske kopien (git slår dem sammen uten konflikt). Funksjonaliteten beholdes selv om #35 omarbeides.
- **Delte filer** som er identiske på flere grener, beholdes identiske til den første PR-en med dem er slått sammen. `src/domain/kommentarobjekt.ts` ligger i #33 og #38. Rettelsen i `src/hooks/useKortHopp.ts` (som alle grenene har) er tatt inn på `main` med denne revisjonen av planen, byte-identisk.
- **Denne planen** redigeres av flere grener. Ved konflikt: ta `main`s tekst og legg bare inn statusendringene for egen arbeidspakke.
- **Versjonsnummeret** settes når PR-en er klar til sammenslåing: neste ledige nummer over `main`, etter `docs/endringslogg.md`.
- **Ny panel-UI:** ingen nye, permanente panelvarianter bygges før seksjonsmodellen (arbeidspakke 9, del 1) er på `main`. Domenearbeid, lagring, validering, historikk og paritetstester fortsetter som før.

### De åpne PR-ene

| PR | Arbeidspakke | Hva | Vurdering | Rebase | UI-tilpasning |
| --- | --- | --- | --- | --- | --- |
| #38 | 5–7, felles | Kommentarobjektene | Fortsetter uendret | Ja, på `main` med denne planen og endringsloggen | Ingen UI |
| #37 | 5 del 1 | Intervallregelsettene i databasen, importen, pariteten | Fortsetter uendret | Ja, på `main`; planstatus etter reglene over | Ingen UI |
| #39 | 5 del 2 | Redigering, simulator og historikk for konsentrasjonsreglene | Fortsetter. Historikkvinduet er generelt og beholdes | Ja, etter #37 | Regelvisningen og simulatoren flyttes inn i seksjonsmodellen i arbeidspakke 13. Ikke utvid panelet videre |
| #33 | 6 del 1 | Scenariomotoren, regelsettene og simulatoren | Fortsetter | Ja, på `main` etter #38 | Scenarioregler og simulator flyttes inn i seksjonsmodellen i arbeidspakke 13. Ikke utvid panelet videre |
| #34 | 7 del 1 | THC-motoren, reglene og tekstene som data | Fortsetter uendret | Ja, etter #33 | Ingen UI |
| #36 | 7 del 2 | THC-regelsettet lagret i Supabase | Fortsetter uendret | Ja, etter #34 | Ingen UI. THC-editoren og -simulatoren bygges i seksjonsmodellen (arbeidspakke 13) |
| #35 | 4 | Psykofarmakainnholdet | Omarbeidet etter arbeidspakke 4 under; den gamle formen merges ikke | Ja, på `main` | Preparat- og kontrolldatovisningen fjernes; innholdet vises gjennom seksjonsmodellen når arbeidspakke 9 er på `main` |

**Rekkefølge:** denne planen først, så #38, deretter #33 og #37 (i hvilken som helst rekkefølge), #39 etter #37, #34 etter #33, og #36 etter #34. Den omarbeidede #35 kan slås sammen når den er grønn, uavhengig av de andre. Arbeidspakke 9 del 2 (flytting av dagens sider) flytter det som er på `main` når den starter; paneler som kommer senere, flyttes av eieren i arbeidspakke 13.

### Øktene

| Økt | Eier |
| --- | --- |
| «Kurskorrigering og plan» | Denne planen og koordineringen i del 25 |
| «Fullfør arbeidspakke 4» | Arbeidspakke 4 (omarbeidingen av #35) |
| «Arbeidspakke 5 – enkle regler» | Arbeidspakke 5 (#37, #39, del 3), og sin del av arbeidspakke 13 |
| «Arbeidspakke 6 – analyttgrupper» | Arbeidspakke 6 (#33), og sin del av arbeidspakke 13 |
| «Arbeidspakke 7 – THC-syre» | Arbeidspakke 7 (#34, #36), kommentarobjektene (#38), og sin del av arbeidspakke 13 |
| «Legemiddeldata fra offentlige kilder» | Arbeidspakke 8, 10, 11 og 12 |
| «Seksjoner og detaljkort» | Arbeidspakke 9 |

#38 (kommentarobjektene) drives av «Arbeidspakke 7 – THC-syre», som sist har arbeidet på den.

---

# Arbeidspakker

## Arbeidspakke 1 - Fundament for redigerbart faginnhold

**Status:** [x] Ferdig

Hvordan fundamentet er bygget, står i `docs/faginnhold.md`. Migrasjonen er rullet ut mot Supabase-prosjektet.

Mål: etablere domenemodellen og den tekniske infrastrukturen som senere innhold, referanser, regler og analyttsider skal bygge på, uten å migrere klinisk innhold ennå.

Omfang:

- [x] Modell for informasjonsside/virkestoff.
- [x] Modell for laboratorieanalytt.
- [x] Modell for analyttkomponenter/sumanalyser.
- [x] Modell for generelle redigerbare innholdselementer.
- [x] Versjonering/revisjonshistorikk med komplette snapshots.
- [x] Stabil bruker-ID + navn på endringstidspunktet i historikken.
- [x] Gjenoppretting som ny revisjon, aldri omskriving/sletting av historikk.
- [x] Optimistisk samtidighetskontroll slik at gammel versjon ikke kan overskrive ny.
- [x] Grunnlag for utkast/publisert tilstand.
- [x] Server-side tilgangskontroll bygget på eksisterende brukerroller.
- [x] Tester av RLS, revisjoner, gjenoppretting, samtidighetskonflikt og publisering.
- [x] Ingen eksisterende fortolkningsmodul skal endre klinisk oppførsel i denne arbeidspakken.

Avgrensning:

- Ikke bygg analyttsidene ennå.
- Ikke bygg referansesystemet ennå.
- Ikke importer `Psykofarmaka.pdf`.
- Ikke flytt dagens kommentarer til Supabase.
- Ikke bygg regeleditor.

## Arbeidspakke 2 - Referansesystem

**Status:** [x] Ferdig

Hvordan referansesystemet er bygget, står i `docs/faginnhold.md`. Migrasjonene er rullet ut mot Supabase-prosjektet, og pillen, boblen og listen brukes på analyttsidene.

- [x] Global referansebase med stabile ID-er.
- [x] Slaids-format for referanser.
- [x] Referansekoblinger til innholdselementer.
- [x] Inline-siteringer i riktekst.
- [x] Kort-/panelreferanser.
- [x] Sidebasert dynamisk nummerering etter første forekomst.
- [x] Komprimerte referansepiller.
- [x] Hover + klikk/trykk/tastatur-popover.
- [x] Dynamisk referanseliste nederst på siden.
- [x] Referansehistorikk.
- [x] Beskyttelse mot hard-sletting av referanser i bruk.

## Arbeidspakke 3 - Analyttsider og navigasjon

**Status:** [x] Ferdig

Hvordan sidene er bygget, står i `docs/faginnhold.md` under «Informasjonssidene». Sidene er tomme til innholdet legges inn: de viser koden, kategorien, navnet og komponentene fra de statiske datasettene, og resten fylles i arbeidspakke 4. Historikkvisningen med diff (del 7) er ikke laget; «Sist redigert» vises i redigeringsmodus.

- [x] Egne URL-er for analyttsider.
- [x] Venstremeny fører til informasjonssider.
- [x] Klikkbare analyttkodepiller i fortolkningsmodulene.
- [x] «Åpne fortolkning» fra informasjonssiden.
- [x] Panelstruktur 1-7.
- [x] Lesemodus/redigeringsmodus.
- [x] Begrenset rikteksteditor.
- [x] Panel-, kort- og inline-referanser med dynamisk nummerering og referanseliste.
- [x] Søk på siden.
- [x] Arkitektur for globalt søk.

## Arbeidspakke 4 - Psykofarmakainnhold

**Status:** [ ] Revidert 23.09.2026. Innholdet er ferdig i produksjonsdatabasen, og omarbeidingen er gjort der. PR #35 (omarbeidet) gjenstår å slå sammen.

Beholdes:

- [x] Render og kontroller `originaldata/Psykofarmaka.pdf`.
- [x] Bygg kontrollert importdatasett.
- [x] Importer antidepressiver, antipsykotika og lamotrigin: 35 sider og 103 referanser (i produksjonsdatabasen; ikke på `main` ennå).
- [x] Fyll panel 2–7 der kilden har data, koblet til riktige informasjonssider, også sumanalyser og komponenter.
- [x] Første revisjon peker tilbake til kilde/side der det er mulig, f.eks. «Importert fra Psykofarmaka.pdf, side 7» (`revisjonskilde`, som også brukes av annet arbeid og beholdes uendret).
- [x] Indikasjonssammendragene beholdes som redaksjonelt klinisk innhold (panel 5), med preparatomtalene i Felleskatalogen som referanser. FEST/HAPI gir ikke indikasjonstekst; arbeidspakke 8 bekrefter om noen av de eksterne kildene gjør det.

Erstattet (del 16 og 23):

- ~~Søk i Felleskatalogen for gjeldende preparatnavn.~~ Preparatene kommer fra de eksterne dataene (arbeidspakke 11).
- ~~Lagre kilder og dato sist kontrollert mot Felleskatalogen.~~ Aktualiteten er tidspunktet for siste synkronisering.

Omarbeidingen:

- [x] Den manuelle preparatnavnlisten og kontrolldatoen er fjernet fra koden, importdatasettet og visningen.
- [x] De 35 preparatnavnelementene og kontrolldatoene på indikasjonene er tatt bort i produksjonsdatabasen som nye, publiserte revisjoner med kilden «Tatt bort: preparatnavnene skal hentes fra offentlige legemiddeldata» (migrasjonen `psykofarmaka_kursendring`). De kjørte migrasjonene er ikke endret, og alt kan gjenopprettes fra historikken.
- [x] Ingen ny, permanent panel-UI; innholdet vises gjennom seksjonsmodellen (arbeidspakke 9).
- [ ] Alle migrasjonene som er kjørt i produksjon, er med byte-identiske når PR-en slås sammen.

Elementtypen for preparater og skjemaet for dem fra arbeidspakke 3 står fortsatt på `main`. De erstattes i arbeidspakke 11.

Til klinisk gjennomgang: avvikene mellom PDF-en og de statiske dataene (BREK, DOKSUM, LMP) og toksisk område lavere enn referanseområdet (KLOZ, PARO, MIASUM) er listet i PR #35 og ikke rettet.

## Arbeidspakke 5 - Enkle kommentarer og konsentrasjonsregler

**Status:** [ ] Ikke startet

- [ ] Kommentarobjekter i Supabase.
- [ ] Enkle intervalbaserte regelsett.
- [ ] Redigering av delte skillepunkter mellom intervallene.
- [ ] Ingen hull eller overlapp kan publiseres.
- [ ] Kommentar og regel lagres separat.
- [ ] Cut-off-logikken representeres uten duplisering av hovedkommentar.
- [ ] «Ring rekvirent» representeres som egen handling/egenskap.
- [ ] Regeltest/simulator.
- [ ] Historikk og gjenoppretting.
- [ ] Paritetstester mot dagens motor.
- [ ] Produksjonsmodulene bytter til Supabase først når paritet er dokumentert.

## Arbeidspakke 6 - Sammensatte analyttgrupper

**Status:** [ ] Ikke startet

- [ ] Redigerbare scenarioer.
- [ ] Påvist/ikke påvist-betingelser.
- [ ] Forholdstall/terskler.
- [ ] Hoved-/tilleggskommentarer og plassering.
- [ ] Eksplisitte manuelle/gråsoneutfall.
- [ ] Simulator for hele regelsettet.
- [ ] Migrer diazepamgruppen.
- [ ] Migrer tramadolgruppen.
- [ ] Migrer kodein/morfin.
- [ ] Migrer amfetamin/metamfetamin.

## Arbeidspakke 7 - THC-syre

**Status:** [~] Pågår. Motoren og lagringen er ferdige; editoren, simulatoren
og byttet av produksjonskilde gjenstår. Løsningen er beskrevet i
`docs/thc-syre.md`.

Egen spesialisert regelmotor/editor for:

- [x] terskelkurver
- [x] bruksmønster
- [x] prøveintervaller
- [x] kreatininkorrigerte verdier
- [x] dynamisk kommentarsammensetning
- [x] øvrige THC-spesifikke parametere
- [ ] simulator og regresjonstester (regresjonstestene og fasiten er ferdige)

Punktene over er representert i regelsettet, motoren og lagringen i Supabase,
med validering på serveren. Gjenstår:

- [x] Strukturert lagring i Supabase, med utkast/publisering, historikk og gjenoppretting.
- [x] Server-side validering, også av kurvenes rekkefølge for alle prøveverdier.
- [x] Tekstbolkene lagret som egne kommentarer, som regelsettet peker på.
- [x] Regelsettet og tekstene fra dagens modul importert og publisert.
- [ ] Editor og simulator, bygd i seksjonsmodellen (arbeidspakke 13).
- [ ] Produksjonsmodulen bytter til Supabase.

---

# Arbeidspakker etter kursendringen 23.09.2026

Arbeidspakke 5–7 fortsetter med domenearbeidet sitt som før; del 25 sier hva som endres for dem. Arbeidspakke 8–13 svarer til trinn 2–7 i kursendringen. Trinn 1, kurskorrigeringen, er denne revisjonen av planen.

Avhengigheter:

- 8 og 9 kan starte med en gang, parallelt.
- 10 bygger på 8.
- 11 bygger på 9 (del 1), 10 og omarbeidingen av arbeidspakke 4.
- 12 bygger på 11.
- 13 bygger på 9 (del 1), og gjøres for hver av arbeidspakke 5, 6 og 7 når PR-ene deres er slått sammen.

## Arbeidspakke 8 - Kartlegging av offentlige legemiddeldatakilder

**Status:** [ ] Ikke startet

Undersøk faktiske svar og dokumentasjon fra HAPI (FEST) og DMP FHIR, og skriv et kort dokument i repoet, `docs/legemiddeldata.md`, som beskriver:

- [ ] hvilke data vi faktisk kan hente, målt mot listen i del 23
- [ ] hvilken kilde som bør brukes per datatype
- [ ] stabile ID-er for substans, legemiddel og pakning
- [ ] relasjonene mellom dem, også for salter, metabolitter og kombinasjonspreparater
- [ ] autentisering
- [ ] oppdateringsmekanisme og -frekvens
- [ ] lisens og kildeangivelse
- [ ] kjente hull og begrensninger
- [ ] hvordan virkestoffene på dagens informasjonssider finnes igjen i kildene

Ingen databasemodell lages i denne arbeidspakken.

## Arbeidspakke 9 - Seksjoner og detaljkort

**Status:** [x] Ferdig

Stoffsidene bruker progressiv detaljering: seksjon → detaljkort, beskrevet i `docs/seksjoner.md`. Identiteten står alltid fram; Viktige data er åpen fra start; de andre seksjonene er lukket med en kort oppsummering av innholdet. Direktelenker: `#/analytt/<KODE>/<seksjon>/<kort>`. Redigeringsmodus åpner alt.

Del 1, komponenten:

- [x] Én generell komponent for hovedseksjon med minioppsummering og detaljkort, høyst to nivåer (del 24).
- [x] Rask, diskret animasjon som respekterer redusert bevegelse.
- [x] Tastatur, skjermleser og mobil.
- [x] Stabile adresser for seksjoner og detaljkort; direktelenker åpner riktig sted.
- [x] Søk på siden i lukket innhold, som åpner, ruller til og markerer treffet.
- [x] Lyst og mørkt tema.
- [x] Tester.

Del 2, dagens sider:

- [x] Flytt panelene som er på `main`, over i modellen, uten å endre klinisk betydning.
- [x] Minioppsummering for hver hovedseksjon.
- [x] Referansenummereringen og kort-hoppene er uendret.

## Arbeidspakke 10 - Ekstern legemiddelgrunnmur

**Status:** [ ] Ikke startet. Starter når arbeidspakke 8 er ferdig.

- [ ] Databasemodell i Supabase for den lokale kopien, ut fra arbeidspakke 8 (del 18 og 23).
- [ ] Synkroniseringsjobb, server-side og planlagt, idempotent, med nye, endrede og utgåtte produkter.
- [ ] Siste gyldige data beholdes ved feil; kjøringene registreres.
- [ ] Hemmeligheter bare server-side.
- [ ] Eksplisitte, bekreftede koblinger fra informasjonssidene til eksterne substans-ID-er (del 23).
- [ ] Lokale tillegg og skjulinger uten å mutere importerte rader, hvis det trengs.
- [ ] Testdata fra faktiske svar og integrasjonstester.

## Arbeidspakke 11 - Preparater fra eksterne data

**Status:** [ ] Ikke startet

- [ ] Erstatt det manuelle preparatfeltet med de synkroniserte dataene.
- [ ] Hovedseksjonen «Preparater»: `legemiddelform → preparat → styrker`, med pakninger og detaljer i detaljkort.
- [ ] Minioppsummering, for eksempel «12 preparater · 3 legemiddelformer · 6 styrker».
- [ ] Kildeangivelse og tidspunkt for siste synkronisering.
- [ ] Preparatnavnene er med i søket på siden og i det globale søket.
- [ ] Sumanalyser, salter, metabolitter og kombinasjonspreparater vises etter del 23.

## Arbeidspakke 12 - Flere legemiddeldata

**Status:** [ ] Ikke startet

Ta inn de øvrige feltene i del 23 én etter én, der arbeidspakke 8 viser at kildedataene er gode nok og feltet har nytte i OUSFAR, for eksempel ATC, reseptstatus, markedsstatus, administrasjonsvei, byttbarhet, deling/knusing/åpning, lenke til preparatomtale og eventuelt interaksjoner.

## Arbeidspakke 13 - Regelvisninger og simulatorer i seksjonsarkitekturen

**Status:** [ ] Ikke startet. Starter når arbeidspakke 9 del 1 er på `main`.

- [ ] Fortolkning/regler for konsentrasjonsreglene (arbeidspakke 5) vises som hovedseksjon med detaljkort.
- [ ] Scenarioreglene og simulatoren (arbeidspakke 6) likeså.
- [ ] THC-editoren og -simulatoren (arbeidspakke 7) bygges i modellen fra starten.
- [ ] Regelmotorene, valideringen og paritetstestene er uendret; klinisk output endres ikke.

---

## Viktige arkitekturregler for hele prosjektet

1. Informasjonsside, laboratorieanalytt og fortolkningsmodul er separate konsepter.
2. Kommentar og regel er separate objekter.
3. Kommentarer som kopieres til laboratoriesystemet er ren tekst.
4. Delte intervallgrenser redigeres som skillepunkter, slik at hull ikke kan oppstå.
5. Regelsett versjoneres og gjenopprettes atomisk.
6. Klinisk operativt innhold støtter utkast/publisering.
7. Referanser har stabile ID-er; synlige numre avledes per side.
8. Brukte referanser og revisjonshistorikk hard-slettes ikke.
9. Legemiddelgrunndata kommer fra autoritative offentlige kilder, synkronisert server-side til en egen lokal kopi med stabile ID-er; aldri live-oppslag fra nettleseren, aldri manuelle kopier, og aldri som revisjoner av redaksjonelt innhold. (Erstatter regelen om Felleskatalog-data, 23.09.2026.)
10. Migrering til Supabase skal ha paritetstester mot dagens fortolkningsmotor.
11. Komplekse regeltyper får spesialiserte editorer fremfor ett generelt visuelt programmeringsspråk.
12. Farmakologiske tall lagres som strukturerte data når de faktisk er strukturerte.
13. Endringer som kan påvirke klinisk output skal være eksplisitt validerte og sporbare.
14. Stoffsider kobles til eksterne data med eksplisitte, bekreftede ID-koblinger, ikke med tekstnavn.
15. Lokale unntak fra eksterne data lagres for seg; importerte rader muteres ikke.
16. Stoffsidene bruker én seksjonsmodell: hovedseksjon → detaljkort, høyst to nivåer, med minioppsummering. Nye visninger bygges i den, ikke som egne panelvarianter.
