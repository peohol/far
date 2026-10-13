# Evidensjournal – citalopram

- **Stoff/slug:** citalopram
- **Dekning:** full stoffmonografi, inkludert redaksjonelle seksjoner og kontroll av automatiske datalag
- **Sist oppdatert:** 2026-10-13
- **Kurateringsmodus:** de novo-kuratering
- **Kunnskapsgrense:** 2026-10-13
- **Siste fulle kjøring:** 2026-10-06
- **Siste de novo-kjøring:** 2026-10-13

## Full de novo-pilot 2026-10-13

Dette er den første komplette faglige piloten etter teknisk godkjenning av GitHub-, Supabase- og SPC-infrastrukturen. Før eksisterende citalopram-monografi, referanseliste og evidensjournal ble åpnet, ble appens levende innholdsmodell kartlagt til 37 kontrollpunkter: 18 paneler, 14 faste underkort og fem strukturerte datafelt. En separat blind evidensprotokoll ble deretter låst. Først etter adversarial kontroll av hovedkonklusjonene ble eksisterende innhold åpnet og sammenlignet.

### Uavhengig evidensgrunnlag og adversarial kontroll

| Domene | Uavhengig kontroll | Konklusjon før avstemming |
| --- | --- | --- |
| SPC og regulatorisk innhold | gjeldende norske original-PDF-er, tabeller og fotnoter | indikasjon, dose, QT-risiko, PK og sikkerhetsinformasjon må være kildefidel |
| Farmakodynamikk | human transportørstudie, PMID 21730142 | SERT-hemming er den klinisk informative hovedmekanismen; negativ reseptoroppramsing og allosterisk klinisk tolkning har lav nytte |
| Depresjon | Apler 2011, DOI 10.1136/bmjopen-2011-000106; tilbakefalls-RCT, PMID 7622809 | statistisk effekt mot placebo, liten gjennomsnittlig symptomforskjell og betydelige publikasjons-/rapporteringsbegrensninger |
| Panikklidelse | direkte RCT, PMID 9818634; Cochrane 2018, DOI 10.1002/14651858.CD010676.pub2 | eldre positiv studie, men ingen sikker citalopramspesifikk forskjell i senere oversiktsanalyse |
| Tvangslidelse | RCT, PMID 11236072 | respons mot placebo; 60 mg-armen ligger over dagens maksimale anbefalte dose |
| Farmakogenetikk | CPIC 2023, DOI 10.1002/cpt.2903 | CYP2C19 er handlingsrelevant når genotype foreligger; CPIC avgjør ikke hvem som skal genotypes |
| TDM | norsk laboratoriehåndbok; Espnes 2026; AGNP 2026; Xu 2023 | 70–350 nmol/L beholdes; serum uten gel ved steady state 12–24 timer etter dose; ingen skarp universell effektgrense |
| Forgiftning | Giftinformasjonen, kontrollert 2026-10-13 | dose, klinikk og serie-EKG styrer observasjon; tidligere kildebelagte konsentrasjonsgrenser beholdes |
| Graviditet | UKTIS versjon 4, september 2026; Embryotox | ingen overbevisende samlet misdannelsesøkning; små absolutte signaler og residual konfundering må synliggjøres |
| Amming | LactMed, revidert 2026-08-15; Embryotox | vanlig relativ spedbarnsdose omtrent 3–6 %, stor variasjon; amming kan vanligvis fortsette med observasjon |
| Avhengighet/toleranse | målrettede søk, SPC og vurdering av eksisterende kilder | seponeringssyndrom er reelt, klassisk addiksjon ikke etablert; klinisk toleranse og lært mestringsavhengighet mangler robust citalopramspesifikk dokumentasjon |

### Avstemming mot eksisterende innhold

Følgende ble forbedret:

- Antidepressiv effekt fikk direkte substansspesifikke effektmål, tilbakefallsdata og eksplisitte begrensninger.
- Panikkortet balanserer den eldre positive studien mot Cochrane-analysen; OCD-kortet markerer at 60 mg overstiger dagens maksimum.
- Farmakodynamikkpanelet er konsentrert til SERT med humane affinitetsdata. Seks lavt informative negative målkort og en klinisk usikker allosterisk tolkning er tatt ut av levende visning, med revisjonshistorikken bevart.
- Prøvetakingskortet angir serum uten gel, steady state og 12–24 timer etter siste dose, med nødvendige rekvisisjonsopplysninger.
- Graviditets- og ammekortene bruker 2026-teratologikilder, absoluttrisiko og konkret observasjon av barnet.
- Toleransekortet er tatt ut av levende visning fordi molekylær SERT-tilpasning ikke dokumenterer klinisk toleranse.

Følgende ble beholdt etter ny, selvstendig vurdering:

- det norske serumreferanseområdet 70–350 nmol/L, toksisk grense 700 nmol/L og grense for alvorlig forgiftning 10 000 nmol/L;
- den særskilte norske dose–serumtabellen og dens originalkilder;
- SPC-baserte indikasjoner, dosering, QT-risiko og farmakokinetiske nøkkeltall;
- CYP2C19/CPIC-innholdet, TDM-begrensningene, forgiftningskortene, fertilitetskortet, seponeringskortet og addiksjonsavgrensningen;
- automatiske FEST-, interaksjons-, laboratorie- og ClinPGx/CPIC-lag uten manuell duplisering.

### Kvalitetsporter for piloten

- Faglig uavhengighet: bestått; blind protokoll ble låst før eksisterende innhold ble åpnet.
- Beskyttede norske data: bestått ved migrasjons- og regresjonskontroll; ingen beskyttet verdi eller serumrad endres.
- Påstand–kilde-kobling: bestått i nye heterogene kort ved inline-sitering.
- Maskinlesbar dekning: 37 av 37 kontrollpunkter dokumentert i `citalopram-dekning.json`.
- Produksjonsnær funksjonstest og SPC-artefaktkontroll: dokumenteres med GitHub Actions-kjøringen for denne kurateringen før PR-en gjøres klar for faglig vurdering.

## Kontrollerte hovedkilder

| Område | Kilde | Kontroll |
| --- | --- | --- |
| SPC, indikasjon, dosering, PK, sikkerhet, reproduksjon | Citalopram Orion – preparatomtale, DMP, revisjon 04/2025 | kontrollert 2026-10-07 |
| Forgiftning | Giftinformasjonen/Helsebiblioteket: Citalopram – behandlingsanbefaling ved forgiftning | kontrollert 2026-10-07 |
| Farmakogenetikk | CPIC: Bousman et al. 2023, DOI 10.1002/cpt.2903 | kontrollert 2026-10-07 |
| TDM | AGNP Update 2026, DOI 10.1055/a-2860-7861 | kontrollert 2026-10-07 |
| TDM, konsentrasjon–utfall | Xu, Song, Jiang & Zhao 2023, DOI 10.3389/fpsyt.2023.1144573 | kontrollert 2026-10-07 |
| TDM, enantiomerfordeling og norsk konsensusområde | Espnes, Hønnås, Skogvoll & Spigset 2026, DOI 10.1007/s00228-026-04148-x | kontrollert 2026-10-07 |
| Depresjon | Cipriani et al. 2018, DOI 10.1016/S0140-6736(17)32802-7 | kontrollert 2026-10-07 |
| OCD | Montgomery et al. 2001, PMID 11236072 | kontrollert 2026-10-07 |
| Panikklidelse | Lepola et al. 1998, PMID 9818634 | kontrollert 2026-10-07 |
| Graviditet | Kang et al. 2017, DOI 10.5468/ogs.2017.60.2.145; Janusmed fosterpåverkan | kontrollert 2026-10-07 |
| Amming | Janusmed amning; LactMed, siste revisjon 2026-08-15 | kontrollert 2026-10-13 |
| Addiksjon/misbruk | Nutt 2003, DOI 10.1177/0269881103174019; Chiappini et al. 2022, DOI 10.3390/ph15050565 | kontrollert 2026-10-07 |
| Norske serumdata | Reis et al. 2009 og Referanseområdeprosjektet 2005–2008 | eksisterende OUSFAR-grunnlag bevart |

## Søke- og kontrollrunde

| Domene | Hva ble kontrollert |
| --- | --- |
| Regulatorisk | gjeldende norsk SPC, indikasjoner, dosegrenser, QT-risiko, PK og reproduksjon |
| Effekt | oppsummerende evidens ved depresjon og direkte kontrollerte studier ved OCD/panikklidelse |
| Farmakogenetikk | CYP2C19-anbefalinger, relevans av SLC6A4/HTR2A og norsk enzymaktivitetsterminologi |
| TDM | 2026-konsensus, systematisk konsentrasjon–utfall-evidens og samsvar mot norsk referanseområde |
| Toksisitet | akutte doseterskler, klinisk bilde, EKG/kramper og behandlingsråd |
| Graviditet/amming | Janusmed, LactMed, citalopramspesifikk meta-analyse og SPC |
| Avhengighet/seponering | toleranse, seponeringssyndrom, formell addiksjon og farmakovigilanssignaler |
| Automatiske lag | FEST-kobling, ClinPGx-kobling, CPIC-kobling, interaksjonslag og strukturert SPC-bivirkningsmodell kontrollert i repoarkitekturen |

### De novo-runde 2026-10-07

Den uavhengige evidensgjennomgangen ble gjort før den eksisterende citalopramteksten, den gamle evidensjournalen og tidligere konklusjoner ble åpnet. Før avstemming var følgende punkter låst: selektiv SERT-hemming og QT-risiko; norsk SPC som primærkilde for indikasjon/dose/PK; klinisk relevant CYP2C19-variabilitet etter CPIC; bevaring av norsk TDM-område; usikker konsentrasjon–effekt-relasjon; observasjonell graviditetsevidens; målbar men oftest begrenset eksponering ved amming; krampe-/QT-risiko ved overdose; og tydelig skille mellom seponeringssyndrom og addiksjon.

Adversarial kontroll før avstemming omfattet særlig:
- observasjonsstudier med graviditetssignaler opp mot meta-analyse og teratologikilder;
- preparatomtalens forsiktighetsformulering ved amming opp mot LactMed/Janusmed;
- eldre/regulatoriske PGx-formuleringer opp mot CPICs nyere genotypebaserte anbefalinger;
- internasjonale TDM-områder opp mot det norske 70–350 nmol/L;
- regulatorisk beskrivelse av seponeringssymptomer opp mot citalopramspesifikke seponeringsdata.

Etter avstemming ble hovedkonklusjonene fra 06.10 i stor grad **bekreftet**. Følgende ble **forbedret/nyansert**:
- CPIC-kortet presiserer at retningslinjen veileder bruk av et allerede foreliggende CYP2C19-resultat, men ikke hvem som bør genotypes.
- TDM-kortet bruker Espnes et al. 2026 som fersk norsk støtte for at 70–350 nmol/L er norsk nasjonal konsensus.
- Ammekortet skiller eksplisitt preparatomtalens forsiktighetsråd fra LactMed/Janusmeds vurdering av fortsatt amming.
- Kildeplasseringen er revidert slik at selvstendige påstander i lengre eller kildeheterogene tekster har inline-siteringer ved påstanden.

Ingen tidligere kildebelagte norske referanse- eller toksisitetsgrenser ble erstattet.

Søk og kildekontroll ble avsluttet 2026-10-07. Nye kilder etter denne datoen inngår ikke i denne kjøringen.

## Sentrale påstander og evidensstyrke

| Påstand | Grunnlag | Vurdering |
| --- | --- | --- |
| Citalopram virker primært ved potent, selektiv SERT-hemming | SPC | høy |
| Akutt antidepressiv effekt er bedre dokumentert enn eventuelle særfordeler mot andre antidepressiver | nettverksmeta-analyse + SPC | høy/moderat |
| Effekt ved OCD og panikklidelse er dokumentert, men de citalopramspesifikke nøkkelstudiene er gamle | direkte RCT-er + SPC | moderat |
| QT-forlengelse er doseavhengig og klinisk viktig | regulatorisk EKG-evidens/SPC | høy |
| CYP2C19 er klinisk relevant for eksponering og dosevalg | CPIC + SPC | høy |
| En skarp universell konsentrasjon–effektgrense er ikke godt etablert | systematisk oversikt + AGNP | lav/moderat for terskel; høy for at TDM kan være nyttig i utvalgte situasjoner |
| Norsk referanseområde 70–350 nmol/L skal ikke erstattes av AGNPs internasjonale område | norsk OUSFAR-grunnlag + ulikt kildeformål | høy |
| Akutt forgiftning kan gi kramper og betydelig kardial toksisitet; dose og EKG styrer observasjon | Giftinformasjonen + SPC | høy |
| Citalopram fremstår ikke som et betydelig teratogen, men observasjonsdata har residual konfundering | meta-analyse + Janusmed + SPC | moderat |
| Amming gir målbar, variabel eksponering; fortsatt amming er ofte mulig med klinisk observasjon av barnet | LactMed + Janusmed + SPC | moderat |
| Seponeringssyndrom er reelt og vanlig; dette er ikke det samme som et klassisk addiksjonssyndrom | SPC + SSRI-gjennomgang + farmakovigilans | høy for seponering, moderat for negativ addiksjonspåstand |

## Kildeplassering etter revisjonen 2026-10-07

Prinsippet er det smaleste referansenivået som gjør forholdet mellom påstand og kilde entydig:

- **Inline-sitering:** brukes i oppsummeringen og i lengre/kildeheterogene kort, blant annet panikklidelse, CYP2C19, TDM, utvalgte toksisitetskort, graviditet/amming, seponering og addiksjon. En regulatorisk påstand og en observasjons-/ekspertpåstand får hver sin sitering når de bygger på ulike kilder.
- **Element-/kortreferanse:** beholdes når et kort er kort og hele innholdet støttes av samme kilde, for eksempel flere PK-kort, fertilitetskortet og det avgrensede toleransekortet.
- **Panelreferanse:** skal ikke brukes som oppsamlingssted for en lengre tekst med mange separate påstander.

Den forrige testen krevde i praksis samme kildegruppe både inline og på kortet i flere faste seksjoner. Det ga sporbarhet, men ikke nødvendigvis presis påstand→kilde-kobling. Testen er derfor endret til å kreve kildebelegg på enten riktig inline-nivå eller riktig kortnivå, og har egne kontroller for heterogene og homogene eksempler.

## Dekningsmatrise 2026-10-07

| Område | Status etter kjøringen |
| --- | --- |
| Oppsummering | ny, full syntese |
| Viktige data | gjennomgått; norsk referanseområde og toksiske konsentrasjoner bevart; t½ og steady state synkronisert med SPC |
| Virkninger | nye kort for depresjon, panikk, OCD og QT-effekt |
| Farmakodynamikk | alle sju eksisterende kort revurdert, myket opp der gammel tekst var for absolutt, og kildebelagt |
| Indikasjon | oppdatert fra SPC |
| Dosering | oppdatert fra SPC/CPIC |
| Farmakokinetikk | alle levende kort oppdatert fra SPC |
| Farmakogenetikk | CYP2C19 syntetisert; automatiske ClinPGx/CPIC-lag beholdt |
| TDM | norsk grunnverdi beholdt; internasjonal kontekst og evidensbegrensning lagt til |
| Serumkonsentrasjoner | Reis/norsk dose–konsentrasjonstabell kontrollert og bevart |
| Interaksjoner | redaksjonell oversikt oppdatert; automatisk FEST-interaksjonslag beholdt |
| Bivirkninger | strukturert SPC-import fra Citalopram Orion lagt til uten språklig normalisering |
| Toksisitet og forgiftning | seks faste kort fylt; eksisterende 700 og 10 000 nmol/L bevart og kontekstualisert |
| Graviditet, amming og reproduksjon | fire faste kort fylt |
| Avhengighet, toleranse og tilbakeslag | toleranse, seponering og addiksjon vurdert; «Lært mestringsavhengighet» står bevisst tomt fordi citalopramspesifikk evidens mangler |
| Preparater/FEST | automatisk lag; ikke manuelt kopiert inn i monografien |

## Konflikter og kunnskapshull

- AGNPs internasjonale terapeutiske referanseområde skal ikke behandles som en erstatning for OUSFARs norske referanseområde; populasjon, formål og metode er ikke identiske.
- Sammenhengen mellom serumkonsentrasjon og klinisk effekt/bivirkninger er for svak og heterogen til en universell dosejusteringsgrense.
- Citalopramspesifikk moderne komparativ evidens ved panikklidelse og OCD er begrenset; de direkte nøkkelstudiene er eldre.
- Fertilitetsdata hos mennesker er begrensede.
- Melkeoverføring og serumkonsentrasjon hos diebarn varierer betydelig mellom mor–barn-par.
- Farmakovigilans viser rapporter om misbruk/avhengighet for SSRI, men kan ikke brukes til å beregne kausal risiko eller forekomst.
- CPIC beskriver hvordan tilgjengelige genotypefunn brukes; retningslinjen gir ikke et generelt kriteriesett for hvem som bør genotypes.
- Ved amming er kildeformålet viktig: preparatomtalen er regulatorisk og anbefaler forsiktighet, mens LactMed/Janusmed gjør en klinisk laktasjonsvurdering som kan støtte fortsatt amming under observasjon.
- Ingen tilstrekkelig citalopramspesifikk evidens ble funnet for «Lært mestringsavhengighet».

## Historikk

- **2026-10-13 – full de novo-pilot:** forventet dekning avledet fra levende appmodell før søk. Blind evidens og adversarial kontroll ble låst før gammel monografi/journal ble lest. Direkte effektestimater, preanalytikk og 2026-data for graviditet/amming ble lagt inn; seks negative PD-kort og toleransekortet ble tatt ut av levende visning. Norske konsentrasjonsområder og serumtabell ble bevart.
- **2026-10-07 – de novo-kuratering og kildeplassering:** blind evidensrunde før avstemming mot eksisterende monografi. Hovedinnholdet ble bekreftet, PGx/TDM/amming ble nyansert, og lange eller kildeheterogene tekster fikk påstandsnære inline-siteringer. Korte, kildehomogene kort beholder kortreferanser.
- **2026-10-06 – full oppdatering:** hele levende monografien revurdert. Ny oppsummering, virkninger, toksisitet, graviditet/amming/reproduksjon og avhengighetsseksjon; PD, indikasjon, dosering, PK, PGx, TDM og interaksjonstekst revidert. Strukturert bivirkningsimport lagt til.
- Norske referanse- og toksisitetsverdier ble eksplisitt beholdt. Eldre PK-nøkkeltall i «Viktige data» ble derimot synkronisert med gjeldende SPC fordi de ikke omfattes av bevaringsregelen.

## Neste overvåkning

Prioriter ny kontroll ved:
- ny norsk SPC eller Giftinformasjonen-anbefaling;
- ny AGNP/CPIC-versjon;
- nye robuste citalopramspesifikke data om konsentrasjon–utfall;
- nyere direkte eller komparativ evidens ved OCD/panikklidelse;
- nye større graviditets-/ammingsdata;
- ny evidens som endrer skillet mellom seponeringssyndrom, fysiologisk avhengighet og addiksjon.
