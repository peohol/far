# Evidensjournal – lurasidon

- **Oppgave:** `lurasidon-0002`
- **Modus:** de novo
- **Omfang:** full ordinær kuratering
- **Dekningsmodell:** 37 kontrollpunkter
- **Status:** blind protokoll låst før substansspesifikt kildesøk og før innsyn i eksisterende redaksjonelt innhold

## Låst blind evidensprotokoll

Eksisterende lurasidon-tekst, tidligere referanser og tidligere evidensjournal skal ikke leses før den blinde evidensinnhentingen og den adversarielle kontrollen er dokumentert og commit-et. Den maskinlesbare planen ligger i `docs/kurateringsjournal/lurasidon-dekning.json`.

### Kilde- og søkeplan

1. **Regulatorisk grunnlag:** norsk SPC/DMP, EMA/EPAR og FDA-label for identitet, indikasjoner, preparater, dosering, kontraindikasjoner, interaksjoner og sikkerhet.
2. **Kliniske virkninger:** sentrale randomiserte studier og systematiske oversikter/meta-analyser for schizofreni og andre relevante regulatoriske indikasjoner; absolutte og relative effektmål når de kan etterprøves.
3. **Farmakodynamikk:** regulatoriske dokumenter og originalkilder for reseptorprofil og plausibel mekanisme; mekanisme skal ikke fremstilles som dokumentert klinisk årsak.
4. **Farmakokinetikk:** matpåvirkning, biotilgjengelighet, Tmax, distribusjon, proteinbinding, CYP3A4-metabolisme, aktive metabolitter, eliminasjon, halveringstid og steady state.
5. **Interaksjoner og farmakogenetikk:** kliniske DDI-data og retningslinjer fra CPIC, DPWG/ClinPGx og FDA; fravær av handlingsbar PGx-anbefaling skal dokumenteres eksplisitt.
6. **TDM og laboratorieanalyse:** norske laboratoriekilder/Farmakologiportalen, AGNP og originale serumstudier; matriks, enhet, prøvetid og klinisk kontekst kontrolleres.
7. **Toksisitet:** Giftinformasjonen/Helsebiblioteket, regulatoriske kilder og originalserier/kasuistikker for dose, konsentrasjon, symptomer, komplikasjoner, tidsforløp og behandling.
8. **Graviditet, amming og fertilitet:** norsk SPC, LactMed, UKTIS/Embryotox og registre/originalstudier, med separat vurdering av neonatal påvirkning.
9. **Avhengighet og seponering:** regulatoriske kilder og klinisk litteratur om toleranse, rebound/seponeringsfenomener, misbrukspotensial og funksjonell mestringsavhengighet.
10. **Adversariell kontroll:** aktivt søk etter nullfunn, effekt-heterogenitet, akatisi/EPS, metabolsk og kardiell risiko, interessekonflikter og begrensninger i langtidsevidensen.

### Tall- og påstandskontroll

Alle tall skal få populasjon, endepunkt, tidsrom, sammenligning, estimat og usikkerhet når tilgjengelig. Påstander skal ha påstandsnær kilde. Direkte kopiering av formuleringer unngås. Serum- og plasmakonsentrasjoner blandes ikke, og norske referanseområder endres bare med eksplisitt kildegrunnlag.

### Fullføringskriterier

Samtlige 37 kontrollpunkter skal være vurdert som `dekket`, `ikke_relevant` eller eksplisitt begrunnet `kunne_ikke_verifiseres`. SPC- og runtimekontroll, dekningsvalidator, referansekontroll, migrasjonskontroll og relevante tester skal være bestått før utkast-PR meldes til køen.


## Blind evidensinnhenting låst 2026-10-14

Denne delen ble skrevet og commit-et før eksisterende lurasidoninnhold, tidligere referanser eller tidligere journal ble lest.

### Regulatorisk ramme og identitet

- Norsk SPC for Lurasidone Accord (oppdatert 17.04.2026) angir schizofreni hos voksne og ungdom over 13 år, startdose 37 mg én gang daglig med mat, doseområde 37–148 mg hos voksne og 37–74 mg hos ungdom. Moderate CYP3A4-hemmere krever startdose 18,5 mg og maks 74 mg; sterke CYP3A4-hemmere og -induktorer er kontraindisert.
- FEST-kontrollen fant ni markedsførte preparater og 12 pakninger. Tre DMP-adresser dekket Accord-styrkene 18,5, 37 og 74 mg med ett identisk SPC-dokument. Seks Latuda-preparater manglet DMP-adresse fordi de er sentralt godkjent; EMA-produktinformasjonen brukes som supplerende SPC-kilde.
- Lurasidon (fri base) har formel C28H36N4O2S, molekylmasse 492,7 g/mol, CAS 367514-87-2 og ATC N05AE05.

### Farmakodynamikk og virkning

- Høy affinitet er dokumentert for D2, 5-HT2A og 5-HT7; lurasidon er antagonist ved D2/5-HT7 og partiell agonist ved 5-HT1A. Affiniteten for H1 og muskarine reseptorer er ubetydelig. Mekanismen er plausibel, men forklarer ikke alene klinisk effekt.
- Norsk SPC viser heterogene seksukersstudier hos voksne: noen doser/studier var ikke signifikante og det fantes ingen konsistent dose-respons. En meta-analyse av åtte RCT-er (n=2373) fant en moderat liten effekt på total psykopatologi, SMD -0,34 (95 % KI -0,48 til -0,20).
- En asiatisk RCT ga et viktig nullfunn: 40 og 80 mg var ikke signifikante i den forhåndsangitte mITT-analysen (placeboforskjell -4,8; p=0,050 og -4,2; p=0,080), selv om ITT-analysen var signifikant.
- Etter åpen stabilisering reduserte fortsatt behandling tilbakefallsrisiko mot randomisert seponering/placebo: HR 0,663 (95 % KI 0,447–0,983), med estimert tilbakefall ved uke 28 på 42,2 % mot 51,2 % (NNT om lag 12). Berikelses- og seponeringsdesignet begrenser generaliserbarheten.

### Bivirkninger og adversariell kontroll

- Norsk SPC angir akatisi, kvalme og insomni som de vanligste bivirkningene. I korttidsstudier hos voksne var EPS uten akatisi/rastløshet 13,5 % mot 5,8 % med placebo og akatisi 12,9 % mot 3,0 %.
- Meta-analyse av nyere antipsykotika estimerte akatisi ved lurasidon til 12,7 % (95 % KI 10,1–16,1) og OR 3,74 (95 % KI 2,32–6,02) mot kontroll.
- Metabolsk belastning er ofte mindre enn for enkelte andre antipsykotika, men ikke fraværende: meta-analysen fant liten, statistisk signifikant vekt-/BMI-økning mot placebo, og SPC krever vekt- og glukoseovervåking.
- En grundig QT-studie viste maksimal gjennomsnittlig QTcI-økning 7,5 ms (øvre ensidig 95 % KI 11,7) ved 120 mg og 4,6 ms (9,5) ved 600 mg; sjeldne kasuistikker gjør at QT-risiko ikke kan omtales som null.
- Flere sentrale studier og analyser var industrifinansiert eller hadde forfattere ansatt hos produsent. Dette skal oppgis der konkrete resultater brukes.

### Farmakokinetikk og interaksjoner

- Tmax er 1–3 timer, proteinbinding ca. 99 %, distribusjonsvolum ca. 6000 liter, og halveringstid 20–40 timer i norsk SPC. Steady state nås innen sju dager.
- Mat øker eksponeringen vesentlig. I kryss-over-studier doblet et måltid omtrent AUC; minst 350 kcal ga maksimal eksponering uavhengig av fettinnhold.
- Metabolismen skjer hovedsakelig via CYP3A4. Ketokonazol økte lurasidoneksponeringen ni ganger, diltiazem ca. 2,2 ganger, og rifampicin reduserte den omtrent seks ganger. Grapefruktjuice skal unngås.
- Utskillelsen etter radiomerket dose var ca. 67 % i feces og 19 % i urin, med minimal renal utskillelse av uendret stoff.

### TDM og laboratorieanalyse

- Farmakologiportalen viser serum-/plasmaanalyse ved St. Olavs hospital, Diakonhjemmet og OUS; OUS bruker LC-MS/MS, serum uten gel, og måleområde 2–200 nmol/L.
- Farmakologiportalens substansside har per 2026 intet norsk referanseområde. Det beskyttede norske referansefeltet skal derfor ikke fylles med et utenlandsk intervall.
- Internasjonal konsensus oppgir ofte 15–40 ng/mL (omtrent 30–81 nmol/L) som terapeutisk referanseområde, men nyere data utfordrer dette: i 123 kinesiske bunnprøver var medianen 7,09 ng/mL, og 85,6 % lå under 15 ng/mL. Intervallet kan omtales som usikkert uten å erstatte norsk referanseområde.
- Standardisert prøvetaking bør være bunnkonsentrasjon, vanligvis 12–24 timer etter siste dose og ved steady state, med mat, tidspunkt, dose, etterlevelse og CYP3A4-interaksjoner dokumentert.

### Farmakogenetikk

- CPIC release v1.60.1 har ingen gen–lurasidon-par, og ClinPGx-runtime viste ingen retningslinjer eller preparatomtaleannotasjoner. CYP3A4 er farmakokinetisk sentralt, men det foreligger ingen validert genotypebasert doseanbefaling. Farmakogenetikk skal ikke overtolkes som klinisk handlingsbar.

### Forgiftning

- I 1753 rapporterte, tilsiktede enkeltstoffoverdoser var alvorlig effekt registrert i 0,7 %, moderat effekt i 14,8 %, og det var ingen dødsfall. Vanligst var døsighet (25,6 %), takykardi (14,5 %), oppkast (6,9 %) og hypertensjon (6,6 %); dose skilte ikke sikkert mellom alvorlighetsgrader.
- En eldre Texas-serie hadde 140 eksponeringer; rapportert dose var 20–4000 mg (gjennomsnitt 536 mg). Flertallet av rene inntak fikk ikke alvorlig utfall.
- Det finnes ingen validert toksisk serumkonsentrasjon, ingen sikker dosegrense for alvorlig forgiftning og ingen etablert intoksikasjons–konsentrasjonsrelasjon. Disse feltene skal stå uten tall.
- Behandlingen er støttebehandling uten antidot, med kontinuerlig EKG og behandling av hypotensjon/EPS etter klinikk. Adrenalin/dopamin kan forverre hypotensjon ved alfablokade; aktivt kull kan vurderes tidlig etter risikovurdering.

### Graviditet, amming og fertilitet

- Norsk SPC angir færre enn 300 graviditetsutfall og ukjent human risiko; bruk bare når klart nødvendig. Tredjetrimestereksponering kan gi neonatal EPS/seponeringssymptomer.
- Et prospektivt graviditetsregister hadde 134 lurasidoneksponerte svangerskap: større misdannelser 2,19 % mot 1,77 % hos kontroller, OR 1,24 (95 % KI 0,36–4,32). Ingen særskilt mønster ble sett, men intervallet er vidt.
- Ni ammende kvinner (20–80 mg/døgn) ga estimert relativ spedbarnsdose 1,16 %, med verstefall 3,03 %, og ingen rapporterte spedbarnsbivirkninger. Datagrunnlaget er fortsatt lite, særlig for premature og nyfødte.
- Dyredata viser prolaktinrelaterte fertilitetseffekter; human klinisk relevans er uklar. Hyperprolaktinemi kan påvirke menstruasjon og seksualfunksjon.

### Toleranse, seponering og addiksjon

- FDA-labelen oppgir at lurasidon ikke er kontrollert stoff, og at kliniske studier ikke viste legemiddelsøkende atferd. Misbruk, fysisk avhengighet og toleranse er imidlertid ikke systematisk studert.
- Ingen lurasidonspesifikk abstinensprofil eller validert seponeringsfrekvens ble funnet. Symptomer etter seponering må skilles fra sykdomstilbakefall; randomiserte seponeringsstudier er ikke egnet til å fastslå fysisk abstinens.
- Lært mestringsavhengighet er ikke et validert, substansspesifikt endepunkt for lurasidon og kan ikke tallfestes.

### Blinde kilder

1. DMP, Lurasidone Accord SPC, oppdatert 17.04.2026: https://produktinformasjon.legemiddelsok.no/preparatomtaler/22-15235.pdf
2. EMA, Latuda EPAR/product information, oppdatert 08.05.2026: https://www.ema.europa.eu/en/medicines/human/EPAR/latuda
3. FDA, Latuda prescribing information, 01/2025: https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/200603s041lbl.pdf
4. Ishibashi et al., reseptorprofil, PMID 20404009: https://pubmed.ncbi.nlm.nih.gov/20404009/
5. Preskorn et al., matstudier, PMID 24014143: https://pubmed.ncbi.nlm.nih.gov/24014143/
6. Zheng et al., korttidsmeta-analyse, PMID 29906709: https://pubmed.ncbi.nlm.nih.gov/29906709/
7. Higuchi et al., asiatisk RCT og nullfunn, PMID 30950208: https://pubmed.ncbi.nlm.nih.gov/30950208/
8. Tandon et al., vedlikeholds-/seponeringsstudie, PMID 26645209: https://pubmed.ncbi.nlm.nih.gov/26645209/
9. Carbon et al., akatisi-meta-analyse, PMID 31065941: https://pubmed.ncbi.nlm.nih.gov/31065941/
10. Farmakologiportalen, lurasidon: https://www.farmakologiportalen.no/content/9001/Lurasidon
11. ASCP/TDM-konsensus: https://www.psychiatrist.com/pdf/blood-levels-to-optimize-antipsychotic-treatment-in-clinical-practice-a-joint-consensus-statement-of-the-american-society-of-clinical-psychopharmacology-and-the-therapeutic-drug-monitoring-task-force
12. Yang et al., TDM, PMID 39671209: https://pubmed.ncbi.nlm.nih.gov/39671209/
13. Klein-Schwartz et al., NPDS-overdoser, PMID 32167797: https://pubmed.ncbi.nlm.nih.gov/32167797/
14. Forrester, Texas Poison Centers, PMID 34860899: https://pubmed.ncbi.nlm.nih.gov/34860899/
15. Cohen et al., graviditetsregister, PMID 36716275: https://pubmed.ncbi.nlm.nih.gov/36716275/
16. Campbell et al., morsmelk, PMID 41129619: https://pubmed.ncbi.nlm.nih.gov/41129619/
17. PubChem CID 213046: https://pubchem.ncbi.nlm.nih.gov/compound/lurasidone

## Blind beslutning før sammenligning

Planlagt monografi skal prioritere norsk/EU-godkjent schizofreniindikasjon, matkravet, CYP3A4-interaksjoner, akatisi/EPS og den begrensede sikkerheten i TDM-, toksisitets- og reproduksjonsdata. Bipolar depresjon omtales som regulatorisk ulikt mellom jurisdiksjoner, ikke som norsk godkjent indikasjon. Norske referanse- og toksisitetsfelt skal ikke gis utenlandske eller ekstrapolerte tall.
