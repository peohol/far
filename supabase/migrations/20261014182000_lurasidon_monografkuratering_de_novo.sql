-- Full de novo-kuratering av lurasidon etter blind evidensinnhenting.
-- Norsk referanseområde 5-60 nmol/L og automatiske FEST-/laboratorie-/kjemilag bevares.

do $lurasidon_de_novo$
declare
  side uuid := intern.kuratering_start('lurasidon');
  kilde constant text := 'Lurasidon de novo-kuratering 14.10.2026: blind evidens og adversarial kontroll';
  obj uuid;
  spc uuid;
  fda uuid;
  reseptor uuid;
  matstudie uuid;
  effektmeta uuid;
  asiatisk_rct uuid;
  vedlikehold uuid;
  akatisimeta uuid;
  tdmkonsensus uuid;
  tdmrealdata uuid;
  farmakologiportalen uuid;
  npds uuid;
  texas uuid;
  graviditetsregister uuid;
  melkestudie uuid;
  data jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'indikasjon', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'interaksjoner', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 6);
  perform intern.kuratering_antall(side, 'farmakokinetikk', 'kinetikkort', 8);
  perform intern.kuratering_antall(side, 'farmakogenetikk', 'kinetikkort', 1);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'bivirkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 0);

  spc := intern.kuratering_referanse(
    '{"tittel":"Lurasidone Accord - preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2026","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/22-15235.pdf"}', kilde);
  fda := intern.kuratering_referanse(
    '{"tittel":"Latuda - prescribing information","forfattere":"U.S. Food and Drug Administration","aar":"2025","lenke":"https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/200603s041lbl.pdf"}', kilde);
  reseptor := intern.kuratering_referanse(
    '{"tittel":"Pharmacological profile of lurasidone, a novel antipsychotic agent with potent 5-HT7 and 5-HT1A receptor activity","forfattere":"Ishibashi T, Horisawa T, Tokuda K, et al.","aar":"2010","lenke":"https://pubmed.ncbi.nlm.nih.gov/20404009/"}', kilde);
  matstudie := intern.kuratering_referanse(
    '{"tittel":"Effect of food on the pharmacokinetics of lurasidone: results of two randomized, open-label, crossover studies","forfattere":"Preskorn S, Ereshefsky L, Chiu YY, et al.","aar":"2013","lenke":"https://pubmed.ncbi.nlm.nih.gov/24014143/"}', kilde);
  effektmeta := intern.kuratering_referanse(
    '{"tittel":"Short-term efficacy and tolerability of lurasidone in the treatment of acute schizophrenia: a meta-analysis of randomized controlled trials","forfattere":"Zheng W, Cai DB, Yang XH, et al.","aar":"2018","lenke":"https://pubmed.ncbi.nlm.nih.gov/29906709/"}', kilde);
  asiatisk_rct := intern.kuratering_referanse(
    '{"tittel":"Lurasidone in the treatment of schizophrenia: results of a double-blind, placebo-controlled trial in Asian patients","forfattere":"Higuchi T, Ishigooka J, Iyo M, et al.","aar":"2019","lenke":"https://pubmed.ncbi.nlm.nih.gov/30950208/"}', kilde);
  vedlikehold := intern.kuratering_referanse(
    '{"tittel":"A double-blind, placebo-controlled, randomized withdrawal study of lurasidone for the maintenance of efficacy in patients with schizophrenia","forfattere":"Tandon R, Cucchiaro J, Phillips D, et al.","aar":"2016","lenke":"https://pubmed.ncbi.nlm.nih.gov/26645209/"}', kilde);
  akatisimeta := intern.kuratering_referanse(
    '{"tittel":"Medication-induced akathisia with newly approved antipsychotics in patients with a severe mental illness: a systematic review and meta-analysis","forfattere":"Carbon M, Hsieh CH, Kane JM, Correll CU","aar":"2019","lenke":"https://pubmed.ncbi.nlm.nih.gov/31065941/"}', kilde);
  tdmkonsensus := intern.kuratering_referanse(
    '{"tittel":"Blood levels to optimize antipsychotic treatment in clinical practice: a joint consensus statement","forfattere":"Schoretsanitis G, Kane JM, Correll CU, et al.","aar":"2020","lenke":"https://www.psychiatrist.com/pdf/blood-levels-to-optimize-antipsychotic-treatment-in-clinical-practice-a-joint-consensus-statement-of-the-american-society-of-clinical-psychopharmacology-and-the-therapeutic-drug-monitoring-task-force"}', kilde);
  tdmrealdata := intern.kuratering_referanse(
    '{"tittel":"Preliminary determination of the therapeutic reference range of lurasidone in Chinese patients and analysis of factors influencing dose-corrected concentrations","forfattere":"Yang Y, Wang Z, Xiao T, et al.","aar":"2024","lenke":"https://pubmed.ncbi.nlm.nih.gov/39671209/"}', kilde);
  farmakologiportalen := intern.kuratering_referanse(
    '{"tittel":"Lurasidon","forfattere":"Farmakologiportalen","aar":"2026","lenke":"https://www.farmakologiportalen.no/content/9001/Lurasidon"}', kilde);
  npds := intern.kuratering_referanse(
    '{"tittel":"Characterization of intentional lurasidone ingestions using the United States National Poison Data System","forfattere":"Klein-Schwartz W, Anderson B, Schwartz EK","aar":"2020","lenke":"https://pubmed.ncbi.nlm.nih.gov/32167797/"}', kilde);
  texas := intern.kuratering_referanse(
    '{"tittel":"Lurasidone ingestions reported to Texas poison centers","forfattere":"Forrester MB","aar":"2014","lenke":"https://pubmed.ncbi.nlm.nih.gov/34860899/"}', kilde);
  graviditetsregister := intern.kuratering_referanse(
    '{"tittel":"Reproductive safety of lurasidone and quetiapine: update from the National Pregnancy Registry for Psychiatric Medications","forfattere":"Cohen LS, Church TR, Freeman MP, et al.","aar":"2023","lenke":"https://pubmed.ncbi.nlm.nih.gov/36716275/"}', kilde);
  melkestudie := intern.kuratering_referanse(
    '{"tittel":"Balancing mental health and breastfeeding: evaluating the transfer of lurasidone into human milk","forfattere":"Campbell LS, Datta P, Krutsch K","aar":"2025","lenke":"https://pubmed.ncbi.nlm.nih.gov/41129619/"}', kilde);

  -- Korriger indikasjon og dosering mot gjeldende norsk SPC.
  obj := intern.kuratering_element(side, 'indikasjon', 'riktekst', '{}'::jsonb, 2,
    'Tatt bort: datoen for kontroll mot Felleskatalogen');
  data := jsonb_build_object('dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Godkjent indikasjon i Norge er behandling av schizofreni hos voksne og ungdom fra og med 13 år.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Bipolar depresjon er godkjent i USA, men er ikke norsk/EU-godkjent indikasjon.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,fda)))
    ))
  )));
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(side, 'dosering', 'riktekst', '{}'::jsonb, 1,
    'Importert fra Psykofarmaka.pdf, side 51');
  data := jsonb_build_object('dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Voksne: 37 mg én gang daglig uten krav om initial titrering; vanlig doseområde 37-148 mg/døgn. Ungdom fra 13 år: 37 mg én gang daglig, doseområde 37-74 mg/døgn.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Tas med et måltid til omtrent samme tid hver dag. Ved moderat eller alvorlig nyresvikt, eller moderat leversvikt, er startdosen 18,5 mg og maksimal dose 74 mg/døgn; ved alvorlig leversvikt er maksimal dose 37 mg/døgn.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    ))
  )));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Oppdater hovedmekanismen med kvantifisert affinitet og kilde.
  obj := intern.kuratering_element(side,'farmakodynamikk','mekanismekort','{"maal":"D2-reseptor"}',1,
    'Farmakodynamikken strukturert som mekanismekort etter kartleggingen i docs/farmakodynamikk-kort-kartlegging.md');
  data := jsonb_build_object('maal','D2-reseptor','effekt','Blokkerende/antagonistisk effekt','retning','ned','mekanisme','antagonisme','kvalifikasjon','Høy affinitet',
    'dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Lurasidon har høy affinitet for D2-, 5-HT2A- og 5-HT7-reseptorer, er antagonist ved D2 og 5-HT7 og partiell agonist ved 5-HT1A. Affiniteten for H1- og muskarinreseptorer er ubetydelig. Reseptorprofilen gir farmakologisk plausibilitet, men dokumenterer ikke alene klinisk effekt.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(reseptor,spc)))
    )))));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Akutt effekt, nullfunn og beriket vedlikeholdsevidens holdes fra hverandre.
  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','virkninger','posisjon',0,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Akutt effekt ved schizofreni','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I en metaanalyse av åtte seksukers RCT-er (n=2373) bedret lurasidon total psykopatologi mot placebo med SMD -0,34 (95 % KI -0,48 til -0,20). Effekten var liten til moderat, og bivirkninger og dose-respons varierte mellom studiene.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(effektmeta,spc)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I en asiatisk RCT var 40 og 80 mg ikke signifikant bedre enn placebo i den forhandsangitte mITT-analysen (forskjell -4,8; p=0,050 og -4,2; p=0,080), selv om ITT-analysen var signifikant. Dette er et viktig nullfunn ved vurdering av robusthet.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(asiatisk_rct)))
        ))
      )))), '{"tittel":"Akutt effekt ved schizofreni"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','virkninger','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Tilbakefallsforebygging','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Etter åpen behandling og minst 12 ukers stabilisering forsinket fortsatt lurasidon tilbakefall sammenlignet med placebo: HR 0,663 (95 % KI 0,447-0,983). Estimert tilbakefall ved uke 28 var 42,2 % mot 51,2 % (NNT omtrent 12). Berikelses- og seponeringsdesignet begrenser overførbarheten til alle pasienter.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(vedlikehold)))
        )
      ))))), '{"tittel":"Tilbakefallsforebygging"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','bivirkninger','posisjon',0,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Akatisi og ekstrapyramidale symptomer','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I korte placebokontrollerte voksenstudier var akatisi 12,9 % med lurasidon mot 3,0 % med placebo; andre EPS var 13,5 % mot 5,8 %. En meta-analyse estimerte akatisi til 12,7 % (95 % KI 10,1-16,1) og OR 3,74 (95 % KI 2,32-6,02) mot kontroll.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,akatisimeta)))
        )
      ))))), '{"tittel":"Akatisi og ekstrapyramidale symptomer"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','bivirkninger','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Metabolsk, prolaktin- og hjerterisiko','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Vekt- og metabolsk belastning er ofte liten sammenlignet med flere andre antipsykotika, men er ikke fraværende; vekt og glukose bør følges. Hyperprolaktinemi kan forekomme. En grundig QT-studie viste maksimal gjennomsnittlig QTcI-økning 7,5 ms (øvre ensidig 95 % KI 11,7) ved 120 mg; forsiktighet anbefales ved kjent QT-risiko.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,fda)))
        )
      ))))), '{"tittel":"Metabolsk, prolaktin- og hjerterisiko"}', kilde);

  -- Korriger absolutt biotilgjengelighet og presiser matkravet.
  obj := intern.kuratering_element(side,'farmakokinetikk','kinetikkort','{"tittel":"Biotilgjengelighet"}',1,
    'Importert fra Psykofarmaka.pdf, side 51');
  data := jsonb_build_object('tittel','Biotilgjengelighet','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
    'type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Absolutt biotilgjengelighet er lav, anslått til 9-19 %. Mat øker eksponeringen vesentlig.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(farmakologiportalen,matstudie)))
    )
  ))));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(side,'farmakokinetikk','kinetikkort','{"tittel":"Annet"}',1,
    'Importert fra Psykofarmaka.pdf, side 51');
  data := jsonb_build_object('tittel','Matpåvirkning','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
    'type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Skal tas med mat. I kryss-over-studier ga minst 350 kcal maksimal eksponering uavhengig av fettinnhold; sammenlignet med faste ble AUC omtrent doblet og Cmax omtrent to til tre ganger hoyere.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(matstudie,spc)))
    )
  ))));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(side,'interaksjoner','riktekst','{}'::jsonb,2,
    'Flyttet: fra kortet i farmakokinetikken til teksten øverst i interaksjonene');
  data := jsonb_build_object('dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Lurasidon metaboliseres hovedsakelig via CYP3A4. Ketokonazol okte lurasidoneksponeringen ni ganger, diltiazem omtrent 2,2 ganger, og rifampicin reduserte eksponeringen omtrent seks ganger. Sterke CYP3A4-hemmere og -induktorer er kontraindisert; grapefruktjuice skal unngas.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Ved moderat CYP3A4-hemming anbefales startdose 18,5 mg og maksimum 74 mg/døgn. Forsiktighet kreves sammen med sentralt virkende legemidler, alkohol, serotonerge legemidler og legemidler som forlenger QT-intervallet.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    ))
  )));
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','farmakogenetikk','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Farmakogenetisk handlingsgrunnlag','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','CYP3A4 er avgjorende for omsetningen, men det foreligger ingen CPIC- eller ClinPGx-retningslinje og ingen validert genotypebasert doseanbefaling for lurasidon. Enzymhemmere og -induktorer har dokumentert klinisk betydning; genotyping skal ikke brukes som erstatning for interaksjonsvurdering.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        )
      ))))), '{"tittel":"Farmakogenetisk handlingsgrunnlag"}', kilde);

  -- TDM: bevar norsk referanseområde 5-60 nmol/L uendret, og legg usikkerheten i tekst.
  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','tdm','posisjon',0,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Når TDM er nyttig','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Serumkonsentrasjonsmåling kan brukes ved manglende effekt, bivirkninger, usikker etterlevelse, organfunksjonssvikt eller mistenkte CYP3A4-interaksjoner. Resultatet må alltid tolkes sammen med klinisk respons.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(tdmkonsensus,farmakologiportalen)))
        )
      ))))), '{"tittel":"Når TDM er nyttig"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','tdm','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Prøvetaking og tolkning','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Ta serumprøve ved steady state, helst som bunnprøve 12-24 timer etter siste dose. Oppgi dose, tidspunkt for dose og prøve, om dosen ble tatt med mat, etterlevelse og relevante interaksjoner. OUS analyserer serum uten gel med LC-MS/MS; måleområdet er 2-200 nmol/L.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(farmakologiportalen,spc)))
        )
      ))))), '{"tittel":"Prøvetaking og tolkning"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','tdm','posisjon',2,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Usikkert internasjonalt referansegrunnlag','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Internasjonal konsensus oppgir ofte 15-40 ng/mL (omtrent 30-81 nmol/L), men dette er ikke et norsk referanseområde. I en nyere serie med 123 steady-state-bunnprøver var medianen 7,09 ng/mL, og 85,6 % lå under 15 ng/mL; forfatterne stilte spørsmål ved om intervallet passer i denne populasjonen.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(tdmkonsensus,tdmrealdata)))
        )
      ))))), '{"tittel":"Usikkert internasjonalt referansegrunnlag"}', kilde);

  -- Forgiftning: dokumenter observasjoner og fravær av validerte terskler.
  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',0,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Toksisk dose og eksponering','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I en Texas-serie var rapportert dose 20-4000 mg (gjennomsnitt 536 mg). I en stor nasjonal serie skilte rapportert dose ikke sikkert mellom kliniske alvorlighetsgrader. Det kan derfor ikke angis en validert toksisk dosegrense.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(texas,npds)))
        )
      ))))), '{"tittel":"Toksisk dose og eksponering"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Toksiske konsentrasjoner','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Det finnes ingen validert toksisk serumkonsentrasjon eller etablert konsentrasjon-alvorlighetsrelasjon. Konsentrasjon alene kan ikke styre risikovurdering eller behandling.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(npds,texas)))
        )
      ))))), '{"tittel":"Toksiske konsentrasjoner"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',2,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Klinisk forgiftningsbilde','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Vanligst rapportert ved rene, tilsiktede overdoser var døsighet (25,6 %), takykardi (14,5 %), oppkast (6,9 %) og hypertensjon (6,6 %). Agitasjon, kvalme, EPS, kramper og hypotensjon kan forekomme.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(npds,texas,spc)))
        )
      ))))), '{"tittel":"Klinisk forgiftningsbilde"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',3,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Alvorlige komplikasjoner','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I 1753 tilsiktede enkeltstoffoverdoser fikk 0,7 % alvorlig effekt, 14,8 % moderat effekt og ingen døde. Mulige alvorlige komplikasjoner er bevissthetspåvirkning med aspirasjonsfare, kramper, uttalt hypotensjon, EPS og arytmi.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(npds,spc)))
        )
      ))))), '{"tittel":"Alvorlige komplikasjoner"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',4,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Toksikokinetiske særtrekk','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Halveringstiden er 20-40 timer, proteinbindingen 99 % og distribusjonsvolumet stort. Samtidig CYP3A4-hemming kan forlenge og forsterke eksponeringen; forgiftningsspesifikk kinetikk er ikke godt kartlagt.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        )
      ))))), '{"tittel":"Toksikokinetiske særtrekk"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','toksisitet_forgiftning','posisjon',5,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Behandling ved forgiftning','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Det finnes ingen antidot. Behandlingen er symptomrettet med tidlig kontinuerlig EKG og overvåking til klinisk restitusjon. Aktivt kull kan vurderes etter individuell risikovurdering. Ved hypotensjon skal adrenalin, dopamin og andre betaagonistiske sympatomimetika unngås fordi alfablokade kan forverre hypotensjonen; alvorlige EPS kan behandles med antikolinergikum.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,fda)))
        )
      ))))), '{"tittel":"Behandling ved forgiftning"}', kilde);

  -- Reproduksjon og amming.
  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','graviditet_amming','posisjon',0,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Graviditet','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Humandata er begrenset. I et prospektivt register med 134 eksponerte svangerskap var større misdannelser 2,19 % mot 1,77 % hos kontroller, OR 1,24 (95 % KI 0,36-4,32). Det ble ikke sett noe spesifikt mønster, men konfidensintervallet er vidt og utelukker ikke klinisk relevant risiko.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(graviditetsregister,spc)))
        )
      ))))), '{"tittel":"Graviditet"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','graviditet_amming','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Perinatal og neonatal påvirkning','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Eksponering i tredje trimester kan gi neonatal agitasjon, hyper- eller hypotoni, tremor, somnolens, respirasjonsvansker eller sugeproblemer. Alvorlighetsgrad og varighet varierer, og barnet bør observeres etter fødselen.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,fda)))
        )
      ))))), '{"tittel":"Perinatal og neonatal påvirkning"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','graviditet_amming','posisjon',2,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Amming','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','I ni ammende kvinner som brukte 20-80 mg/døgn var estimert relativ spedbarnsdose 1,16 %, og 3,03 % i verstefallsberegningen; ingen bivirkninger ble rapportert hos barna. Datagrunnlaget er lite, og ekstra forsiktighet er rimelig hos premature og nyfødte.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(melkestudie,spc)))
        )
      ))))), '{"tittel":"Amming"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','graviditet_amming','posisjon',3,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Fertilitet og reproduksjon','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Dyrestudier viser prolaktinrelaterte fertilitetseffekter; relevansen for human fertilitet er uklar. Klinisk hyperprolaktinemi kan gi menstruasjonsforstyrrelser, galaktore, gynekomasti og seksuell dysfunksjon.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        )
      ))))), '{"tittel":"Fertilitet og reproduksjon"}', kilde);

  -- Misbruk og seponering: dokumenter datamangel uten å sidestille tilbakefall med abstinens.
  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','avhengighet_toleranse','posisjon',1,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Abstinens, seponeringssyndrom og rebound-effekter','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','En lurasidonspesifikk abstinensprofil og forekomst er ikke etablert. Ved seponering må mulige seponeringsfenomener skilles fra tilbakefall av grunnlidelsen; randomiserte seponeringsstudier dokumenterer tilbakefallsforebygging, ikke i seg selv fysisk abstinens.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(fda,vedlikehold)))
        )
      ))))), '{"tittel":"Abstinens, seponeringssyndrom og rebound-effekter"}', kilde);

  obj := intern.kuratering_nytt(side,
    jsonb_build_object('panel','avhengighet_toleranse','posisjon',2,'elementtype','kinetikkort','data',jsonb_build_object(
      'tittel','Addiksjon','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
        'type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Lurasidon er ikke et kontrollert stoff, og kliniske studier viste ikke legemiddelsøkende atferd. Misbruk, fysisk avhengighet og toleranse er likevel ikke systematisk studert; fravær av signal i studiene er derfor ikke det samme som dokumentert nullrisiko.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(fda)))
        )
      ))))), '{"tittel":"Addiksjon"}', kilde);

  perform intern.kuratering_rapport(
    'chatgpt-monografkurator',
    '20261014182000_lurasidon_monografkuratering_de_novo.sql',
    $rapport$
    {
      "oppsummering": "Lurasidon er de novo-kuratert med rettet indikasjon og biotilgjengelighet, kvantifisert effekt og sikkerhet, TDM-usikkerhet, forgiftning, reproduksjon og tydelige evidenshull; norsk referanseområde er bevart.",
      "seksjoner": [
        {"seksjon":"indikasjon","endret":["Aldersgrensen er rettet til fra og med 13 år, og amerikansk bipolarindikasjon er avgrenset"]},
        {"seksjon":"dosering","endret":["Voksen- og ungdomsdose, matkrav og dosejustering ved organfunksjon er presisert"]},
        {"seksjon":"farmakodynamikk","endret":["D2-kortet har kvantifisert reseptorprofil og mekanismebegrensning"]},
        {"seksjon":"virkninger","nytt":["Akutt effekt med nullfunn","Tilbakefallsforebygging med designbegrensning"]},
        {"seksjon":"bivirkninger","nytt":["Akatisi og EPS","Metabolsk, prolaktin- og hjerterisiko"]},
        {"seksjon":"farmakokinetikk","endret":["Biotilgjengelighet er rettet fra 50 % til 9-19 %","Matpåvirkning er kvantifisert"]},
        {"seksjon":"farmakogenetikk","nytt":["Manglende klinisk handlingsbar PGx er presisert"]},
        {"seksjon":"interaksjoner","endret":["CYP3A4-interaksjoner og eksponeringsendringer er kvantifisert"]},
        {"seksjon":"tdm","nytt":["Bruksområder","Prøvetaking","Usikkert internasjonalt referansegrunnlag"]},
        {"seksjon":"toksisitet_forgiftning","nytt":["Seks faste kort dekker dose, manglende terskler, klinikk, komplikasjoner, kinetikk og behandling"]},
        {"seksjon":"graviditet_amming","nytt":["Graviditet","Perinatal påvirkning","Amming","Fertilitet"]},
        {"seksjon":"avhengighet_toleranse","nytt":["Seponering og tilbakefall er skilt","Misbrukspotensial er avgrenset"]}
      ],
      "nye_opplysninger": [
        "Akutt symptomgevinst og tilbakefallsforebygging er kvantifisert med nullfunn og designbegrensninger",
        "Forgiftningsserier viser oftest mildt forløp, men uten validerte dose- eller konsentrasjonsterskler",
        "Humane graviditets- og morsmelkdata er lagt til med usikkerhet"
      ],
      "korrigeringer": [
        "Godkjent aldersgrense er fra og med 13 år, ikke over 13 år",
        "Biotilgjengelighet er 9-19 %, ikke 50 %",
        "Utenlandsk TDM-intervall er ikke lagt inn som norsk referanseområde"
      ],
      "kildegrunnlag": [
        "Norsk SPC 2026 og FDA-label 2025 er lagt til som regulatoriske hovedkilder",
        "Originalstudier og meta-analyser for effekt, akatisi, TDM, forgiftning, graviditet og amming er lagt til"
      ],
      "mangler": [
        "Ingen validert toksisk dose eller serumkonsentrasjon",
        "Ingen klinisk handlingsbar farmakogenetisk retningslinje",
        "Begrensede lurasidonspesifikke data om toleranse, abstinens og langtidsutfall"
      ],
      "lenker": []
    }
    $rapport$::jsonb);
end
$lurasidon_de_novo$;
