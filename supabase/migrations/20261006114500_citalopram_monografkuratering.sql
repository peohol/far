-- Full oppdatering av citalopram etter monografkuratorprotokollen.
-- Norske referanse- og toksisitetsgrenser, serumtabeller og automatiske
-- FEST/ClinPGx/CPIC-/interaksjonslag bevares. Migrasjonen stopper dersom
-- de redaksjonelle elementene som oppdateres ikke står i forventet revisjon.

do $kuratering$
declare
  side uuid := intern.kuratering_start('citalopram');
  kilde constant text := 'Monografkuratering av citalopram 06.10.2026: full oppdatering';
  obj uuid;
  ref uuid;
  k record;
  kilder jsonb := '{}'::jsonb;
  x jsonb;
  refs jsonb;
  data jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  -- Preflight av elementene som allerede finnes og skal endres.
  perform intern.kuratering_antall(side, 'identitet', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 7);
  perform intern.kuratering_antall(side, 'indikasjon', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'farmakokinetikk', 'kinetikkort', 9);
  perform intern.kuratering_antall(side, 'farmakogenetikk', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 2);
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 0);

  create temporary table citalopram_kilder(
    nokkel text primary key, tittel text, forfattere text, aar text, lenke text
  ) on commit drop;

  insert into citalopram_kilder values
    ('spc','Citalopram Orion – preparatomtale (SPC)','Direktoratet for medisinske produkter','2025','https://produktinformasjon.legemiddelsok.no/preparatomtaler/06-4252.pdf'),
    ('giftinfo','Citalopram – behandlingsanbefaling ved forgiftning','Giftinformasjonen / Helsebiblioteket','2026','https://www.helsebiblioteket.no/forgiftninger/legemidler/citalopram-behandlingsanbefaling-ved-forgiftning'),
    ('cpic','Clinical Pharmacogenetics Implementation Consortium (CPIC) Guideline for CYP2D6, CYP2C19, CYP2B6, SLC6A4, and HTR2A Genotypes and Serotonin Reuptake Inhibitor Antidepressants','Bousman CA, Stevenson JM, Ramsey LB, et al.','2023','https://doi.org/10.1002/cpt.2903'),
    ('agnp2026','Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2026 – Pharmacokinetic, pharmacogenetic and clinical aspects','Hart XM, Gründer G, Hiemke C, et al.','2026','https://doi.org/10.1055/a-2860-7861'),
    ('tdmreview','Toward therapeutic drug monitoring of citalopram in depression? Insights from a systematic review','Li X, et al.','2023','https://doi.org/10.3389/fpsyt.2023.1144573'),
    ('cipriani','Comparative efficacy and acceptability of 21 antidepressant drugs for the acute treatment of adults with major depressive disorder: a systematic review and network meta-analysis','Cipriani A, Furukawa TA, Salanti G, et al.','2018','https://doi.org/10.1016/S0140-6736(17)32802-7'),
    ('ocd','Citalopram 20 mg, 40 mg and 60 mg are all effective and well tolerated compared with placebo in obsessive-compulsive disorder','Montgomery SA, Kasper S, Stein DJ, Bang Hedegaard K, Lemming OM','2001','https://pubmed.ncbi.nlm.nih.gov/11236072/'),
    ('panic','A controlled, prospective, 1-year trial of citalopram in the treatment of panic disorder','Lepola U, Wade A, Leinonen E, et al.','1998','https://pubmed.ncbi.nlm.nih.gov/9818634/'),
    ('pregmeta','Association of citalopram with congenital anomalies: A meta-analysis','Kang HH, Ahn KH, Hong SC, et al.','2017','https://doi.org/10.5468/ogs.2017.60.2.145'),
    ('janusfoster','Janusmed fosterpåverkan – citalopram','Region Stockholm','2026','https://janusmed.se/fosterpaverkan/lakemedel/Citalopram%20BMM%20Pharma'),
    ('janusamning','Janusmed amning – citalopram','Region Stockholm / Klinisk farmakologi, Karolinska Universitetssjukhuset','2026','https://janusmed.se/amning/lakemedel/Citalopram%20Teva'),
    ('lactmed','Citalopram','Drugs and Lactation Database (LactMed)','2026','https://www.ncbi.nlm.nih.gov/books/NBK501185/');

  for k in select * from citalopram_kilder order by nokkel loop
    ref := intern.kuratering_referanse(
      jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke),
      kilde
    );
    kilder := kilder || jsonb_build_object(k.nokkel, ref::text);
  end loop;

  -- Oppsummering.
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Citalopram er et racemisk SSRI der S-enantiomeren står for hoveddelen av den farmakodynamiske effekten; den sentrale målvirkningen er potent og selektiv hemming av serotonintransportøren (SERT)."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Legemidlet er godkjent ved alvorlige depressive episoder, panikklidelse og tvangslidelse, samt til profylakse ved tilbakevendende depressive episoder."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Et klinisk særtrekk er doseavhengig QT-forlengelse, som bidrar til at maksimal anbefalt dose er 40 mg/døgn og 20 mg/døgn hos blant annet eldre, ved nedsatt leverfunksjon og ved manglende CYP2C19-enzymaktivitet."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Halveringstiden er omtrent 36 timer, med betydelig interindividuell variasjon i steady-state-konsentrasjon; CYP2C19 er særlig viktig for variasjon i eksponering."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Brå eller rask seponering gir ofte et karakteristisk seponeringssyndrom, men citalopram er ikke forbundet med et klassisk addiksjonssyndrom."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object('panel','identitet','posisjon',0,'elementtype','riktekst','data',data,
      'referanser',jsonb_build_array(kilder->>'spc',kilder->>'cpic')),
    '{}'::jsonb,
    kilde
  );

  -- Farmakodynamikk: behold de eksisterende syv kortene, men gjør formuleringene
  -- kildebelagte og mindre absolutte.
  for x in select value from jsonb_array_elements($json$
  [
    {"nokkel":{"maal":"Serotoninreopptak / SERT"},"data":{"maal":"Serotoninreopptak / SERT","effekt":"Hemmer reopptak","mekanisme":"reopptakshemming","retning":"ned","kvalifikasjon":"Potent og selektiv","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram hemmer serotoninreopptak potent og selektivt. S-enantiomeren står for hoveddelen av den farmakodynamiske effekten; binding skjer med høy affinitet til SERTs primære bindingssete og med om lag 1000 ganger lavere affinitet til et allosterisk bindingssete."}]}]}}},
    {"nokkel":{"maal":"Noradrenalinreopptak / NET"},"data":{"maal":"Noradrenalinreopptak / NET","effekt":"Ingen eller svært liten effekt","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten effekt på noradrenalinreopptak ved klinisk relevant eksponering."}]}]}}},
    {"nokkel":{"maal":"Dopaminreopptak / DAT"},"data":{"maal":"Dopaminreopptak / DAT","effekt":"Ingen eller svært liten effekt","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten effekt på dopaminreopptak ved klinisk relevant eksponering."}]}]}}},
    {"nokkel":{"maal":"GABA-reopptak"},"data":{"maal":"GABA-reopptak","effekt":"Ingen eller svært liten effekt","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten effekt på GABA-reopptak."}]}]}}},
    {"nokkel":{"maal":"Muskarinreseptorer"},"data":{"maal":"Muskarinreseptorer","effekt":"Ingen eller svært liten affinitet","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten affinitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten affinitet til muskarine kolinerge reseptorer."}]}]}}},
    {"nokkel":{"maal":"Histaminreseptorer"},"data":{"maal":"Histaminreseptorer","effekt":"Ingen eller svært liten affinitet","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten affinitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten affinitet til histamin H1-reseptorer."}]}]}}},
    {"nokkel":{"maal":"Adrenerge reseptorer"},"data":{"maal":"Adrenerge reseptorer","effekt":"Ingen eller svært liten affinitet","mekanisme":"ingen_effekt","retning":"ingen","kvalifikasjon":"Svært liten affinitet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Citalopram har ingen eller svært liten affinitet til α1-, α2- og β-adrenerge reseptorer."}]}]}}}
  ]$json$::jsonb) loop
    obj := intern.kuratering_element(side,'farmakodynamikk','mekanismekort',x->'nokkel',1);
    perform intern.kuratering_lagre(obj,1,jsonb_build_object(
      'data',x->'data','referanser',jsonb_build_array(kilder->>'spc')
    ),kilde);
  end loop;

  -- Kliniske virkninger.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Antidepressiv effekt","tekst":"Citalopram har dokumentert akutt antidepressiv effekt ved alvorlig depressiv episode. I den store nettverksmeta-analysen av 522 randomiserte studier var citalopram blant antidepressivene som var mer effektive enn placebo på respons ved akutt behandling; forskjellene mellom aktive antidepressiver var gjennomgående mindre enn forskjellene mot placebo.","refs":["cipriani"]},
    {"posisjon":1,"tittel":"Effekt ved panikklidelse","tekst":"I en placebokontrollert studie med 475 randomiserte pasienter var citalopram generelt bedre enn placebo bortsett fra i laveste dosegruppe; 20–30 mg/døgn ga best samlet respons i langtidsforløpet. Preparatomtalen angir at maksimal effekt ved panikklidelse vanligvis oppnås etter omtrent tre måneder.","refs":["panic","spc"]},
    {"posisjon":2,"tittel":"Effekt ved tvangslidelse","tekst":"I en 12-ukers randomisert placebokontrollert studie med 401 pasienter var 20, 40 og 60 mg/døgn alle bedre enn placebo på Y-BOCS. Respons, definert som minst 25 % bedring, var 57,4 %, 52 % og 65 % ved henholdsvis 20, 40 og 60 mg, mot 36,6 % med placebo; dosene skilte seg ikke signifikant fra hverandre.","refs":["ocd"]},
    {"posisjon":3,"tittel":"Doseavhengig QT-forlengelse","tekst":"Citalopram forlenger QT-intervallet doseavhengig. I en placebokontrollert EKG-studie hos friske var gjennomsnittlig QTcF-endring fra baseline 7,5 ms (90 % KI 5,9–9,1) ved 20 mg/døgn og 16,7 ms (90 % KI 15,0–18,4) ved 60 mg/døgn. Denne effekten er klinisk viktig ved dosevalg, interaksjoner og forgiftning.","refs":["spc"]}
  ]$json$::jsonb) loop
    refs := '[]'::jsonb;
    for k in select value::text as nokkel from jsonb_array_elements_text(x->'refs') loop
      refs := refs || to_jsonb(kilder->>k.nokkel);
    end loop;
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object(
        'panel','virkninger','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',refs
      ),
      jsonb_build_object('tittel',x->>'tittel'),
      kilde
    );
  end loop;

  -- Indikasjon.
  obj := intern.kuratering_element(side,'indikasjon','riktekst','{}'::jsonb,1);
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Godkjente indikasjoner hos voksne er behandling av alvorlige depressive episoder, panikklidelse med eller uten agorafobi og tvangslidelse (OCD), samt profylakse ved tilbakevendende depressive episoder."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Citalopram bør ikke brukes hos barn og ungdom under 18 år etter preparatomtalen. Dette er en regulatorisk formulering og utelukker ikke at spesialiststyrt bruk kan forekomme utenfor godkjent indikasjon."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_lagre(obj,1,jsonb_build_object(
    'data',data,'referanser',jsonb_build_array(kilder->>'spc')
  ),kilde);

  -- Dosering.
  obj := intern.kuratering_element(side,'dosering','riktekst','{}'::jsonb,1);
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Depresjon: vanlig startdose 20 mg én gang daglig; ved behov kan dosen økes til maksimalt 40 mg/døgn. Etter remisjon anbefales vanligvis minst seks måneders behandling, og ved tilbakevendende episoder kan flere års profylakse være aktuelt."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Panikklidelse: 10 mg/døgn første uke, deretter 20 mg/døgn; ved behov kan dosen økes til maksimalt 40 mg/døgn. Tvangslidelse: start 20 mg/døgn, eventuelt økning til maksimalt 40 mg/døgn."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Eldre over 65 år: 10–20 mg/døgn, maksimalt 20 mg/døgn. Ved mild til moderat nedsatt leverfunksjon og ved kjent manglende CYP2C19-enzymaktivitet anbefales 10 mg/døgn de første to ukene og maksimalt 20 mg/døgn; alvorlig leversvikt krever særlig forsiktig titrering."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Lett til moderat nedsatt nyrefunksjon krever vanligvis ikke dosejustering; ved alvorlig nyresvikt er dokumentasjonen begrenset. Brå seponering bør unngås; dosen reduseres gradvis, og tempoet tilpasses symptomer og behandlingsvarighet."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_lagre(obj,1,jsonb_build_object(
    'data',data,'referanser',jsonb_build_array(kilder->>'spc',kilder->>'cpic')
  ),kilde);

  -- Farmakokinetikk.
  for x in select value from jsonb_array_elements($json$
  [
    {"tittel":"Biotilgjengelighet","tekst":"Citalopram absorberes nesten fullstendig og uavhengig av matinntak. Oral biotilgjengelighet er omtrent 80 %."},
    {"tittel":"tₘₐₓ","tekst":"Maksimal plasmakonsentrasjon nås etter omtrent 4 timer, med oppgitt intervall 1–6 timer."},
    {"tittel":"t½","tekst":"Terminal halveringstid er omtrent 36 timer, med oppgitt intervall 28–42 timer."},
    {"tittel":"tₛₛ","tekst":"Steady state oppnås vanligvis etter 1–2 uker. Ved samme dose kan steady-state-konsentrasjonen variere om lag firefold mellom personer."},
    {"tittel":"Proteinbinding","tekst":"Plasmaproteinbindingen er omtrent 80 % for citalopram og hovedmetabolittene."},
    {"tittel":"Vd","tekst":"Tilsynelatende distribusjonsvolum er omtrent 14 L/kg, med oppgitt intervall 12–17 L/kg."},
    {"tittel":"Eliminasjon","tekst":"Citalopram elimineres hovedsakelig ved hepatisk metabolisme. Omtrent 15 % av clearance er renal; rundt 12–23 % av døgndosen kan utskilles uendret i urin."},
    {"tittel":"CYP-enzymer (substrat)","tekst":"CYP2C19 er et sentralt enzym i N-demetyleringen, med bidrag fra CYP3A4 og CYP2D6. Desmetylcitalopram og didesmetylcitalopram er farmakologisk aktive, men mindre potente og selektive enn moderstoffet og anses ikke å bidra vesentlig til antidepressiv effekt."},
    {"tittel":"Interaksjoner","tekst":"Citalopram er en svak hemmer av CYP1A2, CYP2C19 og CYP2D6 og har ubetydelig hemming av CYP2C9, CYP2E1 og CYP3A4. CYP2C19-hemmere kan øke citaloprameksponeringen; omeprazol økte eksponeringen av S-citalopram med omtrent 50 % i en interaksjonsstudie. Legemiddelspesifikke interaksjoner vises i den automatiske interaksjonsseksjonen."}
  ]$json$::jsonb) loop
    obj := intern.kuratering_element(side,'farmakokinetikk','kinetikkort',
      jsonb_build_object('tittel',x->>'tittel'),1);
    perform intern.kuratering_lagre(obj,1,jsonb_build_object(
      'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
        'type','doc','content',jsonb_build_array(jsonb_build_object(
          'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
        ))
      )),
      'referanser',jsonb_build_array(kilder->>'spc')
    ),kilde);
  end loop;

  -- Farmakogenetikk: redaksjonell syntese ved siden av automatiske ClinPGx/CPIC-data.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"CYP2C19 og citaloprameksponering","tekst":"CYP2C19-genotype har klinisk relevant betydning for citaloprameksponering. Manglende enzymaktivitet gir høyere konsentrasjoner og økt bivirkningsrisiko; preparatomtalen beskriver omtrent doble plasmakonsentrasjoner av den aktive enantiomeren sammenlignet med rask omsetning. Ved økt enzymaktivitet kan konsentrasjonene bli lavere og sannsynligheten for effekt redusert."},
    {"posisjon":1,"tittel":"Når farmakogenetisk analyse er relevant","tekst":"CYP2C19-analyse er særlig relevant ved uventet høy eller lav serumkonsentrasjon, utilstrekkelig effekt eller bivirkninger ved vanlige doser, og når legemiddelinteraksjoner ikke forklarer funnet. CPIC anbefaler å vurdere et alternativ som ikke hovedsakelig metaboliseres av CYP2C19 ved økt eller manglende enzymaktivitet; ved manglende aktivitet kan langsommere titrering og om lag 50 % lavere vedlikeholdsdose brukes dersom citalopram velges. Data for SLC6A4 og HTR2A er ikke tilstrekkelige til klinisk styrt forskrivning."}
  ]$json$::jsonb) loop
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','farmakogenetikk','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',jsonb_build_array(kilder->>'cpic',kilder->>'spc')),
      jsonb_build_object('tittel',x->>'tittel'),
      kilde
    );
  end loop;

  -- TDM: OUSFARs norske 70–350 nmol/L beholdes urørt.
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object(
      'panel','tdm','posisjon',2,'elementtype','kinetikkort',
      'data',$json$
      {"tittel":"Konsentrasjon–effekt og internasjonal kontekst","dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"OUSFARs norske referanseområde 70–350 nmol/L skal brukes som lokalt referanseområde. AGNP oppgir et internasjonalt terapeutisk referanseområde på 50–110 ng/mL (omtrent 154–339 nmol/L), men dette er metodisk og konseptuelt et annet område og erstatter ikke det norske."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Dokumentasjonen for en skarp konsentrasjon–effekt- eller konsentrasjon–bivirkningsterskel er begrenset. TDM er derfor særlig nyttig ved spørsmål om etterlevelse, interaksjoner, særpopulasjoner, farmakogenetisk variasjon eller uventet respons/toksisitet, ikke som automatisk dosejustering mot ett universelt mål."}]}
      ]}}
      $json$::jsonb,
      'referanser',jsonb_build_array(kilder->>'agnp2026',kilder->>'tdmreview')
    ),
    '{"tittel":"Konsentrasjon–effekt og internasjonal kontekst"}'::jsonb,
    kilde
  );

  -- Toksisitet/forgiftning. De eksisterende serumgrensene 700 og 10 000 nmol/L
  -- i Viktige data beholdes og utdypes her, ikke erstattes.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Toksisk dose og eksponering","tekst":"Ved akutt peroralt inntak hos voksne gir under 600 mg som regel lette symptomer. Fra 600 mg foreligger risiko for hjertepåvirkning og kramper og Giftinformasjonen anbefaler sykehusvurdering; over 1000 mg kan kramper og hjertepåvirkning forventes. Samtidige serotonerge eller krampeterskelsenkende stoffer kan øke risikoen."},
    {"posisjon":1,"tittel":"Toksiske konsentrasjoner","tekst":"OUSFARs etablerte serumgrenser beholdes: ≥700 nmol/L er markert som toksisk område, og ≥10 000 nmol/L som omtrentlig nivå assosiert med komatøs/fatal forgiftning. Slike konsentrasjoner er støtteinformasjon, ikke universelle kliniske behandlingsgrenser; i akutt overdose har serumkonsentrasjonsmåling begrenset nytte."},
    {"posisjon":2,"tittel":"Klinisk forgiftningsbilde","tekst":"Lett forgiftning domineres av gastrointestinale symptomer, svimmelhet/ataksi, tremor, takykardi og somnolens. Ved moderat eller alvorlig forgiftning kan CNS-depresjon/koma, kramper, QTc-forlengelse, QRS-forlengelse og serotonergt syndrom forekomme."},
    {"posisjon":3,"tittel":"Alvorlige komplikasjoner","tekst":"De viktigste alvorlige komplikasjonene er kramper og kardial toksisitet med uttalt QTc-forlengelse, torsade de pointes og andre ventrikulære arytmier; sirkulasjonssvikt og hjertestans er beskrevet. Citalopram regnes som et av de mer toksiske SSRI-preparatene ved overdose."},
    {"posisjon":4,"tittel":"Toksikokinetiske særtrekk","tekst":"Symptomer opptrer vanligvis innen tiden til Cmax, omtrent 4 timer for vanlige tabletter, men kramper kan komme allerede etter 2–3 timer og EKG-forandringer kan debutere så sent som rundt 12 timer. CYP2C19-hemming eller manglende CYP2C19-enzymaktivitet kan øke eksponeringen."},
    {"posisjon":5,"tittel":"Behandling ved forgiftning","tekst":"Behandlingen er symptomatisk. Giftinformasjonen anbefaler vurdering av ventrikkelskylling og kull avhengig av dose, tidsforløp og aspirasjonsrisiko. Ved inntak over 600 mg eller forlenget QTc anbefales hjerteovervåkning i minst 12–24 timer eller til QTc er nær normalisert; kramper behandles med benzodiazepin, og uttalt QT-forlengelse/torsade håndteres med målrettet korreksjon av utløsende faktorer og magnesium etter forgiftningsanbefalingen."}
  ]$json$::jsonb) loop
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','toksisitet_forgiftning','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',jsonb_build_array(kilder->>'giftinfo',kilder->>'spc')),
      jsonb_build_object('tittel',x->>'tittel'),
      kilde
    );
  end loop;

  -- Graviditet, amming og reproduksjon.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Graviditet","tekst":"Store observasjonsmaterialer gir ikke grunnlag for å betrakte citalopram som et betydelig teratogen. En citalopramspesifikk meta-analyse fant OR 1,07 (95 % KI 0,98–1,17) for større misdannelser; signaler for hjertefeil har variert mellom analyser og svekkes når konfunderende faktorer og psykiatrisk grunnsykdom håndteres. Behovet for behandling må veies mot risikoen ved ubehandlet sykdom, og brå seponering under graviditet bør unngås.","refs":["pregmeta","janusfoster","spc"]},
    {"posisjon":1,"tittel":"Perinatal og neonatal påvirkning","tekst":"Eksponering sent i svangerskapet kan gi forbigående neonatal adaptasjons-/seponeringssymptomer som respirasjonsforstyrrelser, tremor, tonusforandringer, irritabilitet, matingsvansker og hypoglykemi. SSRI sent i svangerskapet er også assosiert med en liten absolutt økning i risiko for vedvarende pulmonal hypertensjon hos nyfødte, og eksponering siste måned før fødsel er knyttet til mindre enn dobling av risiko for postpartumblødning.","refs":["spc","janusfoster"]},
    {"posisjon":2,"tittel":"Amming","tekst":"Citalopram går over i morsmelk. Janusmed vurderer risikoen for et friskt fullgått barn som lav ved terapeutiske doser, mens LactMed oppgir at citalopram kan måles i serum hos enkelte barn og beskriver sporadiske mindre symptomer som døsighet eller uro. Preparatomtalen anslår omtrent 5 % av maternell vektjustert dose; publiserte serier viser betydelig variasjon. Hvis citalopram er nødvendig hos mor, er dette i seg selv ikke grunn til å avslutte amming, men barnet bør følges for sedasjon/uro, matinntak og vektutvikling.","refs":["janusamning","lactmed","spc"]},
    {"posisjon":3,"tittel":"Fertilitet og reproduksjon","tekst":"Dyrestudier har vist redusert fertilitets-/drektighetsindeks og påvirket sædkvalitet ved eksponering over human eksponering. Hos mennesker er reversibel påvirkning av sædkvalitet rapportert for enkelte SSRI, men preparatomtalen angir at effekt på human fertilitet så langt ikke er påvist. Evidensen for en citalopramspesifikk klinisk fertilitetseffekt er begrenset.","refs":["spc"]}
  ]$json$::jsonb) loop
    refs := '[]'::jsonb;
    for k in select value::text as nokkel from jsonb_array_elements_text(x->'refs') loop
      refs := refs || to_jsonb(kilder->>k.nokkel);
    end loop;
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','graviditet_amming','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',refs),
      jsonb_build_object('tittel',x->>'tittel'),
      kilde
    );
  end loop;

  -- Toleranse, seponering og addiksjon.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Toleranseutvikling","tekst":"Preparatomtalen angir at langvarig behandling ikke induserer toleranse for den hemmende effekten på serotoninreopptak. Dette utelukker ikke at klinisk effekt eller bivirkninger kan endre seg over tid, men det finnes ikke et etablert mønster med farmakodynamisk toleranse som krever kontinuerlig doseeskalering."},
    {"posisjon":1,"tittel":"Abstinens, seponeringssyndrom og rebound-effekter","tekst":"Seponeringssymptomer er vanlige, særlig ved brå avslutning. I en tilbakefallsforebyggende studie ble bivirkninger etter seponering sett hos 40 % etter avsluttet aktiv behandling mot 20 % hos dem som fortsatte. Typiske symptomer er svimmelhet, parestesier, søvnforstyrrelser, angst/agitasjon, kvalme, tremor, hodepine og emosjonell ustabilitet. De oppstår oftest de første dagene og går vanligvis over innen omtrent to uker, men kan hos noen vare i måneder; nedtrapping bør derfor individualiseres."},
    {"posisjon":2,"tittel":"Addiksjon","tekst":"Citalopram gir ikke rusvirkning eller et typisk mønster av craving, kontrolltap og tvangsmessig bruk, og regnes ikke som et addiktivt legemiddel. Et seponeringssyndrom etter fysiologisk tilpasning skal ikke i seg selv tolkes som addiksjon."}
  ]$json$::jsonb) loop
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','avhengighet_toleranse','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',jsonb_build_array(kilder->>'spc')),
      jsonb_build_object('tittel',x->>'tittel'),
      kilde
    );
  end loop;
end
$kuratering$;
