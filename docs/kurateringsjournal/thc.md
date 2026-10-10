# Evidensjournal – THC (delta-9-tetrahydrocannabinol)

- **Stoff/slug:** `thc`
- **Dato:** 2026-10-10
- **Modus:** Full oppdatering, med selvstendig kildeinnhenting før avstemming mot historiske importdata
- **Avgrensning:** Moderstoffet Δ9-THC; 11-OH-THC er farmakologisk aktiv metabolitt, 11-nor-9-karboksy-THC (THC-COOH / THC-syre, IRCAK) er primært markør for eksponering. Cannabisprodukter og kombinasjonen THC/CBD (Sativex/nabiximols) er ikke identiske med isolert THC.
- **Kunnskapsdato:** 2026-10-10
- **Leveransestatus:** Faglig kildegjennomgang og migrasjonsforslag på PR-gren. Produksjons-preflight, kjedetester og runtime-kontroll er **ikke utført**, fordi tilkoblet Supabase-konto ikke eksponerer OUSFAR-prosjektet og kildekoden ikke lar seg klone i arbeidsmiljøet. Ingen endring er gjort i produksjonen.

## Kilderegnskap – selvstendig innhenting

| Nøkkel | Kilde | Bruksområde / forbehold |
| --- | --- | --- |
| `marinol` | [FDA Marinol (dronabinol) godkjent preparatomtale, revidert mars 2026](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/018651s036lbl.pdf) | Isolert dronabinol: godkjente **amerikanske** indikasjoner for aidsrelatert anoreksi og kjemoterapiutløst kvalme, virkning på appetitt og hemodynamikk. Ikke norsk godkjenning. |
| `pain` | [Ateş et al. 2026, Cochrane, DOI 10.1002/14651858.CD012182.pub3](https://doi.org/10.1002/14651858.CD012182.pub3) | Oppdatert placebo-sammenligning: usikker smerteeffekt av THC-dominerte midler ved kroniske nevropatiske smerter; ikke generaliser til alle THC-doser. |
| `dmp` | [DMP Legemiddelsøk – Sativex](https://legemiddelsok.no/sider/Legemiddelvisning.aspx?f=&pakningId=3611939b-f0b7-46c8-ae31-76498d856873&pane=0&searchquery=Cannabidiol) | Bekrefter norsk preparat, kombinasjonsvirkestoffer, styrke og MT. DMPs offisielle [norske SPC](https://produktinformasjon.legemiddelsok.no/preparatomtaler/11-8809.pdf) er lokalisert, men PDF-innholdet kunne ikke hentes eller kvalitetskontrolleres i denne kjøringen. |
| `sativex` | [Sativex – britisk SmPC, emc, oppdatert juli 2026](https://www.medicines.org.uk/emc/product/602/smpc) | Lesbar regulatorisk primærkilde for kombinasjonspreparatet, dose, PK, interaksjoner og sikkerhet. **Er ikke verifisert mot norsk SPC**, så bør avstemmes før publisering av detaljert SPC-basert innhold. Kan ikke alene brukes til norsk kildefidel bivirkningsimport. |
| `gift` | [Giftinformasjonen – Cannabis, behandlingsanbefaling ved forgiftning](https://www.helsebiblioteket.no/forgiftninger/rusmidler/cannabis-behandlingsanbefaling-ved-forgiftning), revidert 2020 | Norsk akutt-toksikologi for cannabis. Doser og komplikasjoner gjelder produkter med THC, ikke nødvendigvis isolert dronabinol. |
| `iuphar` | [IUPHAR/BPS Guide to PHARMACOLOGY – Δ9-THC](https://www.guidetopharmacology.org/GRAC/LigandDisplayForward?ligandId=2424) | CB1- og CB2-partiell agonisme. Separate eksperimentelle mål skal ikke oppgraderes til dokumenterte kliniske hovedmekanismer. |
| `ms` | [Filippini et al., Cochrane 2022, Cannabis and cannabinoids for people with multiple sclerosis](https://www.cochrane.org/evidence/CD013444_cannabis-and-cannabinoids-people-multiple-sclerosis) | Moderat tillit for at **nabiximols (THC + CBD)** forbedrer pasientrapportert spastisitet; ikke isolert THC-effekt. |
| `impair` | [McCartney et al. 2021, systematisk oversikt/metaanalyse, DOI 10.1016/j.neubiorev.2021.01.003](https://doi.org/10.1016/j.neubiorev.2021.01.003) | Kontrollerte studier om akutt svekkelse av kjøre-/kognitive ferdigheter; dose, rute, toleranse og tid er sentrale. |
| `psych` | [Hindley et al. 2020, Lancet Psychiatry, DOI 10.1016/S2215-0366(20)30074-2](https://pmc.ncbi.nlm.nih.gov/articles/PMC7738353/) | Placebokontrollert THC-eksponering gir dose-/studieavhengige psykotomimetiske symptomer; direkte administrasjonsstudier støtter kausal akutteffekt. |
| `high` | [High-Concentration Delta-9-Tetrahydrocannabinol Cannabis Products and Mental Health Outcomes, Ann Intern Med 2025, PMID 40854216](https://pubmed.ncbi.nlm.nih.gov/40854216/) | Risiko ved høy-THC cannabis, mange observasjonsstudier med betydelig skjevhetsfare; assosiasjon, ikke direkte isolert-THC kausalitet. |
| `oralpk` | [Oral Administration of Cannabis and Δ9-THC Preparations, systematisk oversikt 2020, PMID 32585912](https://pubmed.ncbi.nlm.nih.gov/32585912/) | Betydelig variasjon i opptak, forsinket `tmax` peroralt og store formuleringseffekter. |
| `blood` | [Are blood and oral fluid THC and metabolite concentrations related to impairment? metaregresjon, PMID 34767878](https://pubmed.ncbi.nlm.nih.gov/34767878/) | Dårlig korrelasjon med faktisk påvirkning, særlig ved regelmessig bruk; sammenlign aldri serum/plasma/fullblod eller THC/THC-COOH direkte. |
| `pgx` | [Sachse-Seeboth et al. 2009, DOI 10.1038/clpt.2008.213](https://pubmed.ncbi.nlm.nih.gov/19005461/) | 43 friske, CYP2C9*3/*3 sammenlignet med *1/*1: ca. 3 ganger THC-AUC og lavere THC-COOH; lite utvalg og ikke validert doseringsalgoritme. |
| `withdraw` | [Connor et al. 2022, Clinical management of cannabis withdrawal, DOI 10.1111/add.15743](https://pmc.ncbi.nlm.nih.gov/articles/PMC9110555/) | Vanlig abstinens etter langvarig hyppig bruk; debut 24–48 t, topp dag 2–6, mulig varighet ≥3 uker ved tung bruk. |
| `cb1pet` | [Hirvonen et al. 2012, DOI 10.1038/mp.2011.82](https://pmc.ncbi.nlm.nih.gov/articles/PMC3223558/) | Human PET-dokumentasjon for redusert CB1-tilgjengelighet ved daglig bruk og reversering i abstinens; gjelder studerte kroniske brukere. |
| `chs` | [UEG/ESNM europeisk konsensus for kronisk kvalme/oppkast 2025, DOI 10.1002/ueg2.12711](https://doi.org/10.1002/ueg2.12711) | Cannabinoid hyperemesis ved langvarig høyt cannabisbruk, klinisk assosiasjon og bedring etter fullstendig opphør; begrenset evidens for akutte legemidler. |
| `preg` | [Lo et al., JAMA Pediatrics 2025, DOI 10.1001/jamapediatrics.2025.0689](https://pubmed.ncbi.nlm.nih.gov/40323610/) | 51 **observasjonelle cannabisstudier**, assosiasjoner til prematuritet, veksthemming/lav fødselsvekt etter justering. Konfundering og ulike cannabisprodukter; kan ikke attributeres rent THC. |
| `lact` | [LactMed – Cannabis, revidert 15.07.2026](https://www.ncbi.nlm.nih.gov/books/NBK501587/) | THC påvises i morsmelk fra dager til uker, sterkt variabelt; utilstrekkelig spedbarnsoppfølging; kliniske anbefalinger mot bruk. |
| `cud` | [Cochrane – Medicines for the treatment of cannabis use disorder, oppdatert søk mai 2024](https://www.cochrane.org/evidence/CD008940_medicines-treatment-cannabis-use-disorder) | Begrenset dokumentasjon for legemidler; psykososial behandling og diagnostikk av addiksjonsfenomener skal skilles fra fysisk abstinens. |

## Seksjonsgjennomgang og evidensvurdering

| Seksjon | Kuratorens vurdering | Sikkerhet |
| --- | --- | --- |
| Konsis oppsummering | Partiell CB1-/CB2-agonist; akutt rus, svekket oppmerksomhet/psykomotorikk; meget ruteavhengig kinetikk; Sativex er THC/CBD-kombinasjon; abstinens og addiksjon etter gjentatt bruk | Høy for hovedpunktene |
| Viktige data | Ikke endre eksisterende norske referanse-/toksisitetsverdier. Ikke etablere en falsk universell THC-halveringstid fra ulike prøvemetoder. | Høy |
| Farmakodynamikk | CB1 og CB2 er partielle agonistmål. CB1-mediert hemming av presynaptisk transmitterfrigjøring er sentral nevral mekanisme. | Høy |
| Virkninger | Akutt rus, kognisjon/koordinasjon, psykotomimetiske og kardiovaskulære effekter; dronabinol har dokumenterte appetittstimulerende/antiemetiske effekter med **amerikanske** indikasjoner, ikke norske. Cochrane 2026 gir ingen sikker smertelindringskonklusjon for THC-dominerte midler. Sativex-effekt på MS-spastisitet gjelder THC/CBD-kombinasjonen. | Høy for hovedvirkningene; lav/veldig lav for smertelindring |
| Bivirkninger | Sativex-SmPC beskriver blant annet svimmelhet og fatigue, men dette er preparatdata. Strukturert bivirkningstabell fra **norsk SPC** ikke importert: original-PDF/preview utilgjengelig. Redaksjonell risikotekst kan omtale sentrale særtrekk med andre uavhengige kilder. | Moderat |
| Toksisitet og forgiftning | Ikke forsvarlig å oppgi universell toksisk THC-dose eller THC-/THC-COOH-blodgrense. Akutt angst, psykose, takykardi, koordinasjonssvikt; hos barn langvarig CNS-/respirasjonsdepresjon; vurder kardiovaskulære symptomer. Symptomatisk behandling; ingen etablert antidot. | Høy for klinisk bilde, lav for dose-/konsentrasjonsgrenser |
| Indikasjon | Norsk markedsført Sativex ved MS-spastisitet som tillegg hos responderende voksne; det er et THC/CBD-kombinasjonspreparat. Isolert dronabinol (Marinol) har andre **amerikanske** godkjenninger ved aidsrelatert anoreksi og kjemoterapiutløst kvalme, som ikke må fremstå som norske. Historisk norsk import kontrolleres mot norsk SPC før endring. | Høy |
| Dosering | Sativex: 2,7 mg THC + 2,5 mg CBD per spray; opptitrering individuelt til maks 12 sprayer/døgn; vurder respons etter fire uker. Spesifikt for kombinasjonen og formuleringen. | Høy (britisk SPC; norsk SPC-tekst ikke verifisert) |
| Farmakokinetikk | Inhalert hurtig høy topp, peroralt forsinket/variabelt, oromukosalt særregime; høy fettløselighet og proteinbinding; CYP2C9/3A4; 11-OH-THC aktiv og THC-COOH eksponeringsmarkør; bi-/multifasisk eliminasjon. | Høy/moderat |
| Farmakogenetikk | CYP2C9*3 påvirker eksponering i liten human studie; ikke grunnlag for generell genotypebasert forskrivningsanbefaling. Behold automatiske ClinPGx/CPIC-data atskilt. | Moderat for PK, lav for klinisk beslutningsnytte |
| TDM | Ikke et validert konsentrasjonsmål for «ruseffekt» eller standard terapeutisk TDM ved rekreasjonell THC-eksponering. Blod/serum/plasma og tid siden inntak må spesifiseres; bevare evt. eksisterende norske tall. | Høy for tolkingsbegrensning |
| Interaksjoner | CYP3A4-/CYP2C9-hemming/induksjon kan påvirke THC/11-OH-THC i **Sativex** og er også omtalt i isolert-dronabinol FDA-SPC; farmakodynamisk additiv sedasjon. Ikke kopier FEST-liste. | Høy for regulatoriske farmakokinetiske forhold |
| Graviditet | Svangerskapseksponering for cannabis assosiert med prematuritet/lav fødselsvekt/SGA; observerte OR-er er ikke kausalestimater for isolert THC; anbefal å unngå eksponering. | Moderat assosiasjon |
| Perinatal/neonatal | Skille dårlig fostervekst/perinatale assosiasjoner fra dokumentert abstinens ved fødsel; ingen sikker spesifikk neonatal abstinenssannsynlighet etablert. | Lav/moderat |
| Amming | THC utskilles og kan persistere i melk; LactMed anbefaler generelt å unngå cannabis; Sativex er kontraindisert under amming i SmPC. | Høy for eksponering, lav for langtidsutfall |
| Fertilitet | Begrenset human dokumentasjon på THC isolert; dyredata/preparatdata kan ikke brukes til presise menneskelige risikotall. | Lav |
| Toleranse | CB1-nevroadaptasjon i humane PET-studier; effektspecifikk toleranse, ikke lik abstinens eller addiksjon. | Høy/moderat |
| Abstinens / rebound | Irritabilitet, søvnplager, angst, redusert appetitt ved opphør etter hyppig bruk, vanlig debut 1–2 d, topp d2–6. Skill fra tilbakefall av symptomer THC ble brukt mot. | Høy |
| Addiksjon | Etablert cannabisbrukslidelse inkluderer kontrolltap, videre bruk tross skade, craving. Toleranse/abstinens alene er ikke addiksjon. Risikoen avhenger av bruksmønster og produktstyrke. | Høy |
| Lært mestringsavhengighet | Mestringsbruk for søvn/angst kan lære en forventning om at THC er nødvendig. Evidensen er i stor grad selvrapportert cannabisbruk, og en THC-spesifikk kausal konklusjon står åpen. | Lav/moderat – bør vurderes særskilt |

## Kildekritisk kontroll

1. **THC vs. cannabis vs. Sativex:** Direkte forsøk med isolert THC prioriteres for THC-kausalitet. Metaanalyser om cannabis og studier på Sativex kan opplyse relevante forhold, men påstanden må merkes som cannabis eller THC/CBD-kombinasjon.
2. **Serum/helblod/urin:** THC i blod faller raskt etter inhalasjon og kan være detekterbart uten samtidig betydelig påvirkning; THC-COOH i urin dokumenterer eksponering/metabolisme, ikke en pågående rus. Ikke konverter mellom matriser uten dokumentert faktor og kontekst.
3. **Halveringstid:** Kort målbar fase i et spesifikt Sativex-forsøk versus lang terminal fase etter redistribusjon er ikke motstridende; et enkelt tidstall ville villede.
4. **CYP2C9-genetikk:** Tre ganger AUC ved *3/*3 i en studie med 43 personer er ikke bevis for klinisk nytte av rutinemessig genotyping.
5. **Graviditet/amming:** Svangerskapsstudier om cannabis har store residual-konfunderingsproblemer, mens laktasjonsstudier bekrefter THC-overgang men dokumenterer ikke sikkerhetsgrense.
6. **Cannabinoid hyperemesis:** Gjelder særlig langvarig høy cannabiseksponering, ikke påvist terskel for én THC-dose.
7. **FEST/ClinPGx/CPIC/PubChem/Farmakologiportalen:** Uendret. Runtime-integrasjonen og norsk SPC-preview kan ikke kvitteres som gjennomført uten produksjonstilgang.

## Avstemming mot eksisterende OUSFAR-innhold

I GitHub er det funnet eksisterende, historisk kildebelagt THC-indikasjon i `supabase/import/indikasjoner/THC.json`, FEST-kobling via dronabinol, samt analyttkoblingene `THC` (modersubstans) og `IRCAK` (metabolitt). Den egne THC-syremotoren og dens fortolkningsregler skal **ikke røres**. Fordi produksjonsbasen ikke er tilgjengelig, er ingen eksisterende utkast/publisert-revisjoner eller norske grunnverdier blitt lest; dermed må ny migrasjon ha strenge kollisjonskontroller og kreve preflight før sammenslåing.

## Restanser før fullført og trygg publisering

- Kontroller live-preflight av `thc` i OUSFAR og avstem alle kort og eksisterende norske konsentrasjonsgrenser uten overskriving av upubliserte utkast.
- Verifiser norsk Sativex-SPC innhold og revisjonsdato, transkriber eventuell strukturert bivirkningstabell fra *norsk* original med `docs/bivirkninger.md`-preview og egen import.
- Kjør kjedetester, build, kontroll av THC-spesifikk visning og smokk-test av FEST-interaksjoner, ClinPGx/CPIC, PubChem og Farmakologiportalen gjennom appens produksjonsnære rolle.
- Ta stilling til status på den eldre Felleskatalogen-baserte indikasjonsteksten etter norsk SPC-kontroll.
- Bekreft manglende duplikater og riktig inline referanseplassering i appen før merge.

## Historikk

- **2026-10-10:** Full systematisk ny gjennomgang av THC, med vekt på klinisk/forensisk fortolkningspresisjon. Skriftlig kilde- og beslutningslogg. Ytterligere uavhengig kildekontroll av isolert dronabinol (FDA 2026) og Cochrane (2026) førte til særskilt dekning av appetitt, antiemese, hemodynamikk og begrenset evidens for smertelindring. Fullføring begrenset av manglende OUSFAR-Supabase-tilgang og utilgjengelig norsk SPC-PDF.
