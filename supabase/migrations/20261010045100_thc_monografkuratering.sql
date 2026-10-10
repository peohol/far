-- Faglig THC-kuratering 10.10.2026.
-- MERK: FORSLAG / DRAFT. OUSFAR-produksjonsbasen var utilgjengelig under
-- kurateringen. Null-preflightene nedenfor MÅ sammenholdes med faktisk
-- publisert/utkast-innhold før denne migrasjonen tillates på main.
-- Ved eksisterende kort stopper hele transaksjonen; ingen data overskrives.
-- Strukturert bivirkningsimport fra norsk Sativex-SPC krever egen kildefidel
-- import og er uttrykkelig IKKE inkludert. Ingen THC-syreregler endres.
do $kuratering$
declare
  side uuid := intern.kuratering_start('thc');
  kilde constant text := 'Monografkuratering av THC 10.10.2026: full kildegjennomgang (nye redaksjonelle kort)';
  k record;
  e record;
  dokument jsonb;
  data jsonb;
  nokkel jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'THC-kurateringen er alt gjort.';
    return;
  end if;

  -- PRE-FLIGHT: eksplisitte forventninger om tomme redaksjonelle paneler.
  -- Dette er ikke verifisert mot produksjon. En uenighet stopper ALT uten
  -- overskriving av utkast eller publiserte elementer.
  perform intern.kuratering_antall(side, 'identitet', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 0);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'bivirkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'farmakokinetikk', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'farmakogenetikk', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'interaksjoner', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 0);
  -- Eksisterende indikasjon, viktige data, serumtabeller, FEST/ClinPGx,
  -- PubChem, Farmakologiportalen og fortolkningsmotoren for IRCAK røres ikke.

  create temporary table thc_kildeliste(
    nokkel text primary key,
    tittel text not null,
    forfattere text not null,
    aar text not null,
    lenke text not null
  ) on commit drop;
  insert into thc_kildeliste values
    ('dmp','Sativex – legemiddelvisning (MT 11-8809)','Direktoratet for medisinske produkter','2026','https://legemiddelsok.no/sider/Legemiddelvisning.aspx?f=&pakningId=3611939b-f0b7-46c8-ae31-76498d856873&pane=0&searchquery=Cannabidiol'),
    ('sativex','Sativex oromucosal spray – Summary of Product Characteristics (UK)','SVX Therapeutics / MHRA','2026','https://www.medicines.org.uk/emc/product/602/smpc'),
    ('marinol','Marinol (dronabinol) capsules – FDA prescribing information, revised 03/2026','US Food and Drug Administration','2026','https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/018651s036lbl.pdf'),
    ('pain','Cannabis-based medicines for chronic neuropathic pain in adults – Cochrane Review 2026','Ateş G, Welsch P, Klose P, et al.','2026','https://doi.org/10.1002/14651858.CD012182.pub3'),
    ('gift','Cannabis – behandlingsanbefaling ved forgiftning','Giftinformasjonen / Helsebiblioteket','2020','https://www.helsebiblioteket.no/forgiftninger/rusmidler/cannabis-behandlingsanbefaling-ved-forgiftning'),
    ('iuphar','Δ9-Tetrahydrocannabinol – ligand data','IUPHAR/BPS Guide to PHARMACOLOGY','2026','https://www.guidetopharmacology.org/GRAC/LigandDisplayForward?ligandId=2424'),
    ('ms','Cannabis and cannabinoids for symptomatic treatment for people with multiple sclerosis','Filippini G, Minozzi S, Borrelli F, et al. (Cochrane)','2022','https://doi.org/10.1002/14651858.CD013444.pub2'),
    ('impair','Determining the magnitude and duration of acute Δ9-THC-induced driving and cognitive impairment','McCartney D, Arkell TR, Irwin C, McGregor IS','2021','https://doi.org/10.1016/j.neubiorev.2021.01.003'),
    ('psych','Psychiatric symptoms caused by cannabis constituents: a systematic review and meta-analysis','Hindley G, Beck K, Borgan F, et al.','2020','https://doi.org/10.1016/S2215-0366(20)30074-2'),
    ('high','High-Concentration Δ9-THC Cannabis Products and Mental Health Outcomes: a Systematic Review','Rittiphairoj T, Leslie L, Oberste JP, et al.','2025','https://doi.org/10.7326/ANNALS-24-03819'),
    ('oralpk','Oral Administration of Cannabis and Δ9-Tetrahydrocannabinol (THC) Preparations: A Systematic Review','Poyatos L, Pérez-Acevedo AP, Papaseit E, et al.','2020','https://doi.org/10.3390/medicina56060309'),
    ('blood','Are blood and oral fluid THC and metabolite concentrations related to impairment? A meta-regression analysis','McCartney D, Arkell TR, Irwin C, Kevin RC, McGregor IS','2022','https://doi.org/10.1016/j.neubiorev.2021.11.004'),
    ('pgx','Interindividual variation in the pharmacokinetics of Δ9-THC as related to genetic polymorphisms in CYP2C9','Sachse-Seeboth C, Pfeil J, Sehrt D, et al.','2009','https://doi.org/10.1038/clpt.2008.213'),
    ('withdraw','Clinical management of cannabis withdrawal','Connor JP, Stjepanović D, Budney AJ, et al.','2022','https://doi.org/10.1111/add.15743'),
    ('cb1pet','Reversible and regionally selective downregulation of brain cannabinoid CB1 receptors in chronic daily cannabis smokers','Hirvonen J, Goodwin RS, Li C-T, et al.','2012','https://doi.org/10.1038/mp.2011.82'),
    ('chs','European Guideline on Chronic Nausea and Vomiting: UEG and ESNM Consensus','Malagelada C, Keller J, Sifrim D, et al.','2025','https://doi.org/10.1002/ueg2.12711'),
    ('preg','Prenatal Cannabis Use and Neonatal Outcomes: A Systematic Review and Meta-Analysis','Lo JO, Ayers CK, Yeddala S, et al.','2025','https://doi.org/10.1001/jamapediatrics.2025.0689'),
    ('lact','Cannabis – Drugs and Lactation Database (LactMed), revisjon 15.07.2026','National Library of Medicine / NICHD','2026','https://www.ncbi.nlm.nih.gov/books/NBK501587/'),
    ('cud','Medicines for the treatment of cannabis use disorder','Cochrane','2025','https://www.cochrane.org/evidence/CD008940_medicines-treatment-cannabis-use-disorder');

  create temporary table thc_kildeobjekter (
    nokkel text primary key,
    referanse uuid not null
  ) on commit drop;

  for k in select * from thc_kildeliste order by nokkel loop
    insert into thc_kildeobjekter (nokkel, referanse)
    values (k.nokkel, intern.kuratering_referanse(
      jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke),
      kilde));
  end loop;

  -- Én rad = én selvstendig kildebelagt påstand, med inline-sitering. Flere
  -- påstander i ett kort blir egne avsnitt med kilde ved hver påstand.
  -- posisjon følger de faste kortenes eksakte indeks.
  create temporary table thc_pastander (
    panel text not null,
    posisjon integer not null,
    elementtype text not null,
    tittel text,
    mekanisme text,
    rekkefolge integer not null,
    tekst text not null,
    kilder text[] not null,
    unique(panel,posisjon,elementtype,rekkefolge)
  ) on commit drop;

  insert into thc_pastander values
    -- Konsis oppsummering
    ('identitet',0,'riktekst',null,null,1,
      'Δ9-tetrahydrocannabinol (THC, dronabinol) er det viktigste rusgivende cannabinoidet i cannabis. Det virker som partiell agonist ved CB₁- og CB₂-reseptorer; sentrale psykiske virkninger formidles i hovedsak gjennom CB₁.',array['iuphar','sativex']),
    ('identitet',0,'riktekst',null,null,2,
      'Akutt THC-eksponering kan endre persepsjon, affekt og tidsopplevelse og svekke oppmerksomhet, hukommelse og psykomotorikk. Effekten varierer mye med dose, administrasjonsvei og tilvenning.',array['impair','gift']),
    ('identitet',0,'riktekst',null,null,3,
      'Det godkjente norske Sativex-preparatet inneholder både THC og cannabidiol (CBD). Resultater fra behandling med denne kombinasjonen må ikke tilskrives THC alene.',array['dmp','ms']),
    ('identitet',0,'riktekst',null,null,4,
      'THC omdannes blant annet til den aktive metabolitten 11-OH-THC og videre til THC-COOH (THC-syre), som primært er en eksponeringsmarkør. Påvisning av metabolitten dokumenterer ikke i seg selv aktuell rus.',array['sativex','blood']),
    ('identitet',0,'riktekst',null,null,5,
      'Gjentatt høy cannabiseksponering kan medføre toleranse, abstinens og cannabisbrukslidelse. Disse er ulike fenomener og forekommer ikke nødvendigvis sammen.',array['withdraw','cb1pet']),
    ('identitet',0,'riktekst',null,null,6,
      'Isolert dronabinol er i USA et godkjent legemiddel ved aidsrelatert anoreksi og kjemoterapiutløst kvalme som ikke har respondert tilstrekkelig på konvensjonell behandling. Disse amerikanske indikasjonene må holdes atskilt fra norsk godkjenning av kombinasjonspreparatet Sativex.',array['marinol','dmp']),

    -- Mekanismer; direkte binding/mekanisme, ikke kliniske virkninger
    ('farmakodynamikk',0,'mekanismekort','CB₁-reseptor','partiell_agonisme',1,
      'THC er en partiell agonist ved CB₁-reseptoren. Aktivering av presynaptiske CB₁-reseptorer modulerer frigjøring av blant annet glutamat og GABA i sentralnervesystemet.',array['iuphar','sativex']),
    ('farmakodynamikk',1,'mekanismekort','CB₂-reseptor','partiell_agonisme',1,
      'THC er også partiell agonist ved CB₂-reseptoren. Reseptorbindingen er dokumentert, men en spesifikk andel av de subjektive ruseffektene kan ikke sikkert tilordnes CB₂.',array['iuphar','sativex']),

    -- Virkninger (ikke mekanismer)
    ('virkninger',0,'kinetikkort','Akutt rus og subjektive virkninger',null,1,
      'THC kan gi endret sansning og tidsopplevelse, eufori eller avslapning, men også uro, angst, derealisasjon og ubehag. Den samme eksponeringen kan gi ulike opplevelser avhengig av person, kontekst og tilvenning.',array['gift','psych']),
    ('virkninger',1,'kinetikkort','Kognisjon og psykomotorikk',null,1,
      'Placebokontrollerte studier samlet i en metaanalyse viser svekkelse av flere kjørerelevante ferdigheter, særlig delt oppmerksomhet, sporing og sideveis kjøretøykontroll. Størrelsen og varigheten av svekkelsen varierer etter dose, inntaksvei og brukshyppighet.',array['impair']),
    ('virkninger',2,'kinetikkort','Psykotomimetiske virkninger',null,1,
      'Kontrollerte THC-administrasjonsstudier viser en akutt økning i positive, negative og generelle psykotomimetiske symptomer mot placebo. Dette er ikke det samme som at enhver eksponert utvikler en vedvarende psykosesykdom.',array['psych']),
    ('virkninger',3,'kinetikkort','Spastisitet ved multippel sklerose',null,1,
      'Nabiximols (THC + CBD, Sativex) har sannsynligvis effekt på pasientrapportert spastisitet ved MS på kort sikt. Dette er dokumentasjon for kombinasjonspreparatet, ikke for at isolert THC alene har tilsvarende dokumentert effekt.',array['ms','sativex']),
    ('virkninger',4,'kinetikkort','Appetittstimulering',null,1,
      'Dronabinol (isolert Δ9-THC) stimulerer appetitten. I USA er kapsler med dronabinol godkjent ved anoreksi assosiert med vekttap hos personer med aids, basert blant annet på placebokontrollerte kliniske studier. Dette er en amerikansk indikasjon, ikke en norsk godkjenning av isolert THC.',array['marinol']),
    ('virkninger',5,'kinetikkort','Antiemetisk effekt',null,1,
      'Isolert dronabinol har dokumentert antiemetisk effekt og er i USA godkjent til voksne med kvalme og oppkast etter kreftkjemoterapi når vanlige kvalmestillende midler har gitt utilstrekkelig effekt. Nyere antiemetiske alternativer og toleranseproblemer begrenser overførbarheten av eldre effektstudier til dagens praksis.',array['marinol']),
    ('virkninger',6,'kinetikkort','Analgetisk effekt',null,1,
      'Det finnes studier av THC-holdige midler ved kroniske nevropatiske smerter, men en oppdatert Cochrane-oversikt fra 2026 fant ikke sikker dokumentasjon for at THC-dominerte preparater gir klinisk betydningsfull smertelindring sammenlignet med placebo. Resultatene gjelder en gruppe ulike THC-dominerte formuleringer, ikke én standardisert THC-dose.',array['pain']),
    ('virkninger',7,'kinetikkort','Kardiovaskulære virkninger',null,1,
      'THC kan gi takykardi, konjunktival injeksjon og varierende blodtrykksrespons, inkludert ortostatisk hypotensjon og synkope. Hemodynamisk ustabilitet er særlig viktig hos personer med underliggende hjertesykdom.',array['marinol','gift']),

    -- Redaksjonell bivirkningskontekst, IKKE en strukturert SPC-tabell
    ('bivirkninger',0,'kinetikkort','Sentrale sikkerhetsmomenter',null,1,
      'Svimmelhet og tretthet er blant de vanligste registrerte bivirkningene av THC/CBD-preparatet Sativex, særlig ved doseopptrapping. Frekvensene gjelder kombinasjonspreparatet og kan ikke uten videre overføres til THC alene.',array['sativex']),
    ('bivirkninger',0,'kinetikkort','Sentrale sikkerhetsmomenter',null,2,
      'Isolert THC kan akutt utløse psykotomimetiske symptomer; ved cannabiseksponering forekommer også takykardi, blodtrykksendringer og koordinasjonssvikt. Risiko er særlig relevant ved psykoselidelse og alvorlig hjertesykdom.',array['psych','gift']),

    -- Toksisitet: faste kort 0-5
    ('toksisitet_forgiftning',0,'kinetikkort','Toksisk dose og eksponering',null,1,
      'Ingen universell THC-dose skiller sikkert mellom forventet rus og klinisk alvorlig forgiftning. Risikoen påvirkes av dose, produktstyrke, inntaksvei, redosering, toleranse, alder og komorbiditet.',array['gift']),
    ('toksisitet_forgiftning',0,'kinetikkort','Toksisk dose og eksponering',null,2,
      'Perorale produkter har forsinket effekt og kan gi utilsiktet gjentatt dosering før første dose har nådd maksimal effekt. Barn er særlig utsatt for alvorlige forløp etter peroralt inntak.',array['gift','oralpk']),
    ('toksisitet_forgiftning',1,'kinetikkort','Toksiske konsentrasjoner',null,1,
      'En isolert THC-konsentrasjon i blod eller serum har ikke en validert universell toksisitetsgrense. Sammenhengen mellom blodkonsentrasjon og funksjonssvekkelse er svak og påvirkes av blant annet tid etter inntak og regelmessig bruk.',array['blood']),
    ('toksisitet_forgiftning',1,'kinetikkort','Toksiske konsentrasjoner',null,2,
      'THC-COOH (THC-syre) dokumenterer primært tidligere cannabinoideksponering og kan ikke brukes som selvstendig mål på aktuell psykomotorisk påvirkning. Konsentrasjoner på tvers av urin, serum, plasma og fullblod skal ikke tolkes som direkte sammenlignbare.',array['blood','oralpk']),
    ('toksisitet_forgiftning',2,'kinetikkort','Klinisk forgiftningsbilde',null,1,
      'Akutt cannabis-/THC-forgiftning kan gi sløvhet, ataksi, svekket konsentrasjon, perceptuelle endringer, angst eller panikk, kvalme, takykardi og blodtrykksforandringer.',array['gift']),
    ('toksisitet_forgiftning',3,'kinetikkort','Alvorlige komplikasjoner',null,1,
      'Alvorlig agitasjon, forbigående psykotiske reaksjoner og sirkulasjonspåvirkning forekommer. Hos små barn kan høye perorale inntak gi langvarig bevissthets- og respirasjonsdepresjon.',array['gift','sativex']),
    ('toksisitet_forgiftning',3,'kinetikkort','Alvorlige komplikasjoner',null,2,
      'Ved langvarig, ofte høy cannabisbruk kan cannabinoid hyperemesis gi tilbakevendende episoder med alvorlig oppkast. Denne sammenhengen gjelder kronisk cannabiseksponering, ikke ett enkelt THC-inntak.',array['chs']),
    ('toksisitet_forgiftning',4,'kinetikkort','Toksikokinetiske særtrekk',null,1,
      'Etter inhalasjon inntrer effekten raskt; etter peroralt inntak kan maksimal virkning komme flere timer senere. THC er svært lipofilt og har flerfasisk fordeling/eliminasjon med en lang terminal fase etter gjentatt bruk.',array['gift','oralpk','sativex']),
    ('toksisitet_forgiftning',5,'kinetikkort','Behandling ved forgiftning',null,1,
      'Det finnes ingen etablert THC-antidot. Ved akutt forgiftning rettes behandlingen mot kliniske symptomer og komplikasjoner; betydelig uro og angst kan behandles med benzodiazepiner, og alvorlige psykotiske symptomer kan kreve antipsykotisk behandling.',array['gift']),
    ('toksisitet_forgiftning',5,'kinetikkort','Behandling ved forgiftning',null,2,
      'Ved mistanke om cannabinoid hyperemesis er vedvarende opphør av cannabiseksponeringen det viktigste spesifikke tiltaket. Dokumentasjonen for akutte medikamentelle tiltak er begrenset.',array['chs']),

    -- Eksisterende indikasjon bevares. Dosering er produktspesifikk.
    ('dosering',0,'riktekst',null,null,1,
      'For Sativex munnspray (THC + CBD) inneholder hver 100 mikroliter spraydose 2,7 mg THC og 2,5 mg CBD. Indikasjonen er tillegg til annen antispastisk behandling hos voksne med moderat til alvorlig MS-spastisitet og utilstrekkelig respons på andre legemidler.',array['sativex','dmp']),
    ('dosering',0,'riktekst',null,null,2,
      'Doseringen trappes gradvis opp etter preparatomtalens skjema, fra én spray om kvelden, med minst 15 minutter mellom spraydoser. Maksimal anbefalt døgndose er 12 sprayer (32,4 mg THC og 30 mg CBD); median dose i kliniske MS-studier var åtte sprayer per dag.',array['sativex']),
    ('dosering',0,'riktekst',null,null,3,
      'Klinisk respons vurderes etter fire ukers forsøksbehandling. Behandling avsluttes ved manglende klinisk relevant bedring. Doseringsanvisningene gjelder Sativex og skal ikke brukes som generell doseanbefaling for inhalert, peroralt eller isolert THC.',array['sativex']),

    -- Farmakokinetikk
    ('farmakokinetikk',0,'kinetikkort','Opptak og betydningen av administrasjonsvei',null,1,
      'Inhalert THC absorberes raskt og kan gi høye tidlige blodtopper. Peroral tilførsel gir senere og mer variabel absorpsjon, med større betydning av førstepassasje og den aktive metabolitten 11-OH-THC.',array['oralpk','sativex']),
    ('farmakokinetikk',0,'kinetikkort','Opptak og betydningen av administrasjonsvei',null,2,
      'Etter en enkeltdose på fire sprayer Sativex (10,8 mg THC og 10 mg CBD) angir preparatomtalen en gjennomsnittlig maksimal THC-plasmakonsentrasjon rundt 4 ng/mL etter cirka 45–120 minutter, men interindividuell variabilitet er stor. Dette er ikke en generell THC-Tmax.',array['sativex']),
    ('farmakokinetikk',1,'kinetikkort','Distribusjon og proteinbinding',null,1,
      'THC er svært fettløselig, fordeles raskt til vev og kan redistribueres langsomt fra fettdepoter. Sativex-preparatomtalen oppgir høy proteinbinding for THC (omtrent 97 %).',array['sativex']),
    ('farmakokinetikk',2,'kinetikkort','Metabolisme og metabolitter',null,1,
      'Levermetabolisme omfatter blant annet CYP2C9-katalysert dannelse av den farmakologisk aktive metabolitten 11-OH-THC. Videre oksidasjon gir 11-nor-9-karboksy-THC (THC-COOH, THC-syre), en viktig laboratoriemarkør for cannabiseksponering; CYP3A-enzymer medvirker i alternative hydroksyleringer.',array['sativex']),
    ('farmakokinetikk',3,'kinetikkort','Halveringstid og eliminasjon',null,1,
      'Tilsynelatende THC-halveringstid avhenger sterkt av administrasjonsvei, dosering, måleperiode og modell. Sativex-data gir korte estimater etter enkeltdoser, mens litteraturen beskriver en langt langsommere terminal fase på rundt ett til flere døgn som delvis gjenspeiler redistribusjon.',array['sativex','oralpk']),
    ('farmakokinetikk',3,'kinetikkort','Halveringstid og eliminasjon',null,2,
      'Et enkelt samlet THC-halveringstidstall bør derfor ikke stå som et universelt farmakokinetisk nøkkeltall. Påvisningstid for THC-COOH kan ikke avledes direkte fra plasmahalveringstiden for THC.',array['sativex','blood']),

    -- Farmakogenetikk
    ('farmakogenetikk',0,'kinetikkort','CYP2C9 – metabolisme og genetisk variasjon',null,1,
      'CYP2C9 er sentralt i THC-metabolismen. I en liten studie med 43 friske frivillige var median THC-AUC omtrent tre ganger høyere hos CYP2C9*3/*3 enn hos *1/*1 etter peroral THC; tilsvarende ble nivåene av THC-COOH lavere.',array['pgx','sativex']),
    ('farmakogenetikk',0,'kinetikkort','CYP2C9 – metabolisme og genetisk variasjon',null,2,
      'CYP2C9*2 ga ikke tilsvarende effekt i dette materialet. Forsøket er lite, og resultatene kan ikke uten videre generaliseres til alle THC-produkter eller brukes som en validert genotypebasert doseringstabell.',array['pgx']),
    ('farmakogenetikk',1,'kinetikkort','Klinisk relevans av farmakogenetiske funn',null,1,
      'Genetisk variasjon kan bidra til forskjeller i eksponering, men dokumentasjonen for at rutinemessig CYP2C9-genotyping bedrer THC-behandling eller akutt rusvurdering er utilstrekkelig. Vurder klinikk, inntaksvei, andre legemidler og øvrige risikofaktorer først.',array['pgx','sativex']),

    -- Interaksjoner: redaksjonell oversikt i tillegg til automatisk FEST-lag
    ('interaksjoner',0,'riktekst',null,null,1,
      'Sativex-preparatomtalen beskriver farmakokinetiske interaksjoner: ketokonazol (sterk CYP3A4-hemmer) økte THC-AUC omtrent 1,8 ganger, mens flukonazol (CYP2C9-hemmer) økte THC-AUC omtrent 32 %. Dette er data for kombinasjonen THC/CBD og kan ikke automatisk overføres til alle THC-produkter.',array['sativex']),
    ('interaksjoner',0,'riktekst',null,null,2,
      'Rifampicin (CYP3A4-induktor) reduserte THC-eksponeringen i et Sativex-interaksjonsforsøk. Tilføyelse eller seponering av enzymhemmere eller -induktorer kan kreve ny vurdering av Sativex-dosen.',array['sativex']),
    ('interaksjoner',0,'riktekst',null,null,3,
      'Alkohol, benzodiazepiner, hypnotika og andre sentraldempende legemidler kan gi additiv sedasjon, svekket koordinasjon og økt fallrisiko. De konkrete preparatinteraksjonene hentes ellers fra appens automatiske FEST-kobling.',array['sativex']),

    -- TDM: uten oppdiktet terapeutisk referanseområde
    ('tdm',0,'kinetikkort','Konsentrasjon og klinisk påvirkning',null,1,
      'Det finnes ikke ett allment validert THC-konsentrasjonsmål som kan forutsi aktuell subjektiv rus, psykomotorisk svekkelse eller behandlingsbehov. I metaregresjoner er sammenhengen mellom THC i blod/oralvæske og funksjonsmål gjennomgående svak og avhengig av brukshistorikk.',array['blood']),
    ('tdm',0,'kinetikkort','Konsentrasjon og klinisk påvirkning',null,2,
      'Ved tolkning må analysen spesifisere moderstoff eller metabolitt, prøvematrise (serum/plasma, fullblod, urin), prøvetidspunkt, bruksmønster og tilhørende klinikk. THC-COOH i urin er først og fremst en eksponeringsmarkør; dette er ikke et generelt terapeutisk referanseområde for THC.',array['blood','gift']),

    -- Graviditet/amming/reproduksjon; faste kort 0-3
    ('graviditet_amming',0,'kinetikkort','Graviditet',null,1,
      'THC kan passere placenta, og eksponering bør unngås under svangerskap. En systematisk oversikt over cannabisbruk under graviditet fant etter justering assosiasjoner med lav fødselsvekt (OR 1,75), prematur fødsel (OR 1,52) og lav vekt for gestasjonsalder (OR 1,57).',array['preg']),
    ('graviditet_amming',0,'kinetikkort','Graviditet',null,2,
      'Studiene gjelder cannabisbruk, ikke kontrollert eksponering for isolert THC. Røyking, samtidige stoffer, indikasjon og andre livsstilsforhold kan gi residual konfundering; tallene må ikke presenteres som THC-spesifikke kausale risikoer.',array['preg']),
    ('graviditet_amming',1,'kinetikkort','Perinatal og neonatal påvirkning',null,1,
      'I observasjonsstudier er prenatal cannabisbruk assosiert med ugunstige fødselsutfall, men det finnes ikke godt grunnlag for å angi en sikker, særskilt frekvens av et neonatalt THC-abstinenssyndrom. Differensier intrauterin eksponering fra symptomer etter fødsel.',array['preg']),
    ('graviditet_amming',2,'kinetikkort','Amming',null,1,
      'THC går over i morsmelk og er i forskjellige studier påvist fra flere dager til over seks uker etter siste rapporterte cannabiseksponering. Konsentrasjonen og beregnet halveringstid varierer betydelig med metode og tidligere bruk.',array['lact']),
    ('graviditet_amming',2,'kinetikkort','Amming',null,2,
      'LactMed oppgir utilstrekkelig dokumentasjon om barnets langtidsutvikling og at faglige anbefalinger gjennomgående fraråder cannabisbruk ved amming. Sativex er kontraindisert ved amming i preparatomtalen; dette er et preparatspesifikt regulatorisk råd.',array['lact','sativex']),
    ('graviditet_amming',3,'kinetikkort','Fertilitet og reproduksjon',null,1,
      'Menneskedata om isolert THC og fertilitet er begrensede. Preparatomtalen for Sativex omtaler dyredata og usikkerhet om reproduksjonseffekter, men dette gir ikke grunnlag for en presis THC-spesifikk human infertilitetsrisiko.',array['sativex']),

    -- Fysiologisk adaptasjon og læring
    ('avhengighet_toleranse',0,'kinetikkort','Toleranseutvikling',null,1,
      'Ved gjentatt og særlig daglig cannabisbruk kan toleranse for flere THC-effekter utvikles. Human PET-forskning viser redusert tilgjengelighet av CB₁-reseptorer ved daglig bruk og delvis eller omfattende normalisering under uker med abstinens; mekanismen må ikke brukes til å anslå individuell toleranse numerisk.',array['cb1pet']),
    ('avhengighet_toleranse',1,'kinetikkort','Abstinens, seponeringssyndrom og rebound-effekter',null,1,
      'Etter regelmessig, langvarig THC-holdig cannabisbruk kan rask reduksjon eller opphør gi irritabilitet, angst, søvnforstyrrelser eller livlige drømmer, nedstemthet og redusert appetitt.',array['withdraw']),
    ('avhengighet_toleranse',1,'kinetikkort','Abstinens, seponeringssyndrom og rebound-effekter',null,2,
      'Symptomer debuterer typisk etter 24–48 timer og er ofte mest uttalte dag 2–6; hos storforbrukere kan enkelte plager vedvare i tre uker eller mer. Dette er et fysiologisk seponeringssyndrom og er ikke synonymt med addiksjon.',array['withdraw']),
    ('avhengighet_toleranse',2,'kinetikkort','Addiksjon',null,1,
      'Cannabisbrukslidelse kan innebære kontrolltap, craving og videre bruk til tross for skadelige konsekvenser. Toleranse eller abstinens kan forekomme uten at alle kriterier for addiksjon er oppfylt; disse fenomenene bør beskrives separat.',array['withdraw','high']),
    ('avhengighet_toleranse',2,'kinetikkort','Addiksjon',null,2,
      'Studier av produkter med høye THC-konsentrasjoner finner bekymringsfulle assosiasjoner med cannabisbrukslidelse, men mange studier har betydelig risiko for skjevhet og kan ikke gi et presist individuelt risikoestimat for isolert THC.',array['high']);
  -- «Lært mestringsavhengighet» står bevisst tomt: utilstrekkelig
  -- THC-spesifikk dokumentasjon for en kort, kildepresis kausal beskrivelse.

  for e in
    select distinct panel, posisjon, elementtype, tittel, mekanisme
    from thc_pastander
    order by panel, posisjon, elementtype, tittel, mekanisme
  loop
    select jsonb_agg(
      jsonb_build_object(
        'type','paragraph',
        'content',jsonb_build_array(
          jsonb_build_object('type','text','text',p.tekst),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',
            (select jsonb_agg(o.referanse order by a.ord)
             from unnest(p.kilder) with ordinality as a(nokkel,ord)
             join thc_kildeobjekter o on o.nokkel=a.nokkel)
          ))
        )
      ) order by p.rekkefolge
    ) into dokument
    from thc_pastander p
    where p.panel=e.panel and p.posisjon=e.posisjon
      and p.elementtype=e.elementtype
      and p.tittel is not distinct from e.tittel;

    if dokument is null then
      raise exception 'Tomt kildebelegg i %: %', e.panel, e.tittel;
    end if;
    data := jsonb_build_object('dokument',jsonb_build_object('type','doc','content',dokument));
    nokkel := '{}'::jsonb;
    if e.tittel is not null and e.elementtype='mekanismekort' then
      data := data || jsonb_build_object('maal',e.tittel,'mekanisme',e.mekanisme);
      nokkel := jsonb_build_object('maal',e.tittel);
    elsif e.tittel is not null then
      data := data || jsonb_build_object('tittel',e.tittel);
      nokkel := jsonb_build_object('tittel',e.tittel);
    end if;

    perform intern.kuratering_nytt(
      side,
      jsonb_build_object(
        'panel',e.panel, 'posisjon',e.posisjon,
        'elementtype',e.elementtype,'data',data,'referanser','[]'::jsonb
      ),
      nokkel, kilde
    );
  end loop;
end
$kuratering$;
