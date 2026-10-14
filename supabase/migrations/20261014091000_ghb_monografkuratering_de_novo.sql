-- Full de novo-kuratering av GHB for køoppgave ghb-0001.
-- Blind evidensprotokoll ble låst før eksisterende innhold og referanser ble åpnet.

do $ghb_de_novo$
declare
  side uuid := intern.kuratering_start('ghb');
  kilde constant text := 'GHB de novo-pilot 14.10.2026: uavhengig evidens og adversarial kontroll';
  obj uuid;
  ref uuid;
  k record;
  x jsonb;
  kilder jsonb := '{}'::jsonb;
  refs jsonb;
  data jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'identitet', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'viktige_data', 'halveringstid', 0);
  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 0);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'indikasjon', 'riktekst', 1);
  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'farmakokinetikk', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'interaksjoner', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 0);

  create temporary table ghb_kilder(
    nokkel text primary key, tittel text, forfattere text, aar text, lenke text
  ) on commit drop;

  insert into ghb_kilder values
    ('spc','Xyrem – preparatomtale (SPC)','European Medicines Agency','2025','https://www.ema.europa.eu/no/documents/product-information/xyrem-epar-product-information_no.pdf'),
    ('oxiore','Oxiore – preparatomtale (SPC)','Direktoratet for medisinske produkter','2025','https://produktinformasjon.legemiddelsok.no/preparatomtaler/19-12925.pdf'),
    ('kalceks','Natriumoksybat Kalceks – preparatomtale (SPC)','Direktoratet for medisinske produkter','2024','https://produktinformasjon.legemiddelsok.no/preparatomtaler/18-12473.pdf'),
    ('giftinfo','GHB – behandlingsanbefaling ved forgiftning','Giftinformasjonen / Helsebiblioteket','2017','https://www.helsebiblioteket.no/forgiftninger/rusmidler/ghb-behandlingsanbefaling-ved-forgiftning'),
    ('review2021','γ-Hydroxybutyric Acid: Pharmacokinetics, Pharmacodynamics, and Toxicology','Melanie A Felmlee, Bridget L Morse, Marilyn E Morris','2021','https://pubmed.ncbi.nlm.nih.gov/33417072/'),
    ('liechti','Pharmacokinetics and pharmacodynamics of γ-hydroxybutyrate in healthy subjects','Matthias E Liechti, Boris B Quednow, Evangelia Liakoni, Dario Dornbierer, Robin von Rotz, Maria Salomé Gachet, Jürg Gertsch, Erich Seifritz, Oliver G Bosch','2016','https://pubmed.ncbi.nlm.nih.gov/26659543/'),
    ('meta','Sodium oxybate for narcolepsy with cataplexy: systematic review and meta-analysis','Mashael K Alshaikh, Andrea C Tricco, Mariam Tashkandi, Muhammad Mamdani, Sharon E Straus, Ahmed S BaHammam','2012','https://pubmed.ncbi.nlm.nih.gov/22893778/'),
    ('toxprospektiv','Gamma-hydroxybutyrate serum levels and clinical syndrome after severe overdose','Karl A Sporer, Rachel L Chin, Jo Ellen Dyer, Ryan Lamb','2003','https://pubmed.ncbi.nlm.nih.gov/12827115/'),
    ('toxswiss','Presentations to an urban emergency department in Switzerland due to acute γ-hydroxybutyrate toxicity','Evangelia Liakoni, Fabio Walther, Christian H Nickel, Matthias E Liechti','2016','https://pubmed.ncbi.nlm.nih.gov/27581664/'),
    ('forensic','Interpreting γ-hydroxybutyrate concentrations for clinical and forensic purposes','Francesco Paolo Busardò, Alan Wayne Jones','2019','https://pubmed.ncbi.nlm.nih.gov/30307336/'),
    ('withdrawal','Clinical features and management of gamma-hydroxybutyrate (GHB) withdrawal: a review','Michael McDonough, Noel Kennedy, Anthony Glasper, Jenny Bearn','2004','https://pubmed.ncbi.nlm.nih.gov/15225884/'),
    ('dependence','Pharmacological Treatment in γ-Hydroxybutyrate (GHB) and γ-Butyrolactone (GBL) Dependence: Detoxification and Relapse Prevention','Rama M Kamal, Martijn S van Noorden, Wim Wannet, Harmen Beurmanjer, Boukje A G Dijkstra, Arnt Schellekens','2017','https://pubmed.ncbi.nlm.nih.gov/28004314/'),
    ('lactmed','Oxybate Salts','Drugs and Lactation Database (LactMed)','2026','https://www.ncbi.nlm.nih.gov/books/NBK500802/'),
    ('audmeta','Long-term Efficacy and Safety of Sodium Oxybate in Treating Alcohol Use Disorder: A Systematic Review and Meta-Analysis','Letizia Biso, Andrea Spini, Francesco Petragnano, Roberto Maggio, Marco Scarselli, Marco Carli','2025','https://pubmed.ncbi.nlm.nih.gov/39225220/');

  for k in select * from ghb_kilder order by nokkel loop
    ref := intern.kuratering_referanse(
      jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke),
      kilde
    );
    kilder := kilder || jsonb_build_object(k.nokkel, ref::text);
  end loop;

  -- Oppsummering.
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"GHB (4-hydroksybutansyre) er et endogent stoff og et korttidsvirkende sentralnervøst dempende middel. Natriumoksybat er natriumsaltet som brukes som legemiddel; kliniske effekter ved eksogen dose formidles hovedsakelig gjennom GABA-B-reseptorer."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Natriumoksybat er godkjent ved narkolepsi med katapleksi. Virkningen omfatter mindre katapleksi og søvnighet på dagtid og endret søvnarkitektur, men den nøyaktige kliniske mekanismen er ikke fullt avklart."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Stoffet har rask absorpsjon, kort halveringstid og ikke-lineær eksponering. Marginen mellom rus, dyp bevisstløshet og respirasjonsdepresjon er liten, og alkohol eller andre CNS-depressiva øker risikoen."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Hyppig gjentatt høydosebruk kan gi toleranse, avhengighet og et raskt innsettende, potensielt livstruende abstinenssyndrom. Dette må skilles fra forskrevet, overvåket nattlig behandling."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object('panel','identitet','posisjon',0,'elementtype','riktekst','data',data,
      'referanser',jsonb_build_array(kilder->>'spc',kilder->>'review2021',kilder->>'giftinfo',kilder->>'withdrawal')),
    '{}'::jsonb, kilde
  );

  -- Strukturert halveringstid; ingen terapeutisk serumgrense eller steady-state-verdi konstrueres.
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object('panel','viktige_data','posisjon',3,'elementtype','halveringstid',
      'data','{"former":[{"form":"","typisk":0.75,"min":0.5,"maks":1,"enhet":"timer"}]}'::jsonb,
      'referanser',jsonb_build_array(kilder->>'spc',kilder->>'liechti')),
    '{}'::jsonb, kilde
  );

  -- Hovedmekanismen; reseptorens kliniske rolle uttrykkes med moderat sikkerhet.
  data := $json$
  {"maal":"GABA-B-reseptoren","effekt":"Agonist","mekanisme":"agonisme","retning":"opp","kvalifikasjon":"Hovedmekanisme ved eksogen dose","dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"GHB virker hovedsakelig som agonist ved GABA-B-reseptorer ved eksogen eksponering. Egne høyaffine GHB-bindingssteder er beskrevet, men deres bidrag til kliniske effekter er fortsatt uklart; den terapeutiske effekten på narkolepsi kan derfor ikke reduseres til én fullt avklart molekylær mekanisme."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_nytt(
    side,
    jsonb_build_object('panel','farmakodynamikk','posisjon',0,'elementtype','mekanismekort','data',data,
      'referanser',jsonb_build_array(kilder->>'review2021',kilder->>'spc')),
    '{"maal":"GABA-B-reseptoren"}'::jsonb, kilde
  );

  -- Kvantitativ klinisk effekt og human dose-respons.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Narkolepsi med katapleksi","tekst":"Seks industrifinansierte randomiserte studier inngikk i meta-analysen, men endepunktene bygget på ulike delmengder: 9 g natriumoksybat per natt reduserte ukentlige katapleksianfall med gjennomsnittlig 8,5 sammenlignet med placebo (2 studier; 95 % KI 1,6–15,3 færre), økte Maintenance of Wakefulness Test med 5,18 minutter (2 studier; 2,59–7,78) og ga klinisk global bedring med RR 2,42 (3 studier; 1,77–3,32). Kvalme, oppkast og svimmelhet var vanligere. Estimatene gjelder delt nattlig dosering og må tolkes i lys av industrifinansiering og selekterte studiepopulasjoner.","refs":["meta"]},
    {"posisjon":1,"tittel":"Doseavhengige akutte effekter","tekst":"I en kontrollert studie hos 32 friske menn ga 20 og 35 mg/kg både stimulerende og sederende subjektive effekter; sedasjon og svimmelhet økte med dosen. Cmax i plasma var 218 (176–270) og 453 (374–549) µmol/L ved henholdsvis 20 og 35 mg/kg, med median tmax 35 minutter, mens halveringstiden var 36 ± 9 og 39 ± 7 minutter. Plasmakonsentrasjonene skal ikke brukes som serumreferanseområde eller forgiftningsterskel.","refs":["liechti"]}
  ]$json$::jsonb) loop
    refs := '[]'::jsonb;
    for k in select value::text as nokkel from jsonb_array_elements_text(x->'refs') loop
      refs := refs || to_jsonb(kilder->>k.nokkel);
    end loop;
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','virkninger','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',refs),
      jsonb_build_object('tittel',x->>'tittel'), kilde
    );
  end loop;

  -- Eksisterende indikasjon beholdes i sak, men erstattes med primær regulatorisk kilde og evidensavgrensning.
  obj := intern.kuratering_element(side,'indikasjon','riktekst','{}'::jsonb,1);
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Natriumoksybat er godkjent til behandling av narkolepsi med katapleksi. Xyrem og Oxiore omfatter voksne, ungdom og barn fra 7 år; Natriumoksybat Kalceks er godkjent for voksne."}]},
    {"type":"paragraph","content":[{"type":"text","text":"GHB/natriumoksybat er undersøkt ved alkoholbrukslidelse og brukes regulatorisk i enkelte land, men dette er ikke norsk godkjent indikasjon. En systematisk oversikt fra 2024 fant ikke sikker overlegenhet mot placebo for langvarig abstinens; slik bruk bør derfor ikke fremstilles som etablert OUSFAR-indikasjon."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_lagre(obj,1,jsonb_build_object(
    'data',data,'referanser',jsonb_build_array(kilder->>'spc',kilder->>'oxiore',kilder->>'kalceks',kilder->>'audmeta')
  ),kilde);

  -- Dosering.
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Voksne: start 4,5 g per natt fordelt på 2,25 g ved sengetid og 2,25 g 2,5–4 timer senere. Dosen kan justeres med 1,5 g per natt med minst 1–2 ukers intervall til effekt og tolerabilitet; maksimum er 9 g per natt."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Mat reduserer opptaket betydelig. Første dose tas 2–3 timer etter mat, og intervallet mellom mat og dose bør være stabilt. Begge dosene klargjøres ved sengetid."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved nedsatt leverfunksjon halveres startdosen. Ved samtidig valproat anbefaler preparatomtalen omtrent 20 % dosereduksjon og tett oppfølging. Nyresvikt krever vurdering av natriuminntaket, ikke en etablert farmakokinetisk dosereduksjon."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Barn fra 7 år og minst 15 kg doseres etter kroppsvekt. Ved 15 til <20 kg er startdosen høyst 1 g/dag, økning høyst 0,5 g/dag per uke og maksimal dose 0,2 g/kg/dag. Ved 20 til <30 kg er tilsvarende grenser 2 g/dag, 1 g/dag per uke og 0,2 g/kg/dag; ved 30 til <45 kg 3 g/dag, 1 g/dag per uke og 0,2 g/kg/dag; og ved ≥45 kg 4,5 g/dag, 1,5 g/dag per uke og 9 g/dag. Døgndosen deles i to doser ved sengetid og 2,5–4 timer senere, og det bør gå 1–2 uker mellom doseøkningene. Sikkerhet og effekt er ikke fastslått under 7 år eller under 15 kg. Hvis behandlingen har vært avbrutt i mer enn 14 dager, startes titreringen på nytt fra laveste dose."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_nytt(
    side,jsonb_build_object('panel','dosering','posisjon',0,'elementtype','riktekst','data',data,
      'referanser',jsonb_build_array(kilder->>'spc',kilder->>'oxiore',kilder->>'kalceks')),
    '{}'::jsonb,kilde
  );

  -- Farmakokinetikk.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Biotilgjengelighet og mat","tekst":"Oral biotilgjengelighet er omtrent 88 %. Et fettrikt måltid forsinket median Tmax fra 0,75 til 2 timer og reduserte Cmax med 58 % og AUC med 37 %."},
    {"posisjon":1,"tittel":"tₘₐₓ","tekst":"Maksimal plasmakonsentrasjon nås vanligvis etter 0,5–2 timer i fastende tilstand."},
    {"posisjon":2,"tittel":"t½","tekst":"Terminal halveringstid er omtrent 0,5–1 time. I en kontrollert studie var den 36 ± 9 og 39 ± 7 minutter etter 20 og 35 mg/kg."},
    {"posisjon":3,"tittel":"Ikke-lineær eksponering","tekst":"Eksponeringen er mer enn doseproporsjonal. Når total nattdose ble doblet fra 4,5 til 9 g, økte AUC omtrent 3,8 ganger. Gjentatt dosering endret ikke farmakokinetikken vesentlig."},
    {"posisjon":4,"tittel":"Distribusjon og proteinbinding","tekst":"Tilsynelatende distribusjonsvolum er omtrent 190–384 ml/kg, og plasmaproteinbindingen er under 1 %."},
    {"posisjon":5,"tittel":"Metabolisme","tekst":"GHB metaboliseres hovedsakelig via suksinsemialdehyd til intermediater i sitronsyresyklusen og videre til karbondioksid og vann. Det er ikke identifisert farmakologisk aktive metabolitter, og klinisk relevant CYP-hemming er ikke vist in vitro."},
    {"posisjon":6,"tittel":"Eliminasjon og leverfunksjon","tekst":"Under 5 % utskilles uendret i urin. Ved levercirrhose var AUC omtrent doblet; halveringstiden økte fra omtrent 22 minutter hos friske til 32–59 minutter, avhengig av cirrhosetype."}
  ]$json$::jsonb) loop
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','farmakokinetikk','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',x->>'tekst'))
          ))
        )),
        'referanser',jsonb_build_array(kilder->>'spc',kilder->>'liechti')),
      jsonb_build_object('tittel',x->>'tittel'),kilde
    );
  end loop;

  -- Redaksjonell interaksjonsramme; konkrete legemiddelpar beholdes i FEST-laget.
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Oxiore er kontraindisert ved alvorlig depresjon, suksinsemialdehyddehydrogenasemangel og samtidig behandling med opioider eller barbiturater. Alkohol, benzodiazepiner, hypnotika og andre CNS-depressiva kan forsterke sedasjon og respirasjonsdepresjon; kombinasjon med alkohol skal unngås."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Valproat 1250 mg/døgn økte GHB-AUC omtrent 25 % uten vesentlig endring i Cmax og forsterket kognitiv svekkelse og søvnighet. Koma og økt GHB-konsentrasjon er rapportert ved samtidig topiramat. De konkrete interaksjonene nedenfor hentes automatisk fra FEST."}]}
  ]}}
  $json$::jsonb;
  perform intern.kuratering_nytt(
    side,jsonb_build_object('panel','interaksjoner','posisjon',0,'elementtype','riktekst','data',data,
      'referanser',jsonb_build_array(kilder->>'spc')),
    '{}'::jsonb,kilde
  );

  -- Toksisitet og forgiftning.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Toksisk dose og eksponering","tekst":"Omtrent 50 mg/kg gir vanligvis koma, men styrken i illegale blandinger er ofte ukjent og marginen mellom ønsket rus og alvorlig forgiftning er liten. Alkohol og andre rus-/legemidler kan øke toksisiteten. Dose alene kan ikke forutsi forløpet.","refs":["giftinfo"]},
    {"posisjon":1,"tittel":"Toksiske konsentrasjoner","tekst":"I en prospektiv serie med 16 alvorlige forgiftninger (GCS ≤8) var serumkonsentrasjonen 45–295 mg/L, median 180 mg/L, uten sammenheng med komadybde eller oppvåkningstid. En sveitsisk serie fant 8,3–373 mg/L blant målte tilfeller. Dødelige og overlevde konsentrasjoner overlapper betydelig; nivået er derfor ikke en universell prognostisk eller terapeutisk terskel.","refs":["toxprospektiv","toxswiss","forensic"]},
    {"posisjon":2,"tittel":"Klinisk forgiftningsbilde","tekst":"Typisk sees raskt innsettende bevissthetsreduksjon, ofte dyp koma (GCS 3), med fluktuerende uro, myoklonier, oppkast og fare for aspirasjon. Bradykardi, hypotensjon, hypotermi og respirasjonsdepresjon kan forekomme. Mange våkner brått og blir raskt klare etter 2–4 timer; forløp over 4–6 timer er uvanlig uten komplikasjoner eller andre stoffer.","refs":["giftinfo","toxprospektiv"]},
    {"posisjon":3,"tittel":"Alvorlige komplikasjoner","tekst":"De viktigste komplikasjonene er apné eller annen respirasjonsdepresjon, aspirasjon, sirkulasjonspåvirkning og traumer. Kramper er sjeldne og myoklonier kan mistolkes som epileptiske anfall. Blandingsinntak kan forlenge og forverre forløpet.","refs":["giftinfo"]},
    {"posisjon":4,"tittel":"Toksikokinetiske særtrekk","tekst":"Rask absorpsjon og kort halveringstid forklarer både det hurtige komainntredet og den ofte plutselige oppvåkningen. Metningsbar absorpsjon, metabolisme og renal transport gir ikke-lineær kinetikk; enkeltmålinger tatt sent kan være lave selv etter alvorlig forgiftning.","refs":["review2021","giftinfo"]},
    {"posisjon":5,"tittel":"Behandling ved forgiftning","tekst":"Behandlingen er støttebehandling med særlig oppmerksomhet på frie luftveier, ventilasjon, aspirasjonsfare og sirkulasjon. Kull og ventrikkelskylling er nesten aldri indisert. Atropin kan brukes ved behandlingskrevende bradykardi, og benzodiazepin ved reelle kramper eller uttalt agitasjon. Serumkonsentrasjon styrer ikke behandlingen; symptomfrie pasienter observeres etter nasjonal anbefaling.","refs":["giftinfo"]}
  ]$json$::jsonb) loop
    refs := '[]'::jsonb;
    for k in select value::text as nokkel from jsonb_array_elements_text(x->'refs') loop
      refs := refs || to_jsonb(kilder->>k.nokkel);
    end loop;
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','toksisitet_forgiftning','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(
              jsonb_build_object('type','text','text',x->>'tekst'),
              jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',refs))
            )
          ))
        )),
        'referanser',refs),
      jsonb_build_object('tittel',x->>'tittel'),kilde
    );
  end loop;

  -- Graviditet, amming og reproduksjon. Perinatalkortet utelates fordi humandata er utilstrekkelige.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Graviditet","tekst":"Humane data er svært begrensede. Preparatomtalen beskriver et mulig signal om spontanabort etter første trimester-eksponering, men uten tilstrekkelige epidemiologiske data, og anbefaler ikke natriumoksybat under graviditet. Begrensede data fra andre og tredje trimester har ikke vist et klart misdannelses- eller føto-/neonatalt signal; fravær av signal er ikke dokumentasjon på sikkerhet.","refs":["spc"]},
    {"posisjon":2,"tittel":"Amming","tekst":"GHB finnes endogent i morsmelk og konsentrasjonen øker etter natriumoksybat. Preparatomtalen fraråder bruk under amming og beskriver rapporterte endringer i spedbarns søvnmønster. LactMed bygger på få kasuistikker uten påvist utviklingsskade og foreslår ved nødvendig behandling å unngå amming fra første nattdose til 4–6 timer etter andre dose, med observasjon av sedasjon, matinntak og vekt. Dette er begrenset klinisk erfaring, ikke dokumentert sikkerhet, og krever individuell ekspertvurdering.","refs":["spc","lactmed"]},
    {"posisjon":3,"tittel":"Fertilitet og reproduksjon","tekst":"Det finnes ingen kliniske data om fertilitet hos mennesker. I rotter ga GHB opptil 1000 mg/kg/dag ingen påvist negativ effekt på fertilitet; prekliniske funn kan ikke utelukke menneskelig risiko.","refs":["spc"]}
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
            'type','paragraph','content',jsonb_build_array(
              jsonb_build_object('type','text','text',x->>'tekst'),
              jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',refs))
            )
          ))
        )),
        'referanser',refs),
      jsonb_build_object('tittel',x->>'tittel'),kilde
    );
  end loop;

  -- Toleranse, abstinens og addiksjon. Lært mestringsavhengighet står bevisst tomt.
  for x in select value from jsonb_array_elements($json$
  [
    {"posisjon":0,"tittel":"Toleranseutvikling","tekst":"Ved regelmessig, hyppig rusbruk kan toleranse utvikles i løpet av uker og bidra til kortere doseintervaller og økende døgndoser. Kliniske studier ved forskrevet natriumoksybat har ikke vist et tilsvarende tydelig mønster, men de utelukker ikke risiko. Terapeutisk bruk og døgnkontinuerlig høydosebruk må derfor holdes atskilt.","refs":["review2021","dependence","spc"]},
    {"posisjon":1,"tittel":"Abstinens, seponeringssyndrom og rebound-effekter","tekst":"Etter tett, langvarig bruk kan abstinens begynne 3–6 timer etter siste dose med insomni, angst, tremor, svetting, takykardi og hypertensjon. Hallusinasjoner, psykose, uttalt agitasjon, delirium og kramper kan utvikles; i en gjennomgang av 38 kasuistikker fikk 53 % delirium, særlig ved svært hyppig dosering. Alvorlig abstinens er potensielt livstruende og bør håndteres i spesialisthelsetjenesten. Ved terapeutisk seponering kan katapleksi komme tilbake og sjeldne psykiske/seponeringssymptomer er rapportert.","refs":["withdrawal","giftinfo","spc"]},
    {"posisjon":2,"tittel":"Addiksjon","tekst":"GHB har kjent misbruks- og avhengighetspotensial. Hyppig gjentatt bruk, ofte av GHB/GBL gjennom døgnet, kan gi kontrolltap, fortsatt bruk til tross for skade og fysisk avhengighet. Preparatomtalen beskriver illegale døgndoser på 18–250 g i avhengighetsrapporter. Lav rapportert forekomst ved forskrevet natriumoksybat bygger i stor grad på kliniske programmer og spontanrapportering og kan ikke brukes til å avvise risiko hos enkeltpasienter.","refs":["dependence","review2021","spc"]}
  ]$json$::jsonb) loop
    refs := '[]'::jsonb;
    for k in select value::text as nokkel from jsonb_array_elements_text(x->'refs') loop
      refs := refs || to_jsonb(kilder->>k.nokkel);
    end loop;
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object('panel','avhengighet_toleranse','posisjon',(x->>'posisjon')::int,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',x->>'tittel','dokument',jsonb_build_object(
          'type','doc','content',jsonb_build_array(jsonb_build_object(
            'type','paragraph','content',jsonb_build_array(
              jsonb_build_object('type','text','text',x->>'tekst'),
              jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',refs))
            )
          ))
        )),
        'referanser',refs),
      jsonb_build_object('tittel',x->>'tittel'),kilde
    );
  end loop;

  perform intern.kuratering_rapport(
    'chatgpt-monografkurator',
    '20261014091000_ghb_monografkuratering_de_novo.sql',
    $rapport$
    {
      "oppsummering": "GHB er fullstendig de novo-kuratert med regulatorisk indikasjon og dosering, kvantitativ effekt og PK, norsk forgiftningsbehandling, reproduksjon og tydelig skille mellom terapeutisk bruk og avhengighet.",
      "seksjoner": [
        {"seksjon":"identitet","nytt":["Ny oppsummering av GHB og natriumoksybat"]},
        {"seksjon":"viktige_data","nytt":["Strukturert halveringstid"]},
        {"seksjon":"farmakodynamikk","nytt":["GABA-B-agonisme med mekanistisk usikkerhet"]},
        {"seksjon":"virkninger","nytt":["Kvantitativ narkolepsieffekt og kontrollert human dose-respons"]},
        {"seksjon":"indikasjon","endret":["Primærkilder og avgrensning mot alkoholbrukslidelse"]},
        {"seksjon":"dosering","nytt":["Voksen-, barne-, lever-, mat- og valproatdosering"]},
        {"seksjon":"farmakokinetikk","nytt":["Syv kort for absorpsjon, ikke-linearitet, distribusjon, metabolisme og eliminasjon"]},
        {"seksjon":"interaksjoner","nytt":["CNS-depressiva, valproat og topiramat"]},
        {"seksjon":"toksisitet_forgiftning","nytt":["Seks kort fra Giftinformasjonen og originalserier"]},
        {"seksjon":"graviditet_amming","nytt":["Graviditet, amming og fertilitet"]},
        {"seksjon":"avhengighet_toleranse","nytt":["Toleranse, abstinens og addiksjon"]}
      ],
      "nye_opplysninger": [
        "Effekt ved narkolepsi og human PK/PD er kvantifisert",
        "Toksiske konsentrasjoner presenteres som overlappende observasjoner uten universell terskel",
        "Regulatorisk ammeråd og begrenset LactMed-erfaring er synliggjort som kildekonflikt"
      ],
      "korrigeringer": [
        "Felleskatalogreferanser på indikasjonen er erstattet av gjeldende DMP- og EMA-originaler",
        "Alkoholbrukslidelse er eksplisitt avgrenset fra norsk godkjent indikasjon"
      ],
      "kildegrunnlag": [
        "Tre aktuelle preparatomtaler, Giftinformasjonen, LactMed, to systematiske oversikter og målrettede originalstudier",
        "Blind evidensprotokoll og adversarial kontroll ble låst før gammel monografi ble åpnet"
      ],
      "mangler": [
        "Ingen robust terapeutisk serumgrense, universell toksisk konsentrasjon eller klinisk dose-serumtabell",
        "Humane graviditets-, perinatal- og fertilitetsdata er svært begrensede",
        "Ingen handlingsrettet farmakogenetisk anbefaling eller selvstendig evidens for lært mestringsavhengighet"
      ],
      "lenker": ["https://github.com/peohol/far/pull/228"]
    }
    $rapport$::jsonb);
end
$ghb_de_novo$;
