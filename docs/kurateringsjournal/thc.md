# Evidensjournal – THC (delta-9-tetrahydrocannabinol)

- **Stoff/slug:** `thc`
- **Dato:** 2026-10-10
- **Modus:** Full oppdatering, med selvstendig kildeinnhenting før avstemming mot historiske importdata
- **Avgrensning:** Moderstoffet Δ9-THC; 11-OH-THC er farmakologisk aktiv metabolitt, 11-nor-9-karboksy-THC (THC-COOH / THC-syre, IRCAK) er primært markør for eksponering. Cannabisprodukter og kombinasjonen THC/CBD (Sativex/nabiximols) er ikke identiske med isolert THC.
- **Kunnskapsdato:** 2026-10-10
- **Leveransestatus:** Hele den levende panelmodellen er revurdert; nye strukturerte THC-halveringstider og humane serumdata, kildebelagt lærings-/mestringskort, to PK-tillegg og et prøvetakingskort kompletterer den opprinnelige THC-migrasjonen og den norske SPC-bivirkningsimporten i PR #210. Produksjons-preflight er bestått. Full CI på den **siste** tilleggsrevisjonen avventes før PR kan erklæres ferdig. Ingen endring er gjort i produksjonen.

## Kilderegnskap – selvstendig innhenting

| Nøkkel | Kilde | Bruksområde / forbehold |
| --- | --- | --- |
| `marinol` | [FDA Marinol (dronabinol) godkjent preparatomtale, revidert mars 2026](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/018651s036lbl.pdf) | Isolert dronabinol: godkjente **amerikanske** indikasjoner for aidsrelatert anoreksi og kjemoterapiutløst kvalme, virkning på appetitt og hemodynamikk. Ikke norsk godkjenning. |
| `pain` | [Ateş et al. 2026, Cochrane, DOI 10.1002/14651858.CD012182.pub3](https://doi.org/10.1002/14651858.CD012182.pub3) | Oppdatert placebo-sammenligning: usikker smerteeffekt av THC-dominerte midler ved kroniske nevropatiske smerter; ikke generaliser til alle THC-doser. |
| `dmp` | [DMP Legemiddelsøk – Sativex](https://legemiddelsok.no/sider/Legemiddelvisning.aspx?f=&pakningId=3611939b-f0b7-46c8-ae31-76498d856873&pane=0&searchquery=Cannabidiol) | Bekrefter norsk preparat, kombinasjonsvirkestoffer, styrke og MT. DMPs offisielle [norske SPC](https://produktinformasjon.legemiddelsok.no/preparatomtaler/11-8809.pdf) er hentet som original PDF på 15 sider via GitHub Actions, kontrollert med PDF-signatur og PyMuPDF. Revisjonsdato **28.05.2026** (s. 15); original bivirkningstabell i 4.8 (s. 7–8) er visuelt kontrollert og importert. |
| `sativex` | [Sativex – britisk SmPC, emc, oppdatert juli 2026](https://www.medicines.org.uk/emc/product/602/smpc) | Supplerende regulatorisk kilde for kombinasjonspreparatet. Norsk original-SPC er kontrollert for indikasjon, doseringsgrense, flere interaksjonsopplysninger og den kildefaste bivirkningstabellen. UK-SPC brukes fortsatt særskilt når primærgrunnlaget i teksten gjelder den britiske regulatoriske versjonen; den norske bivirkningsimporten bygger bare på norsk original. |
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
| Viktige data | Tre kortverdier for THC-plasmahalveringstid etter Sativex 2/4/8 sprayer (1,94/3,72/5,25 timer) fra norsk SPC, ikke en universell halvveringstid. Alle fire øvrige typer er eksplisitt vurdert og begrunnet tomme. Ingen norske grunnverdier endret. | Høy for preparatspesifikke verdier, lav generaliserbarhet |
| Farmakodynamikk | CB1 og CB2 er partielle agonistmål. CB1-mediert hemming av presynaptisk transmitterfrigjøring er sentral nevral mekanisme. | Høy |
| Virkninger | Akutt rus, kognisjon/koordinasjon, psykotomimetiske og kardiovaskulære effekter; dronabinol har dokumenterte appetittstimulerende/antiemetiske effekter med **amerikanske** indikasjoner, ikke norske. Cochrane 2026 gir ingen sikker smertelindringskonklusjon for THC-dominerte midler. Sativex-effekt på MS-spastisitet gjelder THC/CBD-kombinasjonen. | Høy for hovedvirkningene; lav/veldig lav for smertelindring |
| Bivirkninger | Strukturert tabell er importert fra **norsk Sativex-SPC 28.05.2026**, s. 8, etter visuell kontroll av frekvenskolonner, organsystemer og fotnoter. **53 enkeltreaksjoner:** 2 svært vanlige, 37 vanlige og 14 mindre vanlige fordelt på 13 organsystemer; 3 fotnoter. Repoets forhåndsvisning viste førstegangsimport uten feil. Frekvensene gjelder **Sativex (THC/CBD)** i MS-studier, ikke isolert THC. | Høy for kildefidel overføring; andre kliniske risikoestimater må vurderes separat |
| Toksisitet og forgiftning | Ikke forsvarlig å oppgi universell toksisk THC-dose eller THC-/THC-COOH-blodgrense. Akutt angst, psykose, takykardi, koordinasjonssvikt; hos barn langvarig CNS-/respirasjonsdepresjon; vurder kardiovaskulære symptomer. Symptomatisk behandling; ingen etablert antidot. | Høy for klinisk bilde, lav for dose-/konsentrasjonsgrenser |
| Indikasjon | Norsk markedsført Sativex ved MS-spastisitet som tillegg hos responderende voksne; det er et THC/CBD-kombinasjonspreparat. Isolert dronabinol (Marinol) har andre **amerikanske** godkjenninger ved aidsrelatert anoreksi og kjemoterapiutløst kvalme, som ikke må fremstå som norske. Historisk norsk import kontrolleres mot norsk SPC før endring. | Høy |
| Dosering | Norsk Sativex-SPC, pkt. 2 og 4.2: 2,7 mg THC + 2,5 mg CBD per spray; opptitrering individuelt til maks 12 sprayer/døgn; vurder respons etter fire uker. Spesifikt for kombinasjonen og formuleringen. | Høy, norsk SPC kontrollert |
| Farmakokinetikk | Inhalert hurtig høy topp, peroralt forsinket/variabelt, oromukosalt særregime; høy fettløselighet og proteinbinding; CYP2C9/3A4; 11-OH-THC aktiv og THC-COOH eksponeringsmarkør; bi-/multifasisk eliminasjon. Sativex-enkeldosens rapporterte middel-Cmax 4 ng/mL er omregnet med dokumentert molmasse 314,46 g/mol til omtrent **13 nmol/L** i monografien. | Høy/moderat |
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
| Lært mestringsavhengighet | Eget kort skrevet etter ny gjennomgang av Livingston 2023 og Dyar 2025; de dokumenterer mestrings- og søvnmotiver, men ikke en kausal THC-spesifikk lært avhengighet. OUSFAR-begrepet presenteres som pedagogisk, ikke diagnostisk. | Moderat for motiver, lav for kausal THC-spesifikk mekanisme |

## Dekningsmatrise mot levende panelmodell (full oppdatering 10.10.2026)

Områdeinndelingen kommer fra `src/faginnhold/paneler.ts` på `main`, ikke fra hvilke kort første THC-kjøring tilfeldigvis skrev. **Vurdert = ja** betyr at området er sjekket både for faglig innhold, kildedekning og hva som allerede finnes i FAR. Utelatelse er bare tillatt med selvstendig begrunnelse nedenfor. Ingen automatiske kilder kopieres til redaksjonell tekst.

| Live panel | Vurdert | Vedtak og faktisk dekning etter PR #210 | Eventuelle tomme felt |
| --- | --- | --- | --- |
| `identitet` – Konsis oppsummering | Ja | Nytt kildebelagt kort om THC, CB₁/CB₂, rus, metabolitter, Sativex og avhengighet. | Ingen av de tilsiktede delene. |
| `viktige_data` | Ja | Strukturert, **formulerings- og dosebundet THC-plasmahalveringstid** for Sativex etter 2, 4 og 8 sprayer; ny egen migrasjon. | Klinisk referanseområde, toksisk område, alvorlig/dødelig konsentrasjon og generelt tₛₛ er vurdert og **bevisst ikke fylt**; se detaljmatrisen. |
| `farmakodynamikk` | Ja | To mekanismekort: partiell CB₁- og CB₂-agonisme, med kilde direkte i kortene. | Ingen dokumentert ekstra reseptormekanisme av tilsvarende klinisk betydning er utelatt. |
| `virkninger` | Ja | Åtte kildebelagte kort: rus, psykomotorikk, psykotomimetiske symptomer, MS-spastisitet for THC/CBD, appetitt, antiemese, analgesi og kardiovaskulære effekter. | Ingen av de vurderte hovedvirkningene. |
| `bivirkninger` | Ja | Ett redaksjonelt sikkerhetskort **og** separat SPC-import med 53 norske Sativex-reaksjoner, 13 organsystemer, 3 fotnoter og frekvensinndeling. | Frekvensene gjelder Sativex hos MS-pasienter, ikke isolert THC. |
| `toksisitet_forgiftning` | Ja | **Alle seks faste kort** skrevet: dose/eksponering; toksiske konsentrasjoner; klinisk bilde; komplikasjoner; toksikokinetikk; behandling. | Ingen universell toksisk dose eller dødelig THC-konsentrasjon konstruert. |
| `indikasjon` | Ja | Eksisterende norsk indikasjon beholdt etter kontroll mot Sativex-SPC; amerikanske dronabinolindikasjoner tydelig skilt ut i oppsummeringen. | Ingen ubegrunnet ny norsk indikasjon. |
| `preparater` | Ja | FEST-koblingen via dronabinol beholdt; 11 preparatnavn returnert i produksjonsnær `authenticated`-RPC-test. | Automatisk/importert, ikke redaksjonelt. |
| `dosering` | Ja | Formuleringsspesifikk norsk Sativex-titrering; peroralt dronabinol omtales bare med regulatorisk geografi. | Ingen generell rekreasjonell THC-dose. |
| `farmakokinetikk` | Ja | **Seks kort**: absorpsjon; distribusjon; metabolisme; halveringstid/eliminasjon; mat; nedsatt leverfunksjon. Administrasjonsmåte og matrise beholdes per kilde. | Ingen kunstig felles halveringstid. |
| `farmakogenetikk` | Ja | To redaksjonelle kort om CYP2C9-data og klinisk nytte; automatisk ClinPGx/CPIC beholdt adskilt. | Ingen validert genotypebasert doseringsregel konstruert. |
| `interaksjoner` | Ja | Redaksjonell klinisk syntese + uendret FEST-lag; 37 interaksjonssøketreff i produksjonsnær test. | Ikke dobbeltfør FEST-listen. |
| `tdm` | Ja | **To kort** om forholdet mellom konsentrasjon og påvirkning og prøvetaking etter røykestart. | Ingen terapeutisk målverdi for rus-/påvirkningsbedømmelse. |
| `laboratorieanalyser` | Ja | Farmakologiportalens automatiske lesevei kontrollert som `authenticated`; ikke skrevet manuelt. | Automatisk. |
| `kjemiske_grunndata` | Ja | PubChem `les_kjemi` bekreftet THC/CID 16078 og THC-syre/CID 108207 via `authenticated`-RPC. | Automatisk. |
| `serumkonsentrasjoner` | Ja | **Ny dose–serumtabell** med tre faktiske målte `Cmax` fra samme humane THC-røykestudie (Hunault et al. 2008), omregnet til nmol/L. | Ikke fylt med Sativex-**plasma**tall; ikke ekstrapolert til terapeutiske doser. |
| `graviditet_amming` | Ja | Alle fire faste kort: graviditet, perinatalt/neonatalt, amming og fertilitet; skiller observasjonell cannabisforskning fra isolert THC. | Ingen oppdiktet absoluttrisiko. |
| `avhengighet_toleranse` | Ja | **Alle fire faste kort**: toleranse; abstinens/rebound; addiksjon; nå også forsiktig kildebelagt **lært mestringsavhengighet**. | Den siste er OUSFARs pedagogiske begrep, ikke en særskilt diagnose. |

### «Viktige data»: eksplisitt beslutning for hvert av fem strukturerte datakort

| Kort | Beslutning | Kilde/forbehold |
| --- | --- | --- |
| `referanseomrade` | **Tomt med hensikt.** | Ingen etablert norsk klinisk terapeutisk THC-serumreferanse som dekker ulike produkter og bruksformål. Bruk ikke farmakologiske rus-/kjøregrenseverdier som TDM-mål. Tidligere norske verdier (der de finnes) skal alltid bevares. |
| `toksisk_omrade` | **Tomt med hensikt.** | Ingen universell antemortem THC-konsentrasjon som skiller toksisitet fra ikke-toksisitet; dose, matrise, tid, toleranse og andre stoffer varierer. |
| `alvorlig_intoksikasjon` | **Tomt med hensikt.** | Dødelig/alvorlig THC-forgiftning har ikke en validert enkeltterskel i serum; postmortale eller blandingsrelaterte funn gir ikke et sikkert referansetall. |
| `halveringstid` | **Fylt med tre betingede tall.** | Norsk Sativex-SPC, pkt. 5.2: THC i **plasma** etter 2/4/8 sprayer: 1,94/3,72/5,25 timer. Ikke allmenn eller doseuavhengig terminal halveringstid. |
| `steady_state` | **Tomt med hensikt.** | Det finnes ikke én forsvarlig tₛₛ-verdi for THC på tvers av administrasjonsveier, gjentatte doser, distribusjon til fettvev og varierende halveringstidsfase; tall fra kort plasmafase alene er uegnet som generelt steady-state-estimat. |

### Kvantitativ evidens – serumkonsentrasjoner, t½ og metabolitter

**Hunault et al. 2008** ([DOI](https://doi.org/10.1007/s00213-008-1260-2), originalarbeid, tabell 2): 24 voksne mannlige, ikke-daglige cannabisbrukere i crossover-studie; analyserte runder hadde 18, 20 og 20 deltakere. Cannabis blandet med tobakk, røykt som enkeltsigarett med henholdsvis 29,3, 49,1 og 69,4 mg THC. SERUM ble analysert seriellt over 0–8 timer med LC-MS/MS. Målte gjennomsnittlige THC-serum-**Cmax** (SD) var henholdsvis **135,1 (68,5); 202,9 (112,4); og 231,0 (108,5) µg/L**. Med THC-molekylmasse 314,46 g/mol tilsvarer dette avrundet **430 ± 218; 645 ± 357; og 735 ± 345 nmol/L**, slik den strukturerte tabellen viser. Gjennomsnittlig tid til toppkonsentrasjon fra røykestart 9,8 / 14,1 / 12,3 minutter. **Evidenstillit høy for målte verdier i denne populasjonen, svært lav for å generalisere til kroniske brukere, annen inntaksvei eller kliniske målverdier.** Cmax er ikke et terapeutisk referanseområde, og mg THC i sigaretten er ikke inhalert/absorbert mg.

**Norsk Sativex-SPC 28.05.2026** ([original](https://produktinformasjon.legemiddelsok.no/preparatomtaler/11-8809.pdf), pkt. 5.2): ikke-kompartmental PK-analyse med plasmahalveringstider **1,94; 3,72; 5,25 timer** etter 2; 4; 8 sprayer Sativex. Mat økte THC-Cmax 1,6 ganger og THC-AUC 2,8 ganger, og moderat/alvorlig nedsatt leverfunksjon reduserte clearance. Her er **plasma** prøvematrise, med THC/CBD-spray som formulering; ikke bland med Hunaults SERUM fra inhalert cannabis. Lav generaliserbarhet til isolert THC via andre administrasjonsveier.

**Coping/søvnmotiver:** [Livingston et al. 2023](https://doi.org/10.1080/02791072.2022.2054747) (N=1453 universitetsstudenter med cannabisbruk; selvrapportert motiv-/symptomforskning) og [Dyar, Curtis og Lee 2025](https://doi.org/10.1186/s42238-025-00362-z) (N=571 unge voksne **kvinner** som brukte cannabis regelmessig; økologisk sanntidsundersøkelse) viser sammenhenger mellom bruksmotiver og bruksmønster. Studiene isolerer verken THC-molekylet, effekt av andre cannabinoider eller kausal læring av forventningen om nødvendig mestringshjelp. **Evidenstillit moderat for at mestrings-/søvnmotiver forekommer, lav for kausal THC-spesifikk mestringsavhengighet.** Kortet fremstiller dette som pedagogisk mulighet, aldri et etablerte diagnosekriterium.

**Adversarial kontroll:** Et høyt Cmax i inhalasjonsstudien kan ikke brukes som «normalkonsentrasjon» i Sativex-behandling; et lavt Sativex-plasma-Cmax kan ikke tolkes som direkte ekvivalent lavt serum etter røyking. Fravær av universelle serumgrenser er ikke fravær av klinisk risiko. Motiver for cannabisbruk er ikke i seg selv bevis for avhengighet/addiksjon eller en kausal THC-spesifikk nevrofysiologisk mekanisme.

## Kildekritisk kontroll

1. **THC vs. cannabis vs. Sativex:** Direkte forsøk med isolert THC prioriteres for THC-kausalitet. Metaanalyser om cannabis og studier på Sativex kan opplyse relevante forhold, men påstanden må merkes som cannabis eller THC/CBD-kombinasjon.
2. **Serum/helblod/urin:** THC i blod faller raskt etter inhalasjon og kan være detekterbart uten samtidig betydelig påvirkning; THC-COOH i urin dokumenterer eksponering/metabolisme, ikke en pågående rus. Ikke konverter mellom matriser uten dokumentert faktor og kontekst.
3. **Halveringstid:** Kort målbar fase i et spesifikt Sativex-forsøk versus lang terminal fase etter redistribusjon er ikke motstridende; et enkelt tidstall ville villede.
4. **CYP2C9-genetikk:** Tre ganger AUC ved *3/*3 i en studie med 43 personer er ikke bevis for klinisk nytte av rutinemessig genotyping.
5. **Graviditet/amming:** Svangerskapsstudier om cannabis har store residual-konfunderingsproblemer, mens laktasjonsstudier bekrefter THC-overgang men dokumenterer ikke sikkerhetsgrense.
6. **Cannabinoid hyperemesis:** Gjelder særlig langvarig høy cannabiseksponering, ikke påvist terskel for én THC-dose.
7. **FEST/ClinPGx/CPIC/PubChem/Farmakologiportalen:** Ikke omskrevet som redaksjonell tekst. I FAR-produksjon returnerte authenticated-RPC for THC-siden, FEST-preparater (11 navn), FEST-interaksjonssøk (37 treff) og Farmakologiportalen uten feil eller timeout. THC har ingen aktiv redaksjonell ClinPGx-kobling. Norsk SPC-import er forhåndsvist med repoets importverktøy. PubChem er kontrollert gjennom `authenticated`-rollens ordinære `les_kjemi`-RPC: både THC (CID 16078, C21H30O2, 314,5 g/mol) og THC-syre (CID 108207, C21H28O4, 344,4 g/mol) returneres uten feil.

## Avstemming mot eksisterende OUSFAR-innhold

Eksisterende norsk THC-indikasjon i `supabase/import/indikasjoner/THC.json` og i FAR-produksjon er avstemt mot norsk SPC og beholdt. FEST-koblingen via dronabinol og analyttkoblingene `THC` (moderstoff) og `IRCAK` (metabolitt) bevares; THC-syremotorens fortolkningsregler røres ikke. I FAR-produksjon hadde alle 12 redaksjonelle panel-/elementtypene som den nye migrasjonen skal fylle, **0 publiserte og 0 utkast-elementer** ved kontrollen. Strukturerte norske grunnverdier ble ikke erstattet; migrasjonen stopper ved etterfølgende kollisjon.

## Kvalitetskontroller og siste restanser

- **Bestått:** Produksjons-preflight av de 12 tilsiktede redaksjonelle elementtypene, og bevaring av indikasjon/preparatkobling og norsk konsentrasjonsgrunnlag.
- **Bestått:** Original norsk DMP-SPC for Sativex (15 sider, oppdatert 28.05.2026) hentet direkte som PDF, kildefast tabell s. 8 kontrollert visuelt. Repoets preview viste 53 reaksjoner og 3 fotnoter fordelt over 13 organsystemer, uten feil.
- **Tidligere CI:** Monografikjedetester, norsk SPC-import og bygg bestod samlet på commit `725848cc` (Actions `38026525034`). **Ny full CI må kontrolleres etter denne strukturelle fullføringen.**
- **Bestått:** Authenticated-RPC-test av THC-fagsiden, FEST-preparater og -interaksjoner og Farmakologiportalen. SPC-lesefunksjonen svarte med tom liste før import, som forventet. Aktiv ClinPGx-kobling for THC mangler.
- **Gjenstår før PR klar:** Kontroll av sluttdiff og siste CI for nye dosedata, halveringstid og mestringskort; vurder og håndter eventuelle Codex-funn. **Etter merge:** Kontroller strukturert bivirkningsvisning med 53 norske SPC-reaksjoner og ny serumtabell. Ingen produksjonsmigrasjon før sammenslåing.

## Historikk

- **2026-10-10:** Full systematisk ny gjennomgang av THC, med vekt på klinisk/forensisk fortolkningspresisjon. Skriftlig kilde- og beslutningslogg. Ytterligere uavhengig kildekontroll av isolert dronabinol (FDA 2026) og Cochrane (2026) førte til særskilt dekning av appetitt, antiemese, hemodynamikk og begrenset evidens for smertelindring. Senere samme dag ble FAR-prosjektet lest via direkte prosjekt-ID under «Personlig», og original norsk Sativex-PDF ble selvstendig hentet via en nettverksåpen GitHub Actions-kjører til tross for feil MIME-header i nettleserverktøyet. SPC-revisjon 28.05.2026 og frekvenstabellen på s. 8 er kontrollert. Strukturert import av 53 bivirkninger, med 3 fotnoter, er lagt til med repoets egen forhåndsvisning og migrasjonsgenerator.

- **2026-10-10 (fullføring etter dekningsavvik):** Alle 18 live paneler vurdert systematisk, 15 redaksjonelle/miks-paneler dekket gjennom eksisterende eller nytt innhold og 3 automatiske kontrollert. Ny serumdose–tabell bygger på målte **serum**verdier hos Hunault et al. (2008) og ikke plasma fra Sativex. Tre Sativex-halveringstider registrert med formulering/dose. Lært mestringskort skrevet med lav kausal evidenstillit; alle fem viktige datatyper, seks toksisitetskort, fire graviditetskort og fire avhengighetskort avstemt. Tilhørende test låser dekningsmatrisen til `PANELER`. Fullførende migrasjon er separat og overskriver ingen eksisterende data.
