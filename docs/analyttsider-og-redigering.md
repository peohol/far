# Plan: analyttsider, redigerbart faginnhold og fortolkningsregler

Denne planen beskriver overgangen fra dagens hovedsakelig statiske/hardkodede faginnhold til et redigerbart, kildebelagt og fullt versjonert kunnskapssystem i OUSFAR.

Planen skal brukes som fremdriftssporing. Arbeidspakkene nederst krysses av etter hvert som de er ferdige.

## Status

- [x] Supabase er etablert.
- [x] Brukersystem med profiler og roller er etablert.
- [x] Arbeidspakke 1: fundament for redigerbart faginnhold.
- [x] Arbeidspakke 2: referansesystem.
- [x] Arbeidspakke 3: analyttsider og navigasjon.
- [ ] Arbeidspakke 4: import av psykofarmakainnhold.
- [ ] Arbeidspakke 5: enkle kommentarer og konsentrasjonsregler.
- [ ] Arbeidspakke 6: sammensatte analyttgrupper.
- [ ] Arbeidspakke 7: THC-syre.

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

### Panel 1 - Identitet

Vis:

1. Analyttkode som pille.
2. Legemiddelkategori som pille, med samme kategorier som dagens sidemeny.
3. Virkestoff/analyttnavn som hovedoverskrift.
4. Preparatnavn, alfabetisk sortert.

Preparatnavn skal lagres som strukturerte enkeltoppføringer, ikke som én kommaseparert fritekst.

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

Kortfattet redaksjonell oppsummering basert på gjeldende preparatomtaler i Felleskatalogen.

Hvis ulike preparater har ulike indikasjoner, skal dette representeres korrekt.

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

For antidepressiver og antipsykotika gjøres en separat gjennomgang per virkestoff.

Hent:

- eksisterende preparatnavn
- relevante godkjente indikasjoner

Preparatnavn sorteres alfabetisk.

Indikasjoner kondenseres til et kort faglig sammendrag.

Data fra Felleskatalogen skal ikke slås opp live hver gang analyttsiden åpnes. De lagres i OUSFAR med:

- referanse
- dato sist kontrollert mot Felleskatalogen

Dette er en egen opplysning fra «sist redigert».

---

## 17. Søk

Det skal finnes to forskjellige søk.

### Søk på siden

Finner tekst i den åpne analyttsiden og fremhever treff.

### Søk i hele kunnskapsbasen

Søker minst i:

- analyttnavn
- laboratoriekoder
- aliaser
- preparatnavn
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

Unngå å redusere alt til én stor, uvalidert JSON-kolonne. Bruk strukturerte tabeller/kolonner for data med klare invarianter; JSON kan brukes der selve domenet faktisk er variabelt.

---

## 19. Det som egentlig er data, skal ikke gjemmes i fritekst

Strukturerte felt passer blant annet for:

- referanseområde
- toksisk område
- alvorlig/dødelig konsentrasjon
- halveringstid
- steady-state-tid
- preparatnavn
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

**Status:** [ ] Ikke startet

- [ ] Render og kontroller `originaldata/Psykofarmaka.pdf`.
- [ ] Bygg kontrollert importdatasett.
- [ ] Importer antidepressiver og antipsykotika.
- [ ] Fyll panel 1-7 der kilden har data.
- [ ] Søk i Felleskatalogen for gjeldende preparatnavn.
- [ ] Skriv konsise indikasjonssammendrag.
- [ ] Lagre kilder og dato sist kontrollert mot Felleskatalogen.
- [ ] Første revisjon peker tilbake til kilde/side der det er mulig.

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
- [ ] Redigeringsgrensesnitt med historikk og sammenligning.
- [ ] Simulator.
- [ ] Produksjonsmodulen bytter til Supabase.

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
9. Felleskatalog-data lagres som datert, kildebelagt innhold; ikke som live-oppslag ved hver sidevisning.
10. Migrering til Supabase skal ha paritetstester mot dagens fortolkningsmotor.
11. Komplekse regeltyper får spesialiserte editorer fremfor ett generelt visuelt programmeringsspråk.
12. Farmakologiske tall lagres som strukturerte data når de faktisk er strukturerte.
13. Endringer som kan påvirke klinisk output skal være eksplisitt validerte og sporbare.
