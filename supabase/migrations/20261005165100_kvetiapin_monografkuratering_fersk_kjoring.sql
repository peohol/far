-- Fersk full gjennomgang av kvetiapin etter oppdatert monografkuratorprotokoll.
-- Bevarer norske referanse- og toksisitetsverdier, automatiske FEST/ClinPGx/CPIC-lag
-- og uendrede fagseksjoner som besto ny kildekontroll.
do $kuratering$
declare
  side uuid := intern.kuratering_start('kvetiapin');
  kilde constant text := 'Monografkuratering av kvetiapin 05.10.2026: fersk full gjennomgang etter oppdatert kuratorprotokoll';

  antidepressiv uuid;
  tdm_grunnlag uuid;
  graviditet uuid;
  perinatal uuid;
  amming uuid;

  ref_spc uuid;
  ref_bipolar_depresjon_2014 uuid;
  ref_bipolar_depresjon_2026 uuid;
  ref_mdd_2026 uuid;
  ref_vedlikehold_2026 uuid;
  ref_agnp_2026 uuid;
  ref_norsk_tdm uuid;
  ref_graviditet_meta_2026 uuid;
  ref_janus_graviditet uuid;
  ref_lactmed uuid;
  ref_melk_2018 uuid;
  ref_janus_amming uuid;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  -- Preflight mot den publiserte tilstanden som ble kontrollert 05.10.2026.
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 4);
  antidepressiv := intern.kuratering_element(
    side, 'virkninger', 'kinetikkort', '{"tittel":"Antidepressiv effekt"}'::jsonb, 1,
    'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet'
  );

  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 3);
  tdm_grunnlag := intern.kuratering_element(
    side, 'tdm', 'kinetikkort', '{"tittel":"Grunnlag for referanseområdet"}'::jsonb, 1,
    'Importert fra 080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf, side 25, 41, og fortolkningskommentarene i FAR'
  );

  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 4);
  graviditet := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Graviditet"}'::jsonb, 1,
    'Monografkuratering av kvetiapin 04.10.2026: fullforing av toksisitet, graviditet, indikasjon og interaksjoner'
  );
  perinatal := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Perinatal og neonatal påvirkning"}'::jsonb, 1,
    'Monografkuratering av kvetiapin 04.10.2026: fullforing av toksisitet, graviditet, indikasjon og interaksjoner'
  );
  amming := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Amming"}'::jsonb, 1,
    'Monografkuratering av kvetiapin 04.10.2026: fullforing av toksisitet, graviditet, indikasjon og interaksjoner'
  );

  -- Regulatoriske og tidligere kuraterte kilder gjenbrukes etter URL.
  ref_spc := intern.kuratering_referanse(
    '{"tittel":"Seroquel Depot – preparatomtale","forfattere":"Direktoratet for medisinske produkter","aar":"2024","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf"}'::jsonb,
    kilde
  );
  ref_bipolar_depresjon_2014 := intern.kuratering_referanse(
    '{"tittel":"Quetiapine for acute bipolar depression: a systematic review and meta-analysis","forfattere":"Suttajit S, Srisurapanont M, Maneeton N, Maneeton B","aar":"2014","lenke":"https://doi.org/10.2147/DDDT.S63779"}'::jsonb,
    kilde
  );
  ref_graviditet_meta_2026 := intern.kuratering_referanse(
    '{"tittel":"Perinatal Safety of Quetiapine During Pregnancy: A Systematic Review, Meta-Analysis, and Evidence Gaps","forfattere":"Alem GM, et al.","aar":"2026","lenke":"https://doi.org/10.1097/JCP.0000000000002127"}'::jsonb,
    kilde
  );
  ref_lactmed := intern.kuratering_referanse(
    '{"tittel":"Quetiapine","forfattere":"Drugs and Lactation Database (LactMed)","aar":"2026","lenke":"https://www.ncbi.nlm.nih.gov/books/NBK501087/"}'::jsonb,
    kilde
  );
  ref_melk_2018 := intern.kuratering_referanse(
    '{"tittel":"Quetiapine Excretion Into Human Breast Milk","forfattere":"Yazdani-Brojeni P, et al.","aar":"2018","lenke":"https://doi.org/10.1097/JCP.0000000000000905"}'::jsonb,
    kilde
  );
  ref_norsk_tdm := intern.kuratering_referanse(
    '{"tittel":"Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika","forfattere":"Diakonhjemmet sykehus og St. Olavs hospital","aar":"","lenke":"https://farmakologiportalen.no/nasjonale_referanseomrader/"}'::jsonb,
    kilde
  );

  -- Nye eller nyprioriterte kilder etter den oppdaterte protokollen.
  ref_bipolar_depresjon_2026 := intern.kuratering_referanse(
    '{"tittel":"Treatment of bipolar depression: results from a comprehensive network meta-analysis and updated systematic review","forfattere":"Yalin N, Yildiz A, Siafis S, Vieta E, Leucht S","aar":"2026","lenke":"https://doi.org/10.1016/j.euroneuro.2026.112818"}'::jsonb,
    kilde
  );
  ref_mdd_2026 := intern.kuratering_referanse(
    '{"tittel":"Adjunctive Antipsychotics in Major Depressive Disorder: A Systematic Review and Network Meta-Analysis","forfattere":"McIntyre RS, Stahl SM, Shim SR, et al.","aar":"2026","lenke":"https://doi.org/10.1001/jamapsychiatry.2026.0658"}'::jsonb,
    kilde
  );
  ref_vedlikehold_2026 := intern.kuratering_referanse(
    '{"tittel":"Efficacy and safety of pharmacological interventions for the maintenance of bipolar disorder: A systematic review and dose-related network meta-analysis across different age groups","forfattere":"Fornaro M, Di Lorenzo C, Daray FM, Kishi T","aar":"2026","lenke":"https://doi.org/10.1016/j.jad.2026.121798"}'::jsonb,
    kilde
  );
  ref_agnp_2026 := intern.kuratering_referanse(
    '{"tittel":"Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2026 – Pharmacokinetic, pharmacogenetic and clinical aspects","forfattere":"Hart XM, Gründer G, Hiemke C, et al.","aar":"2026","lenke":"https://doi.org/10.1055/a-2860-7861"}'::jsonb,
    kilde
  );
  ref_janus_graviditet := intern.kuratering_referanse(
    '{"tittel":"Janusmed fosterpåverkan – kvetiapin","forfattere":"Region Stockholm","aar":"2024","lenke":"https://janusmed.se/fosterpaverkan/lakemedel/Quetiapin%20Orion"}'::jsonb,
    kilde
  );
  ref_janus_amming := intern.kuratering_referanse(
    '{"tittel":"Janusmed amning – kvetiapin","forfattere":"Region Stockholm / Klinisk farmakologi, Karolinska Universitetssjukhuset","aar":"","lenke":"https://janusmed.se/amning/lakemedel/Quetiapine%20Teva"}'::jsonb,
    kilde
  );

  -- Bipolar depresjon: nyere NMA prioriteres, mens den kvetiapinspesifikke
  -- meta-analysen beholdes for størrelsesestimat. Unipolar depresjon skilles ut
  -- fordi godkjent indikasjon ikke er det samme som robust effektstørrelse.
  perform intern.kuratering_lagre(
    antidepressiv, 1,
    jsonb_build_object(
      'data', $json$
      {
        "tittel":"Antidepressiv effekt",
        "dokument":{"type":"doc","content":[
          {"type":"paragraph","content":[
            {"type":"text","text":"Ved akutt bipolar depresjon har kvetiapin dokumentert placebokontrollert effekt. En oppdatert nettverksmeta-analyse fra 2026 fant kvetiapin blant legemidlene som reduserte depressive symptomer mer enn placebo, med moderat tillit til evidensen. En tidligere kvetiapinspesifikk meta-analyse av 11 randomiserte studier (n=3 488) fant en gjennomsnittlig forskjell i depresjonsskår på −4,66 poeng (95 % KI −5,59 til −3,73)."}
          ]},
          {"type":"paragraph","content":[
            {"type":"text","text":"Ved unipolar depresjon er depotkvetiapin godkjent som tilleggsbehandling etter suboptimal respons på antidepressiv monoterapi, men nyere komparativ evidens er mer usikker. I en nettverksmeta-analyse fra 2026 var responsestimatet for kvetiapin XR RR 1,15 (95 % CrI 0,96–1,35) mot placebo, mens samlet behandlingsavbrudd var hyppigere (RR 1,56; 95 % CrI 1,14–2,12). Indikasjonen bør derfor ikke tolkes som dokumentasjon for en stor eller sikker gjennomsnittlig tilleggseffekt hos alle pasienter."}
          ]}
        ]}
      }
      $json$::jsonb,
      'referanser', jsonb_build_array(
        ref_bipolar_depresjon_2026::text,
        ref_bipolar_depresjon_2014::text,
        ref_spc::text,
        ref_mdd_2026::text
      )
    ),
    kilde
  );

  -- Vedlikeholdseffekt var ikke tidligere representert som eget virkningskort.
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object(
      'panel','virkninger',
      'posisjon',4,
      'elementtype','kinetikkort',
      'data',$json$
      {
        "tittel":"Forebygging av tilbakefall ved bipolar lidelse",
        "dokument":{"type":"doc","content":[
          {"type":"paragraph","content":[
            {"type":"text","text":"Kvetiapin har dokumentert vedlikeholdseffekt ved bipolar lidelse hos pasienter som har respondert på behandlingen. I en dose-relatert nettverksmeta-analyse fra 2026 med 44 randomiserte studier og 10 867 deltakere var kvetiapin 300, 550 og 600 mg/døgn blant behandlingene som reduserte samlet tilbakefallsrisiko sammenlignet med placebo i sensitivitetsanalysen."}
          ]},
          {"type":"paragraph","content":[
            {"type":"text","text":"De norske preparatomtalene avgrenser vedlikeholdsindikasjonen til forebygging av nye maniske eller depressive episoder hos pasienter som tidligere har respondert på kvetiapin. Dosefunn fra nettverksmeta-analysen er gruppefunn og skal ikke brukes som selvstendige individuelle doseringsmål."}
          ]}
        ]}
      }
      $json$::jsonb,
      'referanser',jsonb_build_array(ref_vedlikehold_2026::text, ref_spc::text)
    ),
    '{"tittel":"Forebygging av tilbakefall ved bipolar lidelse"}'::jsonb,
    kilde
  );

  -- Det norske OUSFAR-området beholdes uendret. AGNP brukes bare som
  -- internasjonal kontekst fordi populasjon, definisjon og formål er annerledes.
  perform intern.kuratering_lagre(
    tdm_grunnlag, 1,
    jsonb_build_object(
      'data', $json$
      {
        "tittel":"Grunnlag for referanseområdet",
        "dokument":{"type":"doc","content":[
          {"type":"paragraph","content":[
            {"type":"text","text":"OUSFARs referanseområde 50–700 nmol/L bygger på serumkonsentrasjoner målt hos norske pasienter som brukte 50–1000 mg daglig: 10- og 90-persentilen, rundet av, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007). Området beskriver konsentrasjoner som er vanlige ved anbefalte doser og er ikke et dokumentert terapeutisk område."}
          ]},
          {"type":"paragraph","content":[
            {"type":"text","text":"AGNPs oppdaterte TDM-konsensus fra 2026 oppgir et terapeutisk referanseområde på 100–500 ng/mL (omtrent 260–1 300 nmol/L) for voksne med schizofreni. Dette er et annet type område, utviklet for et annet klinisk formål og en avgrenset populasjon, og skal derfor ikke erstatte det norske OUSFAR-området. Det kan brukes som supplerende kontekst ved individuell TDM-tolkning."}
          ]}
        ]}
      }
      $json$::jsonb,
      'referanser',jsonb_build_array(ref_norsk_tdm::text, ref_agnp_2026::text)
    ),
    kilde
  );

  -- Graviditet/amming oppdateres slik at spesialiserte autoritative databaser
  -- ligger først, med regulatorisk informasjon og studier som supplerende lag.
  perform intern.kuratering_lagre(
    graviditet, 1,
    jsonb_build_object(
      'data', jsonb_build_object(
        'tittel','Graviditet',
        'dokument', jsonb_build_object(
          'type','doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','Janusmed vurderer at behandling med kvetiapin under graviditet bør skje i samråd med spesialist etter individuell nytte–risiko-vurdering. Tilgjengelige data gir ikke holdepunkter for en tydelig økt risiko for større medfødte misdannelser; en systematisk oversikt og meta-analyse fra 2026 inkluderte 13 090 eksponerte graviditeter med misdannelsesutfall og fant en samlet forekomst på 4,1 %, omtrent på nivå med bakgrunnsrisikoen.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_janus_graviditet::text,ref_graviditet_meta_2026::text)))
              )
            ),
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','Evidensen er observasjonell og påvirkes av indikasjon og andre konfunderende faktorer. Janusmed fremhever en mulig økt risiko for svangerskapsdiabetes ved kvetiapin og anbefaler økt oppmerksomhet på metabolske parametere. Preparatomtalen anbefaler bruk bare når forventet nytte oppveier mulig risiko.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_janus_graviditet::text,ref_spc::text)))
              )
            )
          )
        )
      ),
      'referanser',jsonb_build_array(ref_janus_graviditet::text,ref_graviditet_meta_2026::text,ref_spc::text)
    ),
    kilde
  );

  perform intern.kuratering_lagre(
    perinatal, 1,
    jsonb_build_object(
      'data', jsonb_build_object(
        'tittel','Perinatal og neonatal påvirkning',
        'dokument', jsonb_build_object(
          'type','doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','Eksponering for antipsykotika, inkludert kvetiapin, sent i svangerskapet kan gi forbigående neonatal påvirkning. Janusmed beskriver blant annet økt forekomst av neonatal innleggelse, respirasjonsproblemer og sjeldne nevrologiske symptomer, mens preparatomtalen omtaler ekstrapyramidale symptomer og/eller seponeringssymptomer som agitasjon, hypertoni eller hypotoni, tremor, somnolens, respirasjonsbesvær og ernæringsproblemer.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_janus_graviditet::text,ref_spc::text)))
              )
            ),
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','Nyfødte som er eksponert sent i svangerskapet bør derfor observeres klinisk etter fødselen. Risikoestimatene påvirkes av maternell sykdom, samtidig legemiddelbruk og andre konfunderende faktorer, og gir ikke grunnlag for en presis individuell risikoprosent.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_janus_graviditet::text,ref_spc::text)))
              )
            )
          )
        )
      ),
      'referanser',jsonb_build_array(ref_janus_graviditet::text,ref_spc::text)
    ),
    kilde
  );

  perform intern.kuratering_lagre(
    amming, 1,
    jsonb_build_object(
      'data', jsonb_build_object(
        'tittel','Amming',
        'dokument', jsonb_build_object(
          'type','doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','Janusmed vurderer risikoen for et friskt, fullgått barn som lav ved terapeutiske doser, men understreker at mulige langtidsvirkninger på CNS-utvikling er ukjente. Kvetiapin går over i morsmelk i lave mengder; LactMed oppsummerer at doser opp til 400 mg/døgn vanligvis gir en beregnet spedbarnsdose under 1 % av mors vektjusterte dose.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_janus_amming::text,ref_lactmed::text)))
              )
            ),
            jsonb_build_object(
              'type','paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type','text','text','I en serie på ni ammende kvinner var gjennomsnittlig relativ spedbarnsdose 0,16 % (0,04–0,35 %). Publiserte spedbarnsutfall er begrensede, men gjennomgående betryggende. Ved amming er klinisk observasjon for særlig søvnighet og normal utvikling rimelig; premature eller syke barn krever en særskilt vurdering.'),
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ref_melk_2018::text,ref_janus_amming::text,ref_lactmed::text)))
              )
            )
          )
        )
      ),
      'referanser',jsonb_build_array(ref_janus_amming::text,ref_lactmed::text,ref_melk_2018::text)
    ),
    kilde
  );
end
$kuratering$;
