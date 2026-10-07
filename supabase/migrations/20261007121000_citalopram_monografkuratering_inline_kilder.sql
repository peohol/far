-- De novo-revisjon av citalopram med særskilt audit av kildeplassering.
-- Lange eller kildeheterogene tekster siterer nå den enkelte påstanden inline.
-- Korte/homogene kort beholder referansen på elementnivå.

do $kuratering$
declare
  side uuid := intern.kuratering_start('citalopram');
  kilde constant text := 'Monografkuratering av citalopram 07.10.2026: de novo og påstandsnære kilder';
  forrige constant text := 'Monografkuratering av citalopram 06.10.2026: full oppdatering';
  obj uuid;
  spc uuid;
  cpic uuid;
  panic uuid;
  giftinfo uuid;
  schulz2020 uuid;
  hiemke2017 uuid;
  tdmreview uuid;
  espnes2026 uuid;
  pregmeta uuid;
  janusfoster uuid;
  janusamning uuid;
  lactmed uuid;
  nutt2003 uuid;
  chiappini2022 uuid;
  data jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  -- Preflight: sluttresultatet fra fullkurateringen 06.10.2026.
  perform intern.kuratering_antall(side, 'identitet', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 4);
  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'farmakogenetikk', 'kinetikkort', 3);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 3);
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 6);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 4);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 3);

  spc := intern.kuratering_referanse(
    '{"tittel":"Citalopram Orion – preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2025","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/06-4252.pdf"}',
    kilde);
  cpic := intern.kuratering_referanse(
    '{"tittel":"Clinical Pharmacogenetics Implementation Consortium (CPIC) Guideline for CYP2D6, CYP2C19, CYP2B6, SLC6A4, and HTR2A Genotypes and Serotonin Reuptake Inhibitor Antidepressants","forfattere":"Bousman CA, Stevenson JM, Ramsey LB, et al.","aar":"2023","lenke":"https://doi.org/10.1002/cpt.2903"}',
    kilde);
  panic := intern.kuratering_referanse(
    '{"tittel":"A controlled, prospective, 1-year trial of citalopram in the treatment of panic disorder","forfattere":"Lepola U, Wade A, Leinonen E, et al.","aar":"1998","lenke":"https://pubmed.ncbi.nlm.nih.gov/9818634/"}',
    kilde);
  giftinfo := intern.kuratering_referanse(
    '{"tittel":"Citalopram – behandlingsanbefaling ved forgiftning","forfattere":"Giftinformasjonen / Helsebiblioteket","aar":"2026","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/citalopram-behandlingsanbefaling-ved-forgiftning"}',
    kilde);
  schulz2020 := intern.kuratering_referanse(
    '{"tittel":"Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics","forfattere":"Schulz M et al.","aar":"2020","lenke":"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/"}',
    kilde);
  hiemke2017 := intern.kuratering_referanse(
    '{"tittel":"Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017","forfattere":"Hiemke C et al.","aar":"2018","lenke":"https://doi.org/10.1055/s-0043-116492"}',
    kilde);
  tdmreview := intern.kuratering_referanse(
    '{"tittel":"Toward therapeutic drug monitoring of citalopram in depression? Insights from a systematic review","forfattere":"Xu N, Song Z, Jiang D, Zhao R","aar":"2023","lenke":"https://doi.org/10.3389/fpsyt.2023.1144573"}',
    kilde);
  espnes2026 := intern.kuratering_referanse(
    '{"tittel":"Distribution of citalopram enantiomers following medication with racemic citalopram - a naturalistic therapeutic drug monitoring study","forfattere":"Espnes KA, Hønnås A, Skogvoll E, Spigset O","aar":"2026","lenke":"https://doi.org/10.1007/s00228-026-04148-x"}',
    kilde);
  pregmeta := intern.kuratering_referanse(
    '{"tittel":"Association of citalopram with congenital anomalies: A meta-analysis","forfattere":"Kang HH, Ahn KH, Hong SC, et al.","aar":"2017","lenke":"https://doi.org/10.5468/ogs.2017.60.2.145"}',
    kilde);
  janusfoster := intern.kuratering_referanse(
    '{"tittel":"Janusmed fosterpåverkan – citalopram","forfattere":"Region Stockholm","aar":"2026","lenke":"https://janusmed.se/fosterpaverkan/lakemedel/Citalopram%20BMM%20Pharma"}',
    kilde);
  janusamning := intern.kuratering_referanse(
    '{"tittel":"Janusmed amning – citalopram","forfattere":"Region Stockholm / Klinisk farmakologi, Karolinska Universitetssjukhuset","aar":"2026","lenke":"https://janusmed.se/amning/lakemedel/Citalopram%20Teva"}',
    kilde);
  lactmed := intern.kuratering_referanse(
    '{"tittel":"Citalopram","forfattere":"Drugs and Lactation Database (LactMed)","aar":"2026","lenke":"https://www.ncbi.nlm.nih.gov/books/NBK501185/"}',
    kilde);
  nutt2003 := intern.kuratering_referanse(
    '{"tittel":"Death and dependence: current controversies over the selective serotonin reuptake inhibitors","forfattere":"Nutt DJ","aar":"2003","lenke":"https://doi.org/10.1177/0269881103174019"}',
    kilde);
  chiappini2022 := intern.kuratering_referanse(
    '{"tittel":"A Focus on Abuse/Misuse and Withdrawal Issues with Selective Serotonin Reuptake Inhibitors (SSRIs): Analysis of Both the European EMA and the US FAERS Pharmacovigilance Databases","forfattere":"Chiappini S, Vickers-Smith R, Guirguis A, et al.","aar":"2022","lenke":"https://doi.org/10.3390/ph15050565"}',
    kilde);

  -- Oppsummering: korte, distinkte hovedpåstander får kilden umiddelbart etter påstanden.
  obj := intern.kuratering_element(side, 'identitet', 'riktekst', '{}'::jsonb, 1, forrige);
  data := jsonb_build_object('dokument', jsonb_build_object('type','doc','content',jsonb_build_array(
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Citalopram er et racemisk SSRI der S-enantiomeren står for hoveddelen av den farmakodynamiske effekten; den sentrale målvirkningen er potent og selektiv hemming av serotonintransportøren (SERT).'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Legemidlet er godkjent ved alvorlige depressive episoder, panikklidelse og tvangslidelse, samt til profylakse ved tilbakevendende depressive episoder.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Et klinisk særtrekk er doseavhengig QT-forlengelse, som bidrar til at maksimal anbefalt dose er 40 mg/døgn og 20 mg/døgn hos blant annet eldre, ved nedsatt leverfunksjon og ved langsom CYP2C19-omsetning.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Halveringstiden er omtrent 36 timer, med betydelig interindividuell variasjon i steady-state-konsentrasjon; CYP2C19 er klinisk relevant for variasjon i eksponering.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,cpic)))
    )),
    jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Brå eller rask seponering gir ofte et karakteristisk seponeringssyndrom.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc))),
      jsonb_build_object('type','text','text',' Dette må skilles fra et klassisk addiksjonssyndrom.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(nutt2003,chiappini2022)))
    ))
  )));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Panikklidelse: direkte RCT og regulatorisk tidsforløp er to forskjellige påstander.
  obj := intern.kuratering_element(side, 'virkninger', 'kinetikkort', '{"tittel":"Effekt ved panikklidelse"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Effekt ved panikklidelse','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','I en placebokontrollert studie med 475 randomiserte pasienter var citalopram generelt bedre enn placebo bortsett fra i laveste dosegruppe; 20–30 mg/døgn ga best samlet respons i langtidsforløpet.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(panic))),
      jsonb_build_object('type','text','text',' Preparatomtalen angir at maksimal effekt ved panikklidelse vanligvis oppnås etter omtrent tre måneder.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Doseringen er lang, men hele teksten bygger på samme gjeldende norske SPC.
  -- CPIC fjernes fra elementreferansene fordi den ikke er nødvendig for disse dosepåstandene.
  obj := intern.kuratering_element(side, 'dosering', 'riktekst', '{}'::jsonb, 2, forrige);
  perform intern.kuratering_lagre(obj, 2, jsonb_build_object('referanser',jsonb_build_array(spc)), kilde);

  -- Farmakogenetikk: kilden settes ved hver klinisk påstand. CPIC sier hvordan
  -- et foreliggende resultat brukes, ikke hvem som bør testes.
  obj := intern.kuratering_element(side, 'farmakogenetikk', 'kinetikkort',
    '{"tittel":"CYP2C19 og citaloprameksponering"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','CYP2C19 og citaloprameksponering','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','CYP2C19-genotype har klinisk relevant betydning for citaloprameksponering.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic))),
      jsonb_build_object('type','text','text',' Preparatomtalen beskriver omtrent doble plasmakonsentrasjoner av den aktive enantiomeren hos personer med langsom CYP2C19-omsetning sammenlignet med raske omsettere.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc))),
      jsonb_build_object('type','text','text',' Ved økt enzymaktivitet kan konsentrasjonene bli lavere og sannsynligheten for klinisk effekt redusert.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  obj := intern.kuratering_element(side, 'farmakogenetikk', 'kinetikkort',
    '{"tittel":"Når farmakogenetisk analyse er relevant"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Når farmakogenetisk analyse er relevant','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','CPIC gir anbefalinger for hvordan et allerede foreliggende CYP2C19-resultat kan brukes ved behandling med citalopram, men retningslinjen tar ikke stilling til hvem som bør genotypes.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Ved økt enzymaktivitet avhenger anbefalingen av genotypeprofilen: ved CYP2C19 *1/*17 anbefales vanlig startdose, med vurdering av doseøkning eller et alternativ som ikke hovedsakelig metaboliseres av CYP2C19 dersom responsen er utilstrekkelig; ved *17/*17 anbefales et slikt alternativ sterkere.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Ved manglende enzymaktivitet foretrekkes et alternativ som ikke hovedsakelig metaboliseres av CYP2C19; dersom citalopram brukes, anbefales langsommere titrering og omtrent 50 % lavere vedlikeholdsdose.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Data for SLC6A4 og HTR2A er ikke tilstrekkelige til å støtte klinisk genotypebasert forskrivning.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(cpic)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- TDM: norsk 2026-studie gir fersk støtte for hvilket område som er norsk
  -- nasjonal konsensus; evidensen for en universell konsentrasjon-effekt-grense
  -- siteres separat.
  obj := intern.kuratering_element(side, 'tdm', 'kinetikkort',
    '{"tittel":"Konsentrasjon–effekt og internasjonal kontekst"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Konsentrasjon–effekt og internasjonal kontekst','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','OUSFARs norske referanseområde 70–350 nmol/L skal brukes som lokalt referanseområde. En norsk naturalistisk TDM-studie publisert i 2026 omtaler det samme intervallet som norsk nasjonal konsensus.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(espnes2026))),
        jsonb_build_object('type','text','text',' Det internasjonale området 50–110 ng/mL (omtrent 154–339 nmol/L) er metodisk og konseptuelt et annet referanseområde og erstatter ikke det norske.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(hiemke2017,espnes2026)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Dokumentasjonen for en skarp konsentrasjon–effekt- eller konsentrasjon–bivirkningsterskel er begrenset.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(tdmreview))),
        jsonb_build_object('type','text','text',' Serumkonsentrasjonen bør derfor tolkes i sammenheng med blant annet dose, prøvetidspunkt, etterlevelse, interaksjoner, organfunksjon og farmakogenetiske forhold, ikke som et automatisk dosejusteringsmål mot én universell terskel.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(tdmreview,cpic)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Toksisitet: påstander med ulike kildegrunnlag skilles.
  obj := intern.kuratering_element(side, 'toksisitet_forgiftning', 'kinetikkort',
    '{"tittel":"Toksisk dose og eksponering"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Toksisk dose og eksponering','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Ved akutt peroralt inntak hos voksne gir under 600 mg som regel lette symptomer. Fra 600 mg foreligger risiko for hjertepåvirkning og kramper og Giftinformasjonen anbefaler sykehusvurdering; over 1000 mg kan kramper og hjertepåvirkning forventes.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(giftinfo))),
      jsonb_build_object('type','text','text',' Samtidige serotonerge eller krampeterskelsenkende stoffer kan øke risikoen.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(giftinfo,spc)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  obj := intern.kuratering_element(side, 'toksisitet_forgiftning', 'kinetikkort',
    '{"tittel":"Toksiske konsentrasjoner"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Toksiske konsentrasjoner','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','OUSFARs etablerte serumgrenser beholdes: ≥700 nmol/L er markert som toksisk område, og ≥10 000 nmol/L som omtrentlig nivå assosiert med komatøs/fatal forgiftning.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(schulz2020,hiemke2017))),
      jsonb_build_object('type','text','text',' Slike konsentrasjoner er støtteinformasjon, ikke universelle kliniske behandlingsgrenser; i akutt overdose har serumkonsentrasjonsmåling begrenset nytte.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(giftinfo)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  obj := intern.kuratering_element(side, 'toksisitet_forgiftning', 'kinetikkort',
    '{"tittel":"Toksikokinetiske særtrekk"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Toksikokinetiske særtrekk','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Symptomer opptrer vanligvis innen tiden til Cmax, omtrent 4 timer for vanlige tabletter, men kramper kan komme allerede etter 2–3 timer og EKG-forandringer kan debutere så sent som rundt 12 timer.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(giftinfo,spc))),
      jsonb_build_object('type','text','text',' CYP2C19-hemming eller langsom CYP2C19-omsetning kan øke eksponeringen.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc,cpic)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Graviditet og amming: regulatoriske råd og observasjons-/laktasjonsdata
  -- er ikke blandet i én samlet kildeliste.
  obj := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Graviditet"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Graviditet','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','En citalopramspesifikk meta-analyse fant OR 1,07 (95 % KI 0,98–1,17) for større medfødte misdannelser og ga samlet ikke støtte for en vesentlig økning i risiko.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(pregmeta))),
      jsonb_build_object('type','text','text',' Evidensen er observasjonell og utelukker ikke mindre risikoforskjeller eller residual konfundering. Janusmed og preparatomtalen legger vekt på individuell nytte–risiko-vurdering, og brå seponering under graviditet bør unngås.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(janusfoster,spc)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  obj := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Perinatal og neonatal påvirkning"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Perinatal og neonatal påvirkning','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Eksponering sent i svangerskapet kan gi forbigående neonatal adaptasjons-/seponeringssymptomer som respirasjonsforstyrrelser, tremor, tonusforandringer, irritabilitet, matingsvansker og hypoglykemi.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc))),
      jsonb_build_object('type','text','text',' Preparatomtalen oppgir for SSRI sent i svangerskapet en observert risiko for vedvarende pulmonal hypertensjon hos nyfødte på om lag 5 per 1000 graviditeter, mot 1–2 per 1000 i bakgrunnsbefolkningen.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc))),
      jsonb_build_object('type','text','text',' Eksponering siste måned før fødsel er også knyttet til en mindre enn dobling av risikoen for postpartumblødning.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  obj := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Amming"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Amming','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Citalopram går over i morsmelk. Preparatomtalen anslår at et fullammet barn får omtrent 5 % av mors vektjusterte dose og anbefaler forsiktighet fordi datagrunnlaget ikke er tilstrekkelig til å utelukke risiko.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','LactMed beskriver lave, men målbare serumkonsentrasjoner hos enkelte diebarn og enkelte rapporter om mindre symptomer som døsighet eller uro; databasen vurderer at nødvendig citaloprambehandling hos mor i seg selv ikke er grunn til å avslutte amming.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(lactmed)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Janusmed vurderer også citalopram som forenlig med amming ved terapeutiske doser hos et friskt fullgått barn. Barnet bør observeres klinisk, særlig for sedasjon/uro, matinntak og vektutvikling.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(janusamning,lactmed)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Fertilitetskortet er kort og bygger på én kilde; her er elementreferansen
  -- mer presis enn en redundant inline-sitering.
  obj := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Fertilitet og reproduksjon"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Fertilitet og reproduksjon','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Dyrestudier har vist redusert fertilitets-/drektighetsindeks og påvirket sædkvalitet ved eksponering over human eksponering. Hos mennesker er reversibel påvirkning av sædkvalitet rapportert for enkelte SSRI, men preparatomtalen angir at effekt på human fertilitet så langt ikke er påvist. Evidensen for en citalopramspesifikk klinisk fertilitetseffekt er begrenset.')
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser',jsonb_build_array(spc)), kilde);

  -- Toleranse: kort, kildehomogent kort. SPC-utsagnet avgrenses til SERT-effekten.
  obj := intern.kuratering_element(side, 'avhengighet_toleranse', 'kinetikkort',
    '{"tittel":"Toleranseutvikling"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Toleranseutvikling','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Preparatomtalen angir at langvarig behandling ikke induserer toleranse for den hemmende effekten på serotoninreopptak. Dette er et farmakodynamisk utsagn om SERT-effekten og dokumenterer ikke i seg selv at klinisk effekt eller bivirkninger er uforanderlige over tid.')
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser',jsonb_build_array(spc)), kilde);

  -- Seponeringskortet har mange separate kliniske påstander; samme SPC siteres
  -- ved de relevante påstandsklyngene i stedet for bare én samlet referanse.
  obj := intern.kuratering_element(side, 'avhengighet_toleranse', 'kinetikkort',
    '{"tittel":"Abstinens, seponeringssyndrom og rebound-effekter"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Abstinens, seponeringssyndrom og rebound-effekter','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Seponeringssymptomer er vanlige, særlig ved brå avslutning. Preparatomtalen viser til en tilbakefallsforebyggende studie der bivirkninger etter seponering ble observert hos 40 % etter avsluttet aktiv behandling mot 20 % hos dem som fortsatte.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Typiske symptomer er blant annet svimmelhet, parestesier, søvnforstyrrelser, angst/agitasjon, kvalme, tremor, hodepine og emosjonell ustabilitet.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Symptomene oppstår oftest de første dagene og går vanligvis over, men kan hos noen være alvorlige eller vare i måneder; nedtrapping bør derfor individualiseres og skje gradvis.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  -- Addiksjon: den negative hovedpåstanden og farmakovigilanssignalet har ulike kilder.
  obj := intern.kuratering_element(side, 'avhengighet_toleranse', 'kinetikkort',
    '{"tittel":"Addiksjon"}'::jsonb, 1, forrige);
  data := jsonb_build_object('tittel','Addiksjon','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
      jsonb_build_object('type','text','text','Citalopram og andre SSRI regnes vanligvis ikke som addiktive i betydningen et klassisk avhengighetssyndrom med rusgivende forsterkning og typisk stoff-søkende atferd.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(nutt2003))),
      jsonb_build_object('type','text','text',' Farmakovigilansedatabaser inneholder likevel rapporter om misbruk, avhengighet og seponering også for citalopram; slike spontanrapporter kan ikke fastslå forekomst eller årsakssammenheng.'),
      jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(chiappini2022))),
      jsonb_build_object('type','text','text',' Seponeringssymptomer etter fysiologisk tilpasning må derfor skilles fra addiksjon.')
    )))
  ));
  perform intern.kuratering_lagre(obj, 1, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);
end
$kuratering$;
